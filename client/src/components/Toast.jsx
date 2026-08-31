import { useEffect } from 'react';

export default function Toast({ message, erreur, onFermer }) {
  useEffect(() => {
    const t = setTimeout(onFermer, 2600);
    return () => clearTimeout(t);
  }, [message, erreur, onFermer]);

  return <div className={`toast${erreur ? ' erreur' : ''}`}>{message}</div>;
}
