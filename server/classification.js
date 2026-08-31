'use strict';
const config = require('./config');

/* ---------------------------------------------------------------------------
   Traduction des catégories Open Food Facts vers TES 16 types.

   OFF renvoie une hiérarchie du général au précis. Une eau pétillante porte
   à la fois `en:carbonated-drinks` (boisson gazeuse) et `en:waters` (eau) :
   c'est le plus précis qui doit gagner, pas le premier rencontré.

   D'où le score : chaque règle a une spécificité, et on garde la plus haute.
   Les libellés OFF sont des identifiants stables (`en:spring-waters`), donc on
   les compare en entier au lieu de chercher un bout de mot dans une phrase —
   c'est ce qui évitait à « eaux gazeuses » de tomber dans « Sodas ».
--------------------------------------------------------------------------- */

/* [type, spécificité, tags, motif de secours sur le nom, portée]

   La portée existe parce que les taxonomies se recoupent : `en:creams` désigne
   la crème fraîche chez Open Food Facts et la crème de soin chez Open Beauty
   Facts. Une règle « alimentaire » est donc ignorée quand la fiche vient de la
   base cosmétique, et inversement. Sans portée, la règle s'applique partout. */
const ALIMENTAIRE = 'alimentaire', NON_ALIMENTAIRE = 'non-alimentaire';
const REGLES = [
  ['Boissons - Eaux', 90,
    ['waters', 'spring-waters', 'mineral-waters', 'carbonated-waters', 'sparkling-waters',
     'natural-mineral-waters', 'flavoured-waters', 'flavored-waters', 'still-waters'],
    /\beaux?\b(?!\s+de\s+(toilette|parfum|cologne))|\bpétillante?\b|\bgazeuse/i, ALIMENTAIRE],

  ['Boissons - Alcoolisées', 85,
    ['alcoholic-beverages', 'beers', 'wines', 'red-wines', 'white-wines', 'rose-wines',
     'sparkling-wines', 'champagnes', 'spirits', 'ciders', 'aperitifs'],
    /\bbières?\b|\bvins?\b|\bchampagne\b|\bwhisky\b|\brhum\b|\bvodka\b/i, ALIMENTAIRE],

  ['Boissons - Jus', 80,
    ['fruit-juices', 'juices', 'juices-and-nectars', 'nectars', 'vegetable-juices',
     'fruit-juices-and-nectars', 'orange-juices', 'apple-juices'],
    /\bjus\b|\bnectar\b|\bsmoothie\b/i, ALIMENTAIRE],

  ['Boissons - Sodas', 70,
    ['sodas', 'colas', 'carbonated-drinks', 'energy-drinks', 'iced-teas', 'lemonades',
     'sweetened-beverages', 'artificially-sweetened-beverages'],
    /\bsoda\b|\bcola\b|\blimonade\b|\bice tea\b/i, ALIMENTAIRE],

  ['Surgelés', 88,
    ['frozen-foods', 'frozen-desserts', 'ice-creams', 'frozen-vegetables', 'frozen-fish',
     'frozen-meats', 'frozen-pizzas', 'ice-cream-tubs'],
    /\bsurgel|\bglaces?\b|\bcongelé/i, ALIMENTAIRE],

  ['Produits laitiers', 75,
    ['dairies', 'milks', 'yogurts', 'fermented-milk-products', 'cheeses', 'creams',
     'fresh-dairy-desserts', 'butters', 'fermented-dairy-desserts'],
    /\blait\b|\byaourt|\bfromage|\bcrème fraîche\b|\bbeurre\b/i, ALIMENTAIRE],

  ['Biscuits - Apéritifs', 78,
    ['appetizers', 'aperitif', 'salty-snacks', 'chips-and-fries', 'crisps', 'crackers',
     'extruded-crisps', 'nuts-and-their-products'],
    /\bchips\b|\bapéritif|\bcrackers?\b|\bbretzels?\b/i, ALIMENTAIRE],

  ['Biscuits - Secs', 72,
    ['biscuits-and-cakes', 'biscuits', 'cookies', 'shortbread-cookies', 'cakes',
     'sweet-snacks', 'brownies', 'madeleines'],
    /\bbiscuits?\b|\bcookies?\b|\bgâteau|\bbrownie\b|\bgalette/i, ALIMENTAIRE],

  ['Chocolat', 82,
    ['chocolates', 'dark-chocolates', 'milk-chocolates', 'white-chocolates',
     'chocolate-bars', 'chocolate-candies', 'cocoa-and-its-products'],
    /\bchocolats?\b|\btablette de chocolat\b/i, ALIMENTAIRE],

  ['Confiseries', 76,
    ['candies', 'confectioneries', 'sweets', 'gums', 'lollipops', 'marshmallows',
     'chewing-gum', 'liquorice'],
    /\bbonbons?\b|\bsucettes?\b|\bréglisse\b/i, ALIMENTAIRE],

  ['Conserves', 74,
    ['canned-foods', 'canned-vegetables', 'canned-fish', 'canned-fruits', 'canned-legumes',
     'canned-tuna', 'canned-sardines', 'canned-corn'],
    /\ben (boîte|conserve)\b|\bconserves?\b|\bau naturel\b/i, ALIMENTAIRE],

  ['Pâtes/Riz', 74,
    ['pastas', 'rices', 'cereals-and-potatoes', 'dried-pastas', 'durum-wheat-pasta',
     'white-rices', 'semolinas', 'noodles'],
    /\bpâtes\b|\briz\b|\bsemoule\b|\bnouilles\b/i, ALIMENTAIRE],

  ['Condiments', 73,
    ['condiments', 'sauces', 'tomato-sauces', 'mustards', 'ketchup', 'mayonnaises',
     'vinegars', 'olive-oils', 'vegetable-oils', 'salad-dressings', 'spices'],
    /\bsauce\b|\bmoutarde\b|\bketchup\b|\bmayonnaise\b|\bhuile\b|\bvinaigre\b/i, ALIMENTAIRE],

  ['Fruits secs', 77,
    ['nuts', 'almonds', 'walnuts', 'cashew-nuts', 'hazelnuts', 'dried-fruits',
     'raisins', 'dried-apricots', 'pistachios'],
    /\bamandes?\b|\bnoix\b|\bnoisettes?\b|\braisins secs\b|\bfruits secs\b/i, ALIMENTAIRE],

  /* Étiquettes Open Beauty Facts : ces produits ne sont pas dans Open Food Facts,
     leurs catégories vivent dans une taxonomie distincte. */
  ['Hygiène & beauté', 95,
    ['deodorants', 'antiperspirants', 'perfumes', 'fragrances', 'eaux-de-toilette',
     'shampoos', 'conditioners', 'hair-care', 'soaps', 'shower-gels', 'body-care',
     'skincare', 'face-care', 'creams', 'makeup', 'lipsticks', 'toothpastes',
     'oral-hygiene', 'shaving', 'aftershaves', 'sunscreens', 'hygiene', 'cosmetics',
     'face-mists', 'thermal-water-sprays', 'baby-care', 'feminine-hygiene'],
    /\bdéodorant|\bdeodorant|\bantiperspirant|\bparfums?\b|\bperfume|\bfragrance|\bcologne\b|\beau de (toilette|parfum)\b|\bedt\b|\bedp\b|\bshampoing|\bshampooing|\bshampoo|\bdentifrice|\btoothpaste|\bgel douche\b|\bshower gel\b|\bbrumisateur|\bsavon\b|\bsoap\b|\bcrème solaire\b|\bsunscreen|\bbody (spray|lotion|care)\b|\bskin ?care\b|\bmakeup\b|\bcosmetic|\baftershave\b|\bmascara\b|\brouge à lèvres\b|\blipstick\b/i, NON_ALIMENTAIRE],

  ['Entretien', 94,
    ['cleaning-products', 'household-cleaning', 'laundry-detergents', 'fabric-softeners',
     'dishwashing-products', 'dishwasher-tablets', 'surface-cleaners', 'bleaches',
     'air-fresheners', 'trash-bags', 'paper-towels', 'toilet-papers', 'sponges',
     'insecticides', 'detergents'],
    /\blessive\b|\bdetergent\b|\bliquide vaisselle\b|\bdish ?wash|\bnettoyant\b|\bcleaner\b|\bcleaning\b|\bjavel\b|\bbleach\b|\bdésodorisant\b|\bair freshener\b|\bpapier toilette\b|\btoilet paper\b|\bessuie-tout\b|\bpaper towels?\b|\bsacs? poubelle\b|\btrash bags?\b/i, NON_ALIMENTAIRE],

  ['Petit-déjeuner', 71,
    ['breakfasts', 'breakfast-cereals', 'jams', 'fruit-jams', 'honeys', 'hazelnut-spreads',
     'chocolate-spreads', 'sugars', 'mueslis', 'cereal-flakes'],
    /\bconfitures?\b|\bmiel\b|\bpâte à tartiner\b|\bcéréales\b|\bsucre\b/i, ALIMENTAIRE],
];

// Index tag -> règles, construit une seule fois au démarrage.
const INDEX = new Map();
for (const [type, score, tags, , portee] of REGLES) {
  for (const tag of tags) {
    if (!INDEX.has(tag)) INDEX.set(tag, []);
    INDEX.get(tag).push({ type, score, portee });
  }
}

const REGLES_PAR_SPECIFICITE = [...REGLES].sort((a, b) => b[1] - a[1]);

// Quelles portées sont recevables selon la base qui a répondu.
function porteeAdmise(portee, base) {
  if (!portee) return true;
  if (base === 'openfoodfacts') return portee === ALIMENTAIRE;
  if (base === 'openbeautyfacts') return portee === NON_ALIMENTAIRE;
  return true; // Open Products Facts, ou base inconnue : tout est recevable
}

const sansPrefixe = tag => String(tag).replace(/^[a-z]{2}:/, '').toLowerCase();

/**
 * @param {string[]} tags  categories_tags de la base (ex. ['en:waters', …])
 * @param {string}   nom   nom du produit, utilisé en secours
 * @param {string}   base  quelle base a répondu : openfoodfacts | openbeautyfacts | …
 * @returns {{type: string|null, motif: string|null, score: number}}
 */
function devinerType(tags = [], nom = '', base = null) {
  let meilleur = { type: null, motif: null, score: 0 };

  for (const tagBrut of tags) {
    const tag = sansPrefixe(tagBrut);
    for (const { type, score, portee } of INDEX.get(tag) || []) {
      if (!porteeAdmise(portee, base)) continue;
      if (score > meilleur.score) meilleur = { type, motif: tagBrut, score };
    }
  }
  if (meilleur.type) return meilleur;

  // Aucun tag exploitable : on tente le nom du produit, de la règle la plus
  // spécifique à la moins spécifique — sinon l'ordre du tableau déciderait.
  for (const [type, score, , motifNom, portee] of REGLES_PAR_SPECIFICITE) {
    if (!porteeAdmise(portee, base)) continue;
    if (motifNom && motifNom.test(nom)) return { type, motif: `nom: ${nom}`, score };
  }
  return { type: null, motif: null, score: 0 };
}

const normaliser = s => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

/** Renvoie le nom canonique du type, ou null s'il n'est pas dans la liste. */
function typeConnu(nom) {
  const t = config.types.find(t => normaliser(t.nom) === normaliser(nom));
  return t ? t.nom : null;
}

/** Couleur de pastille d'un type ; gris neutre pour un type absent. */
function couleurType(nom) {
  const t = config.types.find(t => normaliser(t.nom) === normaliser(nom));
  return t ? t.couleur : '#6B7280';
}

/** Section du classeur correspondant à un type. */
function sectionDuType(type) {
  const t = config.types.find(t => t.nom === type);
  return t ? t.section : null;
}

module.exports = { devinerType, sectionDuType, typeConnu, couleurType, REGLES };
