import LigneArticle from './LigneArticle.jsx';
import EtatSync from './EtatSync.jsx';
import FiltrePersonne from './FiltrePersonne.jsx';

export default function Ticket({ prenom, vue, onChangerVue, produits, seuils, etat,
                                 prenoms, filtre, onFiltrer,
                                 onConsommer, onSupprimer, onCorriger }) {
  const montant = produits.reduce(
    (t, p) => t + (p.prix_achat || 0) * (p.quantite_total || 1), 0
  );

  return (
    <main className="ticket">
      <header className="entete">
        <h1 className="enseigne">Inventaire<br />croisé</h1>
        <div className="meta">
          <span>Caisse — {prenom}</span>
          <span>{new Date().toLocaleDateString('fr-FR',
            { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
        </div>
      </header>

      <nav className="onglets" role="tablist">
        {[['session', 'Session'], ['tout', "Tout l'inventaire"]].map(([cle, libelle]) => (
          <button
            key={cle}
            role="tab"
            className={`onglet${vue === cle ? ' actif' : ''}`}
            onClick={() => onChangerVue(cle)}
          >
            {libelle}
          </button>
        ))}
      </nav>

      {vue === 'tout' && (
        <FiltrePersonne prenoms={prenoms} actif={filtre} onChanger={onFiltrer} />
      )}

      <div className="liste" aria-live="polite">
        {produits.map(p => (
          <LigneArticle
            key={p.id}
            produit={p}
            seuils={seuils}
            onConsommer={onConsommer}
            onSupprimer={onSupprimer}
            onCorriger={onCorriger}
          />
        ))}
      </div>

      {produits.length === 0 && (
        <div className="vide">
          <p>Rien sur le ticket.</p>
          <p className="note">Scanne un code-barres pour commencer.</p>
        </div>
      )}

      <footer className="total">
        <div className="ligne-total"><span>Articles</span><span>{produits.length}</span></div>
        <div className="ligne-total">
          <span>Montant</span><span>{montant ? `${montant.toFixed(2)} €` : '—'}</span>
        </div>
        <EtatSync etat={etat} />
      </footer>
    </main>
  );
}
