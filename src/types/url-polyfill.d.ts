// `react-native-url-polyfill/auto` (importert i `src/lib/supabase.ts`) bytter
// ut React Natives stubb-`URL` med hele WHATWG-implementasjonen i drift.
// Typene følger ikke med byttet, så `new URL(x).pathname` og
// `new URLSearchParams(x).get(y)` — som begge VIRKER på telefonen — er
// ukjente for `tsc`.
//
// Her beskrives bare det vi faktisk bruker. Rent typenivå: ingen kode, ingen
// import, ingenting som havner i bundelen. Utvid lista om vi tar i bruk mer.
interface URL {
  readonly pathname: string;
}

interface URLSearchParams {
  get(name: string): string | null;
}
