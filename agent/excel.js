'use strict';
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const config = require('./config');

const S = config.styles;
const nbTypes = () => config.types.length;
const nomsTypes = () => config.types.map(t => t.nom);

const ENTETES = ['Article', 'Type de produit', 'Date de Péremption', 'Quantité Utilisée',
  'Quantité Total', 'Quantité Restante', "Prix d'Achat", 'Code-barres', 'Ajouté par', "Date d'achat"];
const LARGEURS = [22, 20, 18, 16, 14, 18, 14, 16, 14, 14];

// Colonnes A..G = ta mise en page d'origine ; H..J sont alimentées par l'appli.
const COL = { article: 1, type: 2, dlc: 3, utilisee: 4, total: 5, restante: 6, prix: 7,
              code: 8, par: 9, achat: 10 };

const normaliser = s => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

const colLettre = n => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; }
  return s;
};

/* ---------- conversions ---------- */

function versDateISO(valeur) {
  if (valeur == null || valeur === '') return null;
  if (valeur instanceof Date && !isNaN(valeur)) {
    const d = new Date(valeur.getTime() - valeur.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const texte = String(valeur).trim();
  let m = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texte.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const annee = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (typeof valeur === 'number' && valeur > 20000 && valeur < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + valeur * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

const versNombre = v => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
};

const texteCellule = c => {
  const v = c && c.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text) return v.text;
    if (v.formula !== undefined) return v.result != null ? String(v.result) : '';
    if (v.result != null) return String(v.result);
  }
  return String(v).trim();
};

const typeConnu = nom => nomsTypes().find(t => normaliser(t) === normaliser(nom)) || null;
const sectionDuType = nom => {
  const t = config.types.find(t => normaliser(t.nom) === normaliser(nom));
  return t ? t.section : config.sections[1];
};

/* ---------- export ---------- */

/** Réécrit intégralement le classeur : Inventaire, Instructions, Sessions. */
async function ecrireExcel(produits, sessions = [], chemin = config.excelPath) {
  // Le référentiel (types, sections, seuils) est injecté par l'agent depuis l'API.
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inventaire croisé';
  wb.modified = new Date();

  construireInventaire(wb, produits);
  construireARacheter(wb, produits);
  construirePriorite(wb, produits);
  construireInstructions(wb);
  construireSessions(wb, sessions, produits);

  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const tmp = chemin + '.tmp';
  await wb.xlsx.writeFile(tmp);
  try {
    fs.renameSync(tmp, chemin); // atomique : jamais de .xlsx à moitié écrit
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    // Cible sur un autre système de fichiers (disque externe, partage réseau) :
    // rename() est impossible, on copie puis on nettoie.
    fs.copyFileSync(tmp, chemin);
    fs.unlinkSync(tmp);
  }
  return chemin;
}

const remplir = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function construireInventaire(wb, produits) {
  const ws = wb.addWorksheet('Inventaire', { views: [{ state: 'frozen', ySplit: 1 }] });

  ENTETES.forEach((titre, i) => {
    const cell = ws.getRow(1).getCell(i + 1);
    cell.value = titre;
    cell.fill = remplir(S.enteteInventaire);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getColumn(i + 1).width = LARGEURS[i];
  });
  ws.getRow(1).height = 20;

  /* La liste des types est écrite en dur dans la validation. Excel plafonne ce
     champ à 255 caractères : au-delà, on la place dans une feuille annexe
     masquée plutôt que de la tronquer en silence. */
  const listeTypes = nomsTypes().join(',');
  let plageTypes;
  if (listeTypes.length <= 253) {
    plageTypes = `"${listeTypes}"`;
  } else {
    const wsListes = wb.addWorksheet('Listes', { state: 'veryHidden' });
    nomsTypes().forEach((nom, i) => { wsListes.getCell(`A${i + 1}`).value = nom; });
    plageTypes = `Listes!$A$1:$A$${nbTypes()}`;
  }

  // Un produit sans section connue retombe sur la section de son type.
  const parSection = new Map(config.sections.map(s => [s, []]));
  for (const p of produits) {
    let s = p.section;
    if (!parSection.has(s)) s = sectionDuType(p.type_produit);
    if (!parSection.has(s)) s = config.sections[1];
    parSection.get(s).push(p);
  }

  let r = 2;
  for (const section of config.sections) {
    const cellSection = ws.getRow(r).getCell(1);
    cellSection.value = section;
    cellSection.fill = remplir(S.section);
    cellSection.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    r++;

    const items = parSection.get(section);
    const debut = r;
    for (const p of items) { ecrireLigne(ws.getRow(r), p); r++; }
    for (let i = 0; i < config.lignesLibres.inventaire; i++) { ecrireLigne(ws.getRow(r), null); r++; }
    const fin = r - 1;

    // Seul le type garde une liste déroulante ; l'article se saisit librement,
    // puisqu'il n'y a plus de catalogue dans le classeur.
    for (let l = debut; l <= fin; l++) {
      ws.getCell(`B${l}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [plageTypes],
      };
    }
    ajouterMFC(ws, debut, fin);
    r++; // ligne de respiration entre deux sections
  }
}

function ecrireLigne(row, p) {
  const vide = !p;
  row.getCell(COL.article).value = vide ? null : p.article;
  row.getCell(COL.type).value = vide ? null : (p.type_produit || null);
  row.getCell(COL.dlc).value = vide || !p.date_peremption ? null : new Date(p.date_peremption + 'T00:00:00');
  row.getCell(COL.utilisee).value = vide ? null : (p.quantite_utilisee ?? 0);
  row.getCell(COL.total).value = vide ? null : (p.quantite_total ?? 0);
  // Sans le test sur A, les lignes libres affichaient « 0/0 » sur fond rouge,
  // comme si le stock était épuisé.
  const n = row.number;
  row.getCell(COL.restante).value = {
    formula: `IF(A${n}="","",IF(E${n}=0,"0/0",(E${n}-D${n})&"/"&E${n}))`,
  };
  row.getCell(COL.prix).value = vide || p.prix_achat == null ? null : p.prix_achat;
  row.getCell(COL.code).value = vide ? null : (p.code_barres || null);
  row.getCell(COL.par).value = vide ? null : (p.ajoute_par || null);
  row.getCell(COL.achat).value = vide || !p.date_achat ? null : new Date(p.date_achat + 'T00:00:00');

  // Jaune pâle = cellules que tu remplis à la main, gris = colonnes de l'appli.
  for (const k of ['article', 'type', 'dlc', 'utilisee', 'total', 'prix']) {
    row.getCell(COL[k]).fill = remplir(S.saisie);
  }
  for (const k of ['code', 'par', 'achat']) row.getCell(COL[k]).fill = remplir(S.appli);

  row.getCell(COL.dlc).numFmt = 'yyyy-mm-dd';
  row.getCell(COL.achat).numFmt = 'yyyy-mm-dd';
  row.getCell(COL.prix).numFmt = '#,##0.00 €';
  row.getCell(COL.code).numFmt = '@'; // texte : sinon Excel mange le zéro initial
  row.getCell(COL.restante).font = { bold: true };
  row.getCell(COL.restante).alignment = { horizontal: 'center' };
}

/** Reprend les deux codes couleur de ton fichier : péremption (C) et stock restant (F). */
function ajouterMFC(ws, debut, fin) {
  const { rouge, orange, jaune } = config.peremption;
  const style = argb => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } });

  ws.addConditionalFormatting({
    ref: `C${debut}:C${fin}`,
    rules: [
      { type: 'expression', priority: 1, style: style(S.rouge),
        formulae: [`AND(C${debut}<>"",INT(C${debut}-TODAY())<0)`] },
      { type: 'expression', priority: 2, style: style(S.rouge),
        formulae: [`AND(C${debut}<>"",INT(C${debut}-TODAY())>=0,INT(C${debut}-TODAY())<=${rouge})`] },
      { type: 'expression', priority: 3, style: style(S.orange),
        formulae: [`AND(C${debut}<>"",INT(C${debut}-TODAY())>${rouge},INT(C${debut}-TODAY())<=${orange})`] },
      { type: 'expression', priority: 4, style: style(S.jaune),
        formulae: [`AND(C${debut}<>"",INT(C${debut}-TODAY())>${orange},INT(C${debut}-TODAY())<=${jaune})`] },
      { type: 'expression', priority: 5, style: style(S.vert),
        formulae: [`AND(C${debut}<>"",INT(C${debut}-TODAY())>${jaune})`] },
    ],
  });

  const rempli = `$A${debut}<>""`;
  const ratio = `IF($E${debut}=0,0,($E${debut}-$D${debut})/$E${debut})`;
  ws.addConditionalFormatting({
    ref: `F${debut}:F${fin}`,
    rules: [
      { type: 'expression', priority: 1, style: style(S.vert),
        formulae: [`AND(${rempli},${ratio}>=0.75)`] },
      { type: 'expression', priority: 2, style: style(S.jaune),
        formulae: [`AND(${rempli},${ratio}>=0.5,${ratio}<0.75)`] },
      { type: 'expression', priority: 3, style: style(S.orange),
        formulae: [`AND(${rempli},${ratio}>0.25,${ratio}<0.5)`] },
      { type: 'expression', priority: 4, style: style(S.rouge),
        formulae: [`AND(${rempli},${ratio}<=0.25)`] },
    ],
  });
}

/* Bilan de fin de mois — 1 : ce qu'il faut racheter.
   Un produit est à racheter quand il ne reste plus rien, ou moins d'un quart. */
function construireARacheter(wb, produits) {
  const ws = wb.addWorksheet('À racheter', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Article', key: 'article', width: 32 },
    { header: 'Type de produit', key: 'type', width: 20 },
    { header: 'Restant', key: 'restant', width: 12 },
    { header: 'Dernier prix', key: 'prix', width: 14 },
    { header: 'Dernier achat', key: 'achat', width: 14 },
    { header: 'Acheté par', key: 'par', width: 14 },
  ];
  enTete(ws, S.enteteInventaire);

  const aRacheter = produits
    .filter(p => {
      const total = p.quantite_total || 0;
      if (!total) return false;
      return (total - (p.quantite_utilisee || 0)) / total <= 0.25;
    })
    .sort((a, b) => a.article.localeCompare(b.article, 'fr'));

  for (const p of aRacheter) {
    const reste = (p.quantite_total || 0) - (p.quantite_utilisee || 0);
    const row = ws.addRow({
      article: p.article,
      type: p.type_produit || '',
      restant: `${reste}/${p.quantite_total}`,
      prix: p.prix_achat ?? null,
      achat: p.date_achat ? new Date(p.date_achat + 'T00:00:00') : null,
      par: p.ajoute_par || '',
    });
    row.getCell('restant').alignment = { horizontal: 'center' };
    row.getCell('restant').font = { bold: true, color: { argb: reste === 0 ? 'FFC62828' : 'FF9C6500' } };
    row.getCell('prix').numFmt = '#,##0.00 €';
    row.getCell('achat').numFmt = 'yyyy-mm-dd';
  }
  if (!aRacheter.length) ws.addRow({ article: 'Rien à racheter pour le moment' });
}

/* Bilan de fin de mois — 2 : dans quel ordre consommer.
   Trié par date de péremption, les produits sans date en fin de liste. */
function construirePriorite(wb, produits) {
  const ws = wb.addWorksheet('Priorité conso', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Article', key: 'article', width: 32 },
    { header: 'Type de produit', key: 'type', width: 20 },
    { header: 'Péremption', key: 'dlc', width: 14 },
    { header: 'Jours restants', key: 'jours', width: 15 },
    { header: 'Restant', key: 'restant', width: 12 },
    { header: 'Section', key: 'section', width: 22 },
  ];
  enTete(ws, S.enteteInventaire);

  const aujourdhui = new Date(new Date().toDateString());
  const { rouge, orange, jaune } = config.peremption;

  const classes = produits
    .filter(p => p.date_peremption && (p.quantite_total || 0) - (p.quantite_utilisee || 0) > 0)
    .map(p => ({
      p,
      jours: Math.round((new Date(p.date_peremption + 'T00:00:00') - aujourdhui) / 86400000),
    }))
    .sort((a, b) => a.jours - b.jours);

  for (const { p, jours } of classes) {
    const row = ws.addRow({
      article: p.article,
      type: p.type_produit || '',
      dlc: new Date(p.date_peremption + 'T00:00:00'),
      jours,
      restant: `${(p.quantite_total || 0) - (p.quantite_utilisee || 0)}/${p.quantite_total}`,
      section: p.section || '',
    });
    row.getCell('dlc').numFmt = 'yyyy-mm-dd';
    row.getCell('restant').alignment = { horizontal: 'center' };
    // Même code couleur que la feuille Inventaire.
    const fond = jours < 0 || jours <= rouge ? S.rouge
      : jours <= orange ? S.orange
      : jours <= jaune ? S.jaune : S.vert;
    row.getCell('jours').fill = remplir(fond);
    row.getCell('jours').alignment = { horizontal: 'center' };
  }
  if (!classes.length) ws.addRow({ article: 'Aucune date de péremption renseignée' });
}

function enTete(ws, couleur) {
  const ligne = ws.getRow(1);
  ligne.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ligne.fill = remplir(couleur);
  ligne.height = 20;
}

function construireInstructions(wb) {
  const ws = wb.addWorksheet('Instructions');
  ws.getColumn(1).width = 100;
  const lignes = [
    ["GUIDE D'UTILISATION", true],
    ['', false],
    ['Ce classeur est régénéré automatiquement par l\'application à chaque scan.', false],
    ['Les colonnes en jaune se remplissent à la main, celles en gris viennent de l\'appli.', false],
    ['', false],
    ['SAISIE DIRECTE DANS CE CLASSEUR :', false],
    ["1️⃣  Article (colonne A) - saisie libre", false],
    ['2️⃣  Type de produit (colonne B) - liste déroulante', false],
    ["3️⃣  Date de Péremption - saisir la date lue sur l'emballage", false],
    ['4️⃣  Quantités et Prix', false],
    ['', false],
    ["Le nom et le type d'un produit scanné viennent des bases Open Food Facts,", false],
    ['Open Beauty Facts, Open Products Facts et UPCitemdb, pas de ce fichier.', false],
    ['', false],
    ["CODE COULEUR - Date de Péremption (basé sur la date saisie vs aujourd'hui) :", false],
    [`🔴 périmé ou ≤${config.peremption.rouge} jours | 🟠 ${config.peremption.rouge}-${config.peremption.orange}j | 🟡 ${config.peremption.orange}-${config.peremption.jaune}j | 🟢 >${config.peremption.jaune}j`, false],
    ['', false],
    ['CODE COULEUR - Quantité Restante :', false],
    ['🟢 ≥75% | 🟡 50-75% | 🟠 25-50% | 🔴 ≤25%', false],
    ['', false],
    ['⚠️ Ne garde pas ce fichier ouvert pendant que tu scannes : il est réécrit', false],
    ['   après chaque ajout, et tes modifications non enregistrées seraient perdues.', false],
  ];
  lignes.forEach(([texte, titre], i) => {
    const cell = ws.getRow(i + 1).getCell(1);
    cell.value = texte;
    if (titre) {
      cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      cell.fill = remplir(S.enteteInventaire);
    }
  });
}

/* Qui a acheté quoi, quand, pour combien. C'est la feuille qui sert à répartir
   les dépenses entre les membres du pôle. */

/* ---------- feuilles de bilan ---------- */

const enteteFeuille = (ws, colonnes) => {
  ws.columns = colonnes;
  const ligne = ws.getRow(1);
  ligne.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ligne.fill = remplir(S.enteteInventaire);
  ligne.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
};

/** À racheter : ce dont il ne reste rien, ou presque. */
function construireRachat(wb, produits) {
  const ws = wb.addWorksheet('À racheter');
  enteteFeuille(ws, [
    { header: 'Article', key: 'article', width: 32 },
    { header: 'Type de produit', key: 'type', width: 22 },
    { header: 'Section', key: 'section', width: 22 },
    { header: 'Restant', key: 'restant', width: 12 },
    { header: 'Dernier prix', key: 'prix', width: 14 },
    { header: 'Dernier achat', key: 'achat', width: 14 },
  ]);

  const aRacheter = produits
    .map(p => ({ p, total: p.quantite_total || 0, reste: (p.quantite_total || 0) - (p.quantite_utilisee || 0) }))
    .filter(({ total, reste }) => total > 0 && reste / total <= 0.25)
    .sort((a, b) => a.reste / a.total - b.reste / b.total);

  for (const { p, total, reste } of aRacheter) {
    const row = ws.addRow({
      article: p.article,
      type: p.type_produit || '',
      section: p.section || '',
      restant: `${reste}/${total}`,
      prix: p.prix_achat == null ? null : Number(p.prix_achat),
      achat: p.date_achat ? new Date(p.date_achat + 'T00:00:00') : null,
    });
    row.getCell('restant').alignment = { horizontal: 'center' };
    row.getCell('restant').fill = remplir(reste === 0 ? S.rouge : S.orange);
    row.getCell('prix').numFmt = '#,##0.00 €';
    row.getCell('achat').numFmt = 'dd/mm/yyyy';
  }

  if (!aRacheter.length) ws.addRow({ article: 'Rien à racheter pour le moment' });
}

/** Priorité de consommation : ce qui périme le plus tôt, en premier. */
function construirePriorite(wb, produits) {
  const ws = wb.addWorksheet('Priorité');
  enteteFeuille(ws, [
    { header: 'Article', key: 'article', width: 32 },
    { header: 'Type de produit', key: 'type', width: 22 },
    { header: 'Péremption', key: 'dlc', width: 14 },
    { header: 'Jours restants', key: 'jours', width: 15 },
    { header: 'Restant', key: 'restant', width: 12 },
    { header: 'Ajouté par', key: 'par', width: 14 },
  ]);

  const aujourdhui = new Date(new Date().toDateString());
  const { rouge, orange, jaune } = config.peremption;

  const urgents = produits
    .filter(p => p.date_peremption
      && (p.quantite_total || 0) - (p.quantite_utilisee || 0) > 0)
    .map(p => ({
      p,
      jours: Math.round((new Date(p.date_peremption + 'T00:00:00') - aujourdhui) / 86400000),
    }))
    .sort((a, b) => a.jours - b.jours);

  for (const { p, jours } of urgents) {
    const total = p.quantite_total || 0;
    const row = ws.addRow({
      article: p.article,
      type: p.type_produit || '',
      dlc: new Date(p.date_peremption + 'T00:00:00'),
      jours,
      restant: `${total - (p.quantite_utilisee || 0)}/${total}`,
      par: p.ajoute_par || '',
    });
    row.getCell('dlc').numFmt = 'dd/mm/yyyy';
    row.getCell('restant').alignment = { horizontal: 'center' };
    row.getCell('jours').alignment = { horizontal: 'center' };

    // Même code couleur que la feuille Inventaire et que le téléphone.
    const teinte = jours < 0 || jours <= rouge ? S.rouge
      : jours <= orange ? S.orange
      : jours <= jaune ? S.jaune
      : S.vert;
    row.getCell('jours').fill = remplir(teinte);
    if (jours < 0) {
      row.getCell('jours').value = 'périmé';
      row.getCell('jours').font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.getCell('jours').fill = remplir(S.rouge);
    }
  }

  if (!urgents.length) ws.addRow({ article: 'Aucune date de péremption renseignée' });
}

function construireSessions(wb, sessions, produits) {
  if (!sessions.length) return;  // pôle sans session : pas de feuille vide
  const ws = wb.addWorksheet('Sessions', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Prénom', key: 'prenom', width: 18 },
    { header: 'Date', key: 'debut', width: 20 },
    { header: 'Articles', key: 'articles', width: 10 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Détail', key: 'detail', width: 60 },
  ];
  enTete(ws, S.enteteInventaire);

  const totauxParPersonne = new Map();

  for (const s of sessions) {
    const items = produits.filter(p => p.session_id === s.id);
    const total = items.reduce((t, p) => t + (p.prix_achat || 0) * (p.quantite_total || 1), 0);
    totauxParPersonne.set(s.prenom, (totauxParPersonne.get(s.prenom) || 0) + total);

    const row = ws.addRow({
      prenom: s.prenom,
      debut: new Date(s.debut).toLocaleString('fr-FR'),
      articles: items.length,
      total,
      detail: items.map(p => p.article).join(', '),
    });
    row.getCell('total').numFmt = '#,##0.00 €';
  }

  // Récapitulatif par personne, deux lignes plus bas.
  ws.addRow({});
  const titre = ws.addRow({ prenom: 'Total par personne' });
  titre.font = { bold: true };
  for (const [prenom, total] of [...totauxParPersonne].sort((a, b) => b[1] - a[1])) {
    const row = ws.addRow({ prenom, total });
    row.getCell('total').numFmt = '#,##0.00 €';
    row.getCell('total').font = { bold: true };
  }
}

function couleurType(nom) {
  const t = config.types.find(t => normaliser(t.nom) === normaliser(nom));
  return t ? t.couleur : '#6B7280';
}

module.exports = { ecrireExcel, couleurType, sectionDuType };
