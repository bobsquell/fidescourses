import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import EcranPrenom from './components/EcranPrenom.jsx';
import Ticket from './components/Ticket.jsx';
import BarreAction from './components/BarreAction.jsx';
import Scanner from './components/Scanner.jsx';
import FicheProduit from './components/FicheProduit.jsx';
import CorrectionType from './components/CorrectionType.jsx';
import Toast from './components/Toast.jsx';

const SEUILS_DEFAUT = { rouge: 7, orange: 14, jaune: 30 };
const SYNCHRO = 15000; // les autres téléphones ajoutent des articles : on relit régulièrement

const prenomStocke = () => {
  try { return localStorage.getItem('prenom') || ''; }
  catch { return ''; }
};
const nomParDefaut = () => `Courses du ${new Date().toLocaleDateString('fr-FR')}`;

export default function App() {
  const [prenom, setPrenom] = useState(prenomStocke);   // la personne connectée sur ce téléphone
  const [session, setSession] = useState(null);         // la session en cours, commune à tous
  const [vue, setVue] = useState('session');
  const [produits, setProduits] = useState([]);
  const [listeSessions, setListeSessions] = useState([]);
  const [revision, setRevision] = useState(0);          // incrémentée à chaque modification, pour relire les détails ouverts
  const [types, setTypes] = useState([]);
  const [sections, setSections] = useState([]);
  const [seuils, setSeuils] = useState(SEUILS_DEFAUT);
  const [etatServeur, setEtatServeur] = useState(null);
  const [filtre, setFiltre] = useState(null);   // prénom sélectionné, ou null
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [fiche, setFiche] = useState(null);       // { produit, source, motif }
  const [correction, setCorrection] = useState(null);
  const [toast, setToast] = useState(null);
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const signaler = useCallback((message, erreur = false) => setToast({ message, erreur }), []);

  /* Render et Neon endorment le service après quelques minutes : on les réveille
     dès l'ouverture, pendant que tu saisis ton prénom. */
  useEffect(() => { api.reveil().catch(() => {}); }, []);

  /* --- session en cours : on rejoint celle du serveur, ou on en crée une --- */
  const synchroniserSession = useCallback(async (creer = false) => {
    try {
      let s = await api.sessionEnCours();
      if (!s && creer) s = await api.ouvrirSession(prenom, nomParDefaut());
      if (!s) return;
      const precedente = sessionRef.current;
      if (precedente && precedente.id === s.id && precedente.nom === s.nom) return;
      if (precedente && precedente.id !== s.id) {
        setProduits([]);
        setFiltre(null);
        signaler(`Nouvelle session : ${s.nom || 'Courses'}`);
      }
      setSession(s);
    } catch (err) { if (creer) signaler(err.message, true); }
  }, [prenom, signaler]);

  useEffect(() => { if (prenom) synchroniserSession(true); }, [prenom, synchroniserSession]);

  /* --- référentiel : types, sections, seuils --- */
  const chargerReferentiel = useCallback(async () => {
    try {
      const [t, s, etat] = await Promise.all([api.types(), api.sections(), api.etat()]);
      setTypes(t);
      setSections(s);
      setEtatServeur(etat);
      if (etat.seuils) setSeuils(etat.seuils);
    } catch (err) { signaler(err.message, true); }
  }, [signaler]);

  const rafraichirEtat = useCallback(async (delai = 2000) => {
    setTimeout(async () => {
      try { setEtatServeur(await api.etat()); } catch { /* sans importance */ }
    }, delai);
  }, []);

  const rafraichir = useCallback(async (silencieux = false) => {
    if (!session || vue !== 'session') return;
    try {
      setProduits(await api.produits({ sessionId: session.id }));
    } catch (err) { if (!silencieux) signaler(err.message, true); }
  }, [session, vue, signaler]);

  const chargerSessions = useCallback(async () => {
    try { setListeSessions(await api.listeSessions()); }
    catch (err) { signaler(err.message, true); }
  }, [signaler]);

  useEffect(() => { if (prenom) chargerReferentiel(); }, [prenom, chargerReferentiel]);
  useEffect(() => { rafraichir(); }, [rafraichir]);
  useEffect(() => {
    if (prenom && vue === 'sessions') chargerSessions();
  }, [prenom, vue, revision, chargerSessions]);

  /* Les achats des autres apparaissent sans recharger la page. */
  useEffect(() => {
    if (!prenom) return undefined;
    const tick = () => {
      if (document.hidden) return;
      synchroniserSession();
      rafraichir(true);
    };
    const minuteur = setInterval(tick, SYNCHRO);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(minuteur); document.removeEventListener('visibilitychange', tick); };
  }, [prenom, synchroniserSession, rafraichir]);

  /* --- connexion --- */

  const connecter = valeur => {
    try { localStorage.setItem('prenom', valeur); } catch { /* navigation privée */ }
    setPrenom(valeur);
  };

  const deconnecter = () => {
    try { localStorage.removeItem('prenom'); } catch { /* idem */ }
    setPrenom('');
    setSession(null);
    setProduits([]);
    setFiltre(null);
    setVue('session');
  };

  /* --- sessions --- */

  const demarrer = s => {
    setSession(s);
    setProduits([]);
    setFiltre(null);
    setVue('session');
  };

  const nouvelleSession = async nom => {
    try {
      const s = await api.ouvrirSession(prenom, nom || nomParDefaut());
      demarrer(s);
      signaler(`Session « ${s.nom} » démarrée`);
    } catch (err) { signaler(err.message, true); }
  };

  const rouvrirSession = async s => {
    try {
      demarrer(await api.rouvrirSession(s.id));
      signaler(`« ${s.nom || 'Courses'} » reprise`);
    } catch (err) { signaler(err.message, true); }
  };

  const renommerSession = async (id, nom) => {
    try {
      const maj = await api.renommerSession(id, nom);
      setListeSessions(l => l.map(s => (s.id === id ? { ...s, nom: maj.nom } : s)));
      if (session && session.id === id) setSession(s => ({ ...s, nom: maj.nom }));
    } catch (err) { signaler(err.message, true); }
  };

  const supprimerSession = async id => {
    try {
      await api.supprimerSession(id);
      setListeSessions(l => l.filter(s => s.id !== id));
      if (session && session.id === id) {
        setSession(null);
        setProduits([]);
        synchroniserSession(true);   // une autre session ouverte, ou une nouvelle
      }
      signaler('Session supprimée');
    } catch (err) { signaler(err.message, true); }
  };

  /* --- articles --- */

  const surCode = useCallback(async code => {
    setScannerOuvert(false);
    if (navigator.vibrate) navigator.vibrate(60);

    // La fiche s'ouvre tout de suite avec le code : tu vois que le scan a été
    // pris en compte, et tu peux déjà saisir pendant que la recherche tourne.
    setFiche({ produit: { code_barres: code }, source: null, base: null,
               motif: null, provisoire: false, recherche: true });

    const fini = maj => setFiche(f =>
      (f && f.produit.code_barres === code ? maj(f) : f)); // fiche fermée entre-temps : on n'écrase rien

    try {
      const r = await api.lookup(code);
      fini(() => ({
        produit: r.produit,
        source: r.trouve ? r.source : null,
        base: r.base,
        motif: r.motif,
        provisoire: r.provisoire,
        recherche: false,
      }));
    } catch {
      fini(f => ({ ...f, recherche: false }));
    }
  }, []);

  const ajouter = async charge => {
    try {
      const produit = await api.ajouterProduit({ ...charge, session_id: session.id, ajoute_par: prenom });
      setFiche(null);
      setProduits(p => [produit, ...p]);
      setRevision(r => r + 1);
      signaler(`${produit.article} ajouté au ticket`);
      rafraichirEtat();
      chargerReferentiel(); // le nouvel article rejoint les suggestions de son type
    } catch (err) { signaler(err.message, true); }
  };

  /* Les modifications valent partout : ticket en cours et détail d'une session. */
  const appliquer = produit => {
    setProduits(liste => liste.map(p => (p.id === produit.id ? produit : p)));
    setRevision(r => r + 1);
    rafraichirEtat();
  };

  const corriger = async champs => {
    try {
      const produit = await api.modifier(correction.id, champs);
      appliquer(produit);
      setCorrection(null);
      signaler(`${produit.article} mis à jour`);
    } catch (err) { signaler(err.message, true); }
  };

  const consommer = async id => {
    try { appliquer(await api.consommer(id)); }
    catch (err) { signaler(err.message, true); }
  };

  const changerQuantite = async (actuel, delta) => {
    const total = Math.max(0, (actuel.quantite_total || 0) + delta);
    try {
      appliquer(await api.modifier(actuel.id, {
        quantite_total: total,
        quantite_utilisee: Math.min(actuel.quantite_utilisee || 0, total),
      }));
    } catch (err) { signaler(err.message, true); }
  };

  const supprimer = async id => {
    try {
      await api.supprimer(id);
      setProduits(liste => liste.filter(p => p.id !== id));
      setRevision(r => r + 1);
      signaler('Article retiré');
      rafraichirEtat();
    } catch (err) { signaler(err.message, true); }
  };

  if (!prenom) return <EcranPrenom onOuvrir={connecter} />;

  return (
    <>
      <Ticket
        prenom={prenom}
        session={session}
        vue={vue}
        onChangerVue={setVue}
        produits={produits}
        listeSessions={listeSessions}
        revision={revision}
        seuils={seuils}
        etat={etatServeur}
        filtre={filtre}
        onFiltrer={setFiltre}
        onNouvelleSession={nouvelleSession}
        onRouvrirSession={rouvrirSession}
        onRenommerSession={renommerSession}
        onSupprimerSession={supprimerSession}
        onDeconnecter={deconnecter}
        onQuantite={changerQuantite}
        onConsommer={consommer}
        onSupprimer={supprimer}
        onCorriger={setCorrection}
      />

      {vue === 'session' && session && (
        <BarreAction
          onScanner={() => setScannerOuvert(true)}
          onManuel={() => setFiche({ produit: {}, source: null, base: null, motif: null })}
        />
      )}

      {scannerOuvert && <Scanner onCode={surCode} onFermer={() => setScannerOuvert(false)} />}

      {fiche && (
        <FicheProduit
          key={fiche.produit.code_barres || 'manuel'}
          produit={fiche.produit}
          source={fiche.source}
          base={fiche.base}
          motif={fiche.motif}
          provisoire={fiche.provisoire}
          recherche={fiche.recherche}
          types={types}
          sections={sections}
          onValider={ajouter}
          onAnnuler={() => setFiche(null)}
        />
      )}

      {correction && (
        <CorrectionType
          produit={correction}
          types={types}
          sections={sections}
          onValider={corriger}
          onAnnuler={() => setCorrection(null)}
        />
      )}

      {toast && (
        <Toast message={toast.message} erreur={toast.erreur} onFermer={() => setToast(null)} />
      )}
    </>
  );
}
