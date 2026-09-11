# heiaapp.no — samlet plan for nettsiden (2026-09-11)

_Startdokument for nettsidesporet. Skrevet etter gjennomgang av
website_project-minnet, HEIAAPP-NO.md, PAYMENTS.md (fase 6), AUTORITET-
KLUBBBETALINGER (fase B), STATUS-HANDOFF, `web/`, Edge Functions, RPC-ene i
00046/00062–00064 og ekstern research (kilder nederst). Beslutningene i
§9 er Brages; resten er anbefaling._

---

## 0. Hvor vi står — fakta (verifisert 2026-09-11)

**Git.** `origin/main` = `Brage` (PR #52 merget 2026-09-10 21:07). Det er
INGENTING å slå sammen. Kun lokal `main` er utdatert (`git pull` når du
står på den). Punkt 1 i forrige samtales rekkefølge er altså gjort.

**Live på heiaapp.no i dag** (Vercel, konto hello@heiaapp.no, Root
Directory `web/`, ren statisk HTML, deployer fra `main`):

| Sti | Status | Merknad |
|---|---|---|
| `/` | plassholderkort | «Mer her snart» + lenker til vilkår/personvern |
| `/betaling?flow=…` | ferdig | Stripe-retur (success/cancel/portal/onboarding/refresh), `heia://lagkassa`-knapp på iOS |
| `/vilkar/`, `/personvern/` | ferdig tekst | tre plassholdere `[JURIDISK SELSKAPSNAVN]`/`[ORGANISASJONSNUMMER]`/`[FORRETNINGSADRESSE]` venter på AS-et |
| `/.well-known/apple-app-site-association` | riktig content-type | appID `D86MWL7V3S.no.heiaapp.heia`, paths `/betaling*`, `/lag*`, `/stott*` |
| `/lag` | **404** | delelinken finnes ikke ennå |
| `/.well-known/assetlinks.json` | 404 | Android App Links — krever Play-signeringssertifikat, hører til Android-sporet |

**Appen.** Bundle-ID `no.heiaapp.heia`, Associated Domains + `heia://`
er inne. TestFlight 1.0 (4) i Testing (interne + Friends and family);
ekstern gruppe/Beta App Review har vært godkjent tidligere. Ingen App
Store-oppføring er offentlig → **det finnes ingen App Store-URL å lenke
til ennå.** Deep links i JS i dag: `heia://lagkassa` og
`heia://ops/claims/<id>`; https-ruten `/lag?kode=` er IKKE håndtert
(`JoinTeamCode` har `prefillCode`-param klar).

**Android.** `applicationId "com.heia2"` + `namespace "com.heia2"` er
RN-malens plassholder. Android er ikke bygget, FCM-push finnes ikke, ingen
Play-konto er omtalt. (Se §1 om hva det betyr for rekkefølgen.)

**Backend for web — ALT ligger klart.** RPC-ene er klient-agnostiske og
gatet på `auth.uid()`/RLS, ikke på klienttype:
- Invitasjon: `redeem_manager_invitation(p_token)` →
  `accepted|awaiting_review|invalid|expired|suspended`;
  `decline_manager_invitation(p_token, p_note)` → `declined|invalid`.
- Klubbetalinger (betalingsansvarlig): `get_club_payments_overview()`,
  `approve_team_support`/`reject_team_support`/`pause_team_support`,
  `issue_manager_invitation`, Edge `stripe-onboarding` (Account Link),
  `club-support-deactivate`.
- Heia Ops: `is_ops_admin()`, `ops_list_club_claims`, `ops_get_club_claim`,
  `ops_approve_club_claim` (krever verifiseringstekst), `ops_reject_club_claim`,
  `ops_request_claim_info`, `ops_list_payment_entities`,
  `ops_issue_manager_invitation`, `ops_revoke_manager_invitation`,
  `ops_confirm_invitation_review`/`ops_reject_invitation_review`,
  `ops_suspend_manager`/`ops_reactivate_manager`/`ops_remove_manager`,
  `ops_move_team_to_club`.
- Klubbsøknad: Edge `submit-club-claim` (server-side Brønnøysund).
- Auth: e-post + passord; bekreftelse og passordreset er **6-sifret kode**
  (`verifyOtp`), IKKE lenker. Det betyr at web trenger ingen redirect-URL-er
  hos Supabase og slipper hele PKCE-fella «flyt startet i app, lenke åpnet
  i Safari».
- Invitasjonslenken bygges av `payments-notify` som
  `WEB_INVITE_BASE_URL + '#' + token`. Secreten er bevisst IKKE satt;
  `WEB_INVITE_LANDING_LIVE = false` i `src/shared/flags.ts` skjuler
  «En annen»-inngangene i appen til landingen finnes.

---

## 1. Rekkefølgen — vurdering av forrige samtales forslag

Forslaget var: 1) merge → 2) pre-launch-pakken (Android-ID først, så
TestFlight) → 3) nettsiden «når appen kan installeres».

**Vurdering:**

1. **Merge er gjort.** Ingen handling.
2. **Android-ID: ja, ta den nå, men som en 5-minutters commit — ikke som
   en port.** Bytt `applicationId`/`namespace` til `no.heiaapp.heia` i
   `android/app/build.gradle` (+ pakkemappe/`MainActivity`-pakke hvis
   Kotlin-filene ligger under `com/heia2`). Irreversibiliteten inntreffer
   først ved første opplasting til Play Console, og den finnes ikke. Selve
   Android-lanseringen er et EGET spor på uker: Play-konto (bør registreres
   på AS-et — personkontoer opprettet etter nov. 2023 må ha ≥12 testere i
   14 dager før produksjon; organisasjonskontoer slipper), FCM-push,
   assetlinks.json med Play-signeringssertifikat, første bygg og
   enhetstest. Ingenting av dette gater nettsiden.
3. **«Nettsiden når appen kan installeres» er feil vei rundt.** Appen KAN
   installeres i dag (TestFlight). Det som mangler er en App Store-URL, og
   den påvirker én konstant på nettsiden (CTA-lenken). Motsatt: App Store
   Connect-innsendingen ber om Support-URL, Personvern-URL og Marketing-URL
   — og App Review ser på nettsiden. Nettsiden er altså INPUT til
   App Store-innsendingen, ikke output. I tillegg er fase B (invitasjons-
   landing → Klubbetalinger → Heia Ops på web) uavhengig av butikken og
   er det som låser opp «En annen»-nominasjon og full dogfood.

**Anbefalt rekkefølge:**
1. Android-ID-commit (i dag, 5 min, ren gradle).
2. Nettsiden — grunnmur + markedssider + `/lag` + fase B-1 (denne uka).
3. Pre-launch-pakken parallelt der den er Brage-ekstern (TestFlight public
   link, ekstern gruppe, privacy nutrition labels, skjermbilder), og
   S5/S6/S8 fra skaleringsplanen som egne skiver før App Store-innsending.
4. App Store-innsending når AS-et finnes (orgnr i vilkår + Apple-konto
   konvertert) — samme port som Stripe live-bytte.

---

## 2. Hva nettsiden ER — tre roller på ett domene

Brages ramme: «info og kommunikasjon for brukere generelt, og admin for
oss og lag-/klubbledere». Det gir tre lag som deler domene, design og
Supabase-prosjekt, men som har ulik teknisk karakter:

| Lag | Sider | Karakter | Auth |
|---|---|---|---|
| **A. Markedssiden** | `/`, `/stott-laget`, `/om`, `/hjelp`, `/vilkar`, `/personvern` | statisk HTML, null JS, SEO | ingen |
| **B. Broene til appen** | `/lag?kode=…`, `/betaling`, `/invitasjon#token` | små, én jobb hver, må virke på telefon i Safari | `/invitasjon` krever innlogging |
| **C. Admin** | `/klubb` (betalingsansvarlig), `/ops` (Heia internt) | klientside-app mot RPC-ene | Supabase-sesjon, RLS/RPC gater alt |

Lag C skal ALDRI ha egne serverhemmeligheter: all autorisasjon skjer i
Postgres (`is_ops_admin`, `is_entity_payment_manager`), akkurat som i
appen. Nettsiden bruker kun anon-nøkkelen + brukerens JWT.

---

## 3. Sitemap v1

**Offentlig**
- `/` — forsiden = FØLELSEN. Én setning («Følg laget. Hei på laget. Støtt
  laget.»-klassen — copy avgjøres i skiva), appens egne skjermer i
  telefonramme (Hjem-feeden, kampkortet i mørkt glass, MÅL-øyeblikket),
  tre mekanismer (feed / live kamp / deling), «Støtt laget»-teaser, CTA.
  **CTA v1 = TestFlight public link** («Bli med i testen — krever
  TestFlight») + e-postfelt («Si fra når Heia er i App Store»). Byttes til
  App Store-badge (offisiell fra Apple Marketing Tools) + Smart App Banner
  (`apple-itunes-app`, virker KUN når appen er live i App Store) på
  lanseringsdagen — én konstant.
- `/stott-laget` — tillitsargumentet: «79 kr i måneden — 60 kr går direkte
  til laget» (fast, offentlig, låst), «mer enn 3 av 4 kroner», hvordan
  klubben aktiverer (klubbsøknad → Heia godkjenner → betalingsansvarlig →
  Stripe), Stripe-trygghet, avslutt når du vil (14 dagers angrerett + alltid
  feiltrekk-refusjon, som i vilkårene). AASA dekker alt `/stott*`.
- `/om` — hvem står bak, hello@heiaapp.no, juridisk blokk (foretaksnavn,
  orgnr, adresse — plassholdere til AS-et), «Heia er ikke Spond»-avsnittet
  i positiv form.
- `/hjelp` — FAQ som også er App Store «Support URL»: bli med i lag med
  kode, roller (trener/lagleder/forelder/supporter), reporter og live kamp,
  Heia Supporter, forlate lag, slette konto, rapportere innhold.
- `/vilkar`, `/personvern` — eksisterende tekst inn i ny layout, innhold
  urørt (kun plassholderne byttes når AS-et finnes).
- `/nytt` (valgfritt, senere) — enkel nyhets-/endringslogg i markdown for
  «kommunikasjon til brukere». Astro content collections gjør dette
  gratis; hopp over i v1 hvis tiden ikke strekker til.

**Broer**
- `/lag?kode=KODE` — delelinken (DEN viktigste markedsflaten — familien
  lander her). Har appen: Universal Link åpner appen rett på JoinTeamCode
  med koden ferdig utfylt. Har ikke appen: varm side «Du er invitert til
  [laget]?» — NEI, v1 viser IKKE lagets navn/tall (aggregat på åpen web er
  en egen personvernbeslutning); siden viser koden stort, «Åpne i Heia»
  (`heia://lag?kode=`), og CTA til TestFlight/App Store. Krever app-siden i
  §4.1.
- `/betaling` — som i dag, men i ny layout. Ny nyanse: `flow=onboarding`
  startet fra web skal si «gå tilbake til fanen» og ikke «gå tilbake til
  appen» (`&src=web`).
- `/invitasjon#token` — fase B-1 (§4.2).

**Admin**
- `/konto` — logg inn / opprett konto / bekreft kode / glemt passord
  (kodebasert, samme som appen). Én flate, gjenbrukes av `/invitasjon`,
  `/klubb`, `/ops`.
- `/klubb` — Klubbetalinger for betalingsansvarlig: status per enhet,
  lagforespørsler (godkjenn/avvis/pause), Stripe-onboarding (Account Link
  hentes i klikkøyeblikket), inviter ny betalingsansvarlig, hendelseslogg.
- `/ops` — Heia Ops: søknadskø m/ detalj og godkjenning m/ verifiserings-
  tekst, «Klubber og roller» (entities, invitasjoner, avviksbekreftelse,
  suspender/reaktiver), flytt lag. Menypunkt vises kun når
  `is_ops_admin()` er sann; RPC-ene håndhever uansett.

---

## 4. Kontrakten mot appen — det som må stemme for at web og app snakker riktig

1. **Delelink = https-lenke, ikke kode.** Appens deleark sender ren tekst;
   bare en lenke blir blå og trykkbar (avtalt 2026-08-19). App-siden:
   (a) `deepLink.ts` lærer `https://heiaapp.no/lag?kode=X` OG
   `heia://lag?kode=X` → `JoinTeamCode {prefillCode: X}` (ren JS, Linking
   er alt koblet); (b) delearket i appen deler
   `https://heiaapp.no/lag?kode=X` i stedet for koden. AASA har `/lag*`
   fra før. Gamle TestFlight-bygg: Universal Link åpner appen på Hjem uten
   prefill — akseptabelt, web-siden viser koden.
2. **Invitasjonslandingen** (fase B-1, låst i AUTORITET §II.5/B3): token
   leses fra fragmentet, fjernes umiddelbart med `history.replaceState`,
   siden laster INGEN tredjepartsskript, tokenet sendes kun i RPC-kallet.
   Supabase-klienten på web settes opp med `detectSessionInUrl: false` så
   den aldri prøver å tolke fragmentet som en auth-respons. Krever
   innlogget + e-postverifisert konto (RPC-en håndhever). Utfallsskjermer:
   accepted («Du er betalingsansvarlig for [juridisk navn]» + neste steg
   Stripe), awaiting_review («bekreftes av Heia» — e-post ≠ invitert),
   invalid/expired/suspended (kontaktvei hello@heiaapp.no). Landingen
   viser juridisk navn, invitert navn og innlogget konto FØR aksept.
   Når den er live: sett `WEB_INVITE_BASE_URL=https://heiaapp.no/invitasjon`
   (Edge-secret) → flipp `WEB_INVITE_LANDING_LIVE = true` (ren JS, men
   TestFlight-brukere ser det først i neste bygg).
3. **Ops-lenker i e-post** bytter `heia://ops/claims/<id>` →
   `https://heiaapp.no/ops/claims/<id>` når `/ops` finnes (B-3). `/ops*`
   holdes BEVISST UTENFOR AASA så ops-lenker alltid lander på web (ops
   finnes både i app og web; web er arbeidsflaten på PC).
4. **Stripe-returer** lander alt på `/betaling` (`WEB_BASE_URL` satt).
   Ingen endring; kun `src=web`-nyansen over.
5. **Supabase-innstillinger (dashboard, Brage):** Site URL →
   `https://heiaapp.no` (kosmetisk for kodeflytene, men riktig). Ingen
   redirect-URL-er trengs så lenge web bruker kodeflytene. Ikke rør
   `secure_password_change`/`minimum_password_length` i dashboard (CLI-eid).
6. **Nye klienttyper og media (D5 fra skaleringsplanen):** web v1 laster
   IKKE opp media, så «reell eksponering først med web» inntreffer ikke.
   Skal web noen gang poste bilder, tas D5 (magic bytes-validering) først.
7. **Delte typer:** RPC-utfallene er strengkontrakter (se §0). Web får en
   liten `contracts.ts` med de samme unionene; ikke bygg en delt pakke før
   det finnes tre ting å dele.

---

## 5. Stackvalget (B4) — anbefaling

**Anbefaling: Astro i `web/`, statisk output, React-øyer kun på sidene
som trenger interaktivitet, `@supabase/supabase-js` i nettleseren. Ingen
SSR-adapter i v1.**

Hvorfor:
- Lag A (markedssidene) blir ren HTML uten JS — raskest, SEO-trivielt,
  og det er Astros standard.
- Lag B/C er per konstruksjon klientside: autorisasjonen bor i Postgres,
  serveren har ingen hemmeligheter, og invitasjonstokenet SKAL aldri nå en
  server (B3). En SSR-løsning med cookies (`@supabase/ssr`) tilfører
  kompleksitet uten å tilføre sikkerhet her.
- Samme lib og samme auth-modell som appen (supabase-js, kodebasert
  bekreftelse/reset) → null redirect-URL-er, null PKCE-fallgruver.
- Vercel: Root Directory `web/` består; Framework Preset byttes til Astro
  (Brage, ett felt). `web/public/` bærer `.well-known/` og `vercel.json`
  består for AASA-headeren. Preview-deploy per PR gir «rigg» på telefon.
- Én founder + Claude: komponenter, layout og TypeScript uten et
  rammeverk som eier serveren.

Ikke valgt: **Next.js** (SSR/cookie-sesjoner og middleware for noe som er
klientgatet — mer flate, samme sikkerhet), **SvelteKit** (godt, men
appen er React — hold én mental modell), **ren HTML videre** (fire sider
går; `/klubb` + `/ops` med lister, skjemaer og felles chrome gjør det
uhåndterlig).

Repo: **bli i app-repoets `web/`** (ett domene = én deploy: AASA +
`/betaling` + forsiden). Splitt tas først den dagen web får egen
utviklingstakt — da må AASA/betaling følge med.

---

## 6. Design på web

- Samme verden som appen: heiaNeon `#02FFAB` som energi (sparsomt),
  heiaDeep/heiaInk for struktur og tekst, mint→daylight→krem som grunn
  (Heia_Claude_Build_Brief-paletten), Nunito ExtraBold som displayfont
  (`assets/fonts/`), kampflater i mørkt stadionglass. Hvite kort = admin
  — unngå.
- Forsiden bygges kode-først med preview-URL på telefon som rigg («bygg,
  én rigg, send, stopp»). Lav-fi-canvas tas kun hvis første runde bommer.
- Skjermbilder til telefonrammen tas fra simulator/telefon av de tre
  telefongodkjente flatene (Hjem-feed m/ frostkort, kampkort i mørkt
  glass, Kalender). Ingen mockups.
- Admin-flatene (`/klubb`, `/ops`) er nytteflater: rolig, tett, lesbar på
  PC — samme tokens, ingen showpiece.
- Ikke last inn tredjeparts-fonts på `/invitasjon` (B3 «ingen
  tredjepartsskript» — Google Fonts er også en tredjepart; self-host
  Nunito i `public/fonts`).

---

## 7. Jus, drift, analytics — praktisk sjekkliste

| Punkt | Krav | Hva vi gjør |
|---|---|---|
| Foretaksnavn + orgnr på nettsiden | foretaksregisterloven § 10-2, ehandelsloven § 8/9 | juridisk blokk i footer + `/om`; plassholdere til AS-et er registrert (samme som vilkår/personvern) |
| Angrerett | angrerettloven; digital tjeneste som starter straks krever eksplisitt samtykke + erkjennelse | vilkårene gir alt 14 dager på nytegning + feiltrekk-refusjon; `/stott-laget` sier det klart; Stripe Checkout-samtykkelinjen sjekkes i fase 6 |
| Cookies | ekomloven § 3-15 (2025): samtykke for alt som lagres på enheten som ikke er strengt nødvendig | markedssidene setter INGEN cookies; auth-lagring på `/klubb`/`/ops` er strengt nødvendig → ingen banner. Analytics uten cookies |
| Analytics | | **Plausible** (EU, cookiefritt, ~6–9 €/mnd) på markedssidene; IKKE på `/invitasjon`. Nevnes i personvernerklæringen. Alternativ: Vercel Web Analytics hvis vi uansett er på Pro |
| Vercel-plan | Hobby forbyr kommersiell bruk («advertising the sale of a product or service») | **Oppgrader til Pro (20 USD/mnd) FØR `/stott-laget` publiseres** — Brage |
| Barn 13+ | Datatilsynet: foreldresamtykke under 13 | står i vilkår/personvern; nettsiden gjentar aldersgrensen på `/hjelp` |
| E-postfangst «kommer snart» | ingen ny databehandler | `waitlist`-tabell i eget Supabase-prosjekt (insert-only RLS, anon), ikke Formspree/Resend Audiences |
| Smart App Banner | virker kun når appen er live i App Store | legges inn på lanseringsdagen |
| assetlinks.json | Android App Links | Android-sporet; krever Play App Signing-fingeravtrykk |

---

## 8. Skiveplan

**I dag (realistisk W0–W2, W3 hvis tiden holder):**
- **W0 Grunnmur (Claude):** Astro-oppsett i `web/` (`public/.well-known`,
  `vercel.json` består), felles layout/tokens/footer m/ juridisk blokk,
  de fire eksisterende sidene migrert med identisk innhold og identiske
  URL-er, Vercel preview. Exit: AASA 200 `application/json` uten redirect,
  `/betaling?flow=success` identisk oppførsel, `/vilkar/` + `/personvern/`
  200. **Brage:** Framework Preset → Astro i Vercel (og Pro-oppgradering
  når `/stott-laget` skal ut).
- **W1 Markedssidene:** `/`, `/stott-laget`, `/om`, `/hjelp` + waitlist-
  tabell (migrasjon) + e-postfelt. Exit: Brage ser forsiden på telefon
  fra preview-URL. **Brage:** TestFlight public link fra App Store Connect
  (TestFlight → gruppe → Enable Public Link).
- **W2 Delelinken:** `/lag?kode=` på web + `deepLink.ts` (https + heia://
  → prefillCode) + delearket deler lenken. Exit: lenke trykket på telefon
  m/ dev-bygg åpner JoinTeamCode med koden; uten app viser siden koden.
- **W3 Fase B-1:** `/konto` + `/invitasjon` mot `redeem`/`decline`. Exit:
  Benjamin-kontoen aksepterer en ops-utstedt invitasjon med e-postmatch →
  aktiv rolle; avvik → awaiting_review. Deretter secret + flagg.

**Neste dager:**
- **W4 `/klubb`** (B-2), **W5 `/ops`** (B-3, e-postene bytter til https),
  **W6 full dogfood** (B-4) → Stange/Nes-testdata ryddes.
- **W7 Lanseringsdag:** App Store-badge + Smart App Banner + orgnr i
  footer/vilkår/personvern (én PR når AS-et er i Brønnøysund).

**Parallelt, Brage-eksternt:** Android-ID-commit (Claude, i dag) ·
TestFlight public link · Vercel Pro · AS/regnskapsfører → orgnr →
Apple-konvertering · Play-konto på AS-et (Android-sporet).

---

## 9. Beslutninger Brage må ta (før første produksjonskode i fase B)

1. **B4 stack:** Astro statisk + React-øyer + supabase-js i nettleser
   (anbefalt) — ja/nei.
2. **Repo:** bli i `web/` i app-repoet (anbefalt) — ja/nei.
3. **CTA før App Store:** TestFlight public link + e-postfelt (anbefalt)
   eller kun e-postfelt.
4. **Analytics:** Plausible (anbefalt) / Vercel WA / ingen i v1.
5. **`/lag` uten app viser koden men aldri lagnavn/tall** (anbefalt v1,
   personvern) — ja/nei.
6. **Ops-lenker alltid til web** (`/ops*` utenfor AASA) — ja/nei.
7. **Er Heia AS registrert / når?** Avgjør når plassholderne kan fjernes.

---

## 10. Kilder (research 2026-09-11)

- Supabase: [server-side auth clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [e-postmaler](https://supabase.com/docs/guides/auth/auth-email-templates)
- Astro/Vercel: [Vercel-adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/), [Vercel: Astro](https://vercel.com/docs/frameworks/frontend/astro), [Hobby fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Web Analytics-pris](https://vercel.com/docs/analytics/limits-and-pricing)
- Apple: [Smart App Banner](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/PromotingAppswithAppBanners/PromotingAppswithAppBanners.html), [AASA components](https://docs.expo.dev/linking/ios-universal-links/), [badges](https://developer.apple.com/app-store/marketing/guidelines/), [TestFlight public link](https://developer.apple.com/testflight/)
- Google: [assetlinks](https://developers.google.com/digital-asset-links/v1/create-statement), [applicationId permanent](https://developer.android.com/build/configure-app-module), [Play testkrav personkonto](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Play-badges](https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/)
- Norsk jus: [foretaksregisterloven § 10-2](https://lovdata.no/lov/1985-06-21-78/§10-2), [ehandelsloven § 9](https://lovdata.no/dokument/NL/lov/2003-05-23-35/%C2%A79), [Forbrukertilsynet angrerett](https://www.forbrukertilsynet.no/lov-og-rett/angrerettloven), [Nkom cookies](https://nkom.no/internett/informasjonskapsler-cookies), [Datatilsynet cookie-veiledning 2025](https://www.datatilsynet.no/aktuelt/aktuelle-nyheter-2025/ny-veiledning-om-samtykke-til-informasjonskapsler-og-sporingsteknologier-er-klar/), [Datatilsynet barn og unge](https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/digitale-tjenester-og-forbrukeres-personopplysninger/barn-og-unge-forbrukere/)
- Analytics: [Plausible data policy](https://plausible.io/data-policy), [Umami cloud FAQ](https://docs.umami.is/docs/cloud/faq)
