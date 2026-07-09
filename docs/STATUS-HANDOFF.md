# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-07-09 (etter Fase 3B-1 — opprett hendelse)_

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), hele Fase 2 (ekte feed),
Fase 3A (ekte events — lesing) og Fase 3B-1 (opprett hendelse) er ferdig.**
Neste steg er Fase 3B-2 — lagre RSVP + fjerne «Ta rollen».

Branch: `Brage`. `npx tsc --noEmit` er grønn. `npx eslint src` har 6 errors +
5 warnings, alle fra før (ubrukte variabler i `CommentsScreen`/`InviteScreen`,
`exhaustive-deps` i `UserContext`/`TeamContext`) — ingen nye.
Alt under er verifisert i simulator av brukeren: opprette hendelser, bli med i
lag nr. 2, legge til lag fra Profil, og tilbake-knappene.
Ikke pushet til `origin/Brage` ennå.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer), events/kalender/event-detalj/live-banner (lesing), **opprettelse av hendelser + kamper**, rollesjekk (fra membership).
- **Fortsatt mock:** kun medlemslisten i kampreporter-UI-et på `EventDetailScreen` (`getMembersForTeamSpace` i `src/data/teamData.ts`). Ryddes når live-kamp kobles på (Fase 3C). `getUserRoleInTeam` er ikke lenger i bruk.
- Mock-events, mock-feed og mock-oppmøtelister er slettet fra `src/shared/mockData.ts` (~350 linjer). Fila har nå kun `users`/`teams`/`teamSpaces`/`memberships`.

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
- **RSVP-knappene lagrer ikke ennå** — de oppdaterer bare lokal state. `applyMyStatus()` i `EventDetailScreen` trekker fra det lagrede svaret før den legger til det nye, så tallene dobbelttelles ikke. Skrive-delen er ~10 linjer: bytt `setMyStatus` mot `upsert_rsvp` (RPC finnes) + refetch.
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

## Fase 3B-2 — NESTE (lett RSVP + reporter-opprydding)

- **RSVP lagrer ikke ennå.** `EventDetailScreen` oppdaterer bare lokal state.
  Bytt `setMyStatus` mot `upsert_rsvp` (RPC finnes) + refetch. ~10 linjer.
  `applyMyStatus()` trekker allerede fra det lagrede svaret, så tallene
  dobbelttelles ikke mens man venter på serveren.
- **Fjern «Ta rollen» i `ReporterBar`.** RLS på `match_sessions` lar bare
  `reporter_id = auth.uid()` ELLER admin gjøre UPDATE. Når `reporter_id` er NULL
  blir første ledd NULL → usant, så en forelder kan ikke ta en ledig rolle.
  Følger beslutning 3 under: fjern knappen (ikke løsne policyen).

Filosofi: events = innholdskilde + forutsetning for live kamp. IKKE Spond-tung
RSVP/admin. Heia er «Strava for ungdomslag».

### LÅSTE BESLUTNINGER (bruker, 2026-07-09)

1. **`+`-knappen = rollestyrt valgark.** Alle ser «Del med laget» (tekst/bilde).
   Trener/lagleder/admin ser i tillegg «Ny hendelse». Reporter ser «Start kamp»
   når laget har en kamp i dag. Knappen skal aldri være død for en forelder —
   den er appens mest fremhevede knapp, og foreldre er de fleste brukerne.
   ✅ Bygget, bortsett fra «Start kamp» — den venter på Fase 3C, siden ingenting
   kan starte en kamp ennå og en død knapp er verre enn ingen knapp.
2. **Kun trener/lagleder/admin kan opprette hendelser** — som RLS allerede sier.
   Ingen migrasjon for rettigheter. ✅ Bygget.
3. **Trener tildeler kampreporter.** «Ta rollen»-knappen i `ReporterBar` skal
   fjernes; reporter velges via `ReporterSheet`. → 3B-2.

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

### Seed-SQL (fortsatt nyttig for **live** kamp)
Vanlige hendelser lages nå i appen. Men ingenting kan sette en kamp i `live`
før Fase 3C, så hero-banneret må fortsatt seedes. Kjør i Supabase SQL-editor
(finn `<TS_ID>` med `select id, display_name from team_spaces;`):

```sql
-- vanlig trening
insert into public.events (team_space_id, type, title, location, start_time, end_time)
values ('<TS_ID>', 'trening', 'Trening', 'Kunstgresset',
        now() + interval '1 day', now() + interval '1 day 1 hour');

-- live kamp (gir hero-banner på TeamHome)
with e as (
  insert into public.events (team_space_id, type, title, location, start_time)
  values ('<TS_ID>', 'kamp', 'Heia mot Lyn', 'Ullevaal', now())
  returning id
)
insert into public.match_sessions (event_id, opponent, home_score, away_score, status)
select id, 'Lyn', 2, 1, 'live' from e;
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
- **Ny native modul krever full rebuild** (`pod install` + Xcode/`run-ios`), ikke bare Metro-reload.
- **RN 0.83 har ikke Clipboard i core.** Kopiering krever native modul; ellers `<Text selectable>`.
- **Ikke referer en native modul som ikke er bygget inn** — krasjer ved import.
- **RN-bildeupload:** base64 → ArrayBuffer (`base64-arraybuffer` `decode`), IKKE fil-URI direkte i supabase-js `.upload()`.
- **ESLint-serveren i editoren er treg** og viser av og til stale «problems» rett etter merge/rebuild — de forsvinner når den kjører gjennom. tsc er sannhetskilden.
- Miljø: Node v24, RN 0.83.1, Metro 0.83.3, ingen watchman, ingen node-version-manager.
