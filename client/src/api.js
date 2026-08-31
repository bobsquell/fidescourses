/* Un seul point d'entrée réseau : toutes les erreurs remontent en Error avec
   le message du serveur, que les composants affichent en toast. */
/* En production le front (GitHub Pages) et l'API (Render) sont sur deux
   domaines : VITE_API_URL porte l'adresse de l'API. Vide en local, où le
   serveur sert les deux. */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function requete(chemin, options) {
  const url = BASE + chemin;
  const rep = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!rep.ok) {
    const corps = await rep.json().catch(() => ({}));
    throw new Error(corps.erreur || `Erreur ${rep.status}`);
  }
  return rep.json();
}

const poster = (url, corps) => requete(url, { method: 'POST', body: JSON.stringify(corps) });

export const urlApi = BASE;

export const api = {
  ouvrirSession: prenom => poster('/api/sessions', { prenom }),
  cloturerSession: id => poster(`/api/sessions/${id}/fin`, {}),

  produits: ({ sessionId, prenom } = {}) => requete(
    sessionId ? `/api/produits?session=${encodeURIComponent(sessionId)}`
      : prenom ? `/api/produits?prenom=${encodeURIComponent(prenom)}`
      : '/api/produits'
  ),
  prenoms: () => requete('/api/prenoms'),
  listeSessions: () => requete('/api/sessions'),
  reveil: () => requete('/api/reveil'),
  ajouterProduit: produit => poster('/api/produits', produit),
  modifier: (id, champs) => requete(`/api/produits/${id}`, {
    method: 'PATCH', body: JSON.stringify(champs),
  }),
  consommer: (id, pas = 1) => poster(`/api/produits/${id}/consommer`, { pas }),
  supprimer: id => requete(`/api/produits/${id}`, { method: 'DELETE' }),

  lookup: code => requete(`/api/lookup/${encodeURIComponent(code)}`),
  types: () => requete('/api/types'),
  sections: () => requete('/api/sections'),
  etat: () => requete('/api/etat'),
};
