import { useState } from 'react';
import { api } from '../api.js';

const quand = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function Sessions({ sessions, active, onNouvelle, onActiver, onRenommer, onSupprimer }) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState(active.prenom);

  const creer = () => {
    if (!prenom.trim()) return;
    onNouvelle(prenom.trim(), nom.trim());
    setNom('');
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
               placeholder="Nom (ex. Courses du samedi)" />
        <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} maxLength={40}
               placeholder="Qui fait les courses ?" onKeyDown={e => e.key === 'Enter' && creer()} />
        <button className="btn-principal" onClick={creer}>Créer et ouvrir</button>
      </div>

      {sessions.map(s => (
        <article key={s.id} className={`session${s.id === active.id ? ' en-cours' : ''}`}>
          <div className="article-haut">
            <span className="article-nom">{s.nom || `Courses de ${s.prenom}`}</span>
            <span className="pointilles" />
            <span className="article-qte">{s.total ? `${s.total.toFixed(2)} €` : ''}</span>
          </div>
          <p className="note">
            {s.prenom} · {quand(s.debut)} · {s.articles} article{s.articles > 1 ? 's' : ''}
            {s.id === active.id && ' · en cours'}
          </p>
          <div className="article-bas">
            {s.id !== active.id && <button className="puce-filtre" onClick={() => onActiver(s)}>Ouvrir</button>}
            <a className="puce-filtre" download href={api.urlExcel({ sessionId: s.id })}>Excel</a>
            <button className="puce-filtre" onClick={() => renommer(s)}>Renommer</button>
            <button className="btn-suppr" onClick={() => supprimer(s)}
                    aria-label={`Supprimer ${s.nom || s.prenom}`}>×</button>
          </div>
        </article>
      ))}

      {sessions.length === 0 && <div className="vide"><p>Aucune session.</p></div>}
    </section>
  );
}
