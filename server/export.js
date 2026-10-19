'use strict';
const ExcelJS = require('exceljs');

const EURO = '#,##0.00 "€"';
const quantite = p => p.quantite_total || 1;
const montant = p => (p.prix_achat || 0) * quantite(p);
const libelleSession = s => (s ? s.nom || `Courses de ${s.prenom}` : '');

function feuille(wb, nom, colonnes, lignes) {
  const ws = wb.addWorksheet(nom, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = colonnes.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
  const entete = ws.getRow(1);
  entete.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17181A' } };
  lignes.forEach(l => ws.addRow(l));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonnes.length } };
  return ws;
}

/** Classeur « qui a acheté quoi » : détail, synthèse par personne, par article, sessions. */
async function fabriquerClasseur({ produits, sessions, session = null }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inventaire croisé';
  wb.created = new Date();
  const nomSession = Object.fromEntries(sessions.map(s => [s.id, libelleSession(s)]));

  const tries = [...produits].sort((a, b) =>
    (a.ajoute_par || '').localeCompare(b.ajoute_par || '', 'fr') ||
    a.article.localeCompare(b.article, 'fr'));

  const detail = feuille(wb, 'Qui a acheté quoi', [
    ['Acheteur', 'par', 16], ['Article', 'article', 30], ['Type', 'type', 20],
    ['Quantité', 'qte', 10], ['Prix unitaire', 'prix', 14, EURO], ['Total', 'total', 14, EURO],
    ["Date d'achat", 'achat', 14, 'dd/mm/yyyy'], ['Session', 'session', 24],
    ['Péremption', 'dlc', 14, 'dd/mm/yyyy'],
  ], tries.map(p => ({
    par: p.ajoute_par || '—', article: p.article, type: p.type_produit || '',
    qte: quantite(p), prix: p.prix_achat, total: montant(p),
    achat: p.date_achat ? new Date(p.date_achat) : null,
    session: nomSession[p.session_id] || '',
    dlc: p.date_peremption ? new Date(p.date_peremption) : null,
  })));
  const fin = detail.rowCount;
  if (fin > 1) {
    const r = detail.addRow({ par: 'TOTAL', qte: { formula: `SUM(D2:D${fin})` }, total: { formula: `SUM(F2:F${fin})` } });
    r.font = { bold: true };
  }

  const parPersonne = new Map();
  for (const p of produits) {
    const k = p.ajoute_par || '—';
    const e = parPersonne.get(k) || { lignes: 0, qte: 0, total: 0 };
    e.lignes += 1; e.qte += quantite(p); e.total += montant(p);
    parPersonne.set(k, e);
  }
  feuille(wb, 'Par personne', [
    ['Acheteur', 'par', 18], ['Lignes', 'lignes', 10], ['Quantité totale', 'qte', 16], ['Montant', 'total', 14, EURO],
  ], [...parPersonne].sort(([a], [b]) => a.localeCompare(b, 'fr')).map(([par, e]) => ({ par, ...e })));

  const parArticle = new Map();
  for (const p of produits) {
    const k = `${p.article}\u0000${p.type_produit || ''}`;
    const e = parArticle.get(k) || { article: p.article, type: p.type_produit || '', qte: 0, acheteurs: new Map() };
    e.qte += quantite(p);
    const par = p.ajoute_par || '—';
    e.acheteurs.set(par, (e.acheteurs.get(par) || 0) + quantite(p));
    parArticle.set(k, e);
  }
  feuille(wb, 'Par article', [
    ['Article', 'article', 30], ['Type', 'type', 20], ['Quantité totale', 'qte', 16], ['Acheté par', 'acheteurs', 40],
  ], [...parArticle.values()]
    .sort((a, b) => a.article.localeCompare(b.article, 'fr'))
    .map(e => ({ ...e, acheteurs: [...e.acheteurs].map(([n, q]) => `${n} ×${q}`).join(', ') })));

  const sessionsRetenues = session ? [session] : sessions;
  feuille(wb, 'Sessions', [
    ['Session', 'nom', 28], ['Ouverte par', 'prenom', 16], ['Début', 'debut', 18, 'dd/mm/yyyy hh:mm'],
    ['Clôturée', 'fin', 18, 'dd/mm/yyyy hh:mm'], ['Articles', 'articles', 10], ['Montant', 'total', 14, EURO],
  ], sessionsRetenues.map(s => ({ ...s, nom: libelleSession(s), debut: new Date(s.debut), fin: s.fin ? new Date(s.fin) : null })));

  return wb.xlsx.writeBuffer();
}

module.exports = { fabriquerClasseur };
