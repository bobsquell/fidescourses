import { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

/* Deux décodeurs, un même <video> : celui du navigateur quand il existe (Chrome,
   rapide et sans dépendance), ZXing sinon (Safari iOS, Firefox). */
export default function Scanner({ onCode, onFermer }) {
  const videoRef = useRef(null);
  const [message, setMessage] = useState('Cadre le code-barres');

  useEffect(() => {
    let annule = false;
    let flux = null, raf = null, controles = null;

    const emettre = code => {
      if (annule) return;
      annule = true;              // un seul code par ouverture
      onCode(String(code).trim());
    };

    const natif = async () => {
      const dispo = await BarcodeDetector.getSupportedFormats().catch(() => FORMATS);
      const retenus = FORMATS.filter(f => dispo.includes(f));
      const detecteur = new BarcodeDetector({ formats: retenus.length ? retenus : dispo });

      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      });
      if (annule) return;
      const video = videoRef.current;
      video.srcObject = flux;
      await video.play();

      const tick = async () => {
        if (annule) return;
        try {
          const codes = await detecteur.detect(video);
          if (codes.length) return emettre(codes[0].rawValue);
        } catch { /* image non exploitable, on continue */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const secours = async () => {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'), import('@zxing/library'),
      ]);
      if (annule) return;
      const F = BarcodeFormat;
      const indices = new Map([
        [DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE]],
        [DecodeHintType.TRY_HARDER, true],
      ]);
      const lecteurZxing = new BrowserMultiFormatReader(indices, { delayBetweenScanAttempts: 100 });
      controles = await lecteurZxing.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
        videoRef.current,
        resultat => { if (resultat) emettre(resultat.getText()); }
      );
      if (annule) controles.stop();
    };

    ('BarcodeDetector' in window ? natif() : secours()).catch(err => {
      if (annule) return;
      setMessage(err.name === 'NotAllowedError'
        ? 'Accès caméra refusé. Autorise-le dans les réglages du navigateur.'
        : `Caméra indisponible : ${err.message}`);
    });

    return () => {
      annule = true;
      if (raf) cancelAnimationFrame(raf);
      if (flux) flux.getTracks().forEach(t => t.stop());
      if (controles) controles.stop();
    };
  }, [onCode]);

  // Fige la page derrière : sur iOS elle défile sous le scanner et décale l'image.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = avant; };
  }, []);

  // Couper la caméra dès que l'écran passe en arrière-plan.
  useEffect(() => {
    const surVisibilite = () => document.hidden && onFermer();
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  }, [onFermer]);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted autoPlay />
      <div className="viseur"><span /><span /><span /><span /></div>
      <p className="scanner-msg">{message}</p>
      <button className="btn-fermer" onClick={onFermer} aria-label="Fermer le scanner">
        Fermer
      </button>
    </div>
  );
}
