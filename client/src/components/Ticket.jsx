import LigneArticle from './LigneArticle.jsx';
import EtatSync from './EtatSync.jsx';
import FiltrePersonne from './FiltrePersonne.jsx';
import Sessions from './Sessions.jsx';
import { parPersonne } from '../personnes.js';

export default function Ticket({ prenom, session, vue, onChangerVue, produits, seuils, etat,
                                 filtre, onFiltrer, listeSessions, revision,
                                 onNouvelleSession, onRouvrirSession, onRenommerSession,
                                 onSupprimerSession, onQuantite, onDeconnecter, onExcel,
                                 onConsommer, onSupprimer, onCorriger }) {
  // « Mes achats » est verrouillé sur la personne connectée ; « Session en cours » laisse filtrer.
  const personne = vue === 'moi' ? prenom : filtre;
  const visibles = personne ? produits.filter(p => p.ajoute_par === personne) : produits;
  const montant = visibles.reduce((t, p) => t + (p.prix_achat || 0) * (p.quantite_total || 1), 0);
  const actions = { onConsommer, onSupprimer, onCorriger, onQuantite };

  return (
    <main className="ticket">
      <header className="entete">
        <h1 className="enseigne">Inventaire<br />croisé</h1>
        <div className="meta">
          <span>{session ? (session.nom || 'Courses') : 'Connexion…'}</span>
          <button type="button" className="lien-prenom" onClick={onDeconnecter}
                  title="Changer de personne">{prenom} ⎋</button>
        </div>
      </header>

      <nav className="onglets" role="tablist">
        {[['moi', 'Mes achats'], ['session', 'Session en cours'], ['sessions', 'Sessions']].map(([cle, libelle]) => (
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

      {vue === 'sessions' && (
        <Sessions
          sessions={listeSessions}
          active={session}
          seuils={seuils}
          revision={revision}
          actions={actions}
          onExcel={onExcel}
          onNouvelle={onNouvelleSession}
          onRouvrir={onRouvrirSession}
          onRenommer={onRenommerSession}
          onSupprimer={onSupprimerSession}
        />
      )}

      {vue !== 'sessions' && session && <>
        {vue === 'session' && (
          <FiltrePersonne personnes={parPersonne(produits)} actif={filtre} onChanger={onFiltrer} />
        )}

        <div className="liste" aria-live="polite">
          {visibles.map(p => (
            <LigneArticle key={p.id} produit={p} seuils={seuils} {...actions} />
          ))}
        </div>

        {visibles.length === 0 && (
          <div className="vide">
            <p>{personne ? `Rien d'acheté par ${personne === prenom ? 'toi' : personne}.` : 'Rien sur le ticket.'}</p>
            <p className="note">Scanne un code-barres pour commencer.</p>
          </div>
        )}

        <footer className="total">
          <div className="ligne-total"><span>Articles</span><span>{visibles.length}</span></div>
          <div className="ligne-total">
            <span>Montant{personne ? ` — ${personne}` : ''}</span>
            <span>{montant ? `${montant.toFixed(2)} €` : '—'}</span>
          </div>
          <button type="button" className="btn-excel"
                  onClick={() => onExcel({ sessionId: session.id, prenom: personne })}>
            Télécharger l'Excel — qui a acheté quoi
          </button>
          <EtatSync etat={etat} />
        </footer>
      </>}
    </main>
  );
}
