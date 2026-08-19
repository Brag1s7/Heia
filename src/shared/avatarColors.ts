import {inkOnTeamColor} from './teamColors';

/**
 * Avatarfargene — bakgrunnen bak initialene når noen ikke har profilbilde.
 *
 * ⚠️ TO LISTER, OG DE ER IKKE DEN SAMME. Forskjellen er hele poenget:
 *
 *   AVATAR_HASH_COLORS er FROSSET. Den er inndata til navne-hashen, som
 *   avgjør fargen til alle som ikke har valgt selv — altså nesten alle.
 *   Endrer du innholdet ELLER rekkefølgen, bytter halve laget farge over
 *   natten uten at noen har bedt om det (`% length` flytter seg). Legg
 *   aldri til noe her. Nye farger hører hjemme i lista under.
 *
 *   AVATAR_COLORS er valgpaletten. Den kan vokse fritt, og den INNEHOLDER
 *   alle åtte hash-fargene — så den som allerede liker fargen sin kan
 *   velge nettopp den og gjøre den permanent.
 */
export const AVATAR_HASH_COLORS = [
  '#7C3AED', // lilla
  '#2563EB', // blå
  '#059669', // grønn
  '#D97706', // gyllen
  '#DC2626', // rød
  '#0891B2', // cyan
  '#7C2D12', // brun
  '#4338CA', // indigo
] as const;

export interface AvatarColorOption {
  value: string;
  /** Norsk navn — accessibilityLabel på swatchene. */
  name: string;
}

/**
 * Kuratert valgpalett, samme regel som lagfargen (shared/teamColors):
 * ingen fri fargevelger. Begrunnelsen er en litt annen her — en avatar er
 * liten og gjentas titalls ganger på én skjerm, så nær-hvite og blasse
 * toner blir grøt i en feed, og to nabofarger som knapt skiller seg gjør
 * valget meningsløst. Tolv tydelig ulike toner dekker behovet.
 *
 * Gult er med MED VILJE selv om det krever mørke initialer: det er den
 * eneste virkelig lyse tonen, og uten den er hele paletten mørk og
 * alvorlig. `inkOnAvatarColor` håndterer blekket.
 */
export const AVATAR_COLORS: AvatarColorOption[] = [
  {value: '#DC2626', name: 'Rød'},
  {value: '#DB2777', name: 'Rosa'},
  {value: '#D97706', name: 'Gyllen'},
  {value: '#FFC53D', name: 'Gul'},
  {value: '#059669', name: 'Grønn'},
  {value: '#0F766E', name: 'Petrol'},
  {value: '#0891B2', name: 'Cyan'},
  {value: '#2563EB', name: 'Blå'},
  {value: '#4338CA', name: 'Indigo'},
  {value: '#7C3AED', name: 'Lilla'},
  {value: '#7C2D12', name: 'Brun'},
  {value: '#111827', name: 'Grafitt'},
];

/**
 * Tekstfargen på initialene. Delegerer bevisst til lagfargens
 * luminans-regel: den er den samme vurderingen («er flaten lys nok til at
 * hvit tekst forsvinner?»), den er allerede i produksjon, og to ulike
 * terskler for samme spørsmål ville før eller siden sprikt.
 */
export function inkOnAvatarColor(hex: string): string {
  return inkOnTeamColor(hex);
}

/**
 * Stabil farge fra navnet. Brukes KUN når personen ikke har valgt selv.
 *
 * Merk at den hasher NAVNET, ikke bruker-id-en. Det er bevisst beholdt:
 * fargen skal være den samme på flater som bare kjenner navnet, og — som
 * Brage slo fast da fargevalget ble bestilt — den er ikke ment som en
 * identifikator. Med åtte farger og et lag på over åtte personer gjentar
 * de seg uansett med matematisk nødvendighet.
 */
export function hashedAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_HASH_COLORS[Math.abs(hash) % AVATAR_HASH_COLORS.length];
}

/**
 * Fargen en avatar faktisk skal tegnes med: valgt farge hvis den finnes,
 * ellers navne-hashen. ÉN funksjon, så ingen flate kan komme til å svare
 * annerledes enn en annen.
 *
 * Ugyldige verdier ignoreres i stedet for å tegnes. En rå-klient kan
 * skrive hva som helst i kolonnen (CHECK-en i 00070 er format, ikke
 * palett), og `backgroundColor: 'drop table'` gir en usynlig avatar i
 * stedet for en farget.
 */
export function avatarColorFor(
  name: string,
  chosen?: string | null,
): string {
  return chosen && /^#[0-9a-fA-F]{6}$/.test(chosen)
    ? chosen
    : hashedAvatarColor(name);
}
