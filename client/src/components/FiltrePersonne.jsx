/* Filtre de lecture, pas de cloisonnement : tout le monde voit tout,
   mais on peut isoler ce qu'une personne a acheté, avec son total. */
const euros = n => (n ? ` · ${n.toFixed(2)} €` : '');

export default function FiltrePersonne({ personnes, actif, onChanger }) {
  if (!personnes.length) return null;

  return (
    <div className="filtre-personne">
      <button
        type="button"
        className={`puce-filtre${actif === null ? ' actif' : ''}`}
        onClick={() => onChanger(null)}
      >
        Tout le monde
      </button>
      {personnes.map(p => (
        <button
          key={p.prenom}
          type="button"
          className={`puce-filtre${actif === p.prenom ? ' actif' : ''}`}
          onClick={() => onChanger(actif === p.prenom ? null : p.prenom)}
        >
          {p.prenom}
          <span className="puce-compte">{p.articles}{euros(p.total)}</span>
        </button>
      ))}
    </div>
  );
}
