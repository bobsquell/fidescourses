import LigneArticle from './LigneArticle.jsx';
import EtatSync from './EtatSync.jsx';
import FiltrePersonne from './FiltrePersonne.jsx';
import Sessions from './Sessions.jsx';
import { api } from '../api.js';
import { parPersonne } from '../personnes.js';

export default function Ticket({ prenom, session, vue, onChangerVue, produits, seuils, etat,
                                 filtre, onFiltrer, listeSessions, revision,
                                 onNouvelleSession, onRouvrirSession, onRenommerSession,
                                 onSupprimerSession, onQuantite, onDeconnecter,
                                 onConsommer, onSupprimer, onCorriger }) {
  const visibles = filtre ? produits.filter(p => p.ajoute_par === filtre) : produits;
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
        {[['session', 'Session en cours'], ['sessions', 'Sessions']].map(([cle, libelle]) => (
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
          onNouvelle={onNouvelleSession}
          onRouvrir={onRouvrirSession}
          onRenommer={onRenommerSession}
          onSupprimer={onSupprimerSession}
        />
      )}

      {vue === 'session' && session && <>
        <FiltrePersonne personnes={parPersonne(produits)} actif={filtre} onChanger={onFiltrer} />

        <div className="liste" aria-live="polite">
          {visibles.map(p => (
            <LigneArticle key={p.id} produit={p} seuils={seuils} {...actions} />
          ))}
        </div>

        {visibles.length === 0 && (
          <div className="vide">
            <p>{filtre ? `Rien d'acheté par ${filtre}.` : 'Rien sur le ticket.'}</p>
            <p className="note">Scanne un code-barres pour commencer.</p>
          </div>
        )}

        <footer className="total">
          <div className="ligne-total"><span>Articles</span><span>{visibles.length}</span></div>
          <div className="ligne-total">
            <span>Montant{filtre ? ` — ${filtre}` : ''}</span>
            <span>{montant ? `${montant.toFixed(2)} €` : '—'}</span>
          </div>
          <a className="btn-excel" download
             href={api.urlExcel({ sessionId: session.id, prenom: filtre })}>
            Télécharger l'Excel — qui a acheté quoi
          </a>
          <EtatSync etat={etat} />
        </footer>
      </>}
    </main>
  );
}
