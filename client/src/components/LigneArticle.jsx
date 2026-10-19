import { chipPeremption, chipStock } from '../peremption.js';

export default function LigneArticle({ produit, seuils, onConsommer, onSupprimer, onCorriger, onQuantite }) {
  const dlc = chipPeremption(produit.date_peremption, seuils);
  const stock = chipStock(produit);

  return (
    <article className="article">
      <div className="article-haut">
        <span className="article-nom">{produit.article}</span>
        <span className="pointilles" />
        <span className="article-qte">
          {produit.prix_achat ? `${Number(produit.prix_achat).toFixed(2)} €` : ''}
        </span>
      </div>

      <div className="article-bas">
        {/* La pastille est cliquable : c'est le raccourci pour rattraper un
            type mal deviné, sans passer par le classeur. */}
        <button
          type="button"
          className="pastille pastille-modifiable"
          onClick={() => onCorriger(produit)}
          title="Corriger le type"
        >
          <i style={{ background: produit.couleur }} />
          {produit.type_produit || 'Sans type'}
        </button>

        {dlc && <span className={`chip-dlc ${dlc.classe}`}>{dlc.texte}</span>}
        {stock && <span className={`chip-dlc ${stock.classe}`}>{stock.texte}</span>}

        <span className="stepper" title="Quantité achetée">
          <button type="button" onClick={() => onQuantite(produit.id, -1)}
                  disabled={!(produit.quantite_total > 0)}
                  aria-label={`Une unité de moins de ${produit.article}`}>−</button>
          <b>{produit.quantite_total ?? 0}</b>
          <button type="button" onClick={() => onQuantite(produit.id, 1)}
                  aria-label={`Une unité de plus de ${produit.article}`}>+</button>
        </span>

        {produit.quantite_total > 0 && (
          <button className="btn-conso" onClick={() => onConsommer(produit.id)}
                  title="J'en ai consommé un">consommé</button>
        )}
        <button className="btn-suppr" onClick={() => onSupprimer(produit.id)}
                aria-label={`Retirer ${produit.article}`}>×</button>
      </div>
    </article>
  );
}
