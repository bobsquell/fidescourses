'use strict';
const config = require('./config');
const { devinerType } = require('./classification');

/* ---------------------------------------------------------------------------
   Recherche d'un produit à partir de son code-barres, par sources successives.

   Chaque source a son propre format de réponse, donc son propre adaptateur.
   Les fonctions d'analyse sont pures (elles prennent la réponse brute et
   renvoient un produit) afin d'être testables sans réseau.
--------------------------------------------------------------------------- */

const tronquer = (s, n = 60) => String(s || '').trim().slice(0, n);

/** Colle la marque au nom quand elle n'y est pas déjà (pas de colonne Marque). */
function avecMarque(nom, marque) {
  if (!marque) return nom;
  return nom.toLowerCase().includes(marque.toLowerCase()) ? nom : `${nom} ${marque}`;
}

/* ---------- Open Food / Beauty / Products Facts ---------- */

function analyserOpenFacts(data, source) {
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const nom = (p.product_name_fr || p.product_name || '').trim();
  if (!nom) return null;

  const tags = p.categories_tags && p.categories_tags.length
    ? p.categories_tags
    : String(p.categories || '').split(',').map(c => c.trim()).filter(Boolean);

  const article = avecMarque(nom, (p.brands || '').split(',')[0].trim());
  const devine = devinerType(tags, article, source.nom);

  return {
    article: tronquer(article),
    type_produit: devine.type,
    motif: devine.motif,
    tags,
    source: source.nom,
    base: source.libelle,
    provisoire: false,
  };
}

/* ---------- UPCitemdb (plan gratuit, sans inscription) ---------- */

function analyserUpcitemdb(data, source) {
  if (!data || data.code !== 'OK' || !Array.isArray(data.items) || !data.items.length) return null;
  const item = data.items[0];
  const nom = (item.title || '').trim();
  if (!nom) return null;

  const article = avecMarque(nom, (item.brand || '').trim());
  // La catégorie est un chemin « Health & Beauty > Personal Care > Deodorant ».
  // Ce n'est pas la taxonomie Open Facts : on la traite comme du texte.
  const categorie = String(item.category || '').replace(/>/g, ' ');
  const devine = devinerType([], `${article} ${categorie}`, null);

  return {
    article: tronquer(article),
    type_produit: devine.type,
    motif: devine.motif || (categorie.trim() ? `catégorie : ${categorie.trim()}` : null),
    tags: categorie.trim() ? [categorie.trim()] : [],
    source: source.nom,
    base: source.libelle,
    provisoire: false,
  };
}

/* ---------- Recherche web, dernier recours ---------- */

const ENTITES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#x27;': "'" };
const decoder = s => String(s).replace(/&[a-z#0-9]+;/gi, e => ENTITES[e] || e);
const sansBalises = s => decoder(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

/* Les titres de pages marchandes sont bruyants : on retire le code-barres, le
   nom du site après un séparateur, et le bruit commercial le plus fréquent. */
function nettoyerTitre(titre, code) {
  let t = sansBalises(titre)
    .replace(new RegExp(code, 'g'), '')
    .split(/\s[|–—]\s|\s-\s(?=[A-Z][a-z]+\.(com|fr))/)[0]
    .replace(/\b(achat|vente|pas cher|livraison gratuite|prix|en ligne|neuf|occasion|buy|online|sale|free shipping)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '')
    .trim();
  return t.length >= 3 ? t : null;
}

function analyserRechercheWeb(html, code, source) {
  // Résultats DuckDuckGo en version HTML légère.
  const titres = [];
  const motif = /class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = motif.exec(html)) && titres.length < 5) {
    const t = nettoyerTitre(m[1], code);
    if (t) titres.push(t);
  }
  if (!titres.length) return null;

  // Le titre le plus court est en général le moins pollué par le vendeur.
  const article = titres.slice().sort((a, b) => a.length - b.length)[0];
  const devine = devinerType([], titres.join(' '), null);

  return {
    article: tronquer(article),
    type_produit: devine.type,
    motif: devine.motif || 'titre de page web',
    tags: titres,
    source: source.nom,
    base: source.libelle,
    provisoire: true,       // nom deviné à partir d'une page marchande : à vérifier
  };
}

/* ---------- appel réseau ---------- */

/* Renvoie { donnees } ou { erreur }. La distinction compte : un produit absent
   et une source injoignable donnaient jusqu'ici le même résultat vide, ce qui
   rendait impossible de savoir si le réseau était en cause. */
async function recuperer(url, { json = true, timeoutMs }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const rep = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'InventaireCroise/1.0 (usage personnel)',
        Accept: json ? 'application/json' : 'text/html',
      },
    });
    if (!rep.ok) {
      return { erreur: rep.status === 429 ? 'quota atteint' : `HTTP ${rep.status}` };
    }
    return { donnees: json ? await rep.json() : await rep.text() };
  } catch (err) {
    return { erreur: err.name === 'AbortError' ? 'délai dépassé' : `réseau : ${err.message}` };
  } finally {
    clearTimeout(t);
  }
}

async function interroger(source, code, timeoutMs) {
  const encode = encodeURIComponent(code);
  let reponse, produit = null;

  switch (source.type) {
    case 'openfacts': {
      const champs = 'product_name,product_name_fr,brands,categories_tags,categories,quantity';
      // product_type=all fait chercher dans les quatre bases Open Facts d'un coup.
      const url = `${source.url}${encode}.json?fields=${champs}`
        + (source.tousTypes ? '&product_type=all' : '');
      reponse = await recuperer(url, { timeoutMs });
      if (reponse.donnees) produit = analyserOpenFacts(reponse.donnees, source);
      break;
    }
    case 'upcitemdb':
      reponse = await recuperer(`${source.url}${encode}`, { timeoutMs });
      if (reponse.donnees) produit = analyserUpcitemdb(reponse.donnees, source);
      break;
    case 'recherche':
      reponse = await recuperer(`${source.url}${encode}`, { json: false, timeoutMs });
      if (reponse.donnees) produit = analyserRechercheWeb(reponse.donnees, code, source);
      break;
    default:
      reponse = { erreur: `type de source inconnu : ${source.type}` };
  }
  return { produit, erreur: reponse.erreur || null };
}

/** Parcourt les sources dans l'ordre et renvoie la première réponse exploitable. */
async function chercherProduit(code) {
  if (!config.basesProduits.enabled) return null;
  const essais = [];
  // Budget global : mieux vaut rendre la main et laisser saisir que faire
  // patienter vingt secondes devant un écran vide quand le réseau ne répond pas.
  const echeance = Date.now() + (config.basesProduits.budgetMs || 7000);

  for (const source of config.basesProduits.sources) {
    if (source.enabled === false) continue;
    if (Date.now() > echeance) {
      essais.push({ source: source.nom, resultat: 'non interrogée (délai global dépassé)' });
      continue;
    }
    const { produit, erreur } = await interroger(source, code, config.basesProduits.timeoutMs);
    essais.push({
      source: source.nom,
      resultat: produit ? 'trouvé' : erreur ? `échec (${erreur})` : 'absent de cette base',
    });
    if (produit) return { ...produit, essais };
  }
  return { introuvable: true, essais };
}

module.exports = {
  chercherProduit,
  analyserOpenFacts, analyserUpcitemdb, analyserRechercheWeb, nettoyerTitre,
};
