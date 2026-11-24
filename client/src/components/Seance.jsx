import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { aujourdhui, libelleSeance, seancesAVenir } from '../calendrier.js';

const ROLES = [
  ['courses', 'Faire les courses'],
  ['pot', 'Préparer le pot'],
];
const LIBELLE_ROLE = Object.fromEntries(ROLES);

const lireChoix = () => { try { return localStorage.getItem('seance') || ''; } catch { return ''; } };
const ecrireChoix = d => { try { localStorage.setItem('seance', d); } catch { /* navigation privée */ } };

export default function Seance({ prenom, onErreur }) {
  const jour = aujourdhui();
  const avenir = seancesAVenir(jour);
  const memorisee = lireChoix();
  // Une séance passée n'est plus valable : on l'oublie, le choix est à refaire.
  const [date, setDate] = useState(avenir.includes(memorisee) ? memorisee : '');
  const [liste, setListe] = useState(false);
  const [roles, setRoles] = useState([]);

  const charger = useCallback(async () => {
    if (!date) return;
    try { setRoles(await api.rolesSeance(date)); }
    catch (err) { onErreur(err.message, true); }
  }, [date, onErreur]);

  useEffect(() => { setRoles([]); charger(); }, [charger]);

  /* Les rôles des autres apparaissent sans recharger. */
  useEffect(() => {
    const minuteur = setInterval(() => { if (!document.hidden) charger(); }, 15000);
    return () => clearInterval(minuteur);
  }, [charger]);

  /* Rien de mémorisé sur ce téléphone (autre appareil, données effacées) : on retrouve
     la prochaine séance où la personne s'est déjà positionnée, enregistrée sur le serveur. */
  useEffect(() => {
    if (date) return undefined;
    let vivant = true;
    api.mesRoles(prenom, jour).then(l => {
      if (vivant && l.length && avenir.includes(l[0].date)) { ecrireChoix(l[0].date); setDate(l[0].date); }
    }).catch(() => {});
    return () => { vivant = false; };
  }, [prenom]); // eslint-disable-line react-hooks/exhaustive-deps

  const choisir = d => { ecrireChoix(d); setDate(d); setListe(false); };

  const monRole = (roles.find(r => r.prenom === prenom) || {}).role || null;

  const definir = async role => {
    const suivant = role === monRole ? null : role;   // recliquer annule
    try { setRoles(await api.definirRole(date, prenom, suivant)); }
    catch (err) { onErreur(err.message, true); }
  };

  return (
    <section className="seance">
      <p className="eyebrow">1 · Séance concernée</p>
      <button type="button" className="btn-seance" aria-expanded={liste}
              onClick={() => setListe(l => !l)} disabled={!avenir.length}>
        {date ? libelleSeance(date, jour) : 'Choisir la séance'} <span aria-hidden>▾</span>
      </button>

      {!avenir.length && <p className="note">Plus aucune séance au calendrier de cette année.</p>}

      {liste && (
        <ul className="liste-seances">
          {avenir.map(d => (
            <li key={d}>
              <button type="button" className={`puce-filtre${d === date ? ' actif' : ''}`}
                      onClick={() => choisir(d)}>
                {libelleSeance(d, jour)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="eyebrow" style={{ marginTop: 22 }}>2 · Mon rôle</p>
      <div className="roles">
        {ROLES.map(([cle, libelle]) => (
          <button key={cle} type="button" disabled={!date}
                  className={`btn-role${monRole === cle ? ' actif' : ''}`}
                  aria-pressed={monRole === cle} onClick={() => definir(cle)}>
            {libelle}
          </button>
        ))}
      </div>
      {!date && <p className="note">Choisis d'abord la séance pour activer ton rôle.</p>}

      {date && (
        <div className="equipe">
          <p className="eyebrow">Qui fait quoi</p>
          {roles.length === 0 && <p className="note">Personne ne s'est encore positionné.</p>}
          {ROLES.map(([cle]) => {
            const gens = roles.filter(r => r.role === cle).map(r => (r.prenom === prenom ? 'toi' : r.prenom));
            return (
              <p key={cle} className="ligne-role">
                <b>{LIBELLE_ROLE[cle]}</b> <span>{gens.length ? gens.join(', ') : '—'}</span>
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
