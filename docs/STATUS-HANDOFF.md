# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-08-01 (kveld). **NYESTE SPOR: 💳 BETALINGER — fase 3
(claiming + manuell godkjenning + Stripe-onboarding) er KODET + DEPLOYET +
DB-VERIFISERT 19/19 samme dag. GJENSTÅR I FASE 3: Brages telefontest
(ende-til-ende i sandbox — testliste i «💳 BETALINGSSPORET» under) +
fase 3-review. GATE: fase 4 (checkout i appen) starter IKKE før reviewen
er tatt.** Se «💳 BETALINGSSPORET» rett under + `docs/PAYMENTS.md`
(sannhetskilden for alle betalingsbeslutninger, inkl. fase 3-detaljene,
ops-runbooken for manuell godkjenning og fase 4-kontrakten).**
Forrige skive: P9 KALENDEREN — RYTME, IKKE
GRID (design-polish-planen), OMLAGT etter første telefontest:
kalenderkortet er nå en KOMPAKT HERO med Hjem-heroens designspråk
(mint→krem-gradient + banedekor, type-pill, dag + tid i displayfonten,
RSVP-progress) — kamp på mørk stadionflate MED RINGEN (flomlys av),
mint avspark og stillingen som bunnrad. RUNDE 3 samme dag:
hendelsessidens infokort = samme hero-flate (ny delt `HeroSurface`), og
kommende kamp i HJEM-heroen er også stadionmørk med ring.
Månedsseksjoner + dempet arkiv består. ✅ GODKJENT på telefon 2026-07-31
(«Alt dette ser bra ut») — **HELE P1–P9-PLANEN ER I MÅL.** LÅST
samtidig: INGEN visningstoggle i kalenderen i v1 (Brage spurte selv;
listen ER visningen — uke/måned tas opp ved reell tetthet). Se «🗓 P9»
under.** Fra før: P8
HERO-KARUSELL er FERDIG (godkjent 2026-07-31, se
«🎠 P8»); P7 PROFIL-POLISH er FERDIG
(godkjent 2026-07-31); P6 VARSLER-LISTEN er FERDIG (godkjent på telefon
2026-07-31); P5 + P5B KAMPFORLØPET + HENDELSESSIDEN er FERDIG (godkjent
2026-07-31); P4 LAGINNSTILLINGER + KLUBBLOGO er FERDIG (godkjent
2026-07-31; migrasjoner `00034`–`00036` deployet); P3 HEADEREN, P2
MÅL-ØYEBLIKKET og P1 SKELETONS er FERDIG; LAGFARGE er FERDIG;
SESONGFLATEN + TURNERINGER + VÅR/HØST-SESONGER (migrasjoner
`00030`–`00033` deployet, flyt godkjent og pushet).
LÅST underveis: ingen toppscorer/spillerstatistikk før strukturert
spillerstall; sesong = vår/høst-halvår; turnering = enkel kampsamling;
lagfarge = kuratert palett, aldri fri velger; **klubblogo bor på KLUBBEN,
write-once; laglogo = fri override**. **Skive 6 (app-ikon + launch
screen) er FERDIG.** Fortsatt uverifisert: **KAMPRAPPORTEN (skive 5)**.
**Neste: planens backlog eller kandidat 2 (kommentarer + heiing synlig
i kamptidslinja)** — se punkt 5 under. Design skive 1–5 er merget (PR #17),
Fase 4–9 (PR #16)._

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## 💳 BETALINGSSPORET (aktivt spor — startet 2026-08-01)

**Sannhetskilden er `docs/PAYMENTS.md`** — beslutningsbok, fasetabell, alle
låste invariants og fase 0-funnene. Kortversjonen:

- **Modellen (LÅST + teknisk BEKREFTET i sandbox):** Stripe Connect,
  destination charges + `on_behalf_of`, klubben (juridisk enhet med orgnr)
  er KYC-mottaker, laget er allokering, Heia tar application fee, webhooks
  er eneste sannhetskilde. 79 kr/mnd; splitten (75/25 vs fast 60) er ULÅST
  og ligger som data i `support_offerings` — ALDRI hardkodet.
- **Fase 0 (✅ ferdig + godkjent 2026-08-01):** 16 bevispunkter bevist i
  Stripe-sandbox. Spike-mappen `~/Documents/Heia-Stripe-Spike/` (UTENFOR
  repo, med vilje): RUNBOOK.md, RAPPORT.md, logs/. `.env` der har
  sandbox-nøkkelen — aldri i repo/chat.
- **Fase 1 (✅ DEPLOYET + VERIFISERT 2026-08-01):** migrasjon
  `00037_payments_domain.sql` — 9 tabeller, deny-by-default RLS (kun to
  smale klient-SELECT-er), immutability-triggere (offerings versjonert,
  transaksjoner append-only), `get_payment_account_for_team_space()`
  (gatet på lagmedlemskap + service role), dropp av døde felt
  (`profiles.stripe_customer_id`, `team_spaces.stripe_account_id` —
  kontrollert ubrukt). Pushet med GO fra Brage (uten backup — Brages
  eksplisitte valg; migrasjonen er transaksjonell og tabellene var nye),
  deretter **`verify-00037.sql` i dashboardets SQL-editor: 28/28 PASS**
  (alle invariants, kapabilitetsoppslag i 4 varianter, RLS som simulert
  bruker; full tabell i `docs/PAYMENTS.md`). Scriptet ligger i
  `~/Documents/Heia-Stripe-Spike/` og ruller alltid tilbake.
  Committet som `66e22a1`.
- **Fase 2 (✅ DEPLOYET + SANDBOX-VERIFISERT 2026-08-01):**
  `stripe-webhook` Edge Function (`supabase/functions/stripe-webhook/` +
  `_shared/stripe.ts` — håndrullet, uten npm:stripe, API-versjon pinnet
  `2026-07-29.dahlia`). Idempotent (webhook_events-upsert), rekkefølge-
  agnostisk (hendelsen er trigger, sannheten GET-es fresh fra Stripe),
  rent observerende (aldri pengeflyttende kall). To endepunkter i sandbox
  (platform + connect for account.updated), to signatur-secrets satt som
  Edge Function-secrets + speilet i spike-`.env`. **Verifisert med EKTE
  sandbox-events:** signaturavvisning (400), account.updated ende-til-ende
  (konto-rad → active), duplikatvern (attempts forble 1), skip-spor for
  ukjent konto. Testradene i DB er ryddet. **Bevisst restanse: pengeveien
  (invoice.paid → transaksjonsrad) kjøres live først i fase 4s første
  checkout** — detaljer og fase 4-KONTRAKTEN (metadata på sesjon +
  subscription_data) i PAYMENTS.md §Fase 2. **REVIEW TATT 2026-08-01:
  GODKJENT uten justeringer; pengevei-testen i fase 4 er BESLUTTET.**
- **Fase 3 (✅ KODET + DEPLOYET + DB-VERIFISERT 19/19 2026-08-01 — venter
  Brages telefontest + review):** migrasjon `00038_club_claiming.sql`
  (`submit_club_claim` med mod 11-orgnr-sjekk + én-åpen-claim-index;
  `approve_club_claim`/`reject_club_claim` som service-role-only ops-
  funksjoner — godkjenning skaper enhet+link+konto atomisk og GJENBRUKER
  enhet/konto ved samme orgnr; `get_support_activation_status` for admin-
  skjermen, ikke-admin → NULL). Edge Functions `stripe-onboarding`
  (lat kontoopprettelse med Idempotency-Key = kontorad-id + Account Link i
  klikkøyeblikket) og `stripe-onboarding-return` (offentlig landingsside for
  Stripes redirect — domene er fortsatt fase 4/6). App: nytt kort «Støtte
  fra supportere» i Laginnstillinger → ny `SupportSetupScreen` med hele
  flyten (skjema → til vurdering → avslag/godkjent → «Fortsett hos Stripe» +
  «Del lenken» → AKTIV). `verify-00038.sql` i spike-mappen: **19/19 PASS**
  mot prod-DB (ruller alltid tilbake). Ops-runbook for manuell godkjenning:
  PAYMENTS.md §Fase 3.
- **Gate-regel (LÅST): hver fase stopper for Brages review før neste.**
  Fase 4 (checkout i appen) venter på fase 3-reviewen.
- SupportScreen-mockupen (49/399 kr + «80 % til laget») er fortsatt BEVISST
  urørt til fase 4 — tallene der er feil med vilje inntil offering-data
  finnes.

### 📱 Fase 3 — test dette på telefonen (Metro-reload holder)
1. Profil → Laginnstillinger (som trener): nytt kort «Støtte fra
   supportere» nederst → åpner skjermen med intro + søknadsskjema
   (e-post prefylt, klubbnavn prefylt som juridisk navn).
2. Send søknaden med klubbens EKTE orgnr (mod 11-sjekken avviser tastefeil
   — prøv gjerne et feil siffer først og se feilmeldingen).
3. Godkjenn søknaden i dashboardets SQL-editor (runbooken i PAYMENTS.md
   §Fase 3 — claim-id-en får du fra spørringen der).
4. Tilbake i appen (pull-to-refresh): kortet viser «GODKJENT» →
   «Fortsett hos Stripe» åpner sandbox-onboarding i Safari (Stripes
   testdata: testtelefon 000 000 0000, OTP 000000 — jf. spike-RUNBOOK
   steg 4). «Del lenken med klubben» gir Share-arket.
5. Fullfør onboardingen → tilbake i appen flipper account.updated-webhooken
   status → skjermen viser «AKTIV» med orgnr + mottaker (AppState-lytteren
   refetcher når du kommer fra Safari; ellers pull-to-refresh).
6. Som forelder: Laginnstillinger finnes ikke (som før) — og RPC-en svarer
   NULL for ikke-admins (verifisert i test 16).

---

## ▶️ NESTE — start her

**1. ✅ Git er ryddet** (2026-07-30 kveld). PR #17 er merget til `main`,
squash-konflikten er løst med `-s ours` (`474e46c`), alt er pushet, og
`Brage..origin/main` = 0. **En ny PR fra `Brage` er konfliktfri nå.** Se
«🔁 Squash-mønsteret» i git-seksjonen for oppskriften neste gang.

**2. ✅ Sesongflaten er KODET og sett på telefon** (produktkandidat 5).
Migrasjonene `00030`+`00031` er deployet. Bruker fant at toppscorerlisten
viste fritekst → **LÅST beslutning: ingen spillerstatistikk før strukturert
spillerstall finnes; toppscorerne er fjernet** (detaljer i seksjonen
«✅ SESONGFLATEN» under). Gjenstår kun: reload og se at flaten står riktig
uten scorer-seksjonen.

**3. ✅ TURNERINGER + VÅR/HØST-SESONGER er KODET og OMLAGT etter første
brukertest** (migrasjoner `00032`+`00033` deployet). Brukeren likte ikke
turneringen som kalenderkort — nå bor turneringene i sesongsidens velger
(«Vår 2026 · Høst 2026 · 🏆 Hamar Cup» + «+ Ny turnering»), kalenderen viser
kampene, og kampskjemaet har et «Turnering»-felt når det finnes turneringer.
Se seksjonen «✅ TURNERINGER + VÅR/HØST-SESONGER» for modellen og testlisten.
**Bruker godkjente flyten 2026-07-30 (natt) → alt er committet og pushet.**

**4. ✅ LAGFARGE er FERDIG** — verifisert på telefon av bruker og committet
2026-07-31. Kuratert palett ved lagopprettelse + «Lagfarge»-rad på Profil
(kun trener/lagleder/admin) + mørke initialer på gult lagmerke.

**5. 🗺 DESIGN-POLISH-PLANEN er i gang: `docs/DESIGN-POLISH-PLAN.md`** —
9 skiver (P1 skeletons → P2 MÅL-øyeblikket → P3 header, deretter P4–P9) +
backlog. Brages valgte rekkefølge. **P1–P9 er FERDIG (alle godkjent på
telefon 2026-07-31) — HELE P-PLANEN ER I MÅL. P9 endte som kompakte
hero-kort etter tre retningsrunder (se «🗓 P9» under), og beslutningen
«ingen visningstoggle i kalenderen i v1» er LÅST. Gjenstår: backloggen
i planen, deretter kandidat 2 (kommentarer + heiing i kamptidslinja).**
LÅST underveis: **klubblogo bor på KLUBBEN** (`clubs.logo_url` finnes alt),
write-once for lagadmin i klubben, aldri overskriving i MVP — detaljer og
begrunnelse i planens P4. Start design-samtaler med: «Les
docs/STATUS-HANDOFF.md og docs/DESIGN-POLISH-PLAN.md, og ta neste åpne
punkt.»

Deretter (etter polish-planen): kandidat 2 (kommentarer + heiing synlig i
kamptidslinja).

**Fortsatt uverifisert (din jobb):** skive 5 (kamprapporten). **Skive 6,
LAGFARGEN og P1–P9 er FERDIG** (bruker-verifisert 2026-07-30/31).

---

## 🗓 P9 — KALENDEREN: RYTME, IKKE GRID (✅ FERDIG — godkjent på telefon 2026-07-31)

Niende og siste P-skive i design-polish-planen. **To retningsrunder
samme dag:** Claude anbefalte «miniatyr av hendelsessiden» (P5B-bånd på
hvite kort) og Brage valgte den i samtalen — men AVVISTE den på telefon:
for store hvite «admin»-flater, og spilte kamper ble dobbelt mørke-tunge
(bånd + stripe). **Brages endelige retning (GJELDER): kompakt
hero-variant** — Hjem-heroens designspråk i kalenderformat (mint/varm
gradient, runde former, svak banegrafikk, type-chip, dato/tid i kortet,
RSVP/progress nederst), kamp mørk/dramatisk, ingen store hvite flater;
skannbar OG umiddelbart samme Heia som Hjem. Ingen migrasjon, ingen
native-deps — ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra
før).

- **`EventCard` er skrevet om til en kompakt hero.** Lys variant
  (trening/sosialt/turnering/annet): SAMME mint→krem-gradient og
  banedekor som NextEventHero (arcs skalert ned), type-pill med prikk +
  dagetikett (heroens dayLabel: «I dag», «I morgen», «Fredag 12. jun») +
  tid i displayfonten (19, heiaDeep), tittel 18, MapPin-rad,
  mint-progress + «N kommer». Datoblokken (SØN/17/JUN) er borte —
  dagetiketten bærer datoen.
- **Kamp = mørk/dramatisk:** `StadiumSurface` med **RINGEN PÅ og flomlys
  AV** (ringen er kampens signatur — Brage OPPHEVET «maks ett sted per
  skjerm»-regelen i runde 3, kommentaren i StadiumSurface.tsx er
  oppdatert; flomlyset er live-kampens dramatikk — kommende/spilt kamp
  skal være «litt svakere»), kamp-pill, mint avsparkstid, sted i
  stadiumDim.
  Standardtittelen «Kamp mot Lyn» strammes til «Mot Lyn» (pillen sier
  alt Kamp); egne titler vises som de er. **Spilt/pågående kamp:
  stillingen som bunnrad I kortet** (label + evt. SEIER-pill + score i
  mint display) — ingen egen stripe-flate lenger, kortet ER mørkt.
  Live: coral «PÅGÅR NÅ» + prikk; `featured` = coral kant.
- **Avlyst kamp:** lys variant med nøytral «Avlyst»-pill — en avlyst
  kamp er ingen kampdag.
- **RSVP-progressen** (mint-fyll + «N kommer») skjules i arkivet, på
  avlyste, og når stillingen har tatt over kortet. RSVPBar-komponenten
  lever videre på hendelsessiden.
- **Fra runde 1 består:** månedsseksjoner i stedet for «Kommende»
  («August»; «Januar 2027» ved annet år), dempede månedsskiller
  (tertiær, ingen mint-strek) i arkivet, `past`-prop (opacity 0.6 +
  skjult oppmøte — kun kalenderen sender den), og `EventCardSkeleton`
  som speiler kortformen (pill + tid, linjer, progress-bone).
- Turneringslisten på hendelsessiden bruker samme kort → kampene der er
  mørke kompakthero-kort.
- **LÅST (Brage spurte selv ved godkjenningen): ingen visningstoggle i
  v1.** Listen er kalenderens ene, gjennomtenkte visning — en toggle
  dobler designflaten, og hero-kortene har ingen god grid-form.
  Uke-/månedsvisning tas opp ved reell tetthet (turneringshelger, flere
  lag) eller når foreldre faktisk spør.

**Runde 3 (samme dag — Brages telefonfunn på hendelsessiden + Hjem):**
- **Hendelsessidens infokort = samme hero-flate:** P5B-aksentbåndet er
  erstattet av ny delt **`HeroSurface`** (components — StadiumSurfaces
  LYSE tvilling: mint→krem-gradient + banedekor, gjenbrukes av
  EventCard) med type-pill, stor tid (24, heiaDeep), dato i fet, tittel,
  sted og beskjed. Avlyst kamp får nøytral «Avlyst»-pill.
  Kampdag-platta, live-modus og kamprapporten er urørt (de er alt på
  stadionspråket — kampdag-platta har hatt ringen hele tiden).
- **Kommende kamp på HJEM-heroen er stadionmørk:** `NextEventHero`
  rendrer kamp på StadiumSurface med ring, flomlys av, mint avspark,
  «Mot X»-tittelregelen og RSVP-progress på mørk track — samme uttrykk
  som kalenderens kampkort («samme hero» — Brages krav). Lys hero for
  alt annet er urørt; P8-karusellen selv er ikke endret.

### Test dette først (Metro-reload)
1. Kalenderen: trening/sosialt/turnering = kompakte gradient-hero-kort
   (pill + dagetikett + stor tid + sted + «N kommer»-progress) — skal
   umiddelbart kjennes som Hjem-heroen, ingen hvite adminflater.
2. En kommende kamp: mørkt stadionkort med RINGEN nede til høyre, mint
   avsparkstid, «Mot X» — og RSVP-progress på mørk track. En kamp med
   egen tittel («Seriefinalen») viser den i stedet. Roligere enn
   live-banneret (ingen flomlys-glød).
3. En spilt kamp: mørkt kort med «SLUTTRESULTAT»-bunnrad + SEIER-pill
   ved seier — ÉN mørk flate, ingen stripe-i-kortet.
4. Live kamp: coral kant + «PÅGÅR NÅ» med prikk; LiveBadge på
   «I dag»-etiketten.
5. Arkivet: kortene er dempet, oppmøtet er skjult, og dempet
   månedsetikett («JULI», «JUNI» …) når måneden bytter. Fremover:
   «I dag / I morgen / Denne uken», så «August», «September» som egne
   seksjoner med mint-strek.
6. Turneringslisten inne på en turnering (hendelsessiden): mørke
   kompakthero-kampkort — sjekk at de ser riktige ut der og IKKE er
   dempet.
7. **(Runde 3)** Hendelsessiden for en trening/sosialt: infokortet er
   hero-flaten (gradient + banedekor + pill + stor tid + dato) — ingen
   hvit adminflate. Beskjeden («Vi øver på pasninger!») står i kortet.
8. **(Runde 3)** Hjem-karusellen: kommende KAMP er mørk med ring og mint
   avspark («Mot Ottestad»); trening-heroen er lys som før. Live-banner
   og kampdag-platta på kampsiden ser ut som før.

---

## 🎠 P8 — HERO-KARUSELL PÅ HJEM (✅ FERDIG — godkjent på telefon 2026-07-31)

Åttende skive i design-polish-planen (Brages forslag: bla bortover på
øverste hendelse). Ingen migrasjon, ingen native-deps — ren JS.
`npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Ny `NextEventCarousel` (components):** horisontal FlatList med
  `pagingEnabled` — sidene er skjermbredde (`useWindowDimensions`) og
  bærer skjermmargen selv, så TeamHome legger karusellen i en wrapper
  UTEN horisontal padding (`carouselSection`, kun paddingTop). Alle
  sidene (maks 4) rendres med én gang (`initialNumToRender`) så
  listehøyden settes av det høyeste kortet og ikke hopper når man blar.
- **Sidene:** de neste inntil 3 hendelsene som `NextEventHero` (urørt)
  + et siste «Åpne kalenderen»-kort: hvit flate, Calendar-ikon i
  heiaTint-sirkel, «Treninger, kamper og alt som skjer». Kortet fyller
  sidehøyden (flex) og navigerer til Kalender-fanen via
  `getParent().navigate('KalenderStack')` — samme idiom som NewEvent.
- **Prikkene under:** aktiv = mint pill (18×6, `colors.heia` — samme
  språk som RSVP-fyllet i heroen), inaktive = dempet mørkgrønn 6 px.
  Aktiv side spores via `onMomentumScrollEnd` (clampet mot sideantall).
- **`pickNextEvent` → `pickNextEvents(events, 3)`** i TeamHomeScreen
  (samme filter som før: avlyst/ferdig hoppes over, uten sluttid = start
  + 2 t); state `nextEvent` → `nextEvents`.
- **Live-kampen beholder hero-prioritet:** karusellen rendres kun i
  hverdagsmodus (ingen `liveMatch`) — og uten kommende hendelser vises
  ingen karusell i det hele tatt (aldri et ensomt kalenderkort).

### Test dette først (Metro-reload)
1. Hjem uten live kamp, med flere kommende hendelser: bla bortover —
   inntil 3 hendelseskort + «Åpne kalenderen»-kortet bakerst; prikkene
   følger med, aktiv prikk er mint pill.
2. Trykk et hendelseskort → hendelsessiden. Trykk kalenderkortet →
   Kalender-fanen.
3. Kun ÉN kommende hendelse → to sider (hendelsen + kalenderkortet).
   Ingen kommende hendelser → ingen hero (som før).
4. Start en kamp → live-banneret tar hero-plassen alene; avslutt →
   karusellen er tilbake.
5. Sidebyttet skal snappe rent (paging), høyden skal ikke hoppe mellom
   sider, og vanlig vertikal scrolling av feeden skal ikke forstyrres.

---

## 👤 P7 — PROFIL-POLISH (✅ FERDIG — godkjent på telefon 2026-07-31)

Sjuende skive i design-polish-planen + Brages ønske samme dag: lagmerkene
under «Dine lag» skal vise LOGOEN når den finnes, ikke bare lagfargen.
Ingen migrasjon, ingen native-deps — ren JS. `npx eslint src`: 0 errors,
2 warnings (begge fra før).

- **Toppen på varm bakgrunnstone:** profilseksjonen (avatar/navn/rolle)
  er ikke lenger et hvitt kort med skygge — den ligger rett på
  `background`, og luften øverst er strammet (paddingTop 2xl→lg, gap
  sm→xs). Forelder-rollepillen fikk hvit flate + subtil kant (den gamle
  background-tonen forsvant mot den nye bakgrunnen).
- **«Dine lag» viser lagmerket:** 12 px-fargeprikken er erstattet av
  `TeamBadge` (36 pt sirkel) per medlemskap — fallback-kjeden lag-logo →
  klubblogo → initialer på lagfarge, samme som headeren/kampsiden.
  **`TeamBadge` fikk `logoUrl`/`color`-props som overstyrer context** —
  den var låst til AKTIVT lag, og Profil-listen viser alle lagene dine.
  Utelatt prop = context-kjeden som før, så alle gamle kallsteder
  (ScoreBoard, LiveMatchBanner, TeamHeader, EventDetail) er urørt.
  Aktiv-haken er nå tegnet `Check` i heiaInk (før tekst-«✓»).
- **To menykort med mint-strek-etiketter** (seksjonsskillet lag ↔
  innstillinger fra planen): «[LAGNAVNET]» (Lagoversikt, Laginnstillinger
  (kun trener), Inviter til laget) og «INNSTILLINGER» (Telefonnummer,
  Bli med i et lag, Opprett et nytt lag, Varslinger, Logg ut, Om Heia).
  Uten aktivt medlemskap rendres lag-kortet ikke.
- **Konsekvent ikonlogikk:** alle rader har tegnet Lucide-ikon
  (textSecondary, 20 pt) i fast 28 px-slot — de tomme streng-slotene og
  🔔-emojien er borte. Fire nye ikoner i icons.tsx-eksporten: `LogOut`,
  `Settings`, `Share2`, `UserPlus`. `ChevronRight` (textTertiary) på alle
  navigasjonsrader — `ListRow`s `right`-prop endelig i bruk;
  handlingsrader (Telefonnummer, Varslinger, Logg ut) har bevisst ingen
  chevron. Laginnstillinger-raden bruker Settings-ikonet — fargeprikken
  der er borte; lag-identiteten bor nå i «Dine lag»-kortene.

### Test dette først (Metro-reload)
1. Profil-fanen: toppen ligger på kremtonen (ikke eget hvitt kort),
   luften øverst er strammere, rollepillen leses fortsatt tydelig.
2. «Dine lag»: laget med logo viser LOGOEN i sirkelen; lag uten logo
   viser initialer på lagfargen. Aktivt lag har mint-flate + hake som før,
   og lagbytte fungerer.
3. To kort under: «[lagnavnet ditt]» og «Innstillinger» med
   mint-strek-etiketter; alle rader har ikon, og navigasjonsradene har
   chevron til høyre.
4. Trykk deg gjennom radene — alle går dit de skal (Lagoversikt,
   Laginnstillinger, Inviter, Bli med, Opprett, Varslinger, Logg ut).
5. Som forelder: ingen «Laginnstillinger»-rad; lag-kortet viser
   Lagoversikt + Inviter.
6. Headeren, kampsiden og live-banneret ser ut som før (TeamBadge-
   endringen er kun nye valgfrie props).

---

## 📬 P6 — VARSLER-LISTEN (✅ FERDIG — godkjent på telefon 2026-07-31)

Sjette skive i design-polish-planen — **scope omskrevet av Brage samme
dag: det gamle P6-punktet om globalt kontrastpass (mørkne
textSecondary/textTertiary) var en misforståelse og er STRØKET.** Dette
er ren Varsler-polish: luft i raden + tidsbolker. Ingen migrasjon, ingen
native-deps. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Tidsbolker i `InboxScreen`:** «I dag / I går / Siste 7 dager /
  Tidligere» med appens mint-strek-etikett (`SectionHeader`) over hvert
  listekort. Radene kommer nyest først fra serveren (`ORDER BY created_at
  DESC`), så `groupByAge` er en enkel run-deling — rekkefølgen består,
  tomme bolker finnes ikke. Fortsatt samme enkle liste — IKKE kort per
  varsel (Brages ord).
- **`NotificationRow` — tydeligere avstand avsender/innhold/tidspunkt:**
  paddingVertical md→lg, gap tittel↔innhold 2→4, gap tittel↔tidspunkt
  sm→md. Ulest-flaten (heiaSoft) + grønn prikk er urørt.
- **Tidsstempelet:** «I går»/«3 d» → ukedag («tir.») for 1–6 dager siden —
  bolk-etiketten sier alt «I går», raden skal ikke gjenta den. Eldre enn
  7 dager: dato («12. jul») som før.
- **Luft-eierskap:** headerens marginBottom er flyttet til
  seksjonsetikettens eget topp-rom; skeleton/feil/tom-tilstandene har
  egen `standalone`-margin i stedet.

### Test dette først (Metro-reload)
1. Varsler-fanen med blandede varsler: bolkene «I dag», «I går» osv. med
   mint-strek-etikett — og bare bolker som faktisk har innhold.
2. Radene: mer luft mellom tittel, innholdstekst og tidspunktet til
   høyre; listen skal fortsatt være én enkel flate, ikke store kort.
3. Et varsel fra i går viser ukedag («ons.») — ikke «I går» dobbelt opp
   mot etiketten.
4. Ulest: heiaSoft-flate + prikk som før; «Merk alle som lest» virker.
5. Tom inbox og feil (flymodus + dra ned): kortet ligger med samme luft
   under headeren som før.

---

## 🎨 P5 + P5B — KAMPFORLØPET + HENDELSESSIDEN (✅ FERDIG — godkjent på telefon 2026-07-31)

Femte skive i design-polish-planen (P5 skannbarhet + P5B hendelsessidens
hero, samme samtale som planlagt). Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **P5 — markørene i kampforløpet (`MatchEventRow`):** ny `markerFor(event)`
  erstatter de statiske ikon/farge-tabellene — markøren avhenger nå av
  `teamSide`, ikke bare type. **Ballen betyr MÅL og ingenting annet:**
  avspark/fortsettelse har Play-pil på dempet `surfaceMuted` (før heiaTint —
  avspark er ikke feiring). **Mål for oss:** mint-sirkel + liten gull-prikk
  med hvit kant (feiring: grønt/gult). **Mål imot** (og mål uten `teamSide`):
  dempet nøytral — aldri coral («ingen TAP-roping»). **Slutt:** stadion-mørk
  markør (`colors.stadium`, Flag i `stadiumText`).
- **P5 — glyfene erstattet:** `bytte` = Lucide `ArrowLeftRight` (tegnet
  versjon av ↔), `kort` = ny egen svg **`BookingCard`** i icons.tsx (FYLT
  gull-rektangel, lett helning, goldInk-kant — Lucide har kun
  stroke-rektangler, og et dommerkort er en fylt flate). `MatchPhotoSheet`
  beholder tekst-glyfene bevisst — der er de del av en ren tekstetikett i
  øyeblikk-velgeren, ikke tidslinje-markører.
- **P5B — info-kortet (trening/sosialt/turnering/annet + avlyst kamp):**
  type-tonet aksentbånd øverst i kortet (infoSoft/remindSoft/sun/
  surfaceMuted — pillenes semantikk) med typeetiketten i båndets ink-farge
  (en pill i softfargen ville druknet i bånd av samme farge), stort
  klokkeslett i displayfonten (Nunito 24) til høyre, dato i fet under.
  Metalisten (Dato/Tid/Sted-label-rader) er borte; sted er en rolig
  MapPin-rad i kortkroppen. `MetaRow`-hjelperen er slettet.
- **P5B — KAMPDAG (kommende kamp med motstander):** mørk mini-platte
  (`StadiumSurface`, cardResting — roligere enn ScoreBoard): «KAMPDAG» +
  dato øverst, lagmerkene (TeamBadge m/ logo + motstander-initialer på
  ScoreBoard-grå) rundt stort avsparkstidspunkt i mint (Nunito 32, UTEN
  glød — gløden er live-scorens signatur), «Avspark»-caption, sted sentrert
  nederst. Standardtittelen («Kamp mot Lyn») vises ikke (platta sier det
  samme); egendefinert tittel vises. Kamp uten motstander → info-kortet med
  kamp-aksent. ReporterBar + «Start kamp» + RSVP under er urørt.
- **Vakten holdt:** live-modus og kamprapporten er ikke rørt.

### Test dette først (Metro-reload)
1. Åpne en spilt kamp (kamprapporten) → kampforløpet: mål for oss har
   mint-sirkel med gull-prikk, mål imot er grå, avspark/2. omgang har
   grå pil (ikke mint), slutt er mørk. Målene skal hoppe ut ved rask
   scrolling — resten skal ligge rolig.
2. Åpne en trening → kort med blått bånd øverst: «TRENING» + stort
   klokkeslett, dato i fet, sted med kartnål under tittelen. Sosialt =
   lilla bånd, turnering = gult.
3. Opprett/åpne en KOMMENDE kamp → mørk kampdag-platte: lagmerket ditt
   (logo!) mot motstander-initialer, stort avsparkstidspunkt i mint,
   sted nederst. «Start kamp»-knappen og RSVP står under som før.
4. Gi en kommende kamp egen tittel (f.eks. «Seriefinalen») → tittelen
   vises på platta; standard «Kamp mot X» vises ikke dobbelt.
5. Live-kamp og kamprapport-toppen (ScoreBoard) skal se HELT ut som før.

---

## 🛠 P4 — LAGINNSTILLINGER + KLUBBLOGO (✅ FERDIG — godkjent på telefon 2026-07-31)

Fjerde skive i design-polish-planen. Én migrasjon (deployet), ingen
native-deps (pickeren var alt inne). `npx eslint src`: 0 errors, 2 warnings
(begge fra før).

- **Modellen (LÅST, se planens P4):** klubblogo bor på KLUBBEN
  (`clubs.logo_url`, dødt felt fra 00002 — nå i bruk), **write-once** for
  lagadmin i klubben, aldri overskriving i MVP. Laglogo
  (`team_spaces.logo_url`) er per-lag-OVERRIDE og endres/fjernes fritt av
  lagadmin. Fallback-kjeden fra P3 (lag → klubb → initialer) lyser nå opp.
- **Migrasjon `00034_club_logo.sql` (✅ deployet):** ny helper
  `is_club_team_admin(club_id)` (lagadmin i ET av klubbens lag — brukes av
  både RPC og storage-policy). **Offentlig** bucket `club-logos` (logo er
  ikke persondata; signerte URL-er utløper og headeren/søket rendres
  konstant). Tre storage-policyer: klubb-INSERT (kun klubbens lagadmins,
  kun mens `logo_url IS NULL` — write-once også på filnivå), lag-INSERT og
  lag-DELETE (`is_team_admin` på første path-segment; en club_id gir false
  der, så ingen kan slette klubblogoer fra klienten). RPC
  `set_club_logo(p_club_id, p_url)`: SECURITY DEFINER (clubs er
  client-read-only, 00016-mønsteret), alle vakter i COALESCE (NULL-fella
  fra 00020), `FOR UPDATE`-lås mot samtidige opplastinger, og URL-en må
  peke inn i klubbens egen mappe i bucketen.
- **To RLS-fikser etter Brages telefonfunn samme kveld («new row violates
  row-level security policy» ved opplasting):**
  - **`00035`:** i klubb-INSERT-policyens EXISTS-subquery ble det
    UKVALIFISERTE `name` bundet til `clubs.name` (nærmeste relasjon i
    subqueryen), ikke `storage.objects.name` — write-once-sjekken
    sammenlignet klubb-id mot `foldername('Hamkam')` = NULL og policyen sa
    alltid nei. **Regel (samme familie som COALESCE-NULL-fella): ytre
    kolonner i policy-subqueries MÅ kvalifiseres (`objects.name`).**
  - **`00036`:** storage-API-et laster opp med `INSERT … RETURNING`, og
    RETURNING krever at raden også passerer en SELECT-policy —
    `club-logos` hadde ingen. **Regel: en bucket det lastes opp til
    trenger alltid SELECT-policy, også når den er offentlig** (public-URL-
    nedlasting går utenom RLS; API-ets insert-returning gjør ikke).
    feed-media virket hele tiden fordi 00018 har SELECT-policy.
  - Begge er verifisert direkte i SQL som Brages bruker (simulert JWT +
    `authenticated`-rolle): både klubb- og lag-path passerer nå med
    RETURNING. Testradene er ryddet. Fiksene er rene DB-endringer — ny
    test i appen krever INGEN reload.
- **Runde 2 av telefonfunn (2026-07-31, KODET — Metro-reload):** Brage
  bekreftet at opplastingen virker («Det funker!») og fant to ting til:
  - **Lagfarge-valg kastet deg til Hjem:** hver lagring på Laginnstillinger
    (farge/navn/logo) kaller `refreshMemberships`, som satte
    `loading=true` i TeamContext → AppNavigator (linje ~410) river ned
    hele navigatoren på loading → remount lander på Hjem-fanen. Fiks:
    **stille refresh** — `loadedForRef` i TeamContext; loading settes kun
    på FØRSTE last per bruker. Bonus: en refresh som feiler beholder nå
    forrige liste i stedet for å nulle den (et nettverksglipp kunne før
    sende en innlogget bruker til onboarding). Samme bug gjaldt gamle
    Lagfarge-raden på Profil — den har alltid hoppet til Hjem.
  - **Logoen manglet på kampsiden:** ScoreBoard og LiveMatchBanner tegnet
    initialer direkte. Ny delt **`TeamBadge`** (components) eier
    fallback-kjeden lag → klubb → initialer på lagfarge; brukes nå i
    ScoreBoard (kampside + kamprapport, 48 pt), LiveMatchBanner (42 pt)
    og TeamHeader (32 pt sirkel — refaktorert til samme komponent).
    På mørk stadionflate får logoen hvit plate (`logoPlate`) så
    transparente PNG-er ikke drukner. Motstander-merket er urørt.
- **`teams.ts`:** `uploadLogo` (nytt filnavn per opplasting — RN-Image
  cacher per URL, så en BYTTET logo må få ny URL), `setClubLogo`,
  `updateTeamLogo` (null = fjern; best-effort sletting av gammel fil),
  `updateTeamName` (display_name; `.select('id')`-vakta), `getClubForTeamSpace`;
  `searchClubs` returnerer nå `logoUrl`.
- **`media.ts`:** `pickLogoImage()` — rett til kamerarullen (ingen
  kamera-spørsmål; en logo ligger lagret) og resize 512 px (headeren skal
  ikke laste et 12 MP-foto).
- **Ny `TeamSettingsScreen`** (ProfilStack): fire kort — lagnavn
  (input + «Lagre navnet» når endret), lagfarge (TeamColorPicker inline,
  trykk = lagre), laglogo (forhåndsvisning i lagfarge-ring + Velg/Bytt +
  Fjern med bekreftelse), klubblogo (read-only med forklaring når den
  finnes; «Legg til klubblogo» når den mangler). Inngang: Profil-raden
  «Laginnstillinger» (fargeprikk-ikonet) — erstatter Lagfarge-raden, og
  `TeamColorSheet` er SLETTET (arket bodde kun der).
- **CreateTeam:** klubb-dropdownen viser `ClubBadge` (logo, initialer som
  fallback) ved hvert treff — dedup-incentivet fra planen.
- **`OnboardingContext.executeCreate`:** oppretter du en NY klubb kommer
  et valgfritt «Legg til klubblogoen?»-alert etter at laget er opprettet
  (ny `src/lib/clubLogo.ts`). Bor i executeCreate, IKKE i skjermen — da
  dekkes både direkteveien og auth-before-commit-resumet. Write-once-racen
  håndteres stille (rakk noen andre å sette logoen, hopper vi over).

### Test dette først (Metro-reload)
1. Profil som trener → «Laginnstillinger». Endre lagnavnet + «Lagre
   navnet» → headeren og Profil viser nytt navn.
2. Trykk en lagfarge-swatch → lagres direkte (ring + hake flytter seg),
   lagmerket skifter farge overalt.
3. «Velg laglogo» → bilde fra kamerarullen → lagmerket i headeren viser
   logoen (alle tre faner). «Bytt» og «Fjern» — fjern faller tilbake til
   klubblogo/initialer.
4. Klubblogo: mangler klubben logo → «Legg til klubblogo» → etterpå viser
   kortet den som read-only («deles av alle lag i klubben»). **NB: satte
   du en test-URL på `clubs.logo_url` i SQL under P3-testen, null den ut
   først** (`update clubs set logo_url = null where id = '…';`).
5. Profil → «Opprett et nytt lag» → søk klubb: treff viser logo-sirkel
   (initialer uten logo). Velg klubben MED logo → laget arver den i
   headeren uten mer oppsett.
6. Opprett et lag med NY klubb → etter opprettelsen: «Legg til
   klubblogoen?»-spørsmål (Senere / Velg bilde).
7. Som forelder: ingen «Laginnstillinger»-rad på Profil.
8. **(Runde 2)** Endre lagfarge/navn/logo på Laginnstillinger → du BLIR
   på siden (ingen hopp til Hjem).
9. **(Runde 2)** Åpne en kamp (og kamprapporten, og live-banneret på
   Hjem): lagmerket viser logoen på hvit plate — ikke initialer — når
   laget/klubben har logo.

---

## 🎽 P3 — HEADEREN SOM MOCKUPEN (✅ FERDIG — godkjent på telefon + committet 2026-07-31)

Tredje skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **`TeamHeader` matcher A v2-mockupen:** logo-SIRKEL (før: rundet firkant)
  + lagnavn + undertekst «Fotball · 18 medlemmer». Lagfarge-stripen under
  navnet er erstattet av underteksten — lagfargen bor nå i ringen rundt
  sirkelen + initial-fyllet. Vises på alle tre fanene (Hjem/Kalender/Varsler);
  Sesongen-chipen er urørt.
- **Logo-sirkelens fallback-kjede** (P4-modellen, kjeden står klar før
  URL-ene finnes): `teamSpace.logoUrl` → `club.logoUrl` → initialer på
  lagfarge (`inkOnTeamColor` — gult krever mørke initialer). `Club`-typen
  fikk `logoUrl`, mappet i `mapEnrichedMembership` (`clubs(*)` var alt med
  i selecten — feltet var bare ikke mappet). Feiler bildelastingen
  (`onError`) faller sirkelen tilbake til initialene; failed-URL-en huskes
  per URL, så et lagbytte prøver på nytt.
- **Medlemstallet bor i TeamContext** (`activeMemberCount`), IKKE i
  headeren — headeren monteres på tre skjermer og skal ikke spørre per
  skjerm. Ny `getTeamMemberCount(teamSpaceId)` i `teams.ts`: head-count på
  `memberships` (`status='active'`, `count: 'exact'`) — samme telling som
  `lookup_invite_code` (medlemskap, ikke unike personer; en forelder med to
  barn teller to). Cachet per lagrom (Map i ref) så lagbytte viser forrige
  tall med én gang; refetches når memberships refetches.
  **RLS-vakt:** teller du et lag du ikke er medlem i, gir RLS et falskt 0 —
  effekten venter derfor til medlemskapet finnes i `userMemberships`.
- **Underteksten er aldri tom:** tall mangler (henting/feil) → «Fotball ·
  G14» (sport + ageGroup). Singular: «1 medlem».
- **Høydevakten holdt:** sirkelen er 40 pt totalt som før (32 + ring),
  navn 18 pt + undertekst 12 pt ≈ 38 pt — headeren er IKKE høyere, neste
  hendelse-kort synes fortsatt uten scrolling.

### Test dette først (Metro-reload)
1. Hjem: sirkel med initialer på lagfargen + lagnavn + «Fotball · N
   medlemmer». Tallet skal stemme med Lagoversikt-tellingen.
2. Kalender + Varsler: samme header (tallet hentes ÉN gang, fra context).
3. Bytt lag (om du har to): underteksten oppdaterer seg — sport/tall følger
   laget, og gammelt lags tall vises aldri på det nye.
4. Headerens høyde: neste hendelse-kortet på Hjem skal fortsatt synes uten
   å scrolle (vakten fra planen).
5. (Logo-bildet kan først testes i P4 når opplasting finnes — men sett
   gjerne en URL manuelt på `team_spaces.logo_url`/`clubs.logo_url` i SQL
   for å se sirkelen med ekte logo.)

---

## ⚽ P2 — MÅL-ØYEBLIKKET (✅ FERDIG — godkjent på telefon + committet 2026-07-31)

Andre skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren RN `Animated` med native driver (reanimated er bevisst IKKE
installert). `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Ny `src/components/useGoalMoment.ts`:** hook som oppdager scoreendring
  fra props og driver to Animated-verdier: `scoreScale` (sprett: raskt opp
  til ~1.3, fjærende ned med spring) og `celebrate` (mint-glød over
  stadionflaten: 150 ms opp → kort topp → 800 ms ut). **Mål for oss =
  sprett + glød; mål imot = kun sprett** — informasjon, ikke feiring, og
  aldri coral (låst regel). Prop-diff er poenget: animasjonen fyrer også
  hos foreldre som får ny stilling via realtime-refetch. Prev-ref seedes
  med gjeldende score, så å ÅPNE en pågående kamp animerer ingenting —
  kun endring spretter.
- **`ScoreBoard`:** `Animated.Text` på scoren + feirings-overlay
  (absoluteFill, ligger UNDER innholdet så teksten ikke tones,
  `pointerEvents="none"`). Stretch-punktet tatt: **SEIER-pillen spretter
  inn** (spring, 250 ms delay så skjermbyttet lander først) — både i det
  kampen ender med seier og hver gang kamprapporten åpnes.
- **`LiveMatchBanner`:** samme hook + overlay + animert score. Hooken
  kalles FØR early return (hooks-regelen). Hjem-banneret oppdateres av
  feed-subscriben i TeamHome (hvert mål er en feed-post → debounced
  `loadFeed` → ny `liveMatch`), så foreldre som står på Hjem ser spretten
  uten å gjøre noe.
- **`ReporterActions`:** målknappene er nå `GoalButton` (modulnivå, ikke
  nested — eslint-regelen): gir etter til 0.95 ved press (timing 90 ms),
  fjærer tilbake ved slipp (spring). Scale-transformen bor på en
  `Animated.View`-wrapper med `flex: 1` (Pressable kan ikke selv bære en
  Animated-transform); `goalButton`-stilen mistet derfor `flex: 1`.
- **Banner-demping på kampsiden (Brages telefonfunn 2026-07-31):**
  varselbanneret («⚽ MÅL! …») la seg OPPÅ scoreboardet — dobbelt opp når
  animasjonen skjer rett foran deg. Nå: `NotificationsContext` har
  `watchEvent(eventId)` (ref, ikke state — leses i realtime-callbacken
  uten re-subscribe; slipp-funksjonen nuller kun hvis den fortsatt eier
  registreringen). EventDetail registrerer via `useFocusEffect` KUN mens
  kampen er i gang (`isUnderway`) — og callbacken dropper banneret når
  `category='match_live'` OG `data.event_id` matcher (`data` fra 00023
  bærer alt event_id). Badge/inbox/liveNonce består. FOKUS, ikke mount:
  går du inn i kommentarene når banneret deg igjen; alle andre skjermer
  og andre kategorier (kommentar/heia) er urørt.

### Test dette først (Metro-reload)
1. Start en kamp som trener → trykk «Mål oss»: scoren spretter og flaten
   får et kort mint-glimt. «Mål dem»: kun sprett, ingen feiring.
2. **Det viktige:** forelder på annen enhet står på kampskjermen — eller
   på Hjem med live-banneret — mens treneren scorer. Samme sprett/glød
   skal skje der, via realtime, uten at forelderen gjør noe.
3. Kjenn på målknappene: de skal gi etter under fingeren og fjære tilbake.
4. Avslutt en kamp med seier → SEIER-pillen spretter inn på scoreboardet.
   Åpne kamprapporten senere → den spretter inn igjen.
5. Åpne en kamp som allerede pågår → ingen sprett ved åpning (ro først,
   liv kun ved endring).
6. Banner-dempingen: stå på kampsiden som forelder mens det scores →
   INGEN «⚽ MÅL!»-banner over scoreboardet (bare animasjonen). Gå til
   Hjem eller kommentartråden → banneret kommer som før. Varsler-badgen
   teller opp uansett.

---

## 🦴 P1 — SKELETONS (KODET 2026-07-31, kun Metro-reload)

Første skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før:
`no-bitwise` i Avatar, nested component i AppNavigator).

- **Ny `src/components/Skeleton.tsx`:** `Skeleton` (grå/krem blokk med
  svak opacity-puls, RN `Animated` + native driver), `SkeletonCard`
  (hvit kortflate), `FeedCardSkeleton`, `EventCardSkeleton`,
  `ListRowSkeleton`. Én delt modul-`Animated.Value` med refcount-loop:
  alle bones i hele appen puster i takt, og loopen kjører kun mens minst
  én bone er montert.
- **Skjermene som fikk skeleton i stedet for skjermnivå-spinner:**
  TeamHome (3 feedkort), Kalender (etikett + 3 eventkort), Season
  (stadion-KPI-bones i `stadiumEdge` på `StadiumSurface` + kampliste —
  flatebyttet lys/mørk skal ikke blinke inn etter lastingen), Inbox
  (4 rader i listekortet), TeamMembers (lagnavnet vises EKTE — kjent fra
  context — bone kun på tellingen + medlemsrader), EventDetail (speiler
  info-kortet: pill + tittel + metarader), Comments (innleggskort + 2
  replikk-bobler med chat-hjørnet), CreateTeam (3 sport-piller).
- **Bevisst BEHOLDT som spinner:** `Button` (loading-prop) og
  `MatchPhotoSheet` (planens unntak), AppNavigator-bootskjermen (før noe
  UI finnes), Auth (submit-state) og JoinTeamCode (oppslag ETTER
  «Finn lag»-trykk) — de to siste er handlingstilstander, ikke
  skjerm-åpninger.
- **`RefreshControl`-punktet i planen var alt gjort:** alle 5 (TeamHome,
  Kalender, Inbox, Season, TeamMembers) hadde `tintColor={colors.heia}`
  fra telefontest-runden. Verifisert, ingen endring.
- **Copy-polish på tomtilstander** (BRAND_UI-retningslinjene): TeamHome
  «Stille her ennå …», Kalender «Kalenderen er tom» + varmere brødtekst.
  Resten (Inbox, Season «Sesongen starter her», Comments) hadde alt
  personlighet.
- **RN-fallgruve verdt å huske:** `width: undefined` i en SENERE style
  nullstiller IKKE en tidligere `width: '100%'` (RN dropper undefined ved
  flatten). Trengs en flex-styrt bone: legg den i en `{flex: 1}`-wrapper
  (se `skeletonBubbleWrap` i CommentsScreen).

### Test dette først (Metro-reload)
1. Bytt fane til Kalender/Varsler første gang (eller dra ned + slipp på
   tregt nett): grå/krem kort som puster, i samme form som innholdet som
   kommer — ingen spinner, ingen hopp i layout når innholdet lander.
2. Sesongen: mørk stadionflate med pulserende tall-bones — flaten skal
   IKKE blinke hvit→mørk når tallene kommer.
3. Åpne en hendelse og en kommentartråd — skeleton i kort-/bobleform.
4. Tomtilstander: nytt lag uten innhold viser «Stille her ennå …» (Hjem)
   og «Kalenderen er tom» (Kalender).
5. Pulsen: alle blokker på en skjerm dimmer i takt (én delt loop).

**Telefontest-funn 2026-07-30 (kveld), fikset i JS (kun reload — ingen
rebuild):**
- **Onboarding-overganger:** iOS 26 sin nye push/pop-animasjon blinket hvitt i
  hjørnene mot den mørke velkomstskjermen (vinduet bak stacken er hvitt, ingen
  JS-flate når dit). Onboarding-stacken kjører nå `simple_push` +
  `animationMatchesGesture`, og fordi native header ikke blir med i
  egendefinert animasjon («toppen deler seg»), er headeren AV i hele
  onboarding-stacken — skjermene tegner egen tilbakelinje (`BackBar`,
  native metrikk). I Profil-stacken har Bli med/Opprett lag fortsatt native
  header. **Bekreftet fikset på telefon.** NavigationContainer fikk også eget
  tema + `contentStyle` på alle stacker (fjernet hvite kort-blink generelt).
- **Skrivefelt:** tekst rendret feil/utsatt mens man skrev (falt først på
  plass ved blur) — kjent iOS-bug når `TextInput` har `lineHeight` (RN #41240).
  Nytt token `typography.input` (= body uten lineHeight) brukes nå i alle
  skrivefelt (Auth, CreateTeam, NewEvent, Comments, TeamHome-compose).
  **Bekreftet fikset på telefon.**
- **«Løs topp» ved swipe-back i hovedappen** (Hendelse, Kommentarer, Inviter
  m.fl.): iOS 26 animerer UINavigationBar som egen plate i eget tempo —
  fargematch var ikke nok (verifisert på telefon). Endelig løsning = samme som
  onboarding, nå på ALLE stackene via `stackScreenOptions`: native header AV +
  `simple_push`/`animationMatchesGesture`, og skjermene tegner `BackBar`
  (valgfri sentrert tittel). Berørt: EventDetail («Hendelse», alle 4 grener),
  Comments («Kommentarer», + `keyboardVerticalOffset` 100→fjernet siden
  headeren er borte), Invite («Inviter»), Support («Støtt laget»),
  TeamMembers («Lagoversikt»), JoinTeamCode/CreateTeam (alltid BackBar nå,
  `inOnboarding`-sjekken fjernet). Unntak: NewEvent-modalen beholder native
  header + vertikal animasjon (`headerShown: true`, `animation: 'default'`) —
  modaler har ikke problemet. **Bekreftet fikset på telefon.**
- **Kampbilder kom ikke i realtime hos andre:** `subscribeToMatch` lyttet kun
  på `match_events`/`match_sessions`, men bilder er `feed_posts` med
  `event_id` (00028) og rører ingen av dem. Ny tredje lytter på
  `feed_posts` INSERT (filter `event_id`; tabellen er alt i publiseringen via
  00025) + callbacken i EventDetail kaller nå `loadPhotos()` i tillegg til
  `loadEvent()`. Gjelder mens kampen er live (abonnementet lever bare da) —
  som resten av kampoppdateringene. Ingen migrasjon nødvendig. **Bruker
  meldte «det funker nå» 2026-07-30 (samlet bekreftelse for kveldens fikser).**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), hele Fase 2 (ekte feed),
Fase 3A (ekte events — lesing), Fase 3B (opprett hendelse + RSVP) og
Fase 3C (hele live-kamp-loopen) er ferdig og verifisert i simulator.**
**Fase 3D (pause ⇄ andre omgang) er kodet, `00021` er deployet, tsc grønn.**
**Fase 4 (EKTE PUSH): kode + native + backend er ute. `simctl push` viser
varsler i simulator. Gjenstår vault-seed (din service_role_key) + Apple/APNs
for at ekte push skal leve (se «Fase 4 — EKTE PUSH»).**
**Fase 5 (INBOX) er kodet: Varsler-fanen leser `notifications`, har ulest-badge
og deep-link til hendelse/kommentarer. Siste døde hjørne i appen er borte.**

Branch: `Brage` (pushet til `origin/Brage` t.o.m. P9 — commit `b99c2e2`,
hele design-polish-planen P4–P9 committet og pushet 2026-07-31). `npx eslint src` har 6
errors + 5 warnings, alle fra før (ubrukte variabler i `Avatar`/`CommentsScreen`/
`InviteScreen`, `exhaustive-deps` i `UserContext`/`TeamContext`) — ingen nye.

**Tsc-arbeidsmåte (LÅST):** Claude skal IKKE kjøre `tsc` (CLI) selv — heller
ikke i bakgrunn. Det stjeler CPU fra brukerens egne bygg (npm/pod/Xcode/Metro)
og ødelegger dem. Typefeil sjekkes i editoren (VS Code kjører TS-serveren live).
Trengs en CLI-sjekk på en stor endring, spør brukeren først og la brukeren kjøre den.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer), events/kalender/event-detalj/live-banner, **opprettelse av hendelser + kamper**, **RSVP-svar**, **medlemslisten**, **kampreporter**, **start av kamp**, **kamphendelser + stilling + feed-post**, **realtime på live kamp**, rollesjekk (fra membership).
- **Push:** hele pipelinen er KODET (Fase 4), men lever ikke før du har gjort
  Apple/APNs-siden + rebuild. `SimulatedPush` består som reporterens lokale ekko
  (reporteren er forfatter og får ikke ekte push — den går til alle andre).
- **Inbox (Fase 5):** ekte lesing av `notifications` + ulest-badge + deep-link.
  Radene skrives av `push-fanout`, som først fyrer når vault er seedet — se
  «Fase 5» for test-SQL som fyller inboxen uten seed.
- **All mock-data er borte.** `src/shared/mockData.ts` og `src/data/teamData.ts`
  er slettet — ingenting importerte dem lenger.

---

## Backend (Supabase) — tilstand

Prosjektet er linket (ref `sswncdrbsrfieudkdmhj`, config `Heia_Prod`). Migrasjoner
**00001–00022 er alle deployet** — `db push --dry-run` sier «Remote database is
up to date» (2026-07-29). (00016/00017 var hand-kjørt fra før; reconciliert med
`migration repair` 2026-07-08.) `supabase db push` fungerer
(kjør med sandkasse av — nettverk kreves; `--dry-run` viser ubehandlede).
**Edge Functions:** `push-fanout` er deployet (`supabase functions deploy
push-fanout` fungerer også med sandkasse av — Docker trengs ikke, bare en
warning).

Eksisterende RPC-er: lese — `get_team_feed`, `get_event_with_rsvp`,
`get_team_members`; skrive — `create_team_from_scratch`, `join_team_space`,
`activate_team_space`, `upsert_rsvp`, `create_event`. RLS tillater direkte
member/admin-insert for feed/kommentar/reaksjon/event, så få nye RPC-er trengs.

Storage: privat bucket `feed-media` (00018) med INSERT/SELECT/DELETE-policyer
gated på lagmedlemskap. Path-konvensjon `{team_space_id}/{filnavn}`.

---

## Fase 2 — GJORT (ekte feed)

- **2A tekst** (`b7f26a4`): `src/lib/api/feed.ts` (`getTeamFeed`, `createTextPost`), TeamHome async feed + compose-boks.
- **2B reaksjon + kommentarer** (`1aff5ba`): `toggleReaction`, `src/lib/api/comments.ts`, `CommentsScreen`, ekte 👏 Heia.
- **2C bilde** (`6ff0b56`): privat Storage-upload (base64 → ArrayBuffer via `base64-arraybuffer`), `createImagePost`, signerte URL-er (batch `createSignedUrls`) i `getTeamFeed`; `react-native-image-picker`; «📷 Legg til bilde» + preview + fjern i TeamHome; `NSPhotoLibraryUsageDescription`. FeedCard uendret (brukte alt `item.imageUrl`).
- Merge av `origin/main` (`62e6dd7`): main hadde en squash-commit (`Brage #12`) som var en eldre delmengde; 5 konflikter i `OnboardingContext.tsx` + `AppNavigator.tsx` løst ved å beholde Brage-siden.

### Kjente v1-begrensninger (akseptert)
- Bilde-upload + de tre insertene (media, feed_posts, media_attachments) er **ikke atomiske** → mulig foreldreløs fil ved feil midtveis. Atomisk RPC + opprydding utsatt.
- Signerte bilde-URL-er utløper (1t) — greit, feeden refetches.

---

## Fase 3A — GJORT (ekte events, lesing)

Ingen nye migrasjoner, ingen nye native moduler → **kun Metro-reload, ingen rebuild.**

- **`src/lib/api/events.ts` (ny):**
  - `getTeamEvents(teamSpaceId)` — direkte select på `events` + embeddet `match_sessions` (RLS tillater medlems-select), pluss én samlespørring mot `event_rsvps` for tellere.
  - `getLiveMatch(teamSpaceId)` — samme select med `match_sessions!inner` + `status='live'` (uten `!inner` filtrerer ikke PostgREST bort forelder-radene).
  - `getEventDetail(eventId, teamSpaceId)` — via `get_event_with_rsvp`. RPC-en er **nødvendig** for oppmøtelistene, fordi profiles-RLS ikke lar deg lese lagkameraters navn direkte. `teamSpaceId` stemples fra kalleren siden RPC-en ikke returnerer den (samme mønster som `getTeamFeed`).
- **Skjermer:** `KalenderScreen` (loading/feil/tom + pull-to-refresh + `useFocusEffect`), `EventDetailScreen` (async last, ekte oppmøtelister), `TeamHomeScreen` (live-banner fra `getLiveMatch`; feiler oppslaget skjules banneret i stedet for å blokkere feeden).
- **Typer:** `HeiaEvent.endTime`/`location` er nå valgfrie (nullable i DB). `MatchStatus` fikk `'cancelled'` så `avlyst` ikke feilvises som «ferdig». `MatchEvent.reportedBy`/`createdAt` valgfrie.

### Kartlegginger DB → app (i `events.ts`)
- `type`: `mote`/`turnering` → `annet` (ingen egne chips ennå).
- `match_sessions.status`: `planlagt→upcoming`, `pause→halfTime`, `ferdig→finished`, `avlyst→cancelled`.
- `home_score`/`away_score` tolkes som «oss/dem» uavhengig av `is_home` (ScoreBoard viser alltid eget lag først).

### Kjente v1-begrensninger (akseptert)
- `rsvp.pending` teller kun eksplisitte `venter`-rader, ikke medlemmer som aldri har svart. `RSVPBar` skjuler seg når totalen er 0.
- `getTeamEvents` henter alle events uten tidsvindu. Fint nå; paginer/filtrer når lag har historikk.

---

## Fase 3B-1 — GJORT (opprett hendelse)

Ingen nye native moduler → **kun Metro-reload, ingen rebuild.**
(Dato/tid er bevisst laget i ren JS, ikke `@react-native-community/datetimepicker`,
nettopp for å slippe rebuild. Bytt hvis det blir for stivt.)

- **Migrasjon `00019_create_event.sql` (deployet):** `create_event()` RPC.
  SECURITY DEFINER omgår RLS, så den sjekker `is_team_admin()` selv. Oppretter
  event + (for `kamp`) `match_session` i status `planlagt` i samme transaksjon,
  slik at en kamp aldri kan mangle session-rad. Returnerer `{event_id, match_session_id}`.
- **`createEvent(input)` i `src/lib/api/events.ts`** — `opponent`/`is_home`
  nulles ut for ikke-kamp.
- **`NewEventScreen`** — type-chips, motstander + hjemme/borte for kamp,
  30-dagers dag-scroller, `HH:MM`-maskert tidsfelt, varighet-chips (1 t / 1½ t /
  2 t / ingen sluttid), sted, tittel (valgfri — faller tilbake på f.eks.
  «Kamp mot Lyn»), beskjed. Etter lagring: lukk modalen + hopp til kalenderen,
  som refetcher ved fokus.
- **`CreateSheet`** — valgarket bak `+`. `tabPress` på `Opprett`-taben
  `preventDefault()`-es, så skjermen aldri rendres.
- **«Del med laget»** sender en ny `composeNonce` til `TeamHome` for hvert
  trykk, som fokuserer compose-boksen (ellers ville andre trykk ikke gjort noe).
- **Rollesprekken lukket:** `UserRole` har nå `lagleder` + `admin`,
  `src/shared/roles.ts` eksporterer `isTeamAdmin(role)` (speiler `is_team_admin()`
  i `00008`), og `TeamContext` eksponerer `activeRole`. `EventDetailScreen`
  bruker den i stedet for mock-oppslaget `getUserRoleInTeam`.

### Test dette først (Metro-reload, ingen rebuild)
1. Trykk `+` som trener → valgarket viser «Del med laget» + «Ny hendelse».
2. Lag en trening → havner i kalenderen på riktig dag/tid.
3. Lag en kamp med motstander → `EventCard` viser motstander; sjekk i SQL at
   `match_sessions`-raden finnes (`status='planlagt'`).
4. Trykk `+` som forelder (eller sett `role='forelder'` i `memberships`) →
   kun «Del med laget». Valgarket skal aldri være tomt.
5. «Del med laget» → compose-boksen får fokus, også når du alt står på Hjem.

## Bugfiks 2026-07-09 — bli med i lag nr. 2

Funnet under testing av 3B-1.

- **Ventende join ble stille forkastet.** Resume-effekten i `OnboardingContext`
  avbrøt tidlig når `hasTeam` var sann. En bruker som var trener i lag A, logget
  ut, tastet koden til lag B og logget inn igjen, fikk `hasTeam=true` i det
  profilen lastet → join-en mot lag B kjørte aldri, uten feilmelding. Guarden er
  fjernet; `runningRef` + `clearPendingAction` hindrer dobbeltkjøring alene.
  `userMemberships.length` er også ute av dep-arrayet (den var det som trigget
  re-kjøringer guarden skulle beskytte mot).
- **`AppNavigator`** viser nå «Setter opp laget…» også når brukeren alt har et
  lag, og `Alert`-er `lastError` i det tilfellet — før forsvant feilen i
  stillhet, siden `WelcomeIntentScreen` (som viser den) ikke er montert da.
- **Legge til lag når man er innlogget.** `JoinTeamCode` + `CreateTeam` er nå
  også registrert i `ProfilStack`, med nye menyvalg «Bli med i et lag» og
  «Opprett et nytt lag». Begge skjermene henter navigasjon via `useNavigation`
  i stedet for skjerm-props, så de kan monteres i to stacker. De kaller
  `navigation.goBack()` selv når `hadTeam` — da bytter ikke `AppNavigator` skjerm.
- **Rolle-etiketter:** `ProfilScreen` viste «Forelder» for lagleder/admin/spiller.
  Nå en `ROLE_LABELS`-tabell, og rolle-badgen bruker `isTeamAdmin()`.
- **Tilbake-knappen:** `JoinTeamCode`/`CreateTeam` tegnet sin egen «‹ Tilbake»
  fordi onboarding-stacken skjuler headeren globalt. Begge bruker nå den vanlige
  stack-headeren (`stackScreenOptions` + `headerShown: true` + tittel) i begge
  stackene, og samme innholdsmarger som `InviteScreen`.
  **Regel: nye skjermer skal bruke stack-headeren, ikke egne tilbake-knapper.**

## Fase 3B-2 — GJORT (RSVP lagres + reporter-opprydding)

Ingen nye migrasjoner, ingen nye native moduler → **kun Metro-reload.**

- **`setRsvp(eventId, status)` i `src/lib/api/events.ts`** — tynn wrapper rundt
  `upsert_rsvp` (fantes fra `00015`). `p_child_id` utelates: v1 lar en forelder
  kun svare for seg selv.
- **`EventDetailScreen`:** knappene kaller `handleRsvp()`. Svaret vises med én
  gang (optimistisk `setMyStatus`), lagres, og så refetches hele eventet — det
  er refetchen som får deg inn i **oppmøtelisten**, som vi ikke kan gjette lokalt.
  Feiler lagringen: rull tilbake til forrige svar + `Alert`. Knappene er
  `disabled` mens lagringen pågår, så dobbelttrykk ikke kan race.
  Trykk på et allerede valgt svar er en no-op (ingen unødig rundtur).
  - **Knappe-variantene** (`comingVariant`/`notComingVariant` i skjermen).
    To bommer på rad her, verdt å huske: (1) begge knappene var `secondary` når
    du svarte «kan ikke» → like rammer, uendret tittel, så det så ut som et
    uregistrert trykk. (2) Å sette den fravalgte til `ghost` var ikke nok —
    `secondary` og `ghost` er **begge gjennomsiktige**, så den valgte knappen
    fikk ingen fargeendring.
    Fasit: den valgte knappen må skifte **flate**, ikke bare ramme.
    `Button` har derfor en ny variant **`selected`** (heiaSoft-fyll + heia-ramme
    + `heiaInk`-tekst) — samme «valgt»-språk som `selectChipSelected` i
    `NewEventScreen`. `primary` = utfører en handling, `selected` = av/på.
    Tilstandene: ubesvart → Kommer `secondary`, Kan ikke `ghost`;
    kommer → `primary` + `ghost`; kan ikke → `ghost` + `selected`.
    Titlene bekrefter også valget («Du kommer!» / «Du kan ikke»).
  - Merk: `loadEvent()` svelger sine egne feil (setter `error`), så `catch`-en i
    `handleRsvp` fyrer **kun** når selve skrivingen feiler. Rollbacken kan derfor
    ikke bli falsk-positiv. Ikke gjør `loadEvent` throwende uten å fikse det.
- **«Ta rollen» fjernet fra `ReporterBar`** (beslutning 3). Propsene `isMember`
  og `onClaimReporter` er borte, og `handleClaimReporter` er slettet.
  I stedet: når reporter mangler ser **admin** en «Velg»-knapp som åpner
  `ReporterSheet`; alle andre ser bare «Ingen kampreporter». Uten dette ble
  tom-tilstanden en blindvei — ingen kunne tildele rollen fra appen.
  (Selve valget lagres fortsatt ikke — se Fase 3C.)

### Test dette først (Metro-reload, ingen rebuild)
1. Åpne en trening → trykk «Kommer». Tallet i `RSVPBar` går opp, og du dukker
   opp i «Kommer»-listen etter refetchen.
2. Trykk «Kan ikke» → du flytter deg mellom listene, totalen er uendret.
3. Trykk «Du kommer!» igjen mens den alt er valgt → ingenting skjer.
4. Skru av nettet → trykk et svar → `Alert` + knappen hopper tilbake.
5. Gå til kalenderen og tilbake → svaret er det samme (det ligger i DB).
   Sjekk gjerne `select * from event_rsvps;` i SQL-editoren.

Filosofi: events = innholdskilde + forutsetning for live kamp. IKKE Spond-tung
RSVP/admin. Heia er «Strava for ungdomslag».

## Fase 3C — KODET, IKKE DEPLOYET/TESTET (live kamp, hele loopen)

**Lærdom som gjorde om på planen:** den opprinnelige 3C var delt opp etter *lag
i koden* (medlemsliste → reporter → start → skriv → vis). Ingen av bitene var
brukbare alene, og planen stoppet ved «skriv til DB» — den bygde aldri veien ut
til foreldrene. Da bruker spurte «hvordan skal foreldre følge med?» fantes ikke
svaret: **null realtime, null push, `SimulatedPush` forlot aldri reporterens
egen telefon.** Skiv etter loopen brukeren opplever, ikke etter lagene i koden.

Loopen nå: opprett kamp → **Start kamp** → reporter trykker MÅL → rad i
`match_events` + oppdatert stilling + **feed-post** → alle andre ser det, live.

### Migrasjon `00020_live_match.sql` (✅ deployet 2026-07-09)
- **`start_match(event_id)`** — setter `live` + `started_at`, og gjør *den som
  starter* til reporter hvis ingen er utpekt. Det er dette som løser
  hønen-og-egget: før måtte du være reporter for å rapportere, men bare admin
  kunne utnevne en reporter, og UI-et for å utnevne fantes bare inne i en kamp
  som allerede var live. Hvem: admin, eller en alt utpekt reporter.
- **`report_match_event(session, type, team_side, description)`** — én rad i
  `match_events` + oppdatert `home_score`/`away_score` + én `feed_post`, i **én
  transaksjon**. `SELECT … FOR UPDATE` på `match_sessions` serialiserer to raske
  trykk, så verken `sequence` (som er `NOT NULL` uten default!) eller stillingen
  kan race. Minuttet regnes ut server-side fra `started_at`.
- **`get_event_with_rsvp`** er `CREATE OR REPLACE`-t med ett nytt felt:
  `match_session.started_at`. Ellers uendret.
- **Realtime:** `match_sessions` + `match_events` lagt i `supabase_realtime`
  (idempotent DO-blokk). Realtime respekterer RLS, og begge har alt en
  «members can view»-SELECT-policy.

### ⚠️ Tre NULL-feller i plpgsql (jeg gikk i alle tre først)
`false OR NULL` er `NULL`, og **`IF NOT NULL THEN` kjører ikke**. Så
`IF NOT (is_team_admin(...) OR ms.reporter_id = auth.uid())` slapp *hvem som
helst* gjennom når `reporter_id` var NULL. Samme for
`NULL NOT IN ('home','away')`. Alle tre er nå pakket i `COALESCE(..., false)`.
**Skriv aldri en rettighetssjekk i plpgsql uten COALESCE rundt et nullbart
felt.**

### App
- **`src/lib/api/members.ts` (ny):** `getTeamMembers` mot `get_team_members`.
  RPC-en gir én rad per *medlemskap*, så en forelder med barn kommer flere
  ganger; vi beholder første rad per bruker (duplikat-id-er ville brutt
  `keyExtractor`). `comments.ts` bruker nå denne i stedet for sin egen kopi.
- **`events.ts`:** `startMatch`, `reportMatchEvent`, `setMatchReporter`,
  `subscribeToMatch`. Sistnevnte **refetcher** ved endring i stedet for å flette
  inn payloaden — kampforløpet må uansett sorteres, og en refetch kan ikke komme
  ut av synk. `HeiaEvent` har nye `matchSessionId` + `startedAt`.
- **`EventDetailScreen`:** «Start kamp» + `ReporterBar` vises nå på en
  **kommende** kamp. `minute={55}` er borte — minuttet regnes fra `startedAt` og
  tikker hvert 30. sek (uten den frøs minuttet mellom mål). «Slutt» spør først.
- **`ReporterBar`:** «Bytt» er **admin-only**. UPDATE-policyen på
  `match_sessions` har ingen `WITH CHECK`, så Postgres gjenbruker `USING` også
  for den nye raden — en reporter som ikke er admin kan derfor ikke peke rollen
  videre (`42501`). Og: nekter RLS via `USING` får du **ingen feil, bare null
  rader**, så `setMatchReporter` gjør `.select('id')` og kaster selv.
- **Fjernet «Kampvarsler / Slå på»-kortet.** Det lovet push og gjorde ingenting.
  Erstattet med «Du følger kampen direkte», som nå er sant.
- **Alle mock-filer slettet** (`src/data/teamData.ts`, `src/shared/mockData.ts`).

### Slik testes det (Metro-reload — realtime trenger INGEN rebuild)
Migrasjonen er alt ute. Ingen seed-SQL lenger — kampen lages og startes i appen.
1. Opprett en kamp med `+` → åpne den. Som trener ser du «Ingen kampreporter»
   + «Velg», og en **«Start kamp»**-knapp.
2. Trykk «Start kamp» uten å velge reporter → du blir reporter selv,
   `ScoreBoard` + `ReporterActions` dukker opp, minuttet står på 0'.
3. Sjekk feeden på Hjem → «⚽ Kampen er i gang: … mot …». Hero-banneret vises.
4. Trykk **Mål oss** → skriv scorer → stillingen går til 1–0, kampforløpet får
   en rad, og feeden får «⚽ MÅL! … 1–0 …».
5. **Det viktige:** logg inn som en forelder på en annen simulator/enhet, stå på
   kampskjermen, og la treneren score. Stillingen skal endre seg **uten** at
   forelderen gjør noe.
6. Trykk «Slutt» → bekreft → kampen blir `ferdig`, skjermen går tilbake til
   vanlig event-modus, feeden får «🏁 Slutt!».
7. Som forelder: ingen «Velg»/«Bytt»/«Start kamp».

### Kampen etterlater seg et spor (samme skive)
Da «Slutt» ble trykket falt `EventDetailScreen` ned i vanlig event-modus, og
**både stillingen og hele kampforløpet forsvant** i samme øyeblikk som de var
ferdige. Rettet:
- **`EventCard`:** en kamp med `score` viser resultatet i stedet for
  `RSVPBar` — «PÅGÅR NÅ» / «PAUSE» / «SLUTTRESULTAT» + stillingen. Hvem som
  «kommer» er uinteressant når kampen er spilt.
- **`EventDetailScreen`:** en `finished` kamp viser `ScoreBoard` + hele
  **kampforløpet**, kronologisk (avspark → slutt), som en historie. RSVP-knappene
  skjules — man melder seg ikke på en kamp som er over.
- **`describeMatchEvent` i `events.ts`:** et mål viser nå «Mål for oss» /
  «Mål for {motstander}», med scorernavnet reporteren skrev som undertekst
  (`player`). Før havnet navnet i `description`, så et mål uten navn ble en helt
  tom rad, og et mål med navn røpet ikke hvilket lag som scoret.
  `MatchEvent` har fått `teamSide`.

### Fortsatt igjen etter dette
- ~~Ekte push~~ → **kodet i Fase 4** (under). Venter på Apple/APNs + rebuild.
- ~~Resume etter pause~~ + ~~`getLiveMatch` i pause~~ → **løst i Fase 3D** (under).
- **`+`-knappens tredje valg** («Start kamp», beslutning 1) er ikke bygget —
  kampen startes fra kampsiden. Ren snarvei, loopen er hel uten.
- ~~`FeedCard` på match-typene~~ → **verifisert (les-review):** `getMarker`
  gir grønn rail + «KAMP»-markør + fet innholdstekst, ingen krasj. Minuttet
  vises ikke i markøren fordi `mapFeedRow` (feed.ts) ikke hydrerer `matchEvent`
  — kosmetisk, `content`-strengen bærer stilling/minutt. Akseptert v1.

### LÅSTE BESLUTNINGER (bruker, 2026-07-09)

1. **`+`-knappen = rollestyrt valgark.** Alle ser «Del med laget» (tekst/bilde).
   Trener/lagleder/admin ser i tillegg «Ny hendelse». Reporter ser «Start kamp»
   når laget har en kamp i dag. Knappen skal aldri være død for en forelder —
   den er appens mest fremhevede knapp, og foreldre er de fleste brukerne.
   ✅ Bygget, bortsett fra «Start kamp»-snarveien i valgarket. Kampen startes fra
   kampsiden (3C); snarveien er ren bekvemmelighet.

4. **Hvem starter kampen (bruker, 2026-07-09):** trener/lagleder/admin, eller en
   reporter treneren har utpekt. **Den som starter blir reporter** hvis ingen er
   satt. Ikke «alle medlemmer» — to personer som rapporterer samme kamp er verre
   enn litt friksjon.
5. **Levering til foreldre (bruker, 2026-07-09):** Supabase Realtime på
   kampskjermen nå. Ekte push er en senere, egen skive.
2. **Kun trener/lagleder/admin kan opprette hendelser** — som RLS allerede sier.
   Ingen migrasjon for rettigheter. ✅ Bygget.
3. **Trener tildeler kampreporter.** «Ta rollen»-knappen i `ReporterBar` skal
   fjernes; reporter velges via `ReporterSheet`.
   ✅ Ferdig (3B-2 + 3C-1). Kun admin kan tildele — RLS tillater ikke annet.

### Idé parkert i 3B-1
`create_event` kunne også lagt en `paaminnelse`-post i feeden («Ny kamp mot Lyn»)
— `feed_posts` har allerede `event_id` og typen. Droppet for å holde skiven smal
og fordi `FeedCard` ikke er testet på den typen. Vurder i 3C sammen med
`match_event` → feed-post.

### Live kamp — slik er flyten tenkt (skjemaet er allerede bygget for den)

Kamp opprettes med `match_session` i status `planlagt` → noen trykker
«Start kamp» (`status='live'`, `started_at`) → `EventDetailScreen` bytter til
live-modus med `ScoreBoard` + `ReporterActions` → hvert trykk skriver en rad i
`match_events`. Kamphendelser legges altså inn **inne på kampen**, ikke fra `+`.

`feed_posts` har allerede `match_event_id` og typene `match_event`,
`match_start`, `match_end`: en kamphendelse skal **også** bli en feed-post (og
senere en push). Det er Strava-øyeblikket — «MÅL! 2–1» mens kampen pågår.
I dag viser `ReporterActions` kun en simulert push og lagrer ingenting.

### Seed-SQL — ikke nødvendig lenger
Både vanlige hendelser og kamper lages i appen, og «Start kamp» setter en kamp
i `live`. Trenger du likevel å nullstille en kamp under testing:

```sql
-- spol en kamp tilbake til «ikke startet»
update public.match_sessions
set status = 'planlagt', started_at = null, finished_at = null,
    home_score = 0, away_score = 0, reporter_id = null
where id = '<SESSION_ID>';

delete from public.match_events where match_session_id = '<SESSION_ID>';
```

---

## Fase 3D — GJORT (pause ⇄ andre omgang)

Kodet 2026-07-26. Én migrasjon (`00021`, deployet), ingen native moduler →
**kun Metro-reload.** Lukket to hull fra 3C-lista.

- **Migrasjon `00021_resume_match.sql` (✅ deployet):** `report_match_event` er
  `CREATE OR REPLACE`-t. Godtar nå også `andre_omgang` (fantes alt i
  `match_events`-CHECK) → setter `status` tilbake til `live` + feed-post
  «▶️ Andre omgang i gang». To overgangs-vakter lagt til: `pause` kun fra
  `live`, `andre_omgang` kun fra `pause` (ellers dobbel pause-rad / falsk
  gjenopptakelse). Alt annet identisk med `00020`.
- **`events.ts`:** `ReportableEventType` fikk `andre_omgang`. `getLiveMatch`
  bruker nå `.in('...status', ['live','pause'])` — banneret overlever pausen.
- **`ReporterActions`:** «Pause»-knappen bytter til «Fortsett» (▶️) når kampen
  er i pause — samme plass i griddet, aldri en død knapp. Ny `isPaused`-prop.
- **`EventDetailScreen`:** `andre_omgang` er et rent av/på-trykk (som pause,
  ingen modal). `isPaused={matchStatus==='halfTime'}` sendes til `ReporterActions`.
  Vennlige feiltekster for de nye vaktene (race/realtime-lag).
- **`LiveBadge` + `LiveMatchBanner`:** banneret vises nå også i `halfTime`.
  `LiveBadge` fikk `paused`-variant: gul «PAUSE» uten puls (stillestående prikk
  = stoppet). `LiveMatchBanner` slapp før alt annet enn `status==='live'`.

### Test dette først (Metro-reload, migrasjon alt ute)
1. Start en kamp → trykk **Pause**. `ScoreBoard` sier PAUSE, feeden får «⏸ Pause»,
   og handlingsknappen har byttet til **Fortsett**.
2. Gå til Hjem → hero-banneret står fortsatt der, nå gult «PAUSE» (før forsvant det).
3. Trykk **Fortsett** → status `live`, feeden får «▶️ Andre omgang i gang»,
   knappen er «Pause» igjen. Forelder på annen enhet ser byttet via realtime.
4. Prøv å pause to ganger raskt / fortsette en kamp som alt spilles → vennlig
   Alert, ingen rar tilstand.

## Fase 4 — EKTE PUSH — kode + native FERDIG, backend IKKE deployet

Kodet 2026-07-26, native rebuild fullført 2026-07-27, **backend deployet
2026-07-29**: `00022` ✅ pushet, Edge Function `push-fanout` ✅ deployet, ny
native modul ✅ installert/bygget/kjører.

### ✅ VERIFISERT 2026-07-29: `simctl push` virker
`./scripts/push-test.sh` sender et varsel med **nøyaktig samme payload-form som
`_shared/apns.ts` bygger** (`aps.alert.title/body`, `sound`, `thread-id`, +
`feed_post_id`/`event_id`/`team_space_id` på toppnivå). Varselet dukket opp på
begge bootede simulatorer. **Det beviser at AppDelegate + pod'en + forgrunns-
visning er riktig koblet.** Presets: `maal|start|pause|slutt|melding`.

### ⛔ HVORFOR EKTE PUSH (fra appen) IKKE VIRKER ENNÅ
Bruker postet i appen og fikk ingenting. **Forventet.** `simctl push` injiserer
varselet lokalt og **hopper over hele kjeden** — den beviser kun visning.
Kjeden med status:

```
feed_posts INSERT                             ✅ skjer
  → trigger notify_on_feed_post               ✅ deployet (00022)
    → vault: project_url + service_role_key   ⛔ IKKE SEEDET → no-op, stille
      → pg_net → push-fanout                  ✅ deployet
        → notifications-rad (in-app-logg)     ⛔ nås aldri
          → device_tokens                     ⛔ TOM (se under)
            → APNs                            ⛔ ingen APNS_KEY/.p8
```

1. **Vault-secretene er den harde stopperen nå.** Uten dem returnerer
   `notify_on_feed_post` `NEW` uten å gjøre noe — med vilje, så posten ikke
   feiler av at push mangler. Seed dem (punkt 11 under) og hele fan-out-
   logikken kan verifiseres via `notifications`-tabellen, **uten APNs**.
2. **Simulator får normalt aldri en ekte APNs-device-token**, så
   `device_tokens` blir stående tom uansett. Ekte push = Apple Developer
   Program ($99/år) + fysisk iPhone. Ikke noe vi kan kode oss rundt.
3. **⚠️ Forfatteren er ekskludert fra mottakerne** (`id !== post.author_id` i
   push-fanout). Tester du med **samme bruker** på to simulatorer, blir
   `recipients: 0` uansett hvor riktig alt annet er. Bruk to ulike kontoer.

### Hva vi faktisk varsler på
Ett hook på `feed_posts` INSERT dekker alt. Alle typer unntatt `system`:

| `feed_posts.type` | Utløses av | Kategori |
|---|---|---|
| `match_start` | «Start kamp» → ⚽ Kampen er i gang | `match_live` |
| `match_event` | MÅL, ⏸ Pause, ▶️ Andre omgang | `match_live` |
| `match_end` | «Slutt» → 🏁 | `match_live` |
| `melding` | tekstpost i feeden | `new_post` |
| `bilde` | bildepost | `new_post` |
| `paaminnelse` / `resultat` | typene finnes, appen lager dem ikke ennå | — |

Mottakere = alle `status='active'` medlemmer i team_space, **minus forfatteren**,
minus de med `notification_preferences.enabled=false` på kategorien (lag-rad
slår global rad). Tittel = lagnavn for kamp, forfatternavn ellers.

### Arkitektur — alt henger på ÉN hook
Hver kamphendelse OG hver feed-post er allerede én rad i `feed_posts` (fra 3C).
Så i stedet for å røre `report_match_event`/`createTextPost` la vi **én trigger
på `feed_posts` INSERT**. Den fyrer et async `pg_net`-kall til Edge Function
`push-fanout`, som regner ut mottakere og sender APNs.

```
report_match_event / createTextPost / createImagePost
        │  (INSERT feed_posts — fantes alt)
        ▼
 trigger notify_on_feed_post ──pg_net (async)──► Edge Function «push-fanout»
        │ (vault: project_url + service_role_key)      │
                                        1. mottakere = aktive lagmedlemmer − forfatter
                                        2. respekter notification_preferences (opt-out)
                                        3. INSERT notifications (in-app-logg)
                                        4. slå opp device_tokens
                                        5. APNs HTTP/2 (JWT ES256 fra .p8)
                                           410/BadDeviceToken → slett token
```
Ett hook = varsel for mål, avspark, pause, andre omgang, slutt, tekst OG bilde.
`system`-poster hoppes over. Async pg_net → `report_match_event` blir ikke tregere.

### Filer som er lagt til / endret
- **`supabase/migrations/00022_push_notifications.sql`** — `device_tokens`-tabell
  (+ RLS «egne tokens»), RPC-ene `register_device_token` (upsert på token, flytter
  eier ved re-login) og `unregister_device_token`, og trigger-funksjonen
  `notify_on_feed_post`. Aktiverer `pg_net` + `supabase_vault` (no-op på hosted).
- **`supabase/functions/push-fanout/index.ts`** — Deno. Selv-autentiserer
  (Bearer === service_role_key, `verify_jwt=false`). Mottakere, opt-out-logikk
  (team-rad slår global), `notifications`-insert, APNs, rydder døde tokens.
- **`supabase/functions/_shared/apns.ts`** — APNs HTTP/2 + provider-JWT ES256
  signert med .p8 (Web Crypto, rå r||s = JOSE-format), token cachet ~50 min.
  `APNS_HOST` defaulter til **sandbox**.
- **`supabase/config.toml`** — `[functions.push-fanout] verify_jwt=false`.
- **App:** `src/lib/api/push.ts` (RPC-wrappere), `src/lib/push/index.ts`
  (permission + token-registrering; **lazy `require` i try/catch** så appen ikke
  krasjer før native er bygget inn; native-kall også try/catch'et for
  half-installed-vinduet), `src/components/PushGate.tsx` (koblet i `App.tsx`),
  avregistrering i `signOut` (UserContext) — kalt FØR session tømmes, ellers er
  `auth.uid()` null.
- **`scripts/push-test.sh`** (ny, 2026-07-29) — `simctl push` til alle bootede
  simulatorer med realistisk payload. `./scripts/push-test.sh maal|start|pause|slutt|melding [UDID]`.
  Bundle-id overstyres med `HEIA_BUNDLE_ID` når den ekte settes (A1 under).
- **Native:** `ios/Heia2/AppDelegate.swift` (APNs-delegatene → `RNCPushNotificationIOS`,
  + forgrunns-visning via `UNUserNotificationCenter`), `ios/Heia2/Heia2-Bridging-Header.h`
  (eksponerer ObjC-pod'en for Swift). `package.json` +
  `@react-native-community/push-notification-ios ^1.11.0`.

### ⚠️ DIN SIDE — gjør dette i ett jafs, så lever pushen
**A. Apple Developer (nettleser):**
1. Sett en **ekte bundle-id** (nå er den default `org.reactjs.native.example.Heia2`).
   Velg f.eks. `no.heia.app` i Xcode → target Heia2 → Signing & Capabilities →
   Bundle Identifier. Bruk SAMME verdi som `APNS_BUNDLE_ID` under.
2. Registrer App ID-en med **Push Notifications**-capability (Certificates,
   Identifiers & Profiles → Identifiers).
3. Lag en **APNs Auth Key (.p8)** (Keys → +, huk av Apple Push Notifications).
   Noter **Key ID** (10 tegn) og **Team ID** (10 tegn). Last ned .p8 (kun én gang!).

**B. Xcode (native) — ✅ FERDIG 2026-07-27, ikke gjør om igjen:**
- ✅ `npm install` + `pod install` → `RNCPushNotificationIOS (1.12.0)` installert.
- ✅ **Bridging header satt** — `SWIFT_OBJC_BRIDGING_HEADER = "Heia2/Heia2-Bridging-Header.h"`
  er skrevet inn i **begge** build-configs i `project.pbxproj` (linje ~280 og ~307).
- ✅ **Build Succeeded** — appen kjører i simulator med push-modulen linket.
- ⬜ **Gjenstår:** «Push Notifications»- + «Background Modes → Remote
  notifications»-capability er **ikke** lagt til (krever Apple-konto for
  signering; ikke nødvendig for `simctl push`-testing).

**C. Supabase (kan kjøres av Claude, sandkasse av — men secrets er dine):**
8. ✅ **GJORT 2026-07-29:** `supabase db push` (deployerte `00022`).
9. ✅ **GJORT 2026-07-29:** `supabase functions deploy push-fanout`.
10. ⬜ `supabase secrets set APNS_KEY_ID=xxxx APNS_TEAM_ID=xxxx APNS_BUNDLE_ID=no.heia.app APNS_HOST=api.sandbox.push.apple.com` og
    `supabase secrets set APNS_KEY="$(cat AuthKey_XXXX.p8)"`.
11. ⬜ **← NESTE STEG, og det eneste som er gratis.** Seed vault (ÉN gang, i
    SQL-editoren — service_role_key fra Project Settings → API). Uten dette gjør
    trigger'en ingenting. Etterpå: post noe i appen som bruker A og kjør
    `select user_id, category, title, body, sent_at from notifications
     order by sent_at desc limit 10;` — én rad per *annet* medlem betyr at hele
    backenden er verifisert, og kun Apple-siden gjenstår.
    ```sql
    select vault.create_secret('https://sswncdrbsrfieudkdmhj.supabase.co', 'project_url');
    select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
    ```

### Endringer i varsel-flyten (gjort 2026-07-26, etter design-diskusjon)
- **Ingen kald permission-dialog ved innlogging.** iOS lar deg spørre **kun én
  gang** — sier brukeren nei der, er døra stengt for godt. `PushGate` kaller nå
  `refreshPushIfGranted()` som registrerer token **stille** hvis brukeren alt
  har sagt ja, og ellers gjør ingenting.
- **Ny 🔔 «Varslinger»-rad på ProfilScreen** er stedet man skrur på varsler.
  Viser status (`PUSH_SUBTITLE`), ber om tillatelse første gang (`enablePush()`),
  og sender ellers brukeren til iOS-Innstillinger (`Linking.openSettings()`).
  Statusen refreshes via `AppState`-lytter når appen kommer i forgrunn.
- `lib/push` eksporterer nå `getPushPermission`, `refreshPushIfGranted`,
  `enablePush`, `stopPush`, `isPushAvailable` (ikke lenger `startPush`).

### ⚠️ Native-lærdommer fra rebuilden (ikke gjenta)
- **`didFailToRegisterForRemoteNotifications` er FJERNET fra `AppDelegate.swift`
  med vilje.** Swift importerer pod'ens `...WithError:`-klassemetode under et
  navn som ikke lot seg bygge («has no member»). De to andre kallene
  (`didRegisterForRemoteNotifications(withDeviceToken:)` og
  `didReceiveRemoteNotification(_:fetchCompletionHandler:)`) er **riktige** og
  bygger. `registrationError`-eventet er ikke-essensielt. Ikke «fiks» dette ved
  å gjette navnet på nytt uten å lese `RNCPushNotificationIOS.h`.
- **fmt-patchen i `Podfile` er gjort idempotent.** Den kræsjet `pod install` med
  `Permission denied @ rb_sysopen - Pods/fmt/include/fmt/base.h` fordi den
  prøvde å skrive lappen på nytt i en read-only fil som alt var patchet. Nå
  hopper den over når lappen finnes (+ `File.chmod(0644)` før skriving).
- **`pod install` tar 20–60 min på denne maskinen** og ser død ut på
  `Configuring the target with the New Architecture` / `react-native config`.
  **Den er som regel bare treg — ikke Ctrl+C.** Avbryter du der, får du en
  villedende `[!] Invalid Podfile file:` på `use_native_modules!` (linje 18) —
  Podfilen er da IKKE ødelagt, det er bare den drepte Ruby-tråden.
- **Maskin-kontensjon er hovedårsaken til all tregheten.** Verstinger, i tur og
  orden funnet: full disk (98 %), `fseventsd` på 91 %, **Systeminnstillinger →
  Lagring stående åpen** (`ApplicationsStorageExtension` 94 %), og Metro/Xcode/
  to simulatorer samtidig. Lukk alt tungt før `pod install`.
- **`ETIMEDOUT: connection timed out, read` fra metro-file-map** etter at
  Mac-en har stått på i flere døgn = fastlåst filsystem-tilstand. Omstart
  fikser det. (Verifisert at det IKKE var iCloud-eviction: 0 dataless-filer.)
- **Prosjektet ligger i iCloud-synkede `~/Documents`.** Det har nå gitt
  filsystem-trøbbel to ganger. Vurder å flytte til `~/Developer/` en dag —
  egen operasjon, krever at Claude restartes i ny mappe.

### ⚠️ Fallgruve å huske (kostet ellers timer)
**APNs-token er miljøspesifikt.** Debug-build fra Xcode bruker **sandbox**
(`api.sandbox.push.apple.com`); TestFlight/App Store bruker prod
(`api.push.apple.com`). Feil `APNS_HOST` → `BadDeviceToken`. Default er sandbox.

### Slik testes det (etter A–C, to enheter/simulatorer)
1. Logg inn → godta varsel-dialogen. Sjekk i SQL at `device_tokens` fikk en rad.
2. Enhet 2 (forelder) med appen i **bakgrunn**. Enhet 1 (trener) scorer et mål.
3. Forelderen skal få en APNs-banner «⚽ MÅL! …» selv med appen lukket.
4. Åpen app: banneret vises i forgrunn (UNUserNotificationCenter), og feeden
   oppdateres uansett via realtime.
5. `select * from notifications;` skal ha én rad per mottaker (in-app-loggen).
6. Simulator uten push-støtte gir `registrationError` → stille no-op, ingen krasj.

### Kjente v1-begrensninger (akseptert)
- Ingen retry/kø på APNs-feil utover 410-opprydding (pg_net fire-and-forget).
- Ingen deep-link ved trykk ennå — `data.feed_post_id/event_id` sendes med for
  det, men appen navigerer ikke på tap i v1.
- Android: `device_tokens.platform` finnes, men FCM-utsending er ikke bygget.
- `notification_preferences` har ingen UI ennå (default = på; opt-out finnes i DB).

---

## Fase 5 — GJORT (Inbox / Varsler-fanen)

Kodet 2026-07-29. **Ingen migrasjon, ingen native modul → kun Metro-reload.**
Alt backend fantes fra før: `notifications` (00011) + RLS (00014:310–318,
SELECT + UPDATE på egne rader). Ingen ny RPC.

- **`src/lib/api/notifications.ts` (ny):** `getNotifications(teamSpaceId)`,
  `getUnreadCount(teamSpaceId)`, `markAsRead(ids)`, `markAllAsRead(teamSpaceId)`.
  Direkte select — RLS avgrenser til egne rader av seg selv.
  Team-filteret er `.or('team_space_id.eq.X,team_space_id.is.null')`: uten
  null-grenen ville en global `system`-melding aldri dukket opp.
  `markAsRead` har `.is('read_at', null)` så et nytt trykk på en lest rad ikke
  flytter tidspunktet.
- **`src/context/NotificationsContext.tsx` (ny):** ulest-telleren må deles av
  **to** steder — badgen i tab-baren og InboxScreen, som senker den i det du
  leser en rad. Uten delt tilstand ble badgen stående til neste omstart.
  `markRead` senker telleren optimistisk og refetcher etterpå.
  **`getUnreadCount` svelger feil med vilje — en badge skal aldri velte appen.**
  Refresh skjer ved fanebytte (`screenListeners={{focus}}` på `Tab.Navigator`)
  og når appen kommer i forgrunn (`AppState`). **`notifications` ligger IKKE i
  `supabase_realtime`-publiseringen**, så det finnes ingen push-oppdatering av
  telleren — legg den til der hvis badgen skal tikke live.
- **`NotificationRow.tsx` (ny):** emoji per `category`, ulest = heiaSoft-flate +
  grønn prikk + fet tittel, lest = hvit flate + dempet tittel.
- **`InboxScreen`** skrevet om: pull-to-refresh + `useFocusEffect` (samme
  mønster som `KalenderScreen`), «Merk alle som lest» i headeren når det finnes
  uleste (uten den kunne badgen bli stående for alltid), tom-tilstand.
- **Egen `InboxStack`** (`InboxList` + `EventDetail` + `Comments`).
  Tab-en het `Inbox`, heter nå `InboxStack` med label **«Varsler»**.
  Grunn: et trykk på et varsel skal åpne hendelsen/tråden **uten** å kaste deg
  over i Hjem-fanen — tilbake-knappen fører til inboxen. Samme gjenbruk av
  `EventDetailScreen`/`CommentsScreen` på tvers av stacker som Kalender gjør.
- **Deep-link-regelen:** `data.event_id` → `EventDetail` (kamphendelser har den,
  fordi `report_match_event` stempler `event_id` på feed-posten), ellers
  `data.feed_post_id` → `Comments`. Uten mål markerer trykket bare som lest.
  Dette er deep-link-en push mangler i v1 — gjenbrukes den dagen APNs lever.

### ⚠️ Inboxen er tom uten data — og `simctl push` fyller den IKKE

`./scripts/push-test.sh` injiserer varselet lokalt i simulatoren og **rører
aldri databasen**. Fikk du bannere men tom Varsler-fane: det er forventet, ikke
en bug. Radene må komme fra én av disse to:

1. **Vault-seeden** (Fase 4, punkt 11) — den permanente fiksen. Etterpå skriver
   `push-fanout` ekte rader hver gang noen poster. Krever **ingen** Apple-konto.
   **Men:** forfatteren ekskluderes, så poster du med din egen bruker får DU
   ingen rad. Test med to kontoer, ellers ser inboxen fortsatt tom ut.
2. **Test-SQL** (raskest): lager varsler **til deg selv** av de siste
   feed-postene i lagene dine — uten forfatter-ekskludering, nettopp fordi
   én-konto-testing ellers gir null rader. Deep-link-ene virker (ekte
   `feed_post_id`/`event_id`). Bytt ut e-posten med testkontoens:

```sql
with me as (select id from auth.users where email = '<DIN E-POST>')
insert into public.notifications
  (user_id, team_space_id, category, title, body, data,
   source_entity_type, source_entity_id, sent_at)
select me.id, p.team_space_id,
       case when p.type in ('match_start','match_event','match_end') then 'match_live'
            when p.type = 'paaminnelse' then 'event_reminder'
            else 'new_post' end,
       coalesce(pr.display_name, 'Heia'),
       coalesce(nullif(p.content, ''), 'Ny aktivitet i laget'),
       jsonb_build_object('feed_post_id', p.id, 'event_id', p.event_id,
                          'team_space_id', p.team_space_id, 'type', p.type),
       'feed_post', p.id, now()
from me
join public.memberships m on m.user_id = me.id and m.status = 'active'
join lateral (select * from public.feed_posts fp
              where fp.team_space_id = m.team_space_id
              order by fp.created_at desc limit 8) p on true
left join public.profiles pr on pr.id = p.author_id;
```

Feilsøking, i denne rekkefølgen:
```sql
select count(*) from public.notifications;              -- 0 = ingen data, ikke UI-feil
select user_id, team_space_id, category, title, read_at -- ser radene riktige ut?
from public.notifications order by created_at desc limit 10;
```
Er `count` > 0 men fanen fortsatt tom: sjekk at `user_id` er den innloggede
brukeren og at `team_space_id` er det **aktive** laget (skjermen filtrerer på
aktivt lag + globale rader).

### Test dette (Metro-reload, ingen rebuild)
1. Kjør test-SQL-en (eller vault-seeden) → ✉-fanen får en rød badge med tallet.
2. Åpne Varsler → uleste har grønn flate + prikk, leste er hvite og dempet.
3. Trykk et kampvarsel → hendelsen åpnes, raden blir lest, badgen går ned med 1.
   Tilbake-knappen fører til inboxen, ikke til Hjem.
4. Trykk et vanlig innlegg → kommentartråden åpnes.
5. «Merk alle som lest» → badgen forsvinner umiddelbart, alle radene blir hvite.
6. Dra ned for å refreshe. Bytt fane frem og tilbake → badgen holder seg riktig.

## Fase 5B — GJORT (inboxen fyller seg selv + kun ekte varsler)

Migrasjon **`00023_inbox_direct_write.sql` ✅ deployet 2026-07-29**,
`push-fanout` ✅ redeployet. Rettet to feil fra 00022:

### 1. Hele inboxen hang på vault — den gjør den ikke lenger
`notify_on_feed_post` skrev **ingen** rader selv; den fyrte bare et pg_net-kall
til Edge-funksjonen, som skrev dem. Uten `project_url` + `service_role_key` i
vault returnerte den `NEW` og gjorde ingenting — så inboxen var tom for alltid,
uansett hvor mye man postet. **Nå INSERT-er trigger'en `notifications` selv, i
samme transaksjon som posten.** Ingen secrets, ingen Edge Function, ingen Apple
trengs for at Varsler-fanen skal virke. pg_net-kallet står igjen, men gjør nå
**kun** APNs, og kun hvis vault faktisk er seedet.

**Regel å huske: in-app-funksjonalitet skal aldri gå veien om en Edge Function
som krever secrets. Legg den i databasen.**

### 2. Varsler var en kopi av Hjem
Alt i feeden ble et varsel. Nå varsles det kun på det som *er* et varsel:

| Utløser | Kategori | Finnes i feeden? |
|---|---|---|
| Mål, avspark, pause, andre omgang, slutt | `match_live` | ja — men dette er «du gikk glipp av det»-øyeblikket |
| **Kommentar på DITT innlegg** (ny trigger på `comments`) | `new_comment` | **nei — adressert til én person** |
| **Ny hendelse i kalenderen** (ny trigger på `events`) | `event_reminder` | **nei — `create_event` lager ingen feed-post** |
| Vanlig melding / bilde i feeden | — | **varsles IKKE lenger. Det ER feeden.** |

Vil du ha vanlige innlegg tilbake i inboxen: legg `WHEN 'melding' THEN 'new_post'`
tilbake i `CASE`-en i `notify_on_feed_post`. Det er én linje.

### 3. `push-fanout` regner ikke lenger ut mottakere
Den leser `notifications`-radene trigger'en alt har skrevet
(`source_entity_type='feed_post'`) og sender APNs til dem. Ellers ville vi fått
**doble rader** i det vault ble seedet. Én mottakerliste = inbox og push kan
ikke komme ut av synk. pg_net sender først etter commit, så radene finnes.

### `inbox_enabled(user, team, category)`
Ny SQL-hjelper: lag-rad i `notification_preferences` slår global rad, ingen rad
= på. `COALESCE(..., true)` er ikke pynt — uten den blir «ingen rad» NULL, og
`WHERE NULL` filtrerer bort **alle** mottakerne (samme NULL-felle som i 00020).

### ⚠️ Alle varsler ekskluderer den som utløste dem
Reporteren får ikke sitt eget mål, treneren ikke sin egen hendelse, og du får
ikke varsel om din egen kommentar. **Med ÉN konto ser inboxen derfor fortsatt
tom ut, uansett hvor riktig alt er.** Slik testes det ordentlig:

1. Sim 2: logg inn som en **annen** bruker, bli med i laget med invitasjonskoden.
2. Sim 1 (trener): opprett en trening → **sim 2 får «Ny trening …» med én gang.**
3. Sim 2: kommenter på et av sim 1s innlegg → **sim 1 får «… kommenterte
   innlegget ditt».**
4. Sim 1: start kamp og trykk MÅL → **sim 2 får «⚽ MÅL! …».**

Alt dette virker **uten vault, uten APNs og uten Apple-konto.**

## Fase 5C — GJORT (👏-varsel + «Varsle hele laget»)

Migrasjon **`00024_reaction_and_broadcast.sql` ✅ deployet 2026-07-29**.
Ingen native modul → **kun Metro-reload.**

### 1. 👏 «Heia» varsler forfatteren — aggregert
Kudos-varselet er motoren i innholdsløkka: du poster, noen heier, du får
beskjed, du poster igjen. Uten det er det ingen belønning for å dele.
- Ny kategori **`new_reaction`**. CHECK-ene i 00011 er inline på kolonnen med
  autogenerert navn, så migrasjonen finner dem via `pg_constraint` i stedet for
  å gjette navnet — **treffer man feil navn blir den gamle CHECK-en stående og
  hver eneste reaksjon feiler.**
- **Aggregering:** finnes det alt en ULEST reaksjonsrad for samme innlegg,
  oppdateres den («Kari og 3 andre heiet på innlegget ditt») i stedet for å lage
  en ny. `created_at` bumpes så den går øverst. Er raden lest lages en ny.
  Uten dette ville ti som heier gitt ti rader — akkurat støyen 00023 ryddet bort.
- Un-heia (DELETE) fjerner ikke varselet. Akseptert v1.

### 2. «Varsle hele laget» — trenerens kringkasting
Etter 00023 varsler ikke vanlige innlegg. Men noen ganger *er* innlegget
viktig, og da sier avsenderen det selv:
- Avkrysning i compose-boksen på TeamHome, **kun synlig for trener/lagleder**.
  Setter `is_pinned` → varsel i kategorien `admin_message`.
- `is_pinned` fantes fra 00009, og `get_team_feed` sorterer alt
  `ORDER BY fp.is_pinned DESC` — så posten går øverst uten ny kode.
- **`FeedCard` viser «📌 VIKTIG» + rail på pinnede poster.** Uten det trykker
  treneren «varsle alle» og feeden ser helt lik ut — funksjonen ble usynlig.
  `FeedItem.isPinned` + `mapFeedRow` hydrerer feltet (RPC-en returnerte det alt).
- Tittelen i varselet er **forfatterens navn** for `admin_message` (det er
  treneren som snakker), men **lagnavnet** for kamp (det er laget som spiller).

### ⚠️ Pinning er låst i DATABASEN, ikke bare i UI-et
INSERT-policyen på `feed_posts` sjekker kun medlemskap, så uten vakt kunne
hvilken som helst forelder satt `is_pinned` via API-et og varslet hele laget.
Ny BEFORE INSERT/UPDATE-trigger `enforce_pin_is_admin` kaster
«Kun trener eller lagleder kan varsle hele laget».
`COALESCE(is_team_admin(...), false)` — uten den er `IF NOT NULL` usant og
vakten slipper alle gjennom (NULL-fellen fra 00020 igjen).

### Test dette (Metro-reload, migrasjon alt ute)
1. Sim 2 heier 👏 på et innlegg fra sim 1 → **sim 1 får «… heiet på innlegget
   ditt»**. La en tredje bruker heie også → samme rad blir «og 1 annen …».
2. Les varselet, la noen heie igjen → **ny** rad (den forrige er sett).
3. Som trener: skriv et innlegg, huk av **🔔 Varsle hele laget** → posten får
   «📌 VIKTIG» og ligger øverst, og alle andre får et varsel.
4. Som forelder: avkrysningen finnes ikke. (Prøver man via API-et: exception.)

## Fase 5D — GJORT (live overalt + løsne festet post)

Migrasjon **`00025_realtime_feed.sql` ✅ deployet 2026-07-29**. Ingen native
modul → **kun Metro-reload.** To hull funnet av bruker under testing.

### 1. Bare kampen var live
`00020` la KUN `match_sessions` + `match_events` i `supabase_realtime`. Alt
annet krevde pull-to-refresh: sto du på Hjem mens noen postet eller heiet,
skjedde ingenting. Nå er `feed_posts`, `reactions`, `comments` **og**
`notifications` med i publiseringen.
- **`subscribeToFeed(teamSpaceId, onChange)`** i `feed.ts`. `feed_posts`
  filtreres på `team_space_id`; `reactions`/`comments` **har ikke** den
  kolonnen, så de abonneres ufiltrert — trygt, fordi realtime respekterer RLS
  og du kun mottar rader du uansett kunne lest.
- **Debounce på 400 ms i `TeamHomeScreen`.** Én burst med 👏 fra flere
  foreldre skal bli ÉN refetch, ikke ti. `loadFeed` setter ikke `loading`,
  så oppdateringen skjer uten at spinneren blinker.
- **Refetch, ikke flett inn payloaden** — samme valg som `subscribeToMatch`:
  feeden må uansett sorteres (pinnet øverst) og signerte bilde-URL-er hentes
  på nytt.
- **Live ulest-badge:** kanalen bor i `NotificationsContext` og teller opp
  `liveNonce`. `InboxScreen` bruker den som dependency og laster lista på
  nytt — **én kanal dekker både badgen og skjermen**. Ikke lag en kanal til
  i InboxScreen.

### 2. Festede poster kunne aldri fjernes
«Varsle hele laget» festet posten øverst for alltid — det fantes ingen vei ut.
- **`unpinPost(postId)`** i `feed.ts`. RLS hadde alt det som trengtes:
  «Authors can update own posts» + **«Admins can moderate posts»** (00014:194),
  så trener/lagleder kan løsne også andres. `enforce_pin_is_admin` (00024)
  vokter kun veien INN i festet tilstand, så å sette `false` er alltid lov.
  `.select('id')` + egen kastet feil, fordi RLS-avslag gir null rader uten error.
- **Selve «📌 VIKTIG»-markøren er knappen** (med `✕`), kun for trener/lagleder.
  Den står nettopp der man lurer på «hvorfor ligger denne øverst?».
- Bekreftelsesdialog, fordi **det finnes ingen «fest igjen»-knapp** på en
  eksisterende post — vil du feste noe på nytt må det postes på nytt.
  Naturlig neste utvidelse: `setPinned(id, true/false)` + auto-utløp etter
  f.eks. 7 dager, så gamle beskjeder rydder seg selv.

### Test dette (Metro-reload, migrasjon alt ute)
1. To simulatorer på Hjem. Sim 2 poster → **innlegget dukker opp hos sim 1
   uten pull-to-refresh.** Samme med 👏 (telleren beveger seg) og kommentarer.
2. Sim 2 heier på sim 1s innlegg → **badgen på Varsler tikker opp live**, og
   står du på Varsler-fanen dukker raden opp av seg selv.
3. Som trener: trykk «📌 VIKTIG ✕» på en festet post → bekreft → merket og
   toppplasseringen forsvinner, hos begge, live.
4. Som forelder: markøren er ikke trykkbar.

## Fase 5E — GJORT (varselet sier hva det gjelder)

Migrasjon **`00026_notification_context.sql` ✅ deployet 2026-07-29**.
Ingen native modul → **kun Metro-reload.** Funnet av bruker under testing.

### Problemet
«Kari heiet på innlegget ditt» sa ikke HVILKET innlegg — og trykket førte til
kommentarskjermen, som for en **reaksjon** typisk er helt tom. Altså: et varsel
uten kontekst som leder til en blindvei. Rettet i begge ender.

### 1. Varselet bærer nå et utdrag av posten
- Ny SQL-hjelper **`post_ref(content, type)`**: siterer og forkorter teksten
  (`«Husk drakter i morgen»`, 60 tegn + `…`). En bildepost uten tekst har
  ingenting å sitere og omtales som `bildet ditt`.
- `notify_on_reaction` → «heiet på «Husk drakter»» / «og 3 andre heiet på …».
- `notify_on_comment` → «kommenterte på «Husk drakter»: Ja, jeg tar med ekstra».
  Kommentaren kortes til 60 tegn (var 80) fordi referansen tar plass.
- **Raden er nå selvforklarende uten å trykke** — det er den viktigste halvdelen.

### 2. Innlegget vises øverst i tråden
- **`getFeedPost(teamSpaceId, postId)`** i `comments.ts`. Direkte select
  (RLS «Members can view feed»), forfatter via `getMemberMap` som resten av
  fila — **profiles-RLS gir ikke lagkameraters navn direkte.**
- **`media_attachments` er polymorf** (`entity_type`/`entity_id`, ingen FK til
  feed_posts), så PostgREST kan ikke embedde den fra `feed_posts`. Bildet
  hentes i et eget kall + signert URL. Ikke prøv å løse det med `select(...)`.
- `CommentsScreen` laster post + kommentarer parallelt. Posten er
  `.catch(() => null)` — feiler den skal tråden fortsatt vises.
- Ryddet samtidig de to gamle `catch (e)`-lint-feilene i fila.

### Test dette
1. Sim 2 heier på et innlegg fra sim 1 → varselet sier **hvilket** innlegg.
2. Trykk på det → innlegget står øverst, med bilde hvis det er en bildepost,
   over (den kanskje tomme) kommentartråden.
3. Samme for et kommentarvarsel.

## ⏸ Fase 4 (push) er PARKERT — ikke en åpen oppgave
Kode + native + backend er ferdig og deployet; `simctl push` verifisert. Det
som gjenstår er **kun** Apple Developer ($99/år) + fysisk iPhone. Uten
vault-secrets ligger trigger'en trygt i dvale (no-op by design) — ingenting
i appen ryker. Plukk den opp den dagen Apple-kontoen finnes.
Bruker-beslutning 2026-07-29: **ikke bruk mer tid på push nå.** Dette samsvarer
med den låste 3C-beslutningen (realtime nå, ekte push som egen skive senere).

---

## ✅ Fase 6 — Lagoversikt (FERDIG 2026-07-30)

Laget er ikke lenger usynlig: **Profil → Lagoversikt** viser hvem som er med,
gruppert per rolle, og gir trenere en måte å nå én forelder på.

**Hva som ble bygget**
- `supabase/migrations/00027_team_roster.sql` — `get_team_members()` gjenskapt
  (DROP + CREATE, fordi returtypen endret seg) med en ny `phone`-kolonne.
  **To grenser håndheves i SQL-en, ikke i UI-et:** du ser alltid ditt eget
  nummer; lagadmin (`is_team_admin`) ser andre voksnes nummer; **spillerkontoer
  — barna — eksponerer aldri nummeret sitt til noen.** Deployet.
- `src/lib/api/members.ts` — `TeamMember` utvidet med `status`, `joinedAt`,
  `childNames[]` og `phone`. Duplikatradene slås nå *sammen* i stedet for at
  den andre forkastes, så en forelder med to barn blir «Forelder til A og B».
  Endringen er additiv — `EventDetailScreen` og `comments.ts` er urørt.
- `src/screens/TeamMembersScreen.tsx` — seksjoner (trenere/lagledere,
  foreldre, spillere), «deg»-merke, «Invitert»-chip for dem som ikke har åpnet
  appen ennå, pull-to-refresh, og «Inviter til laget» nederst.
  Trykk på en rad med nummer → Ring / Send melding via `Linking`.
- `src/shared/roles.ts` — `ROLE_LABELS` flyttet hit fra `ProfilScreen` og deles
  nå av begge skjermene.
- Registrert i `ProfilStack` (`AppNavigator`, `ProfilStackParamList`), med
  inngang som ListRow i `ProfilScreen`.

**Blokkeren som dukket opp underveis (og ble løst):** `profiles.phone` fantes,
men *ingenting i appen skrev noen gang til den* — `updateProfile` godtok bare
`displayName`/`avatarUrl`. Telefonkolonnen ville altså vært tom for alle.
Derfor: `updateProfile` tar nå `phone` (`null` = fjern nummeret),
`AuthContext` har fått `refreshProfile()`, og Profil har raden
«Telefonnummer» som lagrer via `Alert.prompt`. **`Alert.prompt` er
iOS-only** — raden er derfor `Platform.OS === 'ios'`-gated, og Android trenger
en egen liten flate den dagen det blir aktuelt.

### Test dette
1. Profil → **Telefonnummer** → skriv inn ditt nummer → lagre.
2. Profil → **Lagoversikt**: se seksjonene. Som trener skal 📞 stå på voksne
   som har lagt inn nummer — aldri på spillere. Som forelder skal du ikke se
   andres numre i det hele tatt.
3. Inviter noen uten at de logger inn → de står med «Invitert».

### 🚫 Direktemeldinger — bevisst IKKE bygget (bruker enig 2026-07-29)
DM mellom voksne og barn i en ungdomsidrettsapp er et sikkerhetsproblem, ikke
en funksjon: norske klubber har retningslinjer mot lukket én-til-én-kontakt
mellom voksne og andres barn. Bygges det senere skal det være **voksen-til-
voksen** (trener ↔ forelder), aldri mot spillerkontoer. DM utløser dessuten
strengere krav fra Apple (guideline 1.2: blokkering + rapportering blir
obligatorisk). Behovet bak spørsmålet løses av telefonnummer i lagoversikten.

## ✅ Fase 7 — Kamera + kampbilder (KODET 2026-07-30, ikke verifisert i sim)

**⚠️ KREVER REBUILD** — `Info.plist` har fått `NSCameraUsageDescription`.
Uten den *avslutter iOS appen* i det kameraet åpnes (den spør ikke, og avslår
ikke). Metro-reload er ikke nok. Ingen ny pod — `react-native-image-picker`
var allerede installert, og `launchCamera` ligger i samme pakke.

**Hva som ble bygget**
- `src/lib/media.ts` — `pickTeamImage({preferCamera})` spør «Ta bilde / Velg fra
  kamerarullen» og returnerer bildet klart for opplasting. Den viser sine egne
  feilmeldinger, så kallstedet sjekker bare for `null`. `preferCamera` snur
  rekkefølgen: kamera først i kamp, kamerarull først i hjem-feeden.
- `src/lib/api/feed.ts` — opplastingen er trukket ut som `uploadTeamImage()`,
  så RN-fella (base64 → ArrayBuffer, ALDRI fil-URI i `.upload()`) bor ett sted.
  `createImagePost` tar nå valgfri `eventId` + `matchEventId`.
  Ny `getMatchPhotos(eventId)` med signerte URL-er.
- `supabase/migrations/00028_match_photos.sql` — `get_match_photos(evt_id)`.
  **Deployet.** Egen RPC fordi `media_attachments (entity_type, entity_id)` er
  en generisk peker og IKKE en fremmednøkkel — PostgREST kan ikke joine over
  den, så et nested select fra klienten er umulig.
- `MatchPhotoSheet` — forhåndsvisning + valgfri tekst + valget «Generelt
  kampbilde» eller ett bestemt øyeblikk fra kampforløpet (nyeste øverst).
- `MatchTimeline` — **bildene bor i kampforløpet, ikke i en egen seksjon**
  (bruker-beslutning 2026-07-30). Et bilde knyttet til en hendelse henger på
  hendelsen; et generelt kampbilde er sitt eget innslag på minuttet det ble
  lagt ut. Minuttet regnes ut med SAMME formel som serveren bruker i
  `report_match_event`, så bilder og hendelser deler minuttskala. Deler de
  minutt, kommer hendelsen først — bildet er som regel av det som nettopp
  skjedde. `newestFirst` i live, forfra i rapporten (som før).
- `MatchPhotoRail` + `MatchPhotoGallery` — kompakt thumbnail-rad **kun på
  ferdigspilt kamp**, som åpner fullskjerm galleri med sveiping. Under kampen
  skal ingenting konkurrere med stillingen; etterpå er bildene det man kommer
  tilbake for. Bildene blir uansett stående i forløpet.
- `ReporterActions` — «📷 Legg ut bilde» i full bredde under handlingsknappene.
  Egen `onPhoto`-prop, IKKE en ny `ReporterActionType`: et bilde er ikke en
  kamphendelse og går aldri gjennom `report_match_event`.
- `TeamHomeScreen` bruker samme velger — publiseringsflyten er uendret.

**Låst beslutning (bruker, 2026-07-30):** vanlige innlegg fra hjem-feeden får
**IKKE** automatisk kobling til en pågående kamp. Kampkobling skjer kun via
reporterens bildeknapp inne på kampen. Ett bilde per innlegg, tekst valgfri.

### ⚠️ Kamera kan IKKE testes i simulator
iOS-simulatoren har ingen kameramaskinvare og svarer alltid `camera_unavailable`
— det er ikke noe som kan konfigureres bort. `pickTeamImage` gir da en ærlig
melding («velg fra kamerarullen i stedet») i stedet for å sende brukeren til
Innstillinger for et problem som ikke er en tillatelse. **Alt annet er testbart**
via kamerarullen, som simulatoren har bilder i fra før.

Kamera trenger ingen egen innstilling i appen: iOS lager Innstillinger → Heia
automatisk så snart appen har spurt én gang. Varslingsraden i `ProfilScreen` er
unntaket (ingen naturlig spørreøyeblikk + token-registrering), ikke regelen.

### Test dette (etter rebuild)
1. Hjem → skriv innlegg → bildeknapp → **begge** valg skal dukke opp.
2. Start en kamp, registrer et mål, trykk «📷 Legg ut bilde» → velg fra
   kamerarullen → velg målet i lista → bildet vises **under målet** i
   kampforløpet, ikke i en egen seksjon øverst.
3. Samme, men «Generelt kampbilde» → eget 📷-innslag i forløpet på det
   minuttet det ble lagt ut.
4. Avslutt kampen → kompakt «Kampbilder»-rad øverst, trykk → galleri med
   sveiping. Bildene skal fortsatt ligge i forløpet.
5. Bildet skal også ligge i hjem-feeden som en vanlig bildepost.

**Ikke verifisert:** `tsc` er ikke kjørt (låst regel — se under), og ingenting
er sett i simulator ennå.

---

## ✅ Fase 8 — Feed → kamp-navigasjon (KODET 2026-07-30, ikke verifisert)

Ren TS/TSX. **Ingen migrasjon, ingen rebuild** — men den kom sammen med Fase 7,
så du trenger uansett rebuilden derfra.

Kampen er hovedobjektet: feeden viser høydepunktene, kampsiden samler hele
historien. Derfor åpner alt som hører til en kamp kampsiden.

- `FeedCard` — ny `onPress` (hele kortet) + `onExpandImage` (lite ⤢-ikon oppå
  bildet). `onPress` settes KUN på poster som fører et sted; en vanlig melding
  skal ikke se trykkbar ut. Heia/Kommenter/løsne/forstørr er egne `Pressable`-er
  inni kortet — den innerste tar trykket i RN, så de utløser aldri navigasjon.
- `TeamHomeScreen` — `openableMatchId(item)` avgjør målet. **NB på navnet:**
  den returnerer en `event_id`, ikke en `match_event_id`. Kodebasen har begge,
  og de er lette å blande.
- Fullskjermbilde gjenbruker `MatchPhotoGallery` med ett element.

**Navigerer:** `match_start`, `match_event`, `match_end`, `resultat`, og
`bilde` **med** `event_id` (kampbilder) → `EventDetail` med eksisterende
`eventId`. **Navigerer ikke:** vanlige meldinger, påminnelser, og bilder uten
kampkobling.

**Bevisst utsatt (bruker-beslutning 2026-07-30):** ingen rulling til eller
fremheving av en konkret kamphendelse. Derfor ingen `focusMatchEventId`,
ingen layout-register, ingen endring i `MatchTimeline`. Bygges hvis behovet
faktisk viser seg.

**~~Kjent, urørt~~ → LØST i skive 5 (00029):** `get_team_feed` returnerte
`match_event_id`, men ikke minuttet/stillingen, så kampchipen sto uten tall.
RPC-en returnerer nå `match_minute`/`match_status`/`match_home`/`match_away`.
(`FeedItem.matchEvent` er fortsatt `undefined` — `FeedItem.match` erstatter
behovet, og ingen leser `matchEvent` lenger.)

---

## ✅ Fase 9 — Push → riktig kamp (KODET 2026-07-30, ikke verifisert)

Ren TS. Ingen migrasjon, ingen rebuild, ingen ny pakke. **Kan testes UTEN
Apple Developer** — `simctl push` er allerede verifisert, og et trykk på
varselet i simulatoren utløser nøyaktig samme handlere som ekte push.

Push, hjem-feed og kampside peker nå på samme sted: `EventDetail` med `event_id`.

- `src/navigation/deepLink.ts` (ny) — `navigationRef` +  `openEvent(eventId)` +
  `flushPendingDeepLink()`. Push-lytteren bor utenfor React-treet og har ingen
  `useNavigation`; den trenger en referanse som virker fra en callback som kan
  fyre når som helst. Målet **parkeres** hvis navigatoren ikke er klar, eller
  hvis onboarding står fremme (da finnes ikke `HjemStack`).
- `AppNavigator` — `ref={navigationRef}` + `onReady={flushPendingDeepLink}`,
  og et nytt forsøk når `MainTabs` monteres (første øyeblikk et mål faktisk
  kan åpnes etter innlogging).
- `lib/push/index.ts` — `notification`-lytteren sjekker nå `userInteraction`
  (TRYKK, ikke levering) og åpner kampen. Ny `consumeInitialNotification()`
  for kaldstart, kalt fra `PushGate` når det finnes en innlogget bruker.

**Verifisert mot koden, ikke gjettet:** `sendApns` sprer `payload.data` på
TOPPNIVÅ i APNs-JSON-en (`_shared/apns.ts:125`), og biblioteket legger alle
nøkler utenom `aps` i `_data`. Derfor ligger `event_id` FLATT i `getData()` —
ikke nøstet under `data`. Hadde den vært nøstet, ville navigasjonen aldri
fyrt, helt stille. `userInteraction` settes til tallet `1` av native-siden
(`RCTConvert+Notification.m:299`).

**Ikke bygget (bruker-beslutning 2026-07-30):** ingen `match_event_id`, ingen
rulling til eller fremheving av en konkret hendelse. Kun push → riktig kamp.

### Test dette
1. `xcrun simctl push <device> <bundleId>` med en payload som har `event_id`
   på toppnivå ved siden av `aps`.
2. Trykk varselet med appen **åpen**, i **bakgrunnen**, og **helt lukket** —
   alle tre skal ende på samme EventDetail.
3. Lukket app + utlogget bruker: målet skal parkeres og åpne seg først når
   fanene er montert etter innlogging.

---

## 🐞 Rettelser 2026-07-30 (KODET, ikke verifisert)

**Kalenderen åpnet på fortiden.** `getTeamEvents` henter ALT stigende på
starttid uten tidsfilter, så «Tidligere» lå øverst og nye hendelser havnet
nederst, bak hele historikken. `KalenderScreen` har fått `orderForCalendar()`:
kommende først, fortid nederst og **snudd** (forrige lørdags kamp før den fra
september). Fortiden slettes IKKE — gamle kamper bærer nå kamprapport og
bilder. Sorteringen bruker samme midnatt-grense som `getSectionLabel`; med
`now` ville en kamp kl. 09:00 blitt sortert som fortid, men merket «I dag»,
og seksjonen ville dukket opp to steder.

**Kampvarselet gikk til feil person, og forsvant på et halvsekund.**
`SimulatedPush` var reporterens lokale ekko fra `submitAction` — den som
trykket fikk beskjed om det hun selv nettopp gjorde, mens foreldrene ikke
fikk noe. To feil, to fikser:

*1. Banneret rakk knapt å vises.* `SimulatedPush` hadde `onHide` i
dependency-lista, og `onHide` sendes inn som en pil-funksjon rett i JSX-en —
altså ny identitet hver render. Hver re-render (refetch, tikkende kampklokke)
startet animasjonen på nytt, og `.start(cb)` kaller callbacken **også når
animasjonen avbrytes** → `onHide()` → borte. Nå ligger `onHide` i en ref, og
callbacken sjekker `finished`.

*2. Banneret bor nå over fanene, ikke på kampsiden.* Ny `NotificationBanner`
rendres én gang i `MainTabs` og mates av `notifications`-kanalen som allerede
fantes i `NotificationsContext`. **Dette er et bedre feste enn kampskjermen:**
triggeren i 00023 skriver rader til alle aktive lagmedlemmer UNNTATT
forfatteren, og radene har ferdig `title`/`body`. Mottakerlisten er altså
avgjort i SQL — klienten har ingen «er dette til meg?»-logikk å ta feil av,
og teksten er den samme som ekte push vil sende.
Kanalen lytter på `'*'`, så banneret filtrerer på `eventType === 'INSERT'`
(en UPDATE er «markert som lest»).

Ryddet bort i samme slengen: `InsertedMatchEvent` og
`describeInsertedMatchEvent` i `events.ts` (fra første, dårligere forsøk),
og `SimulatedPush`-bruken i `EventDetailScreen`. `subscribeToMatch` er
tilbake til `onChange: () => void`.

---

## 🧹 Teknisk gjeld — Jest kjører ikke (oppdaget 2026-07-30)

`npx jest` **feiler før én eneste test kjører** (`Tests: 0 total`), og har
gjort det lenge — dette er ikke noe dagens arbeid innførte.

```
node_modules/@react-navigation/native/lib/module/index.js:3
export { createStaticNavigation } from "./createStaticNavigation.js";
SyntaxError: Unexpected token 'export'
```

`@react-navigation/native` distribueres som ESM, og `transformIgnorePatterns`
i Jest-oppsettet transformerer den ikke. Kjeden er
`__tests__/App.test.tsx` → `App.tsx` → `AppNavigator.tsx` → `@react-navigation`,
altså har testen vært ødelagt siden navigasjonen kom inn. Ingen merket det,
fordi suiten aldri kjøres.

Fiks: legg `@react-navigation` (og trolig flere RN-pakker) i
`transformIgnorePatterns` i Jest-konfigurasjonen. Merk at kjøringen tok
**451 sekunder** — regn med at det trengs mer enn én runde.

Egen liten skive. Ikke gjør den sammen med produktarbeid.

**Kjent støy som IKKE er et problem:** Xcode viser ~500 «Issues», men alle
kommer fra `node_modules/` og `ios/Pods/` — ingen fra `src/` eller
`ios/Heia2/`. Under target `Heia2` står det bare to, og begge er iboende i
React Native (duplikat `-lc++` fra CocoaPods, og bundle-scriptet som ikke kan
deklarere outputs). `inhibit_all_warnings!` i Podfile ville skjult
bibliotekstøyen — **bevisst IKKE gjort** (bruker, 2026-07-30). Merk også at
Xcodes issue-panel kun oppdateres når Xcode selv bygger; bygger du fra
terminalen med `npm run ios` blir lista stående gammel.

---

## 📦 Git-status (2026-07-30)

Fase 4–9 er merget til `main` (PR #16). **Designarbeidet skive 1–5 er merget
i PR #17.** Dagens ikon-skive (6) + telefonrettelsene er committet og pushet
på `Brage`, og `origin/main` er merget inn (`474e46c`), så `Brage` er igjen et
rent supersett og en ny PR er konfliktfri. Sen kveld kom i tillegg
telefonfiks-commiten (`ed5d897`) og deretter én samlet commit med
sesongflaten + turneringer/vår-høst (00030–00033) — begge pushet.

### 🔁 Squash-mønsteret — løs det på 30 sekunder, ikke for hånd
GitHub squash-merger PR-en, så `main` får ÉN commit mens `Brage` beholder sine
egne. Git ser da to historikker som rører samme linjer, og du får konflikter
selv om arbeidet er identisk. **Skjedd i #14, #15, #16 og #17.**

**Ikke løs konfliktene manuelt.** Squash-commiten er nesten alltid en kopi av
`Brage` slik den var ved et tidligere punkt. Bevis det, så forsvinner jobben:

```bash
git fetch origin
# 1) Finn commiten Brage sto på da PR-en ble laget (forrige merge-commit).
# 2) BEVISET: er main byte for byte identisk med den?
git diff --quiet <den-commiten> origin/main && echo "Brage er et supersett"
# 3) Behold Brages tre, men registrer main som forelder:
git merge -s ours origin/main
# 4) Verifiser at ingenting gikk tapt — hashen skal være uendret:
git rev-parse HEAD^{tree}
```

⚠️ **`-s ours` forkaster main-siden fullstendig.** Den er kun trygg ETTER at
steg 2 slår til. Gjør den ikke det, har noen endret noe direkte på `main`, og
da må det faktisk inspiseres.

Er filtrehashen lik før og etter, er treet **bevist uendret** — da trengs
ingen tsc/lint-runde på merge-en (se tsc-regelen øverst).

## 🎨 DESIGN — «A v2 · Stadium Pop Hybrid» (LÅST 2026-07-30)

Prosess: 3 HTML-konsepter (artifact) → bruker valgte A → A v2-iterasjon →
**låst**. Artifacts (designintensjon, IKKE piksel-spesifikasjon):
- Konsepter A/B/C: https://claude.ai/code/artifact/51dd852d-7ac7-4b98-b756-f97797538505
- A v2 (den låste): https://claude.ai/code/artifact/cefe92dd-a148-4202-a9b9-71bf8cd28431

**Låste identitetsgrep:** varm mintkrem-hverdag (#F6F8F0); #02FFAB = Heia/
handling/energi; **kampen bor ALLTID på mørk stadionflate** (fra fullt
scoreboard ned til liten score-chip — dette er signaturen); banesirkelmotiv
subtilt, maks ett sted per skjerm; coral = KUN live-status; grønt/gult = mål/
feiring (aldri coral på mål); lagfarge kontrollert (ring/stripe/«oss»-side);
store tabulære 800-tall. Regler: aldri mint tekst på lyst; gradient-disiplin;
ingen «TAP»-roping (SEIER-pill finnes, tap-pill finnes ikke); glød KUN på
live-score, hovedhandling og enkelte Heia-øyeblikk.

### ✅ Skive 1 — hjem (KODET 2026-07-30, IKKE optisk verifisert)
Ren TS/TSX — **kun Metro-reload.** ESLint: 0 nye feil.
- `theme/tokens.ts` — v2-palett (alle gamle tokennavn beholdt + nye:
  heiaDeep/heiaTint/sun/stadium/live/info/remind/gold …), typografi
  (heading1 30/800, scoreLarge/scoreSmall/displayTime m/ tabular-nums),
  grønntonede restriktive skygger + `shadows.glow` (rasjonert).
- Nye: `StatusPill` (semantiske pills, m/ onPress+suffix for «Viktig ✕»),
  `ScoreChip` (mørk kamp-chip), `NextEventHero` (vanlig hero; hele kortet
  åpner EventDetail — bevisst ingen inline-RSVP).
- Endret: `Button` (radius 16, primær = mintfyll + heiaDeep-tekst + glød kun
  aktiv), `Card`, `SectionHeader` (mint-strek + caps), `LiveBadge` (solid
  coral/gul), `TeamHeader` (lagmerke m/ ring + stripe, bg=background),
  `LiveMatchBanner` (stadion-hero: mørk flate, flomlys/banesirkel som
  View-sirkler, glødende mint-score m/ textShadow, minutt fra startedAt),
  `FeedCard` (rail FJERNET; sun-flate for pinned, ScoreChip på kamp-poster,
  reaksjons-pills), `TeamHomeScreen` (hero-prioritet live>neste hendelse via
  `pickNextEvent` på eksisterende `getTeamEvents`; composer m/ avatar+felt+
  kamerachip; Publiser/varsle-rad vises først når noe skal publiseres),
  `AppNavigator` (aktiv fane = mint-pille + mørk tekst — fikser kontrastfeil
  der aktiv farge var #02FFAB på hvitt; +-knapp squircle m/ glød; badge i
  coral).
- **~~Kjente hull~~ — begge lukket senere samme dag:** feed-kampchipen uten
  stilling ble løst i skive 5 (`00029`); tekstglyf-ikonene i skive 4.

### ✅ Optisk review gjennomført 2026-07-30 (alle 4 tilstander sett)
Bruker viste skjermbilder; funn og fikser samme dag:
- **Tab-bar-glyfene ble klippet til strimler** — ikon-slotten i bottom-tabs
  er ~30 px bred; pillens `paddingHorizontal` spiste hele bredden. Fiks:
  `tabBarIconStyle` (64×32) + fast pillebredde (56×30). Verifisert OK.
- **Flomlys-/kremsirklene var for harde** (synlige skivekanter — Views har
  ingen blur). Gjort større + svakere; ekte radial-glød kommer med
  gradient-modulen i rebuilden.
- **Ferdigspilt kamp sto som «neste hendelse»** når avsparket lå frem i tid
  (test-case: kamp spilt før planlagt start). `pickNextEvent` hopper nå over
  `finished` i tillegg til `cancelled`.
- **Slutt-poster i feeden** fikk chip «Slutt» (dempet) i stedet for «KAMP»
  (coral). Coral = kun pågående.
Stadion-hero, sun-kort, bildepost, composer og seksjonsheadere satt som
tegnet. Brukeren åpnet ny samtale med «fortsett» → tolket som OK, skive 2
startet.

### ✅ Skive 2 — kalender, varsler og kampdetalj (KODET + optisk OK 2026-07-30)
Ren TS/TSX — **kun Metro-reload.** `npx eslint src`: **0 errors**, 4 warnings
(alle fra før). tsc ikke kjørt (låst regel — sjekk i editoren).

- **`ScoreBoard` skrevet om til stadionflate** — det låste signaturgrepet
  («kampen bor ALLTID på mørk flate») gjaldt fra fullt scoreboard og ned, men
  ScoreBoard var fortsatt et hvitt kort. Nå: samme motiv som `LiveMatchBanner`
  (flomlys-/banesirkel-Views, lagmerke med ring + «oss»-stripe i lagfarge,
  48 pt tabulær mint-score). **Glød KUN når kampen pågår** (live/pause);
  ferdig = rolig flate med «Slutt»-pill + **SEIER-pill ved seier** (home >
  away — home/away er alltid oss/dem, se Fase 3A). Ingen tap-pill (låst
  regel). Props uendret; henter lagfarge selv via `useActiveTeam`, akkurat
  som `LiveMatchBanner`.
- **`EventCard`:** `Chip` → `StatusPill` (samme type→pill-språk som
  `NextEventHero`); resultatfeltet er nå en **mørk stadionstripe** (coral
  label kun live, gul i pause, dempet «Sluttresultat» + SEIER-pill);
  `featured` (live) = tynn coral kant i stedet for mint-rail (coral eier
  live-status); kortflate på Card-språket (radius.xl + borderSubtle);
  datotall 800 tabulær.
- **`KalenderScreen`:** seksjonsetikettene fikk mint-streken (samme uttrykk
  som `SectionHeader`, men beholdt plassen til `LiveBadge` ved «I dag»);
  tomkort på Card-språket.
- **`RSVPBar`:** mint fylling på mørkgrønn-tonet track — samme språk som
  oppmøtestripa i `NextEventHero`. «Kan ikke» roper ikke lenger i rødt
  (fravær er informasjon, ikke en feil); «kan ikke»-segmentet er dempet grått.
- **`ReporterActions`:** «Mål oss» = mintfyll + heiaDeep-tekst + **glød**
  (reporterens hovedhandling — ett av de rasjonerte glød-stedene; mål feires
  i grønt, aldri coral). «Mål dem» = nøytral hvit flate. Radius-harmonisert.
- **`ReporterBar`:** «Velg» følger knapperegelen (heiaDeep på mint — var
  svart-på-mint); borderSubtle + radius.lg.
- **`MatchEventRow` + `MatchTimeline`:** mål/avspark/fortsettelse på
  heiaTint-sirkler (grønt = feiring), kort på sun, resten dempet — myke
  flater bak emoji i stedet for solide sirkler. Minutter 800 tabulær.
- **`NotificationRow`:** semantisk ikonflate per kategori (match_live=
  liveSoft, new_comment=infoSoft, event_reminder=remindSoft (lilla =
  påminnelse), admin_message=sun, new_reaction=heiaTint, ellers dempet);
  ulest tittel 700.
- **`InboxScreen`:** liste + tomkort på Card-språket.
- **`EventDetailScreen`:** `Chip` → `StatusPill` i infokortet — eneste
  endring; all logikk urørt.
- **`Chip.tsx` SLETTET** (+ ut av `components/index.ts`) — ingen brukere
  igjen etter EventCard/EventDetail.

### Test dette (Metro-reload — optisk review, samme øvelse som skive 1)
1. **Kalender:** pill per type på kortene; mint-strek på seksjonsetikettene.
   Live kamp = coral kant + mørk stripe «PÅGÅR NÅ» med mint-score; pause =
   gul label; ferdig = «SLUTTRESULTAT» + grønn «Seier»-pill når vi vant —
   og INGEN pill når vi tapte.
2. **Kampdetalj live:** mørkt scoreboard med lagmerker, glødende mint-score
   og minutt-pill; som reporter er «Mål oss» mint med glød, «Mål dem» hvit.
3. **Kampdetalj pause:** gul «PAUSE»-badge, stillestående, «Pause — kampen
   fortsetter» under.
4. **Ferdig kamp:** samme mørke flate uten glød, «Slutt»- (+ evt. «Seier»-)
   pill; kampforløpet har mint-sirkler på mål.
5. **Varsler:** fargede ikonsirkler per kategori (coral kamp, blå kommentar,
   lilla påminnelse, gul trenerbeskjed, mint 👏); ulest = grønn flate + prikk
   som før.
6. **Oppmøtestripa** (kalenderkort + hendelse): mint fylling, ingen rød.

### ✅ Skive 3 — resten av flatene (KODET + optisk OK 2026-07-30)
Ren TS/TSX — **kun Metro-reload.** `npx eslint src`: 0 errors, 4 warnings
(samme fire som før). Nå snakker HELE appen A v2 — ingen skjerm står igjen
på det gamle uttrykket.

**Regelbrudd som ble funnet og lukket (mint-tekst/svart-på-mint):**
- `SimulatedPush` (varselbanneret): mint appLabel på hvitt + mint venstre-rail
  → mint-strek + heiaInk, kortflate med borderSubtle (railene er døde i A v2).
- `ReporterSheet`: ✓-haken var `colors.heia` på hvitt → heiaInk.
- `CreateTeamScreen`: «+ Opprett klubb» var heiaPressed på hvitt → heiaInk.
- `SupportScreen`: ✓-fordeler i mint på lyst → heiaInk; «80% til laget» og
  «Spar 33%» hadde svart tekst på mintfyll → heiaDeep.
- `InviteCodeCard`/`ReporterBar`/`AuthScreen`-tab/`WelcomeIntent`: svart tekst
  på mintfylte knapper → heiaDeep (+ glød på Del-knappen og velkomst-CTA-en).
- Verifisert med grep: alle gjenværende `color: colors.heia` er på mørk
  stadionflate (ScoreChip/ScoreBoard/EventCard-stripe/LiveMatchBanner) — riktig.

**Øvrig samkjøring:**
- **`WelcomeIntentScreen` bor nå på stadionflaten** (`colors.stadium`, var
  `textPrimary`-svart) — appens første møte bærer kamp-signaturen.
- **`CreateSheet`:** semantiske ikonsirkler (mint «Del med laget», blå «Ny
  hendelse») — samme språk som varselradene.
- **`ProfilScreen`:** lagvelgeren følger «valgt skifter FLATE»-regelen
  (heiaSoft + mint-ramme, var kun ramme); menyen er et avrundet kort med
  marger (var kant-til-kant); «Dine lag» har mint-strek.
- **`TeamMembersScreen`:** mint-strek på seksjonene, kort på Card-språket.
- **`NewEventScreen`:** feltetiketter i A v2-caps, klokkeslett 20 pt tabulær
  800, valgt chip-tekst 700.
- **`JoinTeamCodeScreen`:** kodefeltet 800 m/ letterSpacing 4, kort/rollekort
  på Card-språket, «Din rolle»-etikett i A v2-caps.
- **`AuthScreen`:** feltetiketter i A v2-caps.
- **`CommentsScreen`/`ListRow`/`ReporterModal`/`MatchPhotoSheet`:** radius-
  og borderSubtle-samkjøring, navn/titler 600–700.
- InviteScreen trengte ingenting (arver fra `InviteCodeCard`).

**Tillegg (bruker-funn under review av skive 3): kommentartråden**
1. **Kommentarbobler.** Kommentarene fløt rett på kremflaten uten avgrensning.
   Nå: hvit boble per kommentar (chat-hjørne oppe til venstre mot avataren),
   navn/tid inne i boblen.
2. **👏 Heia på innlegget inne i tråden.** Man sto PÅ innlegget uten å kunne
   se eller gi applaus — brudd på innholdsløkka. `getFeedPost` (comments.ts)
   hydrerer nå `heiaCount` + `iReacted` (én ekstra reactions-select + lokal
   session i samme `Promise.all`), og `CommentsScreen` har samme reaksjons-
   pill som `FeedCard` med optimistisk toggle + rollback og busy-ref mot
   dobbelttrykk (`toggleReaction` er retningsstyrt — to raske trykk ville
   ellers gitt dobbel insert).

### Test dette (Metro-reload — optisk review av skive 3)
1. Logg ut → velkomstskjermen er mørk stadion med mint CTA (grønn tekst på
   mint, ikke svart). Auth: aktiv fane har mørkegrønn tekst på mint.
2. `+` → valgarket har fargede ikonsirkler.
3. Profil → aktivt lag har mint flate + ramme; menyen er et avrundet kort.
4. Lagoversikt → mint-strek på «Trenere og lagledere» osv.
5. Ny hendelse → CAPS-etiketter, stort tabulært klokkeslett.
6. Under kamp: la et varsel komme → banneret har mint-strek + «HEIA» i
   mørkegrønt, ingen mint-rail.
7. Støtt laget → «80% til laget» i mørkegrønn på mint, hakene i mørkegrønt.
8. Kommentartråd → kommentarene ligger i hvite bobler; innlegget øverst har
   👏-pill med teller. Trykk → teller opp og pillen blir mint; trykk igjen →
   av. Heia i tråden skal også synes i feeden etterpå (samme data).

### ✅ Skive 4 — den samlede «native rebuilden» (KODET 2026-07-30, IKKE optisk verifisert)

Viste seg å være mye mindre native enn fryktet: **react-native-svg 15.15.3 lå
allerede i Podfile.lock** (bygget inn fra før). Dermed:
- **lucide-react-native ^1.28.0** er ren JS oppå svg → kun `npm install`,
  ingen pod install.
- **react-native-linear-gradient er BEVISST IKKE installert.** Artifactens
  flomlys er *radiale* gløder, og linear-gradient kan ikke radial — svg kan.
  Alle gradienter tegnes med react-native-svg. Ikke installer linear-gradient
  senere «for ordens skyld».
- **Eneste native endring: bundlede fonter** (Nunito-Bold/-ExtraBold i
  `assets/fonts/`, linket med `npx react-native-asset` → `UIAppFonts` i
  Info.plist + Resources i pbxproj + android/assets). Krevde bare en vanlig
  `npm run ios`-rebuild — **ingen pod install, ingen 20–60 min**.

**Font (A v2 «tall med autoritet»):**
- Artifacten bruker `ui-rounded` (SF Rounded) — finnes ikke i RN, og Apple-
  lisensen gjør bundling av SF utrygt. **Nunito ExtraBold** (OFL) er
  erstatteren. KUN store tall (score, minutter, klokkeslett, datotall, pris) —
  aldri brødtekst/titler/CAPS-etiketter.
- `fonts.display`/`fonts.displayBold` i `theme/tokens.ts`. Strengen
  «Nunito-ExtraBold» er både PostScript-navnet (iOS) og filnavnet (Android).
- **Sett ALDRI fontWeight sammen med displayfonten** — fila ER vekten; en
  fontWeight får iOS til å lete etter vekter familien ikke har.
- **Sifrene i Nunito er like brede** (verifisert i hmtx-tabellen), så
  `tabular-nums` trengs ikke — klokka tikker uten hopp.
- ⚠️ **TTF-ene fra google-webfonts-helper hadde ØDELAGTE navnetabeller**
  («NunitoExtraLight-Bold»). Fikset med fontTools (name-tabell + usWeightClass
  + fsSelection omskrevet) før kopiering til `assets/fonts/`. Gjenta prosessen
  hvis flere vekter skal inn — ikke bruk zip-filene rått.

**Gradienter — ny delt komponent `StadiumSurface.tsx`:**
- base linear 165° `#0B1912→#143126` + radial amber-flomlys (18%, −20%) +
  radial mint-glød (85%, −10%), pluss banesirkel-ringene. Props: `flood`,
  `arc`, `bordered` (av for chips/striper).
- Brukes av: `LiveMatchBanner`, `ScoreBoard` (erstattet de identiske
  sirkel-View-blokkene), `ScoreChip`, `EventCard`-resultatstripa,
  `WelcomeIntentScreen` (fullskjerm, radius 0).
- `NextEventHero` fikk sin egen mint→krem-linear (140°, `#DFFBEA→#F4F9E6→
  #FAF4DC`) inline — den er hverdag, ikke stadion.
- Gradient-id-er i svg er trygt gjenbrukbare per `<Svg>`-rot (egen scope).

**Ikoner — `src/components/icons.tsx` (eneste lucide-importsted):**
- Re-eksporterer Lucide (stroke 2) + egen **`Ball`** (fotball finnes ikke i
  Lucide — tegnet fra artifactens path med react-native-svg).
- Byttet: tab bar (House/Calendar/Plus/Bell/User — pillen og squirclen
  består), composer-kamerachip, CreateSheet-sirklene, FeedCards kommentar-
  pill + forstørr-knapp (Maximize2), NotificationRow-kategoriene (Ball/
  MessageCircle/Calendar/Megaphone/Check/Info, blekket i flatens ink-farge),
  ReporterActions (alle seks + kamera), MatchEventRow/MatchTimeline-sirklene,
  hakene i ReporterSheet/MatchPhotoSheet/SupportScreen/TeamHome-avkrysningen
  (Check), lukkekrysset i MatchPhotoGallery (X), chevron+MapPin i
  NextEventHero, MapPin+Clock på EventCard-meta.
- **👏 består som emoji overalt** — det er merkevare-gesten, Lucide har ingen
  applaus. `bytte`/`kort` i kampforløpet beholder tegn-glyfene (lages ikke av
  appen ennå). JoinTeamCode-kodefeltet beholder systemfont (kode er ikke et
  display-tall). StatusPill-suffikset «✕» består som tegn (piksel-lite).

`npx eslint src`: **0 errors, 4 warnings (samme fire som før).** tsc ikke
kjørt (låst regel — sjekk i editoren).

### Test dette (optisk review av skive 4 — KREVER rebuilden fra i dag)
Rebuild + fontlinking ble gjort i samtalen 2026-07-30 (npm install +
`npx react-native-asset` + `npm run ios`). Ser talltypografien tynn/vanlig ut
er det den GAMLE binæren som kjører — bygg på nytt før du bedømmer noe.
1. **Tab bar:** strek-ikoner (hus/kalender/bjelle/person), aktiv fane = mint
   pille med mørkegrønt ikon, «+» = mint squircle med mørkegrønt pluss + glød.
2. **Hjem:** hero har ekte mint→krem-gradient med kremdrag nede til høyre;
   composer-kameraet er strek-ikon på mintchip; kommentar-pillen har boble-
   ikon; 👏-pillen er uendret.
3. **Live kamp (hero + scoreboard):** flomlysene er nå myke radiale gløder
   (amber oppe-venstre, mint oppe-høyre) — INGEN synlige sirkelkanter; scoren
   er rund og tung (Nunito). Minutt-pillen likeså.
4. **Kalender:** datotallene på kortene er runde 800; resultatstripa på
   kampkort har gradient.
5. **Varsler:** kategorisirkler med strek-ikoner — fotball (coral), boble
   (blå), kalender (lilla), megafon (gul), 👏 (mint).
6. **Kampforløp:** mål = fotball på mintsirkel, foto = kamera, minuttene runde.
7. **Reporter:** «Mål oss» = fotball-ikon i mørkegrønt på mint m/ glød;
   Pause/Fortsett/Slutt/Kommentar/kamera = strek-ikoner.
8. **Ny hendelse:** klokkeslettet i rund 800.
9. **Logg ut:** velkomstskjermen er gradient-stadion i fullskjerm med
   banesirkel nede til høyre.
10. **Støtt laget:** prisene runde, fordels-hakene er strek-ikoner.

### ✅ Skive 5 — KAMPRAPPORTEN (KODET 2026-07-30, ikke optisk verifisert)

Bruker: «dette er det viktigste i hele appen». Tre grep, én migrasjon.

#### 1. Migrasjon `00029_feed_match_context.sql` (✅ deployet)
`get_team_feed` returnerte `match_event_id`, men aldri minuttet eller
stillingen — derfor sto kampchipen i feeden tom for tall siden Fase 8.
RPC-en joiner nå `match_events` (minutt for posten) og `match_sessions`
(status + stilling for kampen) og returnerer fire nye kolonner:
`match_minute`, `match_status`, `match_home`, `match_away`.
- `match_sessions.event_id` er **UNIQUE** (00009), så joinen er 1:1 — ingen
  radmultiplisering. LEFT JOIN, så poster uten kamp er upåvirket.
- Returtypen endret seg → **DROP + CREATE** (samme mønster som 00027).
  Originalen i 00015 hadde ingen eksplisitte GRANTs, så ingen å gjenskape.

#### 2. Kampchipen i feeden er statusdrevet, ikke posttype-drevet
`FeedItem.match {minute, status, home, away}` + mapping i `feed.ts`
(`MATCH_STATUS_MAP` er nå eksportert fra `events.ts` — én sannhet for
norsk DB-status → appens union). `FeedCard.Marker`:

| Post | Chip |
|---|---|
| `match_end` | «Slutt 4–5» |
| `match_event` (mål/pause/…) | «12′», coral **kun mens kampen faktisk pågår** |
| `match_start` mens live/pause | «Live 2–1» / «Pause 2–1» — lagets levende resultatkort |
| `match_start` etterpå | «Kamp» **uten** stilling |

To bevisste valg: (a) en gammel målpost skal ikke rope coral «live» for
alltid — derfor styrer `match.status`, ikke posttypen. (b) avsparkposten får
IKKE sluttresultatet, fordi teksten sier «Kampen er i gang» og tallet ville
motsagt sin egen post.

#### 3. Kampforløpet har løpende stilling
`MatchTimeline` teller mål-radene i serverens rekkefølge (`ORDER BY
sequence`) og stempler hver målrad med stillingen ETTER øyeblikket; slutt-
raden får sluttresultatet. `MatchEventRow` viser den som en mørk `ScoreChip`
skjøvet til høyremargen — tallkolonnen leses vertikalt nedover forløpet.
- Regnes **klientside**, ikke i DB: `match_events` lagrer ikke stillingen per
  hendelse, og å legge den til ville krevd backfill av gamle kamper.
- Mål uten `teamSide` teller ikke (skal ikke skje etter 00020) — bedre å
  mangle et tall enn å vise feil stilling.
- `ScoreChip.label` er nå **valgfri** (ren stilling-chip uten etikett).

#### 4. En spilt kamp åpner med resultatet
`EventDetailScreen` åpnet med et administrativt infokort (Dato/Tid/Sted), og
scoreboardet lå under. På en spilt kamp ER resultatet historien. Ny
`showReport`-gren: **ScoreBoard først**, så tittel, så «hvor og når» som én
dempet linje (`Torsdag 30. juli · 18:00 · Kunstgresset`), så bilder, så
forløp. Infokortet består uendret for trening/sosialt/kommende kamp.
Oppmøtelisten på en spilt kamp: «Ikke svart» og «Kan ikke» skjules (ren støy
i etterkant), og «Kommer» heter **«Påmeldt»** — fortid, ikke fremtid.
**NB på ærligheten:** listen sier hvem som meldte seg på, ikke hvem som
faktisk møtte. Ikke omdøp den til «Var med» uten ekte oppmøteregistrering.

`npx eslint src`: **0 errors, 4 warnings** (samme fire). tsc ikke kjørt.

### Test dette (Metro-reload — migrasjonen er alt ute)
1. **Feed etter en spilt kamp:** «🏁 Slutt!»-posten har chip **«Slutt 4–5»**;
   målpostene har minutt-chip i dempet grå (ikke coral); avsparkposten har
   «Kamp» uten tall.
2. **Under en live kamp:** avsparkposten viser «Live 2–1» og oppdaterer seg
   via realtime; målpostene har coral minutt.
3. **Åpne en ferdig kamp:** scoreboardet møter deg **først**, tittel og
   «dato · tid · sted» under, deretter Kampbilder og Kampforløp.
4. **Kampforløpet:** hver målrad har en mørk stilling-chip til høyre
   (1–0, 1–1, 2–1 …) og slutt-raden sluttresultatet. Pause/kommentar-rader
   har ingen chip.
5. **Oppmøte på spilt kamp:** kun «Påmeldt (N)», ingen «Ikke svart».
6. **Trening/kommende kamp:** uendret — infokort med Dato/Tid/Sted øverst.

### ✅ Skive 6 — APP-IKON + LAUNCH SCREEN (FERDIG — bruker: «perfekt gjennomført», 2026-07-30)

**⚠️ KREVER REBUILD.** Ikoner og storyboard bakes inn i binæren — Metro-reload
viser ingenting. Ingen ny pakke, ingen pod install, ingen pbxproj-endring
(`Images.xcassets` er en `folder.assetcatalog`-referanse, så nye imagesets
trengs ikke registreres).

**Produksjonsspesifikasjon (siden er oppdatert fra valg til fasit):**
https://claude.ai/code/artifact/143f2aaf-c2b4-48cd-b86c-0ecb01ef7cf5

#### 🔒 LÅST BESLUTNING (bruker, 2026-07-30): variant **C — figur med glød**
Begrunnelse fra bruker: virker best i liten størrelse, tydeligst egenart,
matcher stadionmodus og mint-energien. **Ordmerket skal IKKE brukes som
app-ikon** — variant D er derfor fjernet fra scriptet, ikke bare fravalgt.
Brukerens tre justeringer er innarbeidet: helt solid flate, større figur,
dempet glød.

#### Merkevarekilden — figurmerket, ikke ordmerket
`Heia logoer/` har fem varianter av **samme lockup** («Heia» + jubelfigur) i
ulike fargeversjoner. Det finnes **ikke** noe isolert figurmerke. Figuren er
trukket ut på farge (den er mint `#02FFAB`, ordmerket hvitt/mørkt) fra
`Logo_1.pdf` rasterisert i 3000 px med `sips`, og ligger nå som
**`assets/brand/heia-figur.png`** (680×1025, transparent).

**Hvorfor figuren og ikke «Heia»:** ikonet leses i 60 pt på hjemmeskjermen,
ikke i 1024 px. Ordmerket blir uleselig grøt der. Kandidat D på siden viser
det — den er med nettopp så valget kan tas på syn, ikke på påstand.

**Gledelig funn:** minten i logofilene er nøyaktig `#02FFAB` — samme verdi som
A v2 låste. Merkevaren og designsystemet var allerede samstemte.

#### To ekte feil i det gamle ikonet (ikke smak)
1. **`Icon-1024.png` hadde alfakanal.** App Store Connect **avviser**
   markedsføringsikoner med gjennomsiktighet — dette ville stoppet en
   innsending uansett design. Alt genereres nå som RGB.
2. **Koksgrå flate.** Ikonet var den eneste flaten i hele appen som ikke
   fulgte «kampen bor alltid på mørk stadionflate».

#### `scripts/build-app-icon.py` (ny) — ikonet er DERIVERT, ikke tegnet
```
python3 scripts/build-app-icon.py                # C, standard
python3 scripts/build-app-icon.py --variant A|B  # de to andre som ble vurdert
python3 scripts/build-app-icon.py --android      # tar med mipmap-ene
python3 scripts/build-app-icon.py --preview /tmp/x.png
```
Stadionflaten er **portert 1:1 fra `StadiumSurface.tsx`** (linear 165°
`#0B1912→#143126` stop .78, radial amber cx 18 %, radial mint cx 85 %,
banesirkelringene). Endrer `theme/tokens.ts` seg, kan ikonet følge etter uten
at noen åpner Photoshop.

**Hver ikonstørrelse tegnes for seg** (`build_icon(variant, px)`), ikke skalert
ned fra én 1024-master — gløden må ha egne tall per størrelse
(`_glow_profile`). Intern oppløsning holdes alltid over ~1024 px, så hårfine
detaljer ikke forsvinner i supersamplingen på et 40 px-ikon. Merkehøyden er
`MARK_HEIGHT_FRAC = 0.68`.

Byggingen **kaster** hvis flaten ikke er 100 % dekkende, i stedet for å kaste
alfakanalen i stillhet. App Store-kravet er dermed håndhevet i koden.

#### ⚠️ FIRE alfa-feller i PIL — alle kostet en runde
Disse gjelder all bildegenerering i Python, ikke bare dette ikonet:

1. **`ImageDraw.ellipse(outline=MINT+(33,), width=17)`** tegner hvert av de 17
   pikslene i strekbredden som sitt eget alfa-kompositt. 0.13 lagt oppå seg
   selv 17 ganger ≈ 0.90 — den «subtile» banesirkelen lyste som en neonring.
   Tegn strøket **solid på et eget lag** og komposit ÉN gang med riktig alfa.
2. **`GaussianBlur` på et RGBA-lag blurrer også FARGEN.** Utenfor figuren er
   fargen gjennomsiktig svart, så gløden falmet mot svart og **dempet flaten
   sin egen glød** i stedet for å løfte den — den døde innen 15 px uansett hvor
   høyt tall man skrev. Blur **kun alfakanalen** (`Image.new("L", …)`), og la
   fargen stå solid.
3. **Gjentatt kompositt av samme lag ganger ikke opp lineært.** `0.3` tre
   ganger blir ≈ `0.66`. Da er tallet i koden ikke tallet på skjermen, og
   uttrykket blir umulig å styre.
4. **Et bredt blur sprer alfaen tynt, så toppverdien synker med spredningen.**
   Uten normalisering betyr `strength` noe helt ulikt for et stramt og et bredt
   lag. Normaliser etter blur — da ER `strength` den faktiske toppdekningen.

**Glødet er derfor to lag med ulik spredning:** en stram bloom tett på figuren
(`bloom`) og en bred, svak ambient rundt (`ambient`). Det er *kontrasten*
mellom spredningene som gjør at lyset føles fysisk. Ett jevnt blur-lag er
nettopp det som leser som gaming.

**Målt fasit (1024 px):** grønnkanalen løftes ~30 nivåer rett ved figurkanten,
~18 ved 15 px, ~8 ved 40 px, borte ved 150 px. Vil du justere, endre
`_glow_profile` og mål på nytt — ikke gjett på tallene.

#### Launch screen — stadionflaten, ingen tekst
Malen fra React Native sto urørt: hvit flate, «Heia2» i systemfont, «Powered
by React Native». Nå: stadiongradienten i fullskjerm med figurmerket sentrert
og banesirkelen nede til høyre — **samme flate som `WelcomeIntentScreen` fikk
i skive 3**, så oppstarten og appens første skjerm er ett og samme bilde.

- **Storyboards kan ikke tegne gradient.** Flaten ligger derfor som et bilde
  (`LaunchBackground.imageset`, 1170×2532) og strekkes med `scaleAspectFill`.
  Trygt fordi den er en glatt overgang uten detaljer som kan forvrenges.
  Bakgrunnen er festet til view-kantene, **ikke** safe area.
- `LaunchMark.imageset` i @1x/@2x/@3x, der **@1x ER punktstørrelsen**
  (132×199 pt) — så merket trenger ingen størrelseconstraint, bare sentrering.
- **Ingen tekst med vilje.** iOS viser allerede «Heia» under ikonet man
  trykket på; en splash med logo + navn er en webkonvensjon, ikke en iOS-en.
- `colors.stadium` er satt som view-bakgrunn også, synlig et blunk før bildet
  dekodes.

#### Verifisert uten å bygge appen
Storyboarden er håndskrevet XML, så den er sjekket med Apples egne verktøy:
- `xcrun ibtool --compile` → **0 feil, 0 advarsler, 0 notices.**
- `xcrun actool --compile` på hele `Images.xcassets` → **`Assets.car` bygget
  rent**, alle tre imagesets validerte.
- Alle 8 ikon-PNG-er bekreftet `RGB` (ingen alfa).

Dette er billig og fanger nettopp det en håndskrevet storyboard pleier å ryke
på. **Gjenta det hvis storyboarden røres igjen** — alternativet er å oppdage
feilen i en 10-minutters Xcode-build.

#### Test dette (etter rebuild)
1. **Hjemmeskjermen:** mint jubelfigur på mørk grønn flate. Skal være tydelig
   gjenkjennelig ved siden av andre apper — ikke en grå rute med småtekst.
2. **Oppstart:** mørk stadionflate med merket sentrert. Ingen hvit flash,
   ingen «Powered by React Native».
3. **Innstillinger → Heia:** ikonet i 29 pt skal fortsatt leses.
4. **Varsler:** ikonet i 20 pt — figuren skal fortsatt kjennes igjen som en
   person, ikke bli en grønn flekk. (Kontrollert i generert kontaktark ned til
   40 px; den tynne hevede armen er det som ryker først.)

#### 🐞 To funn fra første ekte telefontest (rettet 2026-07-30)
Begge oppdaget av bruker på skjermbilder fra iPhone — ikke av simulatoren.

1. **Grå boks midt på velkomstskjermen.** `WelcomeIntentScreen` brukte
   `logo-dark.png`, som har **koksgrå bakgrunn bakt inn i rasteret**. På
   stadionflaten ble det en hard grå firkant. `logo-icon.png` er
   gjennomsiktig, men har så mye tom luft rundt merket at `resizeMode="contain"`
   krympet det til en tredjedel av boksen. Løsning: ny **`logo-wordmark.png`**
   (+@2x/@3x) — lockupen beskåret til sitt eget sideforhold (1983×1025 ≈
   1.935), generert fra `Logo_3.pdf`. Stilen bruker nå ekte proporsjoner
   (260×134) i stedet for en kvadratisk boks.
   ⚠️ **`logo-dark.png` skal aldri brukes på en mørk flate** — den er laget
   for lyse flater og bærer sin egen bakgrunn. Den er nå ubrukt.
2. **Håndtegnet tilbake-knapp på Auth.** `AuthScreen` tegnet sin egen
   «‹ Tilbake» — siste brudd på regelen fra 2026-07-09 («nye skjermer skal
   bruke stack-headeren, ikke egne tilbake-knapper»). Auth er nå registrert
   med `authOptions` (`headerShown: true`, **tom tittel**): skjermen bytter
   selv mellom «Velkommen tilbake» og «Opprett konto» som overskrift, så en
   fast headertittel ville duplisert eller motsagt den. `navigation` er ute av
   propsene, og `header`/`backButton`/`backText`-stilene er slettet.

`npx eslint src`: **0 errors, 4 warnings** (samme fire som før).

**Ikke gjort (bevisst):**
- **Android-mipmapene** står på RN-malen. Ett flagg unna (`--android`), men
  Android bygges ikke i dag, så diffen holdes ærlig.
- **iOS 18 mørk/tonet ikonvariant.** Krever det nyere single-size
  `Contents.json`-formatet; dagens eksplisitte størrelsesformat bygger
  uendret. Egen liten skive hvis det blir aktuelt.

---

## ✅ SESONGFLATEN — produktkandidat 5 (KODET 2026-07-30 sen kveld, delvis sett på telefon)

«Hittil i sesongen: 9 kamper, 35 mål» — den første flaten som viser at appen
samler opp noe over tid. Én lese-RPC + én skjerm, som planlagt.
**Kun Metro-reload** — migrasjonene er deployet, ingen native endring.

**Bruker så flaten på telefon samme kveld:** hero-en (KPI-rad + dempet
uavgjort/tap-linje) og inngangen sto riktig. Funnet som ble rettet med én
gang: toppscorerlisten viste fritekst fra mål-dialogen («1-0, latterlig bra
mål», «Fuuuuuukkk») — feltet var aldri et navnefelt. Det utløste beslutningen
under.

#### 🔒 LÅST BESLUTNING (bruker, 2026-07-30): INGEN toppscorer/spillerstatistikk
**Ingen spillerstatistikk før laget har en strukturert spillerstall, og
målscorere skal ikke registreres som fritekst.** Toppscorerlisten er fjernet
fra RPC, API og skjerm (`00031`). I tillegg til datakvaliteten: en rangering
av barna i foreldrenes app er verdimessig feil for ungdomsidrett — samme etos
som «ingen TAP-roping». Scorernavn-idéen kan gjenoppstå den dagen en
spillerstall finnes — ikke foreslå fritekst-varianten igjen.

#### Migrasjoner `00030` + `00031` + `00032` (✅ alle deployet)
`get_season_stats(space_id, p_year, p_half)` → jsonb med totaler
(`played/wins/draws/losses/goals_for/goals_against`), `matches[]` (nyeste
først, med `tournament`-navn), `seasons[]` (velgerlisten) og
`season_year/half/label`. Historikk: 00030 første versjon (med toppscorere),
00031 fjernet toppscorerne, 00032 innførte vår/høst + turneringer (se egen
seksjon under). Valg som er verdt å kjenne:
- **Kun kamper med status `ferdig` teller.** En live kamp flytter ikke
  tallene før «Slutt».
- **Sesong = halvår: vår (jan–jun) / høst (jul–des)** — bruker-beslutning
  2026-07-30, se turneringsseksjonen. Grensen leses i servertid/UTC.
- `COALESCE(is_team_member(...), false)`-vakt (NULL-fellen fra 00020).

#### App
- **`src/lib/api/stats.ts` (ny):** `getSeasonStats(teamSpaceId)` + typene
  `SeasonStats`/`SeasonMatch`. Eksportert fra `lib/api`.
- **`src/screens/SeasonScreen.tsx` (ny):** formen er bevisst IKKE et diagram —
  en KPI-rad med store tall og én liste:
  - **Stadion-hero:** Kamper / Seiere / Mål i Nunito-mint på `StadiumSurface`
    (kampdata bor på mørk flate — låst signatur), med dempet linje
    «2 uavgjort · 2 tap · 12–9 i målforskjell» under. Uavgjort/tap er
    informasjon, ikke en feil — ingen «TAP»-roping (låst regel).
  - **Kampene:** ferdigspilte kamper, nyeste først — «mot Lyn · 12. juli ·
    Hjemme» + Seier-pill (kun ved seier) + mørk `ScoreChip`. **Raden åpner
    EventDetail — altså kamprapporten fra skive 5.** Flatene forsterker
    hverandre: sesongen er indeksen, rapporten er historien.
  - Tom-tilstand («Sesongen starter her …») når ingen kamper er spilt.
    Lasting/feil/pull-to-refresh/`useFocusEffect` — samme mønster som
    KalenderScreen.
- **Inngang: `TeamHeader` fikk valgfri `onSeasonPress`** → «Sesongen»-chip til
  høyre (mørk stadion-chip med mint trofé). **Kun Hjem sender prop-en** —
  Kalender/Varsler bruker samme header uten chip, og har heller ikke
  `Season`-skjermen i stacken sin. Registrert i HomeStack + `Season: undefined`
  i `HomeStackParamList`.

`npx eslint src`: **0 errors, 4 warnings (samme fire som før).** tsc ikke
kjørt (låst regel — sjekk i editoren).

### Test dette (Metro-reload — migrasjonene er alt ute)
1. Hjem → «Sesongen»-chipen står til høyre i lagheaderen → trykk: skjermen
   åpner med store tall for kamper/seiere/mål og dempet uavgjort/tap-linje.
   ✅ Sett på telefon 2026-07-30 — sjekk kun at toppscorer-seksjonen nå er
   borte etter reload.
2. Tallene skal stemme med kampene laget faktisk har spilt i år (kun
   ferdigspilte; en live kamp teller ikke før «Slutt»).
3. Kampene: nyeste først, Seier-pill kun når vi vant, ingen pill ved tap.
   Trykk en rad → kamprapporten (scoreboard først, forløp, bilder).
4. Avslutt en live kamp → gå til sesongen → dra ned for å refreshe →
   kampen står i listen og tallene har flyttet seg.
5. Lag uten spilte kamper (nytt lag): tom-tilstanden, ingen krasj.

### Kjente v1-begrensninger (akseptert)
- Halvårsgrensen leses i servertid (UTC) — en kamp rett rundt nyttår/1. juli
  sent på kvelden kan teoretisk havne i feil halvår. Uinteressant i praksis.
- Ingen inngang fra Kalender/Profil — kun Hjem-headeren. Legg `Season` inn i
  flere stacker hvis behovet viser seg.

**Drive-by-fiks i samme commit:** `ReporterModal` og `MatchPhotoSheet` sto
igjen med `typography.body` i skrivefeltene sine — samme RN #41240-bug
(lineHeight i TextInput) som kveldens telefonfunn rettet i alle andre felt.
Begge bruker nå `typography.input`.

---

## ✅ TURNERINGER + VÅR/HØST-SESONGER (KODET 2026-07-30 natt, omlagt etter brukertest)

Bruker-beslutning samme kveld: «Jeg vil ha støtte for turneringer — en enkel
samling av kamper innenfor den aktive sesongen, ikke et avansert
cupadministrasjonssystem» + «Kan sikkert skille mellom vår og høstsesong?
Dette blir jo som egne turneringer på en måte.» Flere idretter, enklest
mulig, ingen forvirring.

**⚠️ Flyten ble LAGT OM etter brukertest av første versjon** (00032-flyten
med turneringen som kalenderkort + «Ny kamp» kun fra turneringssiden falt
ikke i smak): «på sesongsiden kan man switche mellom sesonger/turneringer —
kanskje det er inne der man legger til en ny turnering? Ved vanlig
kampopprettelse kan man velge turnering HVIS det finnes en, ellers blir det
en vanlig kamp i sesongen.» Det er dét som nå er bygget (00033).

#### Modellen (den mentale: sesong og turnering er begge «samlinger av kamper»)
- **Sesong = halvår.** Vår (jan–jun) / høst (jul–des). Sport-nøytralt uten
  noe oppsett: fotball teller kalenderåret som vår + høst, hallidrettenes
  26/27-sesong ER en høstdel + en vårdel. (`seasons`-tabellen fra 00002 står
  fortsatt urørt/ubrukt.)
- **Turneringer BOR PÅ SESONGSIDEN, ikke i kalenderen.** Velgeren øverst
  sidestiller halvår og turneringer («Vår 2026 · Høst 2026 · 🏆 Hamar Cup»),
  og «+ Ny turnering» er siste chip i velgeren (kun trener). En valgt
  turnering er sin egen visning: egne tall + egen kampliste.
- **Kalenderen viser KAMPENE** — vanlige kampkort, det er dem foreldrene
  møter opp på. Turnerings-containeren er filtrert bort fra kalenderen.
- **Kampskjemaet har et «Turnering»-felt** (chips: «Ingen» + navn) som kun
  vises når laget har aktuelle turneringer (siste 60 dager + kommende).
  «Ingen» = vanlig seriekamp. Turnering-typen er FJERNET fra «Hva
  skjer?»-chipsene — turneringer opprettes ett sted (sesongsiden).
- **I databasen er modellen uendret fra 00032:** turnering = event av type
  `turnering`, kamper peker med `parent_event_id`. Hele kamp-løypa (live,
  rapport, bilder, feed, push) er urørt og vet ingenting om turneringer.

#### Migrasjoner `00032` + `00033` (✅ begge deployet)
- **00032:** `events.parent_event_id` (FK → events, **ON DELETE SET NULL** —
  kampene overlever hvis turneringen slettes) + partial index.
  `create_event` **DROP + CREATE** (ny param `p_parent_event_id` = ny
  signatur; OR REPLACE ville skapt en tvetydig overload). Vakter: forelder
  må være `turnering` i samme lagrom, kun `kamp` kan legges i den, ett nivå.
- **00033:** `get_season_stats` **DROP + CREATE** igjen:
  `(space_id, p_year, p_half, p_tournament)`. Med `p_tournament` viser den
  ÉN turnering (samme svarform, `season_label` = navnet); ellers
  halvårsvinduet. Returnerer alltid `seasons[]` (halvår med spilte kamper +
  inneværende) og `tournaments[]` (alle, nyeste først — også uten kamper, så
  en nyopprettet kan velges). Kun `ferdig`-kamper teller i begge modi.
- **00033 også:** `notify_on_event_created` hopper over rader med
  `parent_event_id` — fire kamper lagt inn i en cup skal ikke gi fire «Ny
  hendelse»-varsler (turneringen varslet da den ble opprettet).

#### App
- `EVENT_TYPE_MAP`: `turnering` er egen type (var `annet`). Ny verdi i
  `EventType`-unionen — alle tre `typePill`-tabellene (EventCard,
  NextEventHero, EventDetail) + `StatusPill` fikk `turnering` (myk gul
  `sun`/`goldInk` — solid gull er fortsatt reservert VIKTIG).
- **`getTeamEvents` filtrerer bort `type='turnering'`** (containeren), men
  turneringsKAMPENE vises i kalenderen som vanlige kamper. Ny lett
  `getTournaments(teamSpaceId)` (siste 60 dager + kommende) til
  kampskjemaets velger; `getTournamentMatches` består (turneringssiden).
- **`NewEventScreen` har tre innganger:** fri (+-knappen; typevelger UTEN
  turnering), «Ny kamp» fra turneringsside (`parentEventId` → låst til kamp,
  gul «Kamp i {navn}»-banner), og «+ Ny turnering» fra sesongsiden
  (`presetType: 'turnering'` → låst, knappen heter «Opprett turnering», og
  man returneres til sesongsiden — ikke kalenderen). Fri kampopprettelse
  viser «Turnering»-feltet (chips «Ingen» + navn) kun når det finnes
  aktuelle turneringer.
- **`SeasonScreen`:** velgeren = halvår-chips + turnerings-chips (med trofé)
  + «+ Ny turnering» (kun trener). Turneringsvisning: trofé + navn som
  hero-etikett, egne tall, kampliste uten mellomtitler. Halvårsvisning har
  turneringsnavn som gule mellomtitler i listen. Valgt chip markeres
  umiddelbart (lokal state) mens serversvaret laster.
- **`EventDetailScreen`s turneringsside består** (kampliste + «Ny kamp i
  turneringen» for admin) — den nås via «Ny turnering»-varselet i inboxen.
  `NewEvent`-modalen er registrert i alle tre stackene (delte
  `newEventOptions`) så den flyten virker overalt. (Netto én lint-warning
  mindre; 3 igjen.)

### Test dette (Metro-reload — migrasjonene er alt ute)
1. **Sesongen → «+ Ny turnering»** (siste chip i velgeren, kun som trener)
   → skjema med gul «Turnering»-banner, «Opprett turnering» → tilbake på
   sesongsiden, og 🏆-chipen for turneringen står i velgeren.
2. Turneringen skal **IKKE** ligge i kalenderen.
3. `+` → Ny hendelse → **Kamp** → «Turnering»-feltet viser «Ingen» +
   turneringsnavnet. Velg turneringen → lagre → kampen ligger i kalenderen
   som et vanlig kampkort.
4. Lag en kamp til med «Ingen» → vanlig seriekamp.
5. Spill turneringskampen (start → mål → slutt — helt vanlig kampside).
   Sesongsiden: kampen står under gul «HAMAR CUP»-mellomtittel i
   halvårsvisningen, og 🏆-chipen viser turneringens egne tall + kampliste.
6. Kun ETT «Ny hendelse»-varsel (for turneringen) — turneringskamper varsles
   ikke enkeltvis.
7. Som forelder: ingen «+ Ny turnering»-chip, ingen «Turnering»-felt-endring
   ellers; alt annet ser likt ut.

### Kjente v1-begrensninger (akseptert)
- Ingen redigering/flytting av en kamp inn/ut av en turnering i etterkant.
- Turneringsvisningen viser kun SPILTE kamper (kjøreplanen bor i
  kalenderen) — før første kamp er spilt viser den 0-er + forklaring.
- Kampkortet i kalenderen røper ikke hvilken turnering kampen hører til —
  det bor på sesongsiden.
- `mote`-typen mapper fortsatt til `annet` (uendret).

---

## ✅ LAGFARGE (FERDIG — verifisert på telefon og committet 2026-07-31)

Bruker-funn: fargevalg fantes ikke i appen — CreateTeam sendte aldri farge,
så ALLE lag fikk RPC-defaulten `#6366F1` (indigo, 00016). Nå: fargevalg ved
opprettelse + innstilling på Profil. **Kun Metro-reload — INGEN migrasjon.**
Skrivingen dekkes av «Admins can update team space»-policyen som alt lå i
00014.

#### 🔒 Kuratert palett, ikke fri fargevelger (bruker godkjente 2026-07-30)
A v2-regelen er «lagfarge kontrollert»: fri velger lar en trener plukke
hvitt/krem (usynlig på flatene) eller mint (kolliderer med #02FFAB =
Heia/handling — live-scoren blir tvetydig). 12 farger i
`src/shared/teamColors.ts` dekker i praksis norske klubbdrakter. Indigo er
MED i paletten slik at eksisterende lag viser «valgt» når velgeren åpnes.

- **`src/shared/teamColors.ts` (ny):** `TEAM_COLORS` (12, med norske navn
  til accessibilityLabel) + `inkOnTeamColor(hex)` — YIQ-luminans → mørke
  initialer på gult (Glimt/LSK-gult tåler ikke hvit tekst), hvite ellers.
- **`TeamColorPicker.tsx` (ny):** swatch-grid, valgt = ring i fargen + hake.
  **`TeamColorSheet.tsx` (ny):** valgark på ReporterSheet-mønsteret —
  trykk på swatch = lagre og lukk.
- **`updateTeamColor` (teams.ts):** direkte UPDATE på `team_spaces` med
  `.select('id')`-vakt — RLS-nekt via USING gir ellers null rader og INGEN
  feil (setMatchReporter-lærdommen). Kaster norsk melding for ikke-admin.
- **ProfilScreen:** «Lagfarge»-rad (kun trener/lagleder/admin), lagfarget
  prikk som ikon → sheet → `refreshMemberships()`. Fargen leses via context
  overalt, så lagmerket, scoreboardet, «oss»-stripa og laglisten skifter
  uten reload.
- **CreateTeamScreen:** «Lagfarge»-feltgruppe med forhåndsvalgt TILFELDIG
  palettfarge (sprer fargene mellom lag, null ny friksjon — alltid utfylt).
  Payload sender `color`; auth-before-commit (pendingAction) bærer den også.
- **Gul-fiksen:** TeamHeader/ScoreBoard/LiveMatchBanner hadde hardkodet
  hvite initialer på lagfargen. Alle tre bruker nå `inkOnTeamColor` på
  «oss»-merket. Motstandermerket er urørt (nøytral mørk flate).

### Test dette (Metro-reload)
1. Profil som trener → «Lagfarge»-rad med dagens farge som prikk → trykk →
   ark med 12 farger, dagens har ring + hake.
2. Velg ny farge → arket lukkes, lagmerket i headeren + prikken i «Dine
   lag» skifter uten reload. Sjekk scoreboardet på en kamp også.
3. Velg GULT → initialene på lagmerket blir mørke, ikke hvite.
4. Som forelder: ingen «Lagfarge»-rad på Profil.
5. Opprett nytt lag → «Lagfarge» står forhåndsvalgt; bytt farge → laget
   får fargen (sjekk lagmerket etterpå).
6. `npx eslint src`: 0 errors, 3 warnings (alle fra før).

---

## 📱 Test på fysisk iPhone (etablert 2026-07-30)

Første gang appen kjørte på ekte enhet (iPhone 15). Tre ting kostet tid og er
verdt å kunne.

### ⚠️ `DEVELOPMENT_TEAM = Q5A6QMRZ4A` er BRUKERENS PERSONLIGE Apple-ID
Lagt inn av Xcode da bruker logget på for å teste på egen telefon.
**Den skal IKKE brukes ved publisering** — bytt til firmakontoen når den
finnes. Team-ID er ingen hemmelighet (den ligger i hver publiserte app), så
den er committet med vilje: alternativet var en permanent endret
`project.pbxproj`, og dette repoet har allerede nok merge-støy fra
squash-mønsteret. Xcode normaliserte samtidig hele fila (omsortering +
tomme `inputPaths`/`outputPaths` på CocoaPods-fasene) — ufarlig.

### «Bygget lyktes, men appen finnes ikke på telefonen»
Bygget lå ferdig signert i `Debug-iphoneos/Heia2.app`, men
`xcrun devicectl device info apps` viste **`Apps installed:` tomt**.
Installasjonssteget hadde aldri kjørt — typisk **⌘B (Build)** i stedet for
**⌘R (Run)**. Diagnose og fiks uten å bygge på nytt:

```bash
xcrun devicectl list devices                       # finn UDID-en
xcrun devicectl device info apps --device <UDID>   # er den installert i det hele tatt?
xcrun devicectl device install app --device <UDID> \
  ~/Library/Developer/Xcode/DerivedData/Heia2-*/Build/Products/Debug-iphoneos/Heia2.app
xcrun devicectl device process launch --device <UDID> org.reactjs.native.example.Heia2
```

**Appen heter «Heia» på hjemskjermen, ikke «Heia2»** — `CFBundleDisplayName`
i `Info.plist` overstyrer `PRODUCT_NAME`. Lett å lete etter feil navn.

### Profilen må godkjennes PÅ telefonen
`process launch` feilet med «its profile has not been explicitly trusted by
the user». Med personlig Apple-ID må man selv gjøre:
**Innstillinger → Generelt → VPN og enhetsadministrering → Utviklerapp →
Apple-ID-en → «Stol på»**. Kan ikke gjøres fra Mac-en.

⚠️ **Gratis provisioning gir 7 dagers sertifikat.** Appen slutter å starte
etter en uke og må installeres på nytt. Ikke en feil.

### ⛔ Fri provisioning låser fortsatt opp push
Personlig Apple-ID gir **ikke** APNs-entitlement. Fase 4 er derfor fremdeles
parkert på nøyaktig samme sted: ekte push krever **betalt** Apple Developer
Program. At det nå finnes et DEVELOPMENT_TEAM endrer ingenting der.

### iOS cacher app-ikoner hardt
Etter en rebuild med nytt ikon kan hjemskjermen bli stående på det gamle.
Slett appen og installer på nytt — det er den pålitelige veien.

---

## 🎯 SENERE — produktkandidater

**Visjonen (bruker, 2026-07-30):** hver kamp skal bli et automatisk *kampminne*
— før kamp (bane, oppvarming), under (mål, bilder, reaksjoner kronologisk),
etter (resultat, galleri, forløp), og senere en delbar «Kampen på 30 sekunder».
Anbefalt rekkefølge, med begrunnelse:

1. ~~**Alle medlemmer kan legge bilder på kampen**~~ — **AVVIST av bruker
   2026-07-30** («nei, alle skal ikke legge bilder på kampen»). Ikke foreslå
   den på nytt uten at bruker tar den opp selv. Backend-en ligger der uansett
   (`createImagePost` tar `eventId` fra hvem som helst, RLS krever bare
   lagmedlemskap), så kampbilder er fortsatt reporterens jobb — som i dag.
2. **Kommentarer + heiing synlig i kamptidslinja** — «var der»-følelsen ligger
   i de andres stemmer. De finnes i dag, men bor på feed-poster og er usynlige
   på kampsiden.
3. **Før kamp-innhold** — nesten gratis når 1 finnes: samme knapp, bare ikke
   låst til live-grenen.
4. **«Kampen på 30 sekunder»** — SIST. Kvaliteten er en direkte funksjon av
   hvor mye innhold kampen samlet; bygges den før 1–3 oppsummerer den fire
   måltidspunkter og ingenting annet.
   ⚠️ **Avklar før den bygges:** en *delbar* oppsummering bryter med at bildene
   ligger i privat bucket med signerte URL-er nettopp fordi de er av barn.
   Norske klubber har samtykkeregler for billedbruk. Deling til foreldregruppa
   er noe helt annet enn en offentlig lenke — lettere å designe riktig nå enn
   å trekke tilbake senere.

Andre kandidater:
5. ~~**Sesong/statistikk-flate**~~ — ✅ **BYGGET 2026-07-30** (se seksjonen
   «✅ SESONGFLATEN» over). Venter kun på optisk review.
6. **Varslingsinnstillinger-UI** — `notification_preferences` + `inbox_enabled()`
   (00023) finnes i DB, men har ingen skjerm. Påbygg på 🔔-raden i `ProfilScreen`.
7. **`+`-knappens «Start kamp»-snarvei** (låst beslutning 1, siste rest).
8. **Rydd `NSLocationWhenInUseUsageDescription`** — står med tom streng i
   Info.plist og posisjon brukes ingen steder. Tomme begrunnelser er en kjent
   grunn til avslag i App Store-review.
9. ~~**Sport + årsklasse i TeamHeader**~~ — ✅ **DEKKET AV P3 2026-07-31**
   (undertekst «Fotball · N medlemmer», fallback «Fotball · G14»).

### 🎨 Designgjeld (kartlagt 2026-07-30 — ikke påbegynt)
- **BRAND_UI.md beskriver FØR-A v2-systemet** (gamle fargeverdier, slettet
  `Chip`, «Unicode-symboler» som ikonstil, 5-tab med «Meldinger»). Alt låst
  A v2-språk bor kun i denne fila. Skriv den om FØR noen bygger på den.
- **13 rå `ActivityIndicator`-lastetilstander** — «default spinners» er
  eksplisitt anti-mønster i BRAND_UI. Skeleton/tomkort på Card-språket.
- **Null bevegelse i appen** (kun LiveBadge-puls + SimulatedPush). Størst
  effekt per innsats: MÅL-øyeblikket (scoren teller opp / feiring).
- **Ingen haptikk** på mål/Heia/start-slutt — krever native modul → rebuild.
- **Tilgjengelighet:** 7 accessibilityLabels i hele appen; fast px-typografi
  (ingen Dynamic Type). Målgruppa er foreldre 40+.
- **`bytte`/`kort`** i MatchEventRow/MatchPhotoSheet er fortsatt tegn-glyfer
  (↔/🟨) blant Lucide-ikonene — appen lager dem ikke ennå, men de VISES om
  data finnes.
- **Mørk modus: lås bevisst «nei i v1»** — mørk flate BETYR kamp i A v2; en
  systemvid mørk modus ville spist signaturen.

---

## Arbeidsmåte (for å spare tokens + beholde kontekst)

1. Ny samtale per skive. Start alltid med: «Les docs/STATUS-HANDOFF.md og fortsett.»
2. Én smal vertikal skive per samtale.
3. Når en oppgave er ferdig oppdaterer Claude denne fila og sier fra at du trygt kan åpne ny samtale. (Fast regel — du trenger ikke be om det.)
4. Varige ting (hvem du er, produktidentitet, arbeidsstil) ligger i Claudes minne og følger med automatisk.

---

## VIKTIGE LÆRDOMMER (ikke gjenta)

- **ALDRI kjør `pod install`/lange native/build-kommandoer i bakgrunnen mens appen kjører.** Skaper ressurskonflikt + flere Metro-instanser → app henger på «loading from Metro». Kjør i forgrunnen når brukeren er klar, og si fra at rebuild trengs.
- **Claude kan ikke kjøre Metro/simulator** (sandkassen binder ikke port). Brukeren kjører `npm start` selv og lar den stå. Første RN 0.83-oppstart tar 1–2 min.
- **Claude KAN kjøre `supabase db push`** — men bash-sandkassen blokkerer nettverk, så kommandoen henger uten output. Kjør den med sandkassen av. DB-passordet ligger i macOS-nøkkelringen fra `supabase link`, så den spør ikke.
  `supabase migration list` krever derimot en **access token** (`supabase login`), som ikke er satt — den feiler uansett. Bruk `db push --dry-run` for å se hva som er ubehandlet.
- **Ny native modul krever full rebuild** (`pod install` + Xcode/`run-ios`), ikke bare Metro-reload.
- **RN 0.83 har ikke Clipboard i core.** Kopiering krever native modul; ellers `<Text selectable>`.
- **Ikke referer en native modul som ikke er bygget inn** — krasjer ved import.
- **RN-bildeupload:** base64 → ArrayBuffer (`base64-arraybuffer` `decode`), IKKE fil-URI direkte i supabase-js `.upload()`.
- **ESLint-serveren i editoren er treg** og viser av og til stale «problems» rett etter merge/rebuild — de forsvinner når den kjører gjennom. tsc er sannhetskilden.
- Miljø: Node v24, RN 0.83.1, Metro 0.83.3, ingen watchman, ingen node-version-manager.
