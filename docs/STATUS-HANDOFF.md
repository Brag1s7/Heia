# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-07-09 (etter Fase 3A — les-siden for events)_

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), hele Fase 2 (ekte feed) og
Fase 3A (ekte events — les-siden) er ferdig.** Neste steg er Fase 3B —
skrive-siden (`create_event` + `NewEventScreen`).

Branch: `Brage`. `npx tsc --noEmit` og `npx eslint` er grønne.
Fase 3A er verifisert i simulator (trening i kalenderen + live-banner via seedet
SQL) og committet. Ikke pushet til `origin/Brage` ennå.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer), **events/kalender/event-detalj/live-banner (lesing)**.
- **Fortsatt mock:** kun medlemslisten i kampreporter-UI-et på `EventDetailScreen` (`getMembersForTeamSpace`/`getUserRoleInTeam` i `src/data/teamData.ts`). Den koden er uansett uåpnelig i dag, siden ingen `match_sessions` kan opprettes før Fase 3B. Ryddes når live-kamp kobles på.
- Mock-events, mock-feed og mock-oppmøtelister er slettet fra `src/shared/mockData.ts` (~350 linjer). Fila har nå kun `users`/`teams`/`teamSpaces`/`memberships`.

---

## Backend (Supabase) — tilstand

Prosjektet er linket (ref `sswncdrbsrfieudkdmhj`, config `Heia_Prod`). Migrasjoner
00001–00018 er nå alle deployet til remote (00016/00017 var hand-kjørt fra før;
reconciliert med `migration repair` 2026-07-08).

Eksisterende RPC-er: lese — `get_team_feed`, `get_event_with_rsvp`,
`get_team_members`; skrive — `create_team_from_scratch`, `join_team_space`,
`activate_team_space`, `upsert_rsvp`. RLS tillater direkte member/admin-insert
for feed/kommentar/reaksjon/event, så få nye RPC-er trengs.

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

## Fase 3B — Skrive-siden (NESTE)

- Ny RPC `create_event` (atomisk event + `match_session` for kamp) → migrasjon `00019`. Må selv sjekke `is_team_admin()`, siden SECURITY DEFINER omgår RLS.
- `NewEventScreen` + rollestyrt valgark bak `+`-knappen (se beslutninger under).
- Deretter **lett** RSVP (`upsert_rsvp` finnes allerede).
- Filosofi: events = innholdskilde + forutsetning for live kamp. IKKE Spond-tung RSVP/admin. Heia er «Strava for ungdomslag».

### LÅSTE BESLUTNINGER (bruker, 2026-07-09)

1. **`+`-knappen = rollestyrt valgark.** Alle ser «Del med laget» (tekst/bilde).
   Trener/lagleder/admin ser i tillegg «Ny hendelse». Reporter ser «Start kamp»
   når laget har en kamp i dag. Knappen skal aldri være død for en forelder —
   den er appens mest fremhevede knapp, og foreldre er de fleste brukerne.
   (`OpprettScreen` i `AppNavigator.tsx` er i dag bare en placeholder.)
2. **Kun trener/lagleder/admin kan opprette hendelser** — som RLS allerede sier.
   Ingen migrasjon for rettigheter.
3. **Trener tildeler kampreporter.** «Ta rollen»-knappen i `ReporterBar` skal
   fjernes; reporter velges via `ReporterSheet`.

### TO SPREKKER Å FIKSE I 3B (funnet 2026-07-09)

- **Appens `UserRole` mangler `lagleder` og `admin`** (`src/shared/types.ts`),
  mens DB har begge. Derfor gjør `EventDetailScreen` sjekken
  `isCurrentUserAdmin = role === 'trener'` — en lagleder som DB *tillater* å
  opprette hendelser, ville ikke sett knappen. Utvid unionen og innfør en
  felles `isTeamAdmin(role)`-hjelper.
- **`ReporterBar`s «Ta rollen» kan ikke virke.** RLS på `match_sessions` lar
  bare `reporter_id = auth.uid()` ELLER admin gjøre UPDATE. Når `reporter_id`
  er NULL blir første ledd NULL → usant, så en forelder kan ikke ta en ledig
  rolle. Følger beslutning 3: fjern knappen (ikke løsne policyen).

### Live kamp — slik er flyten tenkt (skjemaet er allerede bygget for den)

Kamp opprettes med `match_session` i status `planlagt` → noen trykker
«Start kamp» (`status='live'`, `started_at`) → `EventDetailScreen` bytter til
live-modus med `ScoreBoard` + `ReporterActions` → hvert trykk skriver en rad i
`match_events`. Kamphendelser legges altså inn **inne på kampen**, ikke fra `+`.

`feed_posts` har allerede `match_event_id` og typene `match_event`,
`match_start`, `match_end`: en kamphendelse skal **også** bli en feed-post (og
senere en push). Det er Strava-øyeblikket — «MÅL! 2–1» mens kampen pågår.
I dag viser `ReporterActions` kun en simulert push og lagrer ingenting.

### Slik tester du Fase 3A før 3B (ingen create_event ennå)
Kalenderen er tom til det finnes ekte rader. Kjør i Supabase SQL-editor
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
