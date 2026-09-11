# PR: heiaapp.no — informasjonssiden og adminløsningen (Brage → main)

_PR-tekst klar til å limes inn. `gh` er ikke innlogget på maskinen, så PR-en
opprettes av Brage: https://github.com/Brag1s7/Heia/compare/main...Brage_

## Hva

**Nettsiden (web/) er nå et Astro-prosjekt** med statiske markedssider og
fire React-øyer mot samme Supabase-prosjekt som appen:

- Markedssider: `/`, `/stott-laget/`, `/om/`, `/hjelp/`, `/lag/?kode=`,
  `/vilkar/`, `/personvern/` (tekst uendret), `/betaling/` (alle fem
  Stripe-flows bevart + `src=web`-variant). AASA bevart i
  `public/.well-known/`.
- `/konto/` — innlogging med appens kontoer (e-post/passord, 6-sifret
  kode for bekreftelse og passordreset), rolleoversikt.
- `/invitasjon/#token` — «Bli betalingsansvarlig»: lesende forhåndsvisning
  (ny RPC `peek_manager_invitation`, migrasjon 00082), eksplisitt
  aksept/avslag, avvik → `awaiting_review`, utløpt/ugyldig/suspendert.
  Tokenet lever kun i minne; ingen tredjepartsskript.
- `/klubb/` — Klubbetalinger for betalingsansvarlige: Stripe-oppsett
  (Account Link), lagforespørsler (godkjenn/avslå), lag (pause/deaktiver/
  fullfør deaktivering), betalingsansvarlige + invitasjoner, historikk.
- `/ops/` — Heia Ops: søknadskø og detalj med Brønnøysund-bevis,
  godkjenn/avslå/be om info, klubber og roller (suspender/reaktiver/fjern,
  invitasjoner, avvikskontroll, flytt lag), hendelseslogg. Direkte lenker
  `/ops/claims/<id>` og `/ops/entities/<id>` via Vercel-rewrite; oppfrisking
  beholder visningen.

**Backend (deployet til prod):**
- Migrasjon `00082_web_invitation_preview.sql` — `peek_manager_invitation`
  (SECURITY DEFINER, search_path m/ pg_temp sist, kun `authenticated`).
- `stripe-onboarding`: aksepterer `entity_id` (web kjenner enheten) og
  `source: 'web'` → retur `/betaling?flow=…&src=web`. Bakoverkompatibel.
- `claim-notify`: ops-lenken blir `https://heiaapp.no/ops/claims/<id>` når
  `WEB_BASE_URL` er satt — **IKKE deployet ennå** (venter på at `/ops` er
  live på main).

**Appen (til neste TestFlight-bygg):**
- `deepLink.ts`: `https://heiaapp.no/lag?kode=X` og `heia://lag?kode=X`
  åpner «Bli med i lag» med koden utfylt i alle tre navigatorrøttene, og
  parkeres gjennom innlogging (flush ved rotbytte).
- `InviteCodeCard`: delearket deler https-lenken + koden.

## Tester

- `scripts/verify-00082.sql` via `scripts/run-sql.mjs`: **19/19 grønne**
  (dør, uinnlogget, ukjent/tomt token, riktig/feil konto, utløp, ingen
  sideeffekt).
- `scripts/verify-web-access.mjs`: **18/18 grønne** — anon nektes på alle
  ops-/manager-RPC-er og peek; innlogget bruker UTEN roller får null/nekt
  på ops og Klubbetalinger, `found=false` på peek, `invalid` på redeem,
  4xx på stripe-onboarding med fremmed enhet. Testbrukeren slettes.
- `__tests__/deepLinkJoinCode.test.ts`: 3/3 grønne.
- Headless Chrome: alle fire flater rendrer innloggingstilstanden uten
  JS-feil; markedssidene på PC (1440) og mobil (390).
- IKKE testet (krever konto med rolle): positive ops-/manager-flyter i
  nettleseren. RPC-ene er de samme som appen bruker og er telefontestet
  (A2/A3), men web-UI-et rundt dem må Brage prøve med sin ops-konto.

## Gjenstående publiseringspunkter (i rekkefølge)

1. **Merge til main** → Vercel prod-deploy. Sjekk at Framework Preset er
   Astro/auto (vercel.json setter `"framework": "astro"`), Root Directory
   `web`.
2. **Vercel Pro** før markedsføring av Støtt laget (Hobby forbyr kommersiell
   bruk).
3. `supabase functions deploy claim-notify` (ops-lenker → web).
4. **Aktiver invitasjonsreisen** når Brage har prøvd `/invitasjon` selv:
   `supabase secrets set WEB_INVITE_BASE_URL=https://heiaapp.no/invitasjon`
   → deretter `WEB_INVITE_LANDING_LIVE = true` i `src/shared/flags.ts` og
   nytt TestFlight-bygg (flagget endrer ikke installerte bygg).
5. Nytt TestFlight-bygg med delelinken (app-endringene over).
6. Selskapsopplysninger (`web/src/config.ts` → `LEGAL`, plassholderne i
   vilkår/personvern) når AS-et er registrert.
7. TestFlight public link / App Store-URL i `web/src/config.ts`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
