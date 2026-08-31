export default function BarreAction({ onScanner, onManuel }) {
  return (
    <div className="barre">
      <button className="btn-scan" onClick={onScanner}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" />
        </svg>
        Scanner un produit
      </button>
      <button className="btn-secondaire" onClick={onManuel} title="Ajouter sans scanner">+</button>
    </div>
  );
}
