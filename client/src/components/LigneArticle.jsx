import { chipPeremption, chipStock } from '../peremption.js';

export default function LigneArticle({ produit, seuils, onConsommer, onSupprimer, onCorriger }) {
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

        {produit.quantite_total > 0 && (
          <button className="btn-conso" onClick={() => onConsommer(produit.id)}
                  title="J'en ai consommé un">−1</button>
        )}
        <button className="btn-suppr" onClick={() => onSupprimer(produit.id)}
                aria-label={`Retirer ${produit.article}`}>×</button>
      </div>
    </article>
  );
}
