/* Calendrier des séances de l'année. Pour les saisons suivantes, il suffit de
   remplacer cette liste (format AAAA-MM-JJ, ordre chronologique). */
export const SEANCES = [
  '2026-10-06', '2026-10-17', '2026-11-10', '2026-11-24', '2026-12-08',
  '2027-01-05', '2027-01-19', '2027-02-02', '2027-03-02', '2027-03-16',
  '2027-03-30', '2027-04-27', '2027-05-11', '2027-05-25', '2027-06-08', '2027-06-22',
];

/* Date du jour en heure locale, au même format que le calendrier. */
export const aujourdhui = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Les séances encore à venir, celle du jour comprise : la liste se vide
   d'elle-même à mesure que le calendrier avance. */
export const seancesAVenir = (jour = aujourdhui()) => SEANCES.filter(d => d >= jour);

export const libelleSeance = (date, jour = aujourdhui()) => {
  const texte = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long' });
  return date === jour ? `${texte} (aujourd'hui)` : texte;
};
