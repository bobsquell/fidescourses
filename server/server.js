'use strict';
const express = require('express');
const crypto = require('crypto');
const config = require('./config');
const store = require('./db');
const { couleurType, sectionDuType, typeConnu } = require('./classification');
const { chercherProduit } = require('./recherche');

const app = express();
app.use(express.json());

/* Le front est servi par GitHub Pages, l'API par Render : deux domaines,
   donc CORS explicite. La liste vient de la variable CORS_ORIGINS. */
app.use((req, res, next) => {
  const origine = req.headers.origin;
  if (origine && config.originesAutorisees.includes(origine)) {
    res.set('Access-Control-Allow-Origin', origine);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Toute erreur asynchrone non capturée doit répondre, pas faire tomber le service.
const route = gestion => (req, res, next) => Promise.resolve(gestion(req, res, next)).catch(next);

const enrichir = p => ({
  ...p,
  couleur: couleurType(p.type_produit),
  restante: (p.quantite_total || 0) - (p.quantite_utilisee || 0),
});

let derniereExtraction = null;   // dernier passage de l'agent local

/* ---------- réveil ----------
   L'offre gratuite de Render endort le service après quinze minutes, et Neon
   suspend la base après cinq. Le client appelle cette route au démarrage
   pendant que tu saisis ton prénom, pour que le premier scan ne l'attende pas. */
app.get('/api/reveil', route(async (req, res) => {
  const debut = Date.now();
  await store.pool.query('SELECT 1');
  res.json({ eveille: true, ms: Date.now() - debut });
}));

/* ---------- sessions ---------- */

app.post('/api/sessions', route(async (req, res) => {
  const prenom = String(req.body.prenom || '').trim().slice(0, 40);
  if (!prenom) return res.status(400).json({ erreur: 'Prénom manquant' });
  res.json(await store.sessionCreer(crypto.randomUUID(), prenom));
}));

app.post('/api/sessions/:id/fin', route(async (req, res) => {
  await store.sessionCloturer(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/sessions', route(async (req, res) => res.json(await store.sessions())));

app.get('/api/prenoms', route(async (req, res) => res.json(await store.personnes())));

/* ---------- produits ---------- */

app.get('/api/produits', route(async (req, res) => {
  const liste = await store.produits({
    session: req.query.session || null,
    personne: req.query.prenom || null,
  });
  res.json(liste.map(enrichir));
}));

app.post('/api/produits', route(async (req, res) => {
  const b = req.body || {};
  const article = String(b.article || '').trim();
  if (!article) return res.status(400).json({ erreur: "Nom d'article manquant" });

  const session = b.session_id ? await store.session(b.session_id) : null;
  const type = typeConnu(b.type_produit) || null;
  const section = config.sections.includes(b.section)
    ? b.section
    : (sectionDuType(type) || config.sections[1]);

  const produit = await store.ajouterProduit({
    article,
    type_produit: type,
    section,
    date_peremption: b.date_peremption || null,
    quantite_utilisee: b.quantite_utilisee != null ? Number(b.quantite_utilisee) : 0,
    quantite_total: b.quantite_total != null ? Number(b.quantite_total) : 1,
    prix_achat: b.prix_achat != null && b.prix_achat !== '' ? Number(b.prix_achat) : null,
    code_barres: b.code_barres || null,
    ajoute_par: session ? session.prenom : (b.ajoute_par || null),
    date_achat: b.date_achat || new Date().toISOString().slice(0, 10),
    session_id: b.session_id || null,
  });

  // Le catalogue est partagé : un code résolu une fois sert à tout le pôle.
  if (produit.code_barres) {
    await store.catalogueSet({
      code_barres: produit.code_barres,
      article: produit.article,
      type_produit: produit.type_produit,
      source: 'manuel',
    });
  }
  if (produit.type_produit) await store.bdAjouter(produit.article, produit.type_produit);

  res.status(201).json(enrichir(produit));
}));

app.patch('/api/produits/:id', route(async (req, res) => {
  const champs = { ...(req.body || {}) };
  // Corriger le type depuis le téléphone doit déplacer la ligne dans le bon bloc.
  if (champs.type_produit !== undefined) {
    champs.type_produit = typeConnu(champs.type_produit) || null;
    if (champs.section === undefined) {
      champs.section = sectionDuType(champs.type_produit) || config.sections[1];
    }
  }
  const produit = await store.modifierProduit(Number(req.params.id), champs);
  if (!produit) return res.status(404).json({ erreur: 'Produit introuvable' });
  res.json(enrichir(produit));
}));

app.post('/api/produits/:id/consommer', route(async (req, res) => {
  const actuel = await store.produit(Number(req.params.id));
  if (!actuel) return res.status(404).json({ erreur: 'Produit introuvable' });
  const utilisee = Math.min(actuel.quantite_total || 0,
    Math.max(0, (actuel.quantite_utilisee || 0) + Number(req.body?.pas ?? 1)));
  res.json(enrichir(await store.modifierProduit(actuel.id, { quantite_utilisee: utilisee })));
}));

app.delete('/api/produits/:id', route(async (req, res) => {
  if (!await store.supprimerProduit(Number(req.params.id))) {
    return res.status(404).json({ erreur: 'Produit introuvable' });
  }
  res.json({ ok: true });
}));

/* ---------- recherche produit ---------- */

app.get('/api/lookup/:code', route(async (req, res) => {
  const code = String(req.params.code).trim();

  const local = await store.catalogueGet(code);
  if (local) return res.json({ trouve: true, source: 'local', produit: local });

  const resultat = await chercherProduit(code);
  if (!resultat || resultat.introuvable) {
    return res.json({
      trouve: false, source: null,
      produit: { code_barres: code },
      essais: resultat ? resultat.essais : [],
    });
  }

  const { motif, tags, base, essais, provisoire, ...aStocker } = resultat;
  // Un nom deviné sur le web n'entre au cache qu'après validation par l'utilisateur.
  if (!provisoire) await store.catalogueSet({ code_barres: code, ...aStocker });

  res.json({
    trouve: true,
    source: resultat.source,
    base,
    motif,
    provisoire: provisoire || undefined,
    tags: req.query.debug ? tags : undefined,
    essais: req.query.debug ? essais : undefined,
    produit: { code_barres: code, ...aStocker },
  });
}));

/* ---------- référentiel ---------- */

app.get('/api/types', route(async (req, res) => {
  const types = await Promise.all(config.types.map(async t => ({
    nom: t.nom, couleur: t.couleur, section: t.section,
    articles: await store.bdParType(t.nom),
  })));
  res.json(types);
}));

app.get('/api/sections', (req, res) => res.json(config.sections));

app.get('/api/etat', route(async (req, res) => {
  const [produits, prenoms] = await Promise.all([store.produits(), store.personnes()]);
  res.json({
    produits: produits.length,
    personnes: prenoms.length,
    seuils: config.peremption,
    // L'agent local tire les données : le classeur n'est plus écrit par le serveur.
    agent: derniereExtraction
      ? { ok: true, quand: derniereExtraction }
      : { ok: null, quand: null },
  });
}));

/* ---------- extraction pour l'agent local ----------
   Protégée par un jeton : sans lui, n'importe qui aspirerait tout l'inventaire. */
app.get('/api/agent/export', route(async (req, res) => {
  const fourni = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!config.jetonAgent || fourni !== config.jetonAgent) {
    return res.status(401).json({ erreur: 'Jeton agent invalide' });
  }
  const [produits, sessions] = await Promise.all([store.produits(), store.sessions()]);
  derniereExtraction = new Date().toISOString();
  res.json({
    produits, sessions,
    types: config.types,
    sections: config.sections,
    peremption: config.peremption,
    extrait_le: derniereExtraction,
  });
}));

app.use((err, req, res, next) => {
  console.error('[erreur]', err.message);
  res.status(500).json({ erreur: err.message });
});

store.initialiser()
  .then(() => app.listen(config.port, '0.0.0.0', () => {
    console.log(`API inventaire croisé sur le port ${config.port}`);
    console.log(`Origines autorisées : ${config.originesAutorisees.join(', ')}`);
    if (!config.jetonAgent) console.warn('AGENT_TOKEN absent : /api/agent/export est fermé.');
  }))
  .catch(err => {
    console.error('Impossible d\'initialiser la base :', err.message);
    process.exit(1);
  });
