#!/usr/bin/env node
'use strict';
/* Agent local : tire les données depuis l'API et régénère le classeur ici.
   Le serveur ne peut pas écrire sur ton PC — c'est donc ton PC qui va chercher.

   Usage :
     node agent.js            une passe et on sort
     node agent.js --boucle   surveille toutes les INTERVALLE_MINUTES minutes  */

const config = require('./config');
const { ecrireExcel } = require('./excel');

const horodatage = () => new Date().toLocaleTimeString('fr-FR');

async function recuperer() {
  const rep = await fetch(`${config.apiUrl}/api/agent/export`, {
    headers: { Authorization: `Bearer ${config.jeton}` },
  });
  if (rep.status === 401) throw new Error('jeton refusé — AGENT_TOKEN diffère de celui de Render');
  if (!rep.ok) throw new Error(`API : HTTP ${rep.status}`);
  return rep.json();
}

async function unePasse() {
  if (!config.jeton) throw new Error('AGENT_TOKEN absent : complète agent/.env');

  // Le service Render dort après quinze minutes : la première requête peut
  // prendre une minute, ce n'est pas une panne.
  const donnees = await recuperer();

  config.appliquerReferentiel(donnees);
  await ecrireExcel(donnees.produits, donnees.sessions);

  console.log(`[${horodatage()}] ${donnees.produits.length} produit(s), `
    + `${donnees.sessions.length} session(s) → ${config.excelPath}`);
  return donnees;
}

(async () => {
  const boucle = process.argv.includes('--boucle');

  const tenter = async () => {
    try { await unePasse(); }
    catch (err) { console.error(`[${horodatage()}] échec : ${err.message}`); }
  };

  await tenter();
  if (!boucle) return;

  const ms = Math.max(1, config.intervalleMinutes) * 60000;
  console.log(`Surveillance active, une passe toutes les ${config.intervalleMinutes} min. Ctrl+C pour arrêter.`);
  setInterval(tenter, ms);
})();
