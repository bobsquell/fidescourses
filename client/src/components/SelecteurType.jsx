/* Sélecteur partagé : utilisé à l'ajout d'un produit et pour corriger
   le type d'une ligne déjà au ticket. La section suit le type choisi,
   mais reste modifiable — c'est elle qui décide du bloc dans le classeur. */
export default function SelecteurType({ types, sections, type, section, onChange, motif }) {
  const choisirType = nom => {
    const suivant = nom === type ? null : nom;
    const t = types.find(t => t.nom === suivant);
    onChange({ type: suivant, section: t ? t.section : null });
  };

  return (
    <>
      <div className="champ">
        <span>
          Type de produit
          {motif && <em className="motif"> · déduit de « {motif} »</em>}
        </span>
        <div className="pastilles-choix">
          {types.map(t => (
            <button
              key={t.nom}
              type="button"
              aria-pressed={t.nom === type}
              onClick={() => choisirType(t.nom)}
            >
              <i style={{ background: t.couleur }} />{t.nom}
            </button>
          ))}
        </div>
      </div>

      <div className="champ">
        <span>Section du classeur</span>
        <div className="raccourcis">
          {sections.map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={s === section}
              onClick={() => onChange({ type, section: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
