# Heia — statusoverlevering (for ny chat)

_Sist oppdatert: 2026-07-08_

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## Hvor vi er

Vi følger en godkjent 4-fase-plan for «Team Activity Loop». **Fase 0 (invite-loopen) er ferdig og kjører i simulator. Vi er nå inne i Fase 1 (design) — se egen seksjon under.**

Backend (Supabase) er nesten komplett fra før: datamodell + RLS + lese-RPC-er
(`get_team_feed`, `get_event_with_rsvp`, `get_team_members`) og skrive-RPC-er
(`create_team_from_scratch`, `join_team_space`, `activate_team_space`,
`upsert_rsvp`). RLS tillater direkte member/admin-insert for feed/kommentar/
reaksjon/event, så få nye RPC-er trengs.

Frontend: kun onboarding var koblet til Supabase. Alt «inni» appen
(TeamHome-feed, Kalender, EventDetail) er fortsatt **mock** fra
`src/data/teamData.ts` + `src/shared/mockData.ts`. Det er det Fase 2–3 fikser.

---

## Fase 0 — gjort (invite-loop)

- `src/components/InviteCodeCard.tsx` — viser koden stort (markerbar: hold inne → iOS «Kopier»), «Del invitasjon» via native `Share`. **Kun react-native core, ingen native tredjeparts-modul.**
- `src/screens/InviteScreen.tsx` — egen skjerm, «Laget er klart! 🎉»-variant ved nyopprettelse.
- `src/context/OnboardingContext.tsx` — `justCreatedTeamSpaceId` settes i `executeCreate`, nulles av TeamHome (engangs-reveal).
- `src/screens/TeamHomeScreen.tsx` — engangs-reveal etter opprettelse + invite-CTA når feeden er tom.
- `src/screens/ProfilScreen.tsx` — «Inviter til laget»-rad.
- `src/navigation/AppNavigator.tsx` + `src/shared/types.ts` — `Invite`-rute i Hjem- og Profil-stack.
- Typecheck (`npx tsc --noEmit`) er **grønn**.

## Fase 0 — løse tråder å rydde i ny chat

1. **`@react-native-clipboard/clipboard` er installert i package.json men brukes ikke** (vi fjernet all bruk fordi native-modulen ikke var i binæren og krasjet appen). Beslutning trengs:
   - **Enten** fjern pakken (`npm uninstall @react-native-clipboard/clipboard`) for å holde rent, **eller**
   - behold den og kjør `pod install` + rebuild i Xcode for å få en dedikert ett-trykks «Kopier»-knapp. (Hold-inne-kopiering + Del dekker behovet uten dette.)
2. End-to-end-verifisering: opprett lag → reveal → del via Share; bli med via kode.

---

## Fase 1 — design (PÅGÅR)

Retning satt og research gjort. Fire design-docs styrer arbeidet (les i rekkefølge):
1. [docs/design-notes-chatgpt.md](design-notes-chatgpt.md) — ChatGPT-innspill + reality-check mot koden.
2. [docs/design-research-premium-ui.md](design-research-premium-ui.md) — skills/plugins/templates som referanse, IKKE kildekode. Kjerneregel: alt gjennom `src/theme/tokens.ts` + egne primitiver; ingen NativeWind/Expo/UI-bibliotek/template-kode; glass + Reanimated utsatt til egen native-økt.
3. [docs/home-feed-design-directions.md](home-feed-design-directions.md) — **VALGT: Retning A «Stadium Light»** (lyst, fresh, sosialt, litt varme fra B — IKKE mørkt stadium).
4. [docs/feedcard-reference-spec.md](feedcard-reference-spec.md) — FeedCard-spec + implementeringsrekkefølge (Diff 1 → Diff 2).

### Diff 1 — GJORT (tsc grønn, ingen review-funn)
Retnings-uavhengige forbedringer:
- `tokens.ts`: **la til** `heiaInk` (#047857, WCAG-trygg grønn til tekst/ikon — ~5.5:1 på hvit) og `surfaceMuted` (#F1F2F4, nøytral chip-flate).
- `Chip.tsx`: pastellfyll → **nøytral bg + farget aksent-prikk**; `live` beholder rødt (semantisk).
- Kontrast-fix rolle-pill `heia` (#02ffab) → `heiaInk`: i `FeedCard.tsx` **og** `ProfilScreen.tsx` «Trener»-badge (`heiaPressed`→`heiaInk`). #02ffab er nå kun FYLL, aldri tekst.

### Diff 2 — GJORT & VERIFISERT (tsc grønn, ingen review-funn, screenshots før/etter)
FeedCard proof-of-direction (`FeedCard.tsx`), + tokens:
- `tokens.ts`: **la til** `borderSubtle` (#EDEEF0) og `shadows.cardResting`. **⚠️ Cleanup (IKKE additivt): FJERNET `treningBg`/`kampBg`/`sosialtBg`** — pastell-bg-tokens som ble ubrukte da Chip/FeedCard gikk over til nøytral+prikk. Bevisst opprydding; bekreftet ubrukt + tsc grønn. `*Text`-variantene beholdt (brukes som prikkfarger).
- `FeedCard.tsx`: kort radius 12→24, rolig 1px `borderSubtle` + mykt `cardResting`-løft; betinget **type-markør** (kun `resultat`/`match_*`/`paaminnelse` — vanlig melding/bilde badges IKKE); betinget grønn **energy-rail** (kun `resultat`/`match_*`); større media (200→220h, radius 8→16); inline **ReactionBar** «👏 Heia / 💬 Kommenter». Match-minutt bevart («45′ KAMP»).

Screenshots: `docs/screenshots/` — `baseline-*`, `diff2-before-home.png`, `diff2-after-home.png`.

### ⚠️ Midlertidige/uferdige ting i Fase 1 (må håndteres)
- **Dev-seed/mock-feed er MIDLERTIDIG og MÅ FJERNES i Fase 2.** For å kunne se FeedCard visuelt (aktivt lag HAMKAM G12 har ekte Supabase-id men ingen mock-feed): `src/shared/mockData.ts` `devSeedFeed` (3 poster) + `__DEV__`-fallback i `getFeedForTeamSpace` (`src/data/teamData.ts`) som re-stempler dev-poster med aktivt teamSpaceId når ekte feed er tom. `__DEV__`-gated → lekker ikke til prod, men fjern helt når ekte feed kommer.
- **ReactionBar er PRESENTASJONS-ONLY.** «Heia»/«Kommenter» gjør ingenting. **Skal IKKE shippe som fake interaksjon** — krever ekte wiring (Fase 2) eller feature-flag/skjul før release.
- **Ekte match_event-poster (Fjellørn ts1) blir også restylet** av FeedCard-endringen (mister oransje matchBadge, får grønn rail+markør). Tilsiktet konsistens.
- **Bottom-nav-ikonene skal gjøres «mer premium» (form, ikke farge)** — brukerønske, eget punkt til senere nav-diff.

### Pre-existing changes før denne økten (IKKE del av Diff 1/2)
Følgende var allerede `M`/`??` i git ved sesjonsstart (Fase 0-arbeid) og må ikke forveksles med design-arbeidet: `package.json`, `package-lock.json`, `src/components/index.ts`, `src/context/OnboardingContext.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/TeamHomeScreen.tsx`, `src/shared/types.ts`, `src/components/InviteCodeCard.tsx`, `src/screens/InviteScreen.tsx`. `ProfilScreen.tsx` hadde en pre-existing «Inviter til laget»-ListRow — kun `roleBadgeTrenerText`-fargen er min Diff 1.

### Neste anbefalte steg (etter ny chat)
1. **Rydd Fase 0-tråd:** ubrukt `@react-native-clipboard/clipboard` (se under) + evt. commit av design-arbeidet.
2. **Vurder FeedCard-retningen bredt:** hvis godkjent, ekstraher `ReactionBar` til egen primitiv, og vurder samme kontrast-fix på `LiveMatchBanner`-score (stor grønn tekst på hvit — samme klasse-bug, flagget).
3. **Bred Home/feed-refaktor** på resten (TeamHeader, empty state, supportCard) i «Stadium Light».
4. **Så Fase 2 (ekte feed)** — som fjerner dev-seed/mock-fallback og wirer ReactionBar mot ekte data.

## Neste faser (godkjent plan)

- **Fase 2 — Ekte feed**: `src/lib/api/feed.ts` (get_team_feed, createTextPost, toggleReaction, evt. kommentarer), refaktorer `FeedCard` fra mock til ny `FeedPost`-type, koble TeamHome, fjern mock-feed. Bilde = Fase 2b (krever Supabase Storage-bucket + `react-native-image-picker`).
- **Fase 3 — Event/kamp**: `src/lib/api/events.ts`, ny RPC `create_event` (atomisk event + match_session for kamp), koble Kalender + EventDetail, `NewEventScreen`, lett RSVP. Events = innholdskilde + forutsetning for live kamp, IKKE Spond-tung RSVP.

---

## VIKTIGE LÆRDOMMER (ikke gjenta)

- **ALDRI kjør `pod install` eller andre lange native/build-kommandoer i bakgrunnen mens brukeren kjører appen.** Det skapte ressurskonflikt + tre Metro-instanser som slåss → app hang på «loading from Metro». Kjør slike kommandoer bevisst, i forgrunnen, når brukeren er klar, og forklar at rebuild trengs etterpå.
- **Claude kan ikke kjøre Metro for brukeren** (sandkassen binder ikke nettverksport → tom logg, server kommer ikke opp). **Brukeren kjører `npm start` i sin egen terminal** og lar den stå åpen. Første oppstart av RN 0.83 tar 1–2 min — ikke drep den.
- **RN 0.83 har ikke lenger innebygd Clipboard i core.** En knapp som kopierer krever native modul (pod install + rebuild). Uten den: bruk `<Text selectable>` (hold inne → kopier) — ingen native avhengighet.
- **Ikke referer en native modul som ikke er bygget inn** — `TurboModuleRegistry.getEnforcing('RNCClipboard')` krasjer ved import (og lazy-require hjalp ikke pålitelig). Fjern referansen helt.
- Miljø: Node v24, RN 0.83.1, Metro 0.83.3, ingen watchman, ingen node-version-manager.
