import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function EcranPrenom({ prenomInitial = '', onOuvrir }) {
  const [prenom, setPrenom] = useState(prenomInitial);
  const [serveurPret, setServeurPret] = useState(null);

  /* L'hébergement gratuit met le serveur en veille. On le dit plutôt que de
     laisser croire à un plantage. */
  useEffect(() => {
    let vivant = true;
    const lent = setTimeout(() => vivant && setServeurPret(false), 1500);
    api.reveil()
      .then(() => { if (vivant) { clearTimeout(lent); setServeurPret(true); } })
      .catch(() => { if (vivant) { clearTimeout(lent); setServeurPret(true); } });
    return () => { vivant = false; clearTimeout(lent); };
  }, []);

  const valider = () => {
    const valeur = prenom.trim();
    if (valeur) onOuvrir(valeur);
  };

  return (
    <div className="voile">
      <div className="carte-prenom">
        <p className="eyebrow">Nouvelle session</p>
        <h1>Qui fait les courses&nbsp;?</h1>
        <input
          type="text"
          value={prenom}
          onChange={e => setPrenom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && valider()}
          placeholder="Ton prénom"
          autoComplete="given-name"
          maxLength={40}
          enterKeyHint="go"
          autoFocus
        />
        <button className="btn-principal" onClick={valider}>Ouvrir la caisse</button>
        <p className="note">
          Ton prénom part dans la colonne « Ajouté par » de chaque produit scanné.
        </p>
        {serveurPret === false && (
          <p className="note">Réveil du serveur en cours, quelques secondes…</p>
        )}
      </div>
    </div>
  );
}
