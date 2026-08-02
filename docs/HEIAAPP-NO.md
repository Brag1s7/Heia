# heiaapp.no — Universal Links + landingssider (fase 5-bunken)

_Domenet finnes (Brage eier heiaapp.no). Denne bunken gir: pene
landingssider for betaling/onboarding/portal, og Universal Links så
Safari kan hoppe rett tilbake til appen. Selve BETALINGEN forblir
ekstern Safari (Apple 3.2.2(iv), låst) — dette er retur-opplevelsen._

## Hva som ligger klart i repoet (`web/`)

- `web/.well-known/apple-app-site-association` — AASA-filen som forteller
  iOS at heiaapp.no-lenker skal åpne Heia. **NB: bundle-ID-en i filen er
  dagens placeholder (`org.reactjs.native.example.Heia2`) — oppdater den
  når steg 2 er gjort.**
- `web/betaling/index.html` — én side for alle flows
  (`?flow=success|cancel|portal|onboarding|refresh`), Heia-tonene,
  «Åpne Heia-appen»-knapp (skjult til URL-skjemaet finnes).
- `web/vilkar/` + `web/personvern/` — vilkår/personvern (App Store-krav;
  3 TODO-er venter på Brage, se STATUS-HANDOFF §V1-hygiene punkt 5).
- `web/index.html` — minimal plassholder-rotside (hindrer 404 på
  domenet; markedssiden er nettside-prosjektet, ETTER sporet).
- `web/vercel.json` — header-konfig som gir AASA-filen
  `Content-Type: application/json` (Apples krav).

## Sjekklisten (i rekkefølge)

### 1. Hosting (✅ LIVE + RØYKTESTET 2026-08-02)
**Valget er Vercel** (gratis Hobby-plan; se website_project-minnet for
hvorfor ikke Cloudflare: **DNSSec er AKTIV hos Uniweb + SPF/DMARC-
oppføringer finnes — navnetjenerne skal ALDRI flyttes**; vi legger kun
to oppføringer i Uniwebs DNS-panel):
1. ✅ `web/vercel.json` + `web/index.html` er på `main` (PR #28,
   merget 2026-08-02). Repoet bor hos **Brag1s7/Heia** (overført fra
   yps1lon samme dag); Vercel-kontoen er hello@heiaapp.no.
2. vercel.com → Add New → Project → koble GitHub-kontoen **Brag1s7**
   og installer Vercel-appen med tilgang til `Heia` (repo-overføring
   tar IKKE med app-installasjoner — mangler Heia i listen, er det
   dette som mangler) → importer `Heia` → **Root Directory = `web`**,
   Framework Preset = «Other», ingen build command → Deploy.
3. Project → Settings → Domains → legg til `heiaapp.no` (primær) og
   `www.heiaapp.no` (redirect til heiaapp.no).
4. Vercel viser nå de EKSAKTE DNS-verdiene — bruk dem (typisk: A-post
   på rot/`@` → `76.76.21.21`, CNAME på `www` →
   `cname.vercel-dns.com`). Legg inn i Uniwebs DNS-panel
   (home.uniweb.no). Rør ingenting annet der.
5. Vent til Vercel-domenene viser «Valid Configuration» og sertifikatet
   er utstedt (minutter–timer, DNS-propagering).
6. ✅ Røyktestet 2026-08-02: AASA = 200 + `application/json` UTEN
   redirect (Apples krav); `/betaling` + `/vilkar` + `/personvern` +
   rotsiden = 200; `www` → 308 til heiaapp.no med sti+query intakt.
   DNS-postene hos Uniweb ble Vercels NYE anbefalte verdier (A `@` →
   `216.198.79.1`, CNAME `www` → `d21c109e4fde58eb.vercel-dns-017.com`);
   DNSSec + SPF/DMARC urørt.

### 2. Native-runden (Brage kjører — Xcode åpen, appen IKKE på Metro)
**Steg 0 — bundle-ID (VIKTIG, gjør først):** dagens
`org.reactjs.native.example.Heia2` er RN-malens placeholder og må uansett
byttes før App Store. Velg endelig ID (forslag: `no.heiaapp.heia`) i
Xcode → Target Heia2 → Signing & Capabilities. AASA-filen binder seg til
`TEAMID.BUNDLEID` (team: `Q5A6QMRZ4A`) — bytt ID her FØR AASA deployes,
ellers må filen redeployes.
1. Signing & Capabilities → «+ Capability» → **Associated Domains** →
   legg til `applinks:heiaapp.no`.
2. Info → URL Types → legg til skjema **`heia`** (for «Åpne appen»-knappen
   på landingssidene; Universal Links fra redirect viser ofte banner i
   stedet for å auto-åpne — knappen er fallbacken som alltid virker).
3. (Samme runde, valgfritt) in-app-browser for KLUBB-onboardingen:
   `react-native-inappbrowser-reborn` — sjekk RN 0.83-kompat før
   `pod install`. KUN onboarding — aldri betaling.
4. `pod install` + rebuild + ny provisioning (Xcode ordner ved autosign).
5. Appen: lytteren for Universal Links/URL-skjema (`Linking`-håndtering →
   naviger til Lagkassa/Support) — kodes når skjemaet finnes.

### 3. Retur-URL-ene i Edge Functions (✅ FORHÅNDSKODET + DEPLOYET 2026-08-02)
Alle tre funksjonene (`stripe-checkout`, `stripe-onboarding`,
`stripe-portal`) går via `_shared/web.ts` → `landingUrl(flow)`: med
secreten **`WEB_BASE_URL`** satt lander alt på
`https://heiaapp.no/betaling?flow=…`; uten den består dagens
tekstsider (deployet 2026-08-02 — null atferdsendring til secreten
settes). **Secreten er SATT 2026-08-02 (rett etter steg 1-røyktesten)
— alle Stripe-returer lander nå på `heiaapp.no/betaling`.**
Tekstside-funksjonene består som fallback (fjern secreten = tilbake).

### 4. Delbar lagkassa-lenke (neste skive — krever 1–3)
`https://heiaapp.no/lag?kode=INVITEKODE` → åpner appen på laget (installert)
eller viser en varm side med App Store-lenke (ikke installert). **v1 viser
IKKE lagets tall på weben** (aggregatet er for innloggede medlemmer; delbar
side med tall er en egen personvern-/scope-beslutning). Web-checkout for
ikke-medlemmer står fortsatt på «bygger bevisst ikke»-listen.

## Forventningsstyring (viktig)
Universal Links auto-åpner appen ved LENKETRYKK, men ved server-redirect
(Stripe → heiaapp.no) viser Safari ofte siden med et «Åpne i Heia»-banner
øverst i stedet. Landingssiden + knappen ER derfor opplevelsen: pen side,
ett trykk, tilbake i appen. Apple Pay virker allerede uten alt dette.
