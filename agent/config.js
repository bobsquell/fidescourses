'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/* Configuration de l'agent local. Il tourne sur ton PC, jamais sur Render.
   Les valeurs sensibles vivent dans agent/.env, ignoré par git. */

const config = {
  // URL de l'API sur Render, sans barre oblique finale.
  apiUrl: (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Doit être identique à la variable AGENT_TOKEN configurée sur Render.
  jeton: process.env.AGENT_TOKEN || '',

  // Chemin absolu du classeur à régénérer sur ton PC.
  excelPath: process.env.EXCEL_PATH || path.join(__dirname, 'inventaire_croise.xlsx'),

  // Intervalle en minutes du mode surveillance (`node agent.js --boucle`).
  intervalleMinutes: Number(process.env.INTERVALLE_MINUTES || 5),

  // Lignes vides laissées sous chaque section pour saisir à la main dans Excel.
  lignesLibres: { inventaire: 5 },

  // Couleurs reprises de ton classeur d'origine.
  styles: {
    enteteInventaire: 'FF366092',
    section:          'FF4472C4',
    saisie:           'FFFFF2CC', // jaune pâle = cellule que tu remplis à la main
    appli:            'FFEDEDED', // gris = colonne alimentée par l'application
    vert:             'FFC6EFCE',
    jaune:            'FFFFFFCC',
    orange:           'FFFFEB9C',
    rouge:            'FFFFC7CE',
  },

  // Remplacés au démarrage par le référentiel renvoyé par l'API : c'est le
  // serveur qui fait autorité sur les types, pas une copie locale qui dérive.
  types: [],
  sections: [],
  peremption: { rouge: 7, orange: 14, jaune: 30 },
};

config.appliquerReferentiel = ({ types, sections, peremption }) => {
  if (Array.isArray(types) && types.length) config.types = types;
  if (Array.isArray(sections) && sections.length) config.sections = sections;
  if (peremption) config.peremption = peremption;
};

module.exports = config;
