# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-07-08 (etter Fase 2C + merge av main)_

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), og hele Fase 2 (ekte feed: tekst,
reaksjoner, kommentarer, bilde) er ferdig, committet og verifisert i simulator.
Neste steg er Fase 3 — Event/kamp.**

Branch: `Brage`. `npx tsc --noEmit` er grønn. Alt pushet til `origin/Brage`.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer).
- **Fortsatt mock:** events/kalender. `TeamHomeScreen` henter live-kamp-banneret fra `getEventsForTeamSpace` (`src/data/teamData.ts`). Det er dette Fase 3 fjerner. Dev-seed-feeden er allerede ryddet bort.

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

## Fase 3 — Event/kamp (NESTE)

Godkjent plan. Konverterer den siste mock-kilden til ekte data.
- `src/lib/api/events.ts` — les via `get_event_with_rsvp` (RPC finnes).
- Ny RPC `create_event` (atomisk event + `match_session` for kamp).
- Koble **Kalender** + **EventDetail** fra mock → ekte; bytt mock `getEventsForTeamSpace` i TeamHome → ekte events (og dermed ekte live-kamp-banner).
- `NewEventScreen` + **lett** RSVP.
- Filosofi: events = innholdskilde + forutsetning for live kamp. IKKE Spond-tung RSVP/admin. Heia er «Strava for ungdomslag».

Foreslått første skive: les-siden først (events.ts + koble Kalender/EventDetail/banner til ekte data), deretter skrive-siden (create_event + NewEventScreen), deretter RSVP. Én smal skive per samtale.

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
