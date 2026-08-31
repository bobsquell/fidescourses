import { useState } from 'react';
import SelecteurType from './SelecteurType.jsx';

/* Rattraper une ligne sans ouvrir Excel : type, section, quantités, prix, date.
   Le prix est le cas le plus fréquent — aucun code-barres ne le contient, donc
   il est souvent oublié au moment du scan. */
export default function CorrectionType({ produit, types, sections, onValider, onAnnuler }) {
  const [type, setType] = useState(produit.type_produit || null);
  const [section, setSection] = useState(produit.section || null);
  const [total, setTotal] = useState(produit.quantite_total ?? 1);
  const [utilisee, setUtilisee] = useState(produit.quantite_utilisee ?? 0);
  const [prix, setPrix] = useState(produit.prix_achat ?? '');
  const [peremption, setPeremption] = useState(produit.date_peremption || '');

  const enregistrer = () => onValider({
    type_produit: type,
    section,
    quantite_total: parseFloat(total) || 0,
    quantite_utilisee: parseFloat(utilisee) || 0,
    prix_achat: prix === '' ? null : parseFloat(prix),
    date_peremption: peremption || null,
  });

  return (
    <div className="voile">
      <div className="carte-fiche">
        <div className="poignee" />
        <p className="eyebrow">Corriger · {produit.article}</p>

        <SelecteurType
          types={types}
          sections={sections}
          type={type}
          section={section}
          onChange={({ type: t, section: s }) => { setType(t); setSection(s || section); }}
        />

        <div className="duo">
          <label className="champ">
            <span>Quantité totale</span>
            <input type="number" min="0" step="1" inputMode="decimal"
                   value={total} onChange={e => setTotal(e.target.value)} />
          </label>
          <label className="champ">
            <span>Déjà utilisée</span>
            <input type="number" min="0" step="1" inputMode="decimal"
                   value={utilisee} onChange={e => setUtilisee(e.target.value)} />
          </label>
        </div>

        <div className="duo">
          <label className="champ">
            <span>Prix d'achat</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="—"
                   value={prix} onChange={e => setPrix(e.target.value)} />
          </label>
          <label className="champ">
            <span>Péremption</span>
            <input type="date" value={peremption} onChange={e => setPeremption(e.target.value)} />
          </label>
        </div>

        <div className="actions-fiche">
          <button type="button" className="btn-secondaire large" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="btn-principal" disabled={!type} onClick={enregistrer}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
