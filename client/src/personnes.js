/** Regroupe des produits par acheteur : articles, quantité et montant de chacun. */
export function parPersonne(produits) {
  const groupes = new Map();
  for (const p of produits) {
    const prenom = p.ajoute_par || '—';
    const g = groupes.get(prenom) || { prenom, articles: 0, total: 0, produits: [] };
    g.articles += 1;
    g.total += (p.prix_achat || 0) * (p.quantite_total || 1);
    g.produits.push(p);
    groupes.set(prenom, g);
  }
  return [...groupes.values()].sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'));
}
