'use strict';

/* Configuration du serveur d'API. Tout ce qui dépend de l'hébergement passe
   par des variables d'environnement, réglables dans le tableau de bord Render. */

module.exports = {
  port: process.env.PORT || 3000,

  // Chaîne de connexion Neon, ex. postgresql://user:pass@host/db?sslmode=require
  databaseUrl: process.env.DATABASE_URL,

  // Origines autorisées à appeler l'API : le site GitHub Pages, plus le dev local.
  originesAutorisees: (process.env.CORS_ORIGINS
    || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()),

  // Jeton partagé par l'agent local pour récupérer les données du classeur.
  jetonAgent: process.env.AGENT_TOKEN || null,

  sections: ['BOISSONS', 'NOURRITURE', 'COUVERTS', 'HYGIÈNE & ENTRETIEN'],

  types: [
    { nom: 'Boissons - Sodas',       couleur: '#C0392B', section: 'BOISSONS' },
    { nom: 'Boissons - Jus',         couleur: '#E67E22', section: 'BOISSONS' },
    { nom: 'Boissons - Eaux',        couleur: '#3498DB', section: 'BOISSONS' },
    { nom: 'Boissons - Alcoolisées', couleur: '#8E44AD', section: 'BOISSONS' },
    { nom: 'Biscuits - Secs',        couleur: '#B9770E', section: 'NOURRITURE' },
    { nom: 'Biscuits - Apéritifs',   couleur: '#A04000', section: 'NOURRITURE' },
    { nom: 'Chocolat',               couleur: '#5D4037', section: 'NOURRITURE' },
    { nom: 'Confiseries',            couleur: '#D81B60', section: 'NOURRITURE' },
    { nom: 'Produits laitiers',      couleur: '#00838F', section: 'NOURRITURE' },
    { nom: 'Conserves',              couleur: '#546E7A', section: 'NOURRITURE' },
    { nom: 'Pâtes/Riz',              couleur: '#827717', section: 'NOURRITURE' },
    { nom: 'Condiments',             couleur: '#2E7D32', section: 'NOURRITURE' },
    { nom: 'Fruits secs',            couleur: '#795548', section: 'NOURRITURE' },
    { nom: 'Petit-déjeuner',         couleur: '#F9A825', section: 'NOURRITURE' },
    { nom: 'Surgelés',               couleur: '#0277BD', section: 'NOURRITURE' },
    { nom: 'Autres',                 couleur: '#6B7280', section: 'NOURRITURE' },
    { nom: 'Hygiène & beauté',       couleur: '#7B5EA7', section: 'HYGIÈNE & ENTRETIEN' },
    { nom: 'Entretien',              couleur: '#00796B', section: 'HYGIÈNE & ENTRETIEN' },
  ],

  peremption: { rouge: 7, orange: 14, jaune: 30 },

  /* Sources interrogées dans l'ordre. Attention en hébergement partagé : les
     quotas d'UPCitemdb (100/jour) et la tolérance de DuckDuckGo se comptent par
     adresse IP du serveur, pas par utilisateur. Le cache de codes-barres en base
     est ce qui rend l'ensemble tenable. */
  basesProduits: {
    enabled: true,
    timeoutMs: 2500,
    budgetMs: 7000,
    sources: [
      { nom: 'openfacts',         type: 'openfacts',  libelle: 'Open Food Facts',
        url: 'https://world.openfoodfacts.org/api/v2/product/', tousTypes: true },
      { nom: 'openbeautyfacts',   type: 'openfacts',  libelle: 'Open Beauty Facts',
        url: 'https://world.openbeautyfacts.org/api/v2/product/' },
      { nom: 'openproductsfacts', type: 'openfacts',  libelle: 'Open Products Facts',
        url: 'https://world.openproductsfacts.org/api/v2/product/' },
      { nom: 'upcitemdb',         type: 'upcitemdb',  libelle: 'UPCitemdb',
        url: 'https://api.upcitemdb.com/prod/trial/lookup?upc=' },
      { nom: 'recherche-web',     type: 'recherche',  libelle: 'Recherche web',
        url: 'https://html.duckduckgo.com/html/?q=' },
    ],
  },
};
