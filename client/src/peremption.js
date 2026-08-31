/* Reprend les deux codes couleur du classeur : la date de péremption
   (feuille Instructions) et le ratio de quantité restante (MFC colonne F). */

export function joursRestants(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
}

export function chipPeremption(iso, seuils) {
  const j = joursRestants(iso);
  if (j === null) return null;
  const { rouge, orange, jaune } = seuils;
  const date = new Date(iso + 'T00:00:00')
    .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  if (j < 0) return { classe: 'perime', texte: `Périmé · ${date}` };
  if (j === 0) return { classe: 'critique', texte: "Aujourd'hui" };
  if (j <= rouge) return { classe: 'critique', texte: `J−${j} · ${date}` };
  if (j <= orange) return { classe: 'proche', texte: `J−${j} · ${date}` };
  if (j <= jaune) return { classe: 'tiede', texte: `J−${j} · ${date}` };
  return { classe: 'frais', texte: date };
}

export function chipStock(produit) {
  const total = produit.quantite_total || 0;
  if (!total) return null;
  const reste = total - (produit.quantite_utilisee || 0);
  const ratio = reste / total;
  const classe = ratio >= 0.75 ? 'frais'
    : ratio >= 0.5 ? 'tiede'
    : ratio > 0.25 ? 'proche' : 'critique';
  return { classe, texte: `${reste}/${total}` };
}
