/* Filtre de lecture, pas de cloisonnement : tout le monde voit tout,
   mais on peut isoler ce qu'une personne a acheté. */
export default function FiltrePersonne({ prenoms, actif, onChanger }) {
  if (!prenoms.length) return null;

  return (
    <div className="filtre-personne">
      <button
        type="button"
        className={`puce-filtre${actif === null ? ' actif' : ''}`}
        onClick={() => onChanger(null)}
      >
        Tout le pôle
      </button>
      {prenoms.map(p => (
        <button
          key={p.prenom}
          type="button"
          className={`puce-filtre${actif === p.prenom ? ' actif' : ''}`}
          onClick={() => onChanger(p.prenom)}
        >
          {p.prenom}
          <span className="puce-compte">{p.articles}</span>
        </button>
      ))}
    </div>
  );
}
