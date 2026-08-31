import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import EcranPrenom from './components/EcranPrenom.jsx';
import Ticket from './components/Ticket.jsx';
import BarreAction from './components/BarreAction.jsx';
import Scanner from './components/Scanner.jsx';
import FicheProduit from './components/FicheProduit.jsx';
import CorrectionType from './components/CorrectionType.jsx';
import Toast from './components/Toast.jsx';

const DUREE_SESSION = 6 * 3600 * 1000; // au-delà, ce sont d'autres courses
const SEUILS_DEFAUT = { rouge: 7, orange: 14, jaune: 30 };

const sessionStockee = () => {
  try { return JSON.parse(localStorage.getItem('session') || 'null'); }
  catch { return null; }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [prenomInitial, setPrenomInitial] = useState('');
  const [vue, setVue] = useState('session');
  const [produits, setProduits] = useState([]);
  const [types, setTypes] = useState([]);
  const [sections, setSections] = useState([]);
  const [seuils, setSeuils] = useState(SEUILS_DEFAUT);
  const [etatServeur, setEtatServeur] = useState(null);
  const [prenoms, setPrenoms] = useState([]);
  const [filtre, setFiltre] = useState(null);   // prénom sélectionné, ou null
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [fiche, setFiche] = useState(null);       // { produit, source, motif }
  const [correction, setCorrection] = useState(null);
  const [toast, setToast] = useState(null);

  const signaler = useCallback((message, erreur = false) => setToast({ message, erreur }), []);

  /* Render et Neon endorment le service après quelques minutes : on les réveille
     dès l'ouverture, pendant que tu saisis ton prénom. Sans ça, le premier scan
     attendrait trente secondes. */
  useEffect(() => { api.reveil().catch(() => {}); }, []);

  /* --- reprise ou ouverture de session --- */
  useEffect(() => {
    const precedente = sessionStockee();
    const fraiche = precedente && Date.now() - new Date(precedente.debut).getTime() < DUREE_SESSION;
    if (fraiche) {
      setSession(precedente);
    } else if (precedente) {
      api.cloturerSession(precedente.id).catch(() => {});
      setPrenomInitial(precedente.prenom); // même personne, la plupart du temps
    }
  }, []);

  /* --- référentiel : types, sections, seuils --- */
  const chargerReferentiel = useCallback(async () => {
    try {
      const [t, s, etat, noms] = await Promise.all([
        api.types(), api.sections(), api.etat(), api.prenoms(),
      ]);
      setTypes(t);
      setSections(s);
      setPrenoms(noms);
      setEtatServeur(etat);
      if (etat.seuils) setSeuils(etat.seuils);
    } catch (err) { signaler(err.message, true); }
  }, [signaler]);

  /* L'écriture du classeur est différée de 1,5 s côté serveur : on relit l'état
     un peu après pour afficher l'heure d'enregistrement, ou l'erreur. */
  const rafraichirEtat = useCallback(async (delai = 2000) => {
    setTimeout(async () => {
      try { setEtatServeur(await api.etat()); } catch { /* sans importance */ }
    }, delai);
  }, []);

  const rafraichir = useCallback(async () => {
    if (!session) return;
    try {
      setProduits(await api.produits(
        vue === 'session' ? { sessionId: session.id } : { prenom: filtre || undefined }
      ));
    } catch (err) { signaler(err.message, true); }
  }, [session, vue, filtre, signaler]);

  useEffect(() => { if (session) chargerReferentiel(); }, [session, chargerReferentiel]);
  useEffect(() => { rafraichir(); }, [rafraichir]);

  /* --- actions --- */

  const ouvrirSession = async prenom => {
    try {
      const nouvelle = await api.ouvrirSession(prenom);
      localStorage.setItem('session', JSON.stringify(nouvelle));
      setSession(nouvelle);
    } catch (err) { signaler(err.message, true); }
  };

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
      const produit = await api.ajouterProduit({ ...charge, session_id: session.id });
      setFiche(null);
      if (vue === 'session') setProduits(p => [produit, ...p]);
      else await rafraichir();
      signaler(`${produit.article} ajouté au ticket`);
      rafraichirEtat();
      chargerReferentiel(); // le nouvel article rejoint les suggestions de son type
    } catch (err) { signaler(err.message, true); }
  };

  const corriger = async champs => {
    try {
      const produit = await api.modifier(correction.id, champs);
      setProduits(liste => liste.map(p => (p.id === produit.id ? produit : p)));
      setCorrection(null);
      signaler(`${produit.article} mis à jour`);
      rafraichirEtat();
    } catch (err) { signaler(err.message, true); }
  };

  const consommer = async id => {
    try {
      const produit = await api.consommer(id);
      setProduits(liste => liste.map(p => (p.id === id ? produit : p)));
      rafraichirEtat();
    } catch (err) { signaler(err.message, true); }
  };

  const supprimer = async id => {
    try {
      await api.supprimer(id);
      setProduits(liste => liste.filter(p => p.id !== id));
      signaler('Retiré du ticket');
      rafraichirEtat();
    } catch (err) { signaler(err.message, true); }
  };

  if (!session) {
    return <EcranPrenom key={prenomInitial} prenomInitial={prenomInitial} onOuvrir={ouvrirSession} />;
  }

  return (
    <>
      <Ticket
        prenom={session.prenom}
        vue={vue}
        onChangerVue={setVue}
        produits={produits}
        seuils={seuils}
        etat={etatServeur}
        prenoms={prenoms}
        filtre={filtre}
        onFiltrer={setFiltre}
        onConsommer={consommer}
        onSupprimer={supprimer}
        onCorriger={setCorrection}
      />

      <BarreAction
        onScanner={() => setScannerOuvert(true)}
        onManuel={() => setFiche({ produit: {}, source: null, base: null, motif: null })}
      />

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
