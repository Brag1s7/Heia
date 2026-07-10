# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-07-09 (etter Fase 3C-1 — ekte medlemsliste + lagret reporter)_

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), hele Fase 2 (ekte feed),
Fase 3A (ekte events — lesing), Fase 3B-1 (opprett hendelse) og
Fase 3B-2 (RSVP lagres) er ferdig og testet.**
**Fase 3C (hele live-kamp-loopen) er kodet, og `00020` er deployet til remote.
Ingenting er kjørt i simulator ennå** — det er første oppgave.

Branch: `Brage`. `npx tsc --noEmit` er grønn. `npx eslint src` har 6 errors +
5 warnings, alle fra før (ubrukte variabler i `Avatar`/`CommentsScreen`/
`InviteScreen`, `exhaustive-deps` i `UserContext`/`TeamContext`) — ingen nye.
Alt til og med 3B-1 er verifisert i simulator av brukeren. Av 3B-2 er selve
lagringen bekreftet; knappe-variantene og offline-rollbacken (punkt 4 i
testlisten) er ikke kjørt gjennom ennå.
Ikke pushet til `origin/Brage` ennå.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer), events/kalender/event-detalj/live-banner, **opprettelse av hendelser + kamper**, **RSVP-svar**, **medlemslisten**, **kampreporter**, **start av kamp**, **kamphendelser + stilling + feed-post**, **realtime på live kamp**, rollesjekk (fra membership).
- **Fortsatt uekte:** `SimulatedPush` (lokal banner hos reporteren — ekte push
  finnes ikke i appen i det hele tatt).
- **All mock-data er borte.** `src/shared/mockData.ts` og `src/data/teamData.ts`
  er slettet — ingenting importerte dem lenger.

---

## Backend (Supabase) — tilstand

Prosjektet er linket (ref `sswncdrbsrfieudkdmhj`, config `Heia_Prod`). Migrasjoner
00001–00019 er alle deployet til remote (00016/00017 var hand-kjørt fra før;
reconciliert med `migration repair` 2026-07-08). `supabase db push` fungerer.

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
- **Ekte push.** Dette er den store, og den eneste måten en forelder som *ikke*
  har appen åpen får vite om målet. Krever native modul + rebuild + APNs +
  Edge Function som leser `notifications`-tabellen (den finnes, tom). Egen skive.
  `SimulatedPush` lever fortsatt som lokal bekreftelse til reporteren.
- **Resume etter pause.** `pause` setter status, men ingen knapp setter den
  tilbake til `live` (`andre_omgang` finnes i `match_events`-CHECK). Kampen kan
  fortsatt avsluttes fra pause.
- **`getLiveMatch`** filtrerer på `status='live'`, så hero-banneret forsvinner
  i pausen. Vurder å ta med `pause`.
- **`+`-knappens tredje valg** («Start kamp», beslutning 1) er ikke bygget —
  kampen startes fra kampsiden. Ren snarvei, loopen er hel uten.
- **`FeedCard` er aldri testet på typene `match_event`/`match_start`/`match_end`.**
  Sjekk at de rendrer pent i feeden.

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
