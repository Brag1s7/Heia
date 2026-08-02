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

## Sjekklisten (i rekkefølge)

### 1. Hosting (Brage eller Claude m/ tilgang — 15 min)
Cloudflare Pages (gratis) eller tilsvarende statisk host:
1. Koble heiaapp.no til hosten (DNS: CNAME/ALIAS på rot + www).
2. Deploy `web/`-mappen som site-rot.
3. Krav til AASA-filen: serveres på
   `https://heiaapp.no/.well-known/apple-app-site-association`,
   `Content-Type: application/json`, INGEN redirect, gyldig TLS.
   (Cloudflare Pages gjør alt dette riktig ut av boksen.)
4. Røyktest ETTER deploy: `curl -i https://heiaapp.no/.well-known/apple-app-site-association`
   og `https://heiaapp.no/betaling?flow=success` i Safari.

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

### 3. Bytt retur-URL-ene i Edge Functions (Claude — 5 min etter steg 1)
- `stripe-checkout`: success/cancel → `https://heiaapp.no/betaling?flow=…`
- `stripe-onboarding`: return/refresh → `…?flow=onboarding|refresh`
- `stripe-portal`: return → `…?flow=portal`
- Redeploy funksjonene. De gamle tekstsidene består som fallback.

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
