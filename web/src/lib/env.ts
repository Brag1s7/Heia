// Miljøvalget for nettsiden er EKSPLISITT. Det finnes ingen reserveverdi.
// En bygging uten PUBLIC_HEIA_ENV, PUBLIC_SUPABASE_URL og
// PUBLIC_SUPABASE_ANON_KEY stopper med en feilmelding i stedet for å peke
// stille på produksjonsdatabasen (punkt 108 i docs/GJENSTÅR.md — en
// forhåndsvisning på Vercel pekte tidligere på prod uten at noe sa fra).
//
// Anon-nøkkelen er offentlig per design — all autorisasjon skjer i Postgres
// (RLS + RPC) — men HVILKET prosjekt nettsiden skriver til er ikke en detalj.
// Samme mønster som appen, som leser `.env` gjennom react-native-config og
// heller ikke har noen innebygd reserveverdi (`src/lib/supabase.ts`).
//
// Hvor verdiene settes:
//   lokalt   `web/.env`  — kopier `web/.env.example`
//   Vercel   Project Settings → Environment Variables, per scope
//            (Production / Preview / Development)

/** Hvilket datamiljø nettsiden er bygget mot. */
export type HeiaEnv = 'production' | 'test' | 'local';

const HEIA_ENVS: readonly string[] = ['production', 'test', 'local'];

const HVOR =
  'Sett den i web/.env lokalt (se web/.env.example) eller i Vercel → Project ' +
  'Settings → Environment Variables. Nettsiden har bevisst ingen reserveverdi; ' +
  'se punkt 108 i docs/GJENSTÅR.md.';

function required(name: string, value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    throw new Error(`[heia/web] ${name} mangler. ${HVOR}`);
  }
  return v;
}

const rawEnv = required('PUBLIC_HEIA_ENV', import.meta.env.PUBLIC_HEIA_ENV);
if (!HEIA_ENVS.includes(rawEnv)) {
  throw new Error(
    `[heia/web] PUBLIC_HEIA_ENV = «${rawEnv}» er ukjent. Lovlige verdier: ` +
      `${HEIA_ENVS.join(', ')}. ${HVOR}`,
  );
}

/** Datamiljøet denne byggingen peker på. Eksplisitt valgt, aldri gjettet. */
export const HEIA_ENV = rawEnv as HeiaEnv;

export const SUPABASE_URL = required(
  'PUBLIC_SUPABASE_URL',
  import.meta.env.PUBLIC_SUPABASE_URL,
);
// `local` er den eneste som får bruke http — `supabase start` serverer på
// http://127.0.0.1:54321. Produksjon og test skal alltid være https.
const URL_FORM = HEIA_ENV === 'local' ? /^https?:\/\/[^/\s]+$/ : /^https:\/\/[^/\s]+$/;
if (!URL_FORM.test(SUPABASE_URL)) {
  throw new Error(
    `[heia/web] PUBLIC_SUPABASE_URL = «${SUPABASE_URL}» ser ikke ut som en ` +
      'adresse for miljøet «' +
      HEIA_ENV +
      '». Forventet https://<prosjekt>.supabase.co uten skråstrek til slutt' +
      (HEIA_ENV === 'local' ? ' (http er bare tillatt for «local»)' : '') +
      `. ${HVOR}`,
  );
}

export const SUPABASE_ANON_KEY = required(
  'PUBLIC_SUPABASE_ANON_KEY',
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

/** Prosjektreferansen, utledet av adressen. Vises i miljømerket, så det er
 *  synlig hvilken database en forhåndsvisning faktisk snakker med. */
const vert = SUPABASE_URL.replace(/^https?:\/\//, '');
export const SUPABASE_PROJECT_REF = vert.endsWith('.supabase.co')
  ? vert.slice(0, -'.supabase.co'.length)
  : vert;

/** localStorage-nøkkelen supabase-js lagrer sesjonen under. */
export const AUTH_STORAGE_KEY = 'heia-web-auth';
/** localStorage-nøkkel for headerens rollecache ({uid, ops, manager, at}). */
export const ROLES_STORAGE_KEY = 'heia-web-roles';
/** Hendelsen øyene sender når sesjonen endres, så headeren kan tegne om. */
export const AUTH_EVENT = 'heia:auth';
