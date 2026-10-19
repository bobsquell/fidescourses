'use strict';
const { Pool } = require('pg');
const config = require('./config');

if (!config.databaseUrl) {
  console.error('DATABASE_URL manquante. Renseigne la chaîne de connexion Neon.');
  process.exit(1);
}

/* Neon met la base en veille après quelques minutes d'inactivité : le premier
   appel qui suit doit pouvoir attendre le réveil sans échouer. */
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: /neon\.tech|render\.com|amazonaws/.test(config.databaseUrl)
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', err => console.error('[pg] connexion inactive perdue :', err.message));

const q = (texte, valeurs) => pool.query(texte, valeurs);

async function initialiser() {
  await q(`
    CREATE TABLE IF NOT EXISTS sessions (
      id     TEXT PRIMARY KEY,
      prenom TEXT NOT NULL,
      debut  TIMESTAMPTZ NOT NULL DEFAULT now(),
      fin    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS produits (
      id                SERIAL PRIMARY KEY,
      article           TEXT NOT NULL,
      type_produit      TEXT,
      section           TEXT,
      date_peremption   DATE,
      quantite_utilisee NUMERIC DEFAULT 0,
      quantite_total    NUMERIC DEFAULT 1,
      prix_achat        NUMERIC,
      code_barres       TEXT,
      ajoute_par        TEXT,
      date_achat        DATE,
      session_id        TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      cree_le           TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Cache partagé : un code résolu une fois profite à tout le pôle.
    CREATE TABLE IF NOT EXISTS catalogue (
      code_barres  TEXT PRIMARY KEY,
      article      TEXT,
      type_produit TEXT,
      source       TEXT,
      maj_le       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS bd_articles (
      article      TEXT NOT NULL,
      type_produit TEXT NOT NULL,
      PRIMARY KEY (type_produit, article)
    );

    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS nom TEXT;

    CREATE INDEX IF NOT EXISTS idx_produits_session ON produits(session_id);
    CREATE INDEX IF NOT EXISTS idx_produits_code    ON produits(code_barres);
    CREATE INDEX IF NOT EXISTS idx_produits_par     ON produits(ajoute_par);
  `);
}

const CHAMPS = ['article', 'type_produit', 'section', 'date_peremption', 'quantite_utilisee',
  'quantite_total', 'prix_achat', 'code_barres', 'ajoute_par', 'date_achat', 'session_id'];

/* Les colonnes NUMERIC reviennent en chaîne avec le pilote pg : on les
   reconvertit, sinon les additions côté client concatènent au lieu d'ajouter. */
const nombre = v => (v === null || v === undefined ? null : Number(v));
const jour = v => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

const normaliser = p => p && ({
  ...p,
  quantite_utilisee: nombre(p.quantite_utilisee),
  quantite_total: nombre(p.quantite_total),
  prix_achat: nombre(p.prix_achat),
  date_peremption: jour(p.date_peremption),
  date_achat: jour(p.date_achat),
});

async function ajouterProduit(p) {
  const valeurs = CHAMPS.map(c => (p[c] === undefined ? null : p[c]));
  const jetons = CHAMPS.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await q(
    `INSERT INTO produits (${CHAMPS.join(', ')}) VALUES (${jetons}) RETURNING *`, valeurs);
  return normaliser(rows[0]);
}

async function modifierProduit(id, champs) {
  const cles = Object.keys(champs).filter(k => CHAMPS.includes(k));
  if (!cles.length) return produit(id);
  const set = cles.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await q(`UPDATE produits SET ${set} WHERE id = $1 RETURNING *`,
    [id, ...cles.map(k => champs[k])]);
  return normaliser(rows[0]);
}

const TRI = `ORDER BY date_peremption IS NULL, date_peremption ASC, id DESC`;

async function produits({ session, personne } = {}) {
  const conditions = [], valeurs = [];
  if (session)  { valeurs.push(session);  conditions.push(`session_id = $${valeurs.length}`); }
  if (personne) { valeurs.push(personne); conditions.push(`ajoute_par = $${valeurs.length}`); }
  const filtre = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await q(`SELECT * FROM produits ${filtre} ${TRI}`, valeurs);
  return rows.map(normaliser);
}

async function produit(id) {
  const { rows } = await q('SELECT * FROM produits WHERE id = $1', [id]);
  return normaliser(rows[0]);
}

async function supprimerProduit(id) {
  const { rowCount } = await q('DELETE FROM produits WHERE id = $1', [id]);
  return rowCount > 0;
}

async function catalogueGet(code) {
  const { rows } = await q('SELECT * FROM catalogue WHERE code_barres = $1', [code]);
  return rows[0] || null;
}

const catalogueSet = e => q(
  `INSERT INTO catalogue (code_barres, article, type_produit, source, maj_le)
   VALUES ($1, $2, $3, $4, now())
   ON CONFLICT (code_barres) DO UPDATE SET
     article = EXCLUDED.article, type_produit = EXCLUDED.type_produit,
     source = EXCLUDED.source, maj_le = now()`,
  [e.code_barres, e.article || null, e.type_produit || null, e.source || null]);

const bdAjouter = (article, type) => q(
  `INSERT INTO bd_articles (article, type_produit) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
  [article, type]);

async function bdParType(type) {
  const { rows } = await q(
    'SELECT article FROM bd_articles WHERE type_produit = $1 ORDER BY article', [type]);
  return rows.map(r => r.article);
}

/* Une seule session est « en cours » à la fois (fin IS NULL) : c'est celle que
   tout le monde rejoint en se connectant. En ouvrir une autre clôture les précédentes. */
const sessionEnCours = async () => {
  const { rows } = await q('SELECT * FROM sessions WHERE fin IS NULL ORDER BY debut DESC LIMIT 1');
  return rows[0] || null;
};

async function sessionRouvrir(id) {
  await q('UPDATE sessions SET fin = now() WHERE fin IS NULL AND id <> $1', [id]);
  const { rows } = await q('UPDATE sessions SET fin = NULL WHERE id = $1 RETURNING *', [id]);
  return rows[0] || null;
}

async function sessionCreer(id, prenom, nom = null) {
  await q('UPDATE sessions SET fin = now() WHERE fin IS NULL');
  const { rows } = await q(
    'INSERT INTO sessions (id, prenom, nom) VALUES ($1, $2, $3) RETURNING *', [id, prenom, nom]);
  return rows[0];
}

async function sessionRenommer(id, nom) {
  const { rows } = await q('UPDATE sessions SET nom = $2 WHERE id = $1 RETURNING *', [id, nom]);
  return rows[0] || null;
}

/** Supprime la session et les articles qu'elle contient. */
async function sessionSupprimer(id) {
  await q('DELETE FROM produits WHERE session_id = $1', [id]);
  const { rowCount } = await q('DELETE FROM sessions WHERE id = $1', [id]);
  return rowCount > 0;
}

async function session(id) {
  const { rows } = await q('SELECT * FROM sessions WHERE id = $1', [id]);
  return rows[0] || null;
}

const sessionCloturer = id => q('UPDATE sessions SET fin = now() WHERE id = $1', [id]);

/** Sessions enrichies du nombre d'articles et du montant — la base du bilan. */
async function sessions() {
  const { rows } = await q(`
    SELECT s.*,
           COUNT(p.id)::int AS articles,
           COALESCE(SUM(p.prix_achat * COALESCE(p.quantite_total, 1)), 0) AS total
    FROM sessions s
    LEFT JOIN produits p ON p.session_id = s.id
    GROUP BY s.id
    ORDER BY s.debut DESC`);
  return rows.map(r => ({ ...r, total: nombre(r.total) }));
}

/** Les personnes ayant scanné au moins un produit, avec leur cumul. */
async function personnes() {
  const { rows } = await q(`
    SELECT ajoute_par AS prenom,
           COUNT(*)::int AS articles,
           COALESCE(SUM(prix_achat * COALESCE(quantite_total, 1)), 0) AS total
    FROM produits
    WHERE ajoute_par IS NOT NULL AND ajoute_par <> ''
    GROUP BY ajoute_par
    ORDER BY ajoute_par`);
  return rows.map(r => ({ ...r, total: nombre(r.total) }));
}

module.exports = {
  pool, initialiser, CHAMPS,
  ajouterProduit, modifierProduit, supprimerProduit, produits, produit,
  catalogueGet, catalogueSet, bdAjouter, bdParType,
  sessionCreer, sessionEnCours, sessionRouvrir, sessionRenommer, sessionSupprimer, session, sessionCloturer, sessions, personnes,
};
