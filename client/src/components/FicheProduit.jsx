import { useEffect, useState } from 'react';
import SelecteurType from './SelecteurType.jsx';

const dansNJours = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const RACCOURCIS = [
  { libelle: '+3 j', jours: 3 },
  { libelle: '+1 sem.', jours: 7 },
  { libelle: '+1 mois', jours: 30 },
  { libelle: '+6 mois', jours: 180 },
  { libelle: 'Aucune', jours: null },
];

export default function FicheProduit({ produit, source, base, motif, provisoire, recherche,
                                       types, sections, onValider, onAnnuler }) {
  const typeDeviné = produit.type_produit || null;
  const [article, setArticle] = useState(produit.article || '');
  const [type, setType] = useState(typeDeviné);
  const [section, setSection] = useState(
    types.find(t => t.nom === typeDeviné)?.section || null
  );
  const [touché, setTouché] = useState(false);

  /* La fiche s'ouvre avant la fin de la recherche : quand la réponse arrive,
     on remplit les champs — sauf ceux que tu as déjà commencé à saisir. */
  useEffect(() => {
    if (touché) return;
    if (produit.article) setArticle(produit.article);
    if (produit.type_produit) {
      setType(produit.type_produit);
      setSection(types.find(t => t.nom === produit.type_produit)?.section || null);
    }
  }, [produit.article, produit.type_produit, types, touché]);
  const [quantite, setQuantite] = useState(1);
  const [prix, setPrix] = useState('');
  const [peremption, setPeremption] = useState('');

  const suggestions = types.find(t => t.nom === type)?.articles || [];
  const libelleSource =
    source === 'local' ? 'Déjà scanné'
    : base ? base                       // Open Food / Beauty / Products Facts
    : produit.code_barres ? 'Produit inconnu'
    : 'Ajout manuel';

  const soumettre = e => {
    e.preventDefault();
    if (!article.trim() || !type) return;
    onValider({
      code_barres: produit.code_barres || null,
      article: article.trim(),
      type_produit: type,
      section,
      quantite_total: parseFloat(quantite) || 1,
      quantite_utilisee: 0,
      prix_achat: prix === '' ? null : parseFloat(prix),
      date_peremption: peremption || null,
    });
  };

  return (
    <div className="voile">
      <form className="carte-fiche" onSubmit={soumettre}>
        <div className="poignee" />
        <p className="eyebrow">
          {recherche ? 'Recherche en cours…' : libelleSource} · {produit.code_barres || 'sans code'}
          {provisoire && <em className="motif"> · nom deviné, à vérifier</em>}
        </p>

        {provisoire && (
          <p className="avertissement">
            Nom déduit d'une page web, pas d'une fiche produit. Vérifie-le avant
            d'ajouter — il n'est mémorisé qu'après ta validation.
          </p>
        )}

        <SelecteurType
          types={types}
          sections={sections}
          type={type}
          section={section}
          motif={type && type === typeDeviné ? motif : null}
          onChange={({ type: t, section: s }) => { setTouché(true); setType(t); setSection(s); }}
        />

        <label className="champ">
          <span>Article</span>
          <input
            type="text"
            value={article}
            onChange={e => { setTouché(true); setArticle(e.target.value); }}
            placeholder="Nom du produit"
            maxLength={80}
            required
            autoFocus={!produit.article}
          />
        </label>

        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.slice(0, 12).map(a => (
              <button key={a} type="button" onClick={() => setArticle(a)}>{a}</button>
            ))}
          </div>
        )}

        <div className="duo">
          <div className="champ">
            <span>Quantité totale</span>
            <div className="compteur">
              <button type="button" onClick={() => setQuantite(q => Math.max(0, (parseFloat(q) || 0) - 1))}
                      aria-label="Retirer">−</button>
              <input type="number" value={quantite} min="0" step="1" inputMode="decimal"
                     onChange={e => setQuantite(e.target.value)} />
              <button type="button" onClick={() => setQuantite(q => (parseFloat(q) || 0) + 1)}
                      aria-label="Ajouter">+</button>
            </div>
          </div>
          <label className="champ">
            <span>Prix d'achat</span>
            <input type="number" step="0.01" min="0" placeholder="—" inputMode="decimal"
                   value={prix} onChange={e => setPrix(e.target.value)} />
          </label>
        </div>

        <div className="champ">
          <span>Date de péremption</span>
          <div className="raccourcis">
            {RACCOURCIS.map(r => (
              <button
                key={r.libelle}
                type="button"
                aria-pressed={r.jours === null ? peremption === '' : peremption === dansNJours(r.jours)}
                onClick={() => setPeremption(r.jours === null ? '' : dansNJours(r.jours))}
              >
                {r.libelle}
              </button>
            ))}
          </div>
          <input type="date" value={peremption} onChange={e => setPeremption(e.target.value)} />
        </div>

        <div className="actions-fiche">
          <button type="button" className="btn-secondaire large" onClick={onAnnuler}>Annuler</button>
          <button type="submit" className="btn-principal" disabled={!article.trim() || !type}>
            {!article.trim() && !type ? 'Nom et type requis'
              : !article.trim() ? "Nom de l'article requis"
              : !type ? 'Choisis un type'
              : 'Ajouter au ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
