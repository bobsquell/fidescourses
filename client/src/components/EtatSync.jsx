import { useState } from 'react';

/* Le serveur n'écrit plus le classeur : c'est l'agent local qui vient chercher
   les données. Cette ligne dit donc quand il est passé pour la dernière fois. */
export default function EtatSync({ etat }) {
  const [ouvert, setOuvert] = useState(false);
  if (!etat) return null;

  const agent = etat.agent || {};
  const quand = agent.quand ? new Date(agent.quand) : null;
  const vieux = quand && Date.now() - quand.getTime() > 3600_000; // plus d'une heure

  return (
    <div className={`etat-sync${vieux ? ' echec' : ''}`}>
      <button type="button" className="etat-ligne" onClick={() => setOuvert(o => !o)}>
        {quand
          ? `Classeur récupéré à ${quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Classeur jamais récupéré'}
        <span className="etat-chevron">{ouvert ? '−' : '+'}</span>
      </button>

      {ouvert && (
        <div className="etat-detail">
          <p>
            {etat.produits} produit{etat.produits > 1 ? 's' : ''} en base,
            {' '}{etat.personnes} personne{etat.personnes > 1 ? 's' : ''}.
          </p>
          <p className="note">
            Le classeur est fabriqué sur le PC par l'agent local, pas par le serveur.
            S'il n'a pas tourné récemment, lance <code>node agent.js</code> dans
            le dossier <code>agent/</code>.
          </p>
        </div>
      )}
    </div>
  );
}
