import { useEffect, useState } from 'react';
import { api } from '../api.js';
import LigneArticle from './LigneArticle.jsx';
import { parPersonne } from '../personnes.js';

const quand = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/* Le détail d'une session : ce que chacun a acheté, avec les mêmes actions que le ticket. */
function DetailSession({ id, seuils, revision, actions }) {
  const [produits, setProduits] = useState(null);

  useEffect(() => {
    let vivant = true;
    api.produits({ sessionId: id }).then(l => vivant && setProduits(l)).catch(() => vivant && setProduits([]));
    return () => { vivant = false; };
  }, [id, revision]);

  if (!produits) return <p className="note">Chargement…</p>;
  if (!produits.length) return <p className="note">Aucun article dans cette session.</p>;

  return parPersonne(produits).map(g => (
    <div key={g.prenom} className="bloc-personne">
      <p className="entete-personne">
        <b>{g.prenom}</b>
        <span>{g.articles} article{g.articles > 1 ? 's' : ''}{g.total ? ` · ${g.total.toFixed(2)} €` : ''}</span>
      </p>
      {g.produits.map(p => <LigneArticle key={p.id} produit={p} seuils={seuils} {...actions} />)}
    </div>
  ));
}

export default function Sessions({ sessions, active, seuils, revision, actions,
                                   onNouvelle, onRouvrir, onRenommer, onSupprimer }) {
  const [nom, setNom] = useState('');
  const [ouverte, setOuverte] = useState(null);

  const creer = () => {
    const ok = !active || window.confirm(
      `Démarrer une nouvelle session ? Elle remplace « ${active.nom || 'Courses'} » pour tout le monde.`);
    if (ok) { onNouvelle(nom.trim()); setNom(''); }
  };

  const renommer = s => {
    const saisi = window.prompt('Nom de la session', s.nom || '');
    if (saisi !== null) onRenommer(s.id, saisi);
  };

  const supprimer = s => {
    if (window.confirm(`Supprimer « ${s.nom || s.prenom} » et ses ${s.articles} article(s) ?`)) onSupprimer(s.id);
  };

  return (
    <section className="sessions">
      <div className="nouvelle-session">
        <p className="eyebrow">Nouvelle session</p>
        <input type="text" value={nom} onChange={e => setNom(e.target.value)} maxLength={60}
               placeholder="Nom (ex. Courses du samedi)" onKeyDown={e => e.key === 'Enter' && creer()} />
        <button className="btn-principal" onClick={creer}>Démarrer</button>
      </div>

      {sessions.map(s => {
        const enCours = active && s.id === active.id;
        return (
          <article key={s.id} className={`session${enCours ? ' en-cours' : ''}`}>
            <div className="article-haut">
              <span className="article-nom">{s.nom || `Courses de ${s.prenom}`}</span>
              <span className="pointilles" />
              <span className="article-qte">{s.total ? `${s.total.toFixed(2)} €` : ''}</span>
            </div>
            <p className="note">
              {quand(s.debut)} · {s.articles} article{s.articles > 1 ? 's' : ''}
              {enCours && ' · en cours'}
            </p>
            <div className="article-bas">
              <button className="puce-filtre" onClick={() => setOuverte(ouverte === s.id ? null : s.id)}>
                {ouverte === s.id ? 'Masquer' : 'Voir les achats'}
              </button>
              {!enCours && <button className="puce-filtre" onClick={() => onRouvrir(s)}>Reprendre</button>}
              <a className="puce-filtre" download href={api.urlExcel({ sessionId: s.id })}>Excel</a>
              <button className="puce-filtre" onClick={() => renommer(s)}>Renommer</button>
              <button className="btn-suppr" onClick={() => supprimer(s)}
                      aria-label={`Supprimer ${s.nom || s.prenom}`}>×</button>
            </div>
            {ouverte === s.id && <DetailSession id={s.id} seuils={seuils} revision={revision} actions={actions} />}
          </article>
        );
      })}

      {sessions.length === 0 && <div className="vide"><p>Aucune session.</p></div>}
    </section>
  );
}
