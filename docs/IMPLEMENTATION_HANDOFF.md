# IMPLEMENTATION_HANDOFF — Egress-/medie-/realtime-fundamentet

> Opprettet 7. aug 2026. Arkitekturplanen er **GODKJENT av Brage** (med én safeguard, se under).
> Fullt beslutningsgrunnlag: [EGRESS-MEDIA-ARKITEKTUR-2026-08.md](EGRESS-MEDIA-ARKITEKTUR-2026-08.md)
> (Del I = audit med fil:linje-bevis, Del II = beslutningene P1–P13, Del III = faseplan + exit-kriterier).
> **Fase A0 er BYGGET 2026-08-07** (netMetrics + skjermattribusjon + regresjonstester +
> [audit-observability.md](audit-observability.md) med Q1–Q7). Neste agent starter på **Fase A** —
> men A merges ikke før Brage har fylt ut baseline-rapporten (se «Neste agent starter med»).

## Hvorfor (én setning)

Supabase-egress er ~9,5 GB/uke med 78 MB lagret og 11 brukere (grace period, mulig HTTP 402 fra
5. sept 2026) fordi fire multiplikatorer ganges: nye signerte URL-er per henting (100 % cache-miss),
fulloppløste originaler uten varianter, realtime→full refetch, og alt-lastes-uansett-rendering.

## Rekkefølge og avhengigheter

1. **Fase A0 — baseline** ✅ KODE FERDIG 2026-08-07: `netMetrics`-interceptor i supabase.ts +
   skjermattribusjon + regresjonstestene (`__tests__/feedRefetch.test.tsx`, `__tests__/netMetrics.test.ts`,
   begge mutasjonstestet) + protokolldokumentet [audit-observability.md](audit-observability.md)
   (Q1–Q7, media-SQL, curl-test, brukerreise, rapportmal). Ingen adferdsendring. **GJENSTÅR: selve
   baseline-MÅLINGEN (Brage: dashboard-queriene + brukerreisen + rapportmalen). Baseline SKAL
   dokumenteres før A merges — den er beviset for effekten.**
2. **Fase A — stabilisering** (ingen native deps, ingen SQL; hver endring = egen skipbar commit):
   1. `src/lib/media/`-modul: `MediaRef` + resolver med signedUrlCache (TTL 24 t, AsyncStorage) +
      `MediaImage` (RN-Image-innmat + måling) → bytt de 6 bildeflatene (FeedCard, MatchPhotoRail,
      MatchPhotoGallery, MatchTimeline, MatchEventRow, CommentsScreen)
   2. Picker 2048 px/q0.85 i `media.ts` (kun `PICKER_OPTIONS`; logo-varianten finnes som mønster)
   3. `cacheControl: '86400'` (feed-media) / `'31536000'` (club-logos) i upload-kallene;
      bucket-limits (10 MiB/2 MiB + mime-typer) settes via dashboard/Management API — IKKE rå SQL
   4. Realtime-hygiene: debounce + splitt i EventDetailScreen, INSERT-gate i NotificationsContext,
      fokus-gating (Inbox/TeamHome/EventDetail), kanal-registry
   5. `getUserId()` (getSession-basert) erstatter alle 9 `auth.getUser()`-kallsteder (klassifisering i P5)
      + AppState-styrt startAutoRefresh/stopAutoRefresh
   6. Livssyklus: `clearLocalCaches()` i account.ts kalt fra signOut (fikser WelcomeIntent-lekkasjen);
      `invalidateMediaCache(paths)` i deletePost; memberships-resync ved AppState active + prefix-purge
   7. Backfill-script (kjøres lokalt av Brage, service-nøkkel + sharp): varianter for eksisterende media
      → **se safeguard**
3. **Fase B — launch-fundament** (starter først når A er verifisert stabil på TestFlight; 3 PR-er):
   B1 media (install-expo-modules/SDK 55 i testbranch → expo-image med `cacheKey=storage_path` →
   compressor-thumb → uploadAsync) → B2 data/rendering (TanStack Query, FlatList, paginering,
   events-vindu) → B3 realtime/sikkerhet (payload-kontrakten P6, 00059, P10-fikser, Sentry, CI).
   B2s bildedeler avhenger av B1; B3 kan gå parallelt.
4. **Fase C:** kun terskelstyrt (Del III) — ikke bygg noe.

## Låste beslutninger (ikke re-diskuter uten Brage)

- `feed-media` forblir **privat** — for alltid (barnebilder).
- Signed-URL-TTL **24 t**; cacheControl 24 t på privat media / 1 år på public logoer (kan ikke endres
  per objekt i etterkant — må være riktig ved upload).
- **MediaRef/path-kontrakten:** UI ser aldri leverandør-URL-er; kun path + variant via `MediaImage`.
- **2048 px/q0.85-master + 480-thumb** for nye opplastinger; ingen kameraoriginal lagres hos Heia (nye).
- **TanStack Query** i B (ikke håndrullet cache); **expo-image + expo-file-system (SDK 55) +
  react-native-compressor** (ikke fast-image/blob-util/bam-resizer — begrunnelse i P8).
- Realtime-kontrakten P6: payload-først, refetch er unntak; 1 mål = 0 bilde-nedlastinger.
- Sikkerhet P10 «må» før launch: storage-DELETE-policy, logo_url-validering, REVOKE anon på lese-RPC-er.

## ⚠️ SAFEGUARD (godkjent av Brage 7. aug 2026)

**Eksisterende kameraoriginaler i `feed-media` slettes IKKE automatisk** (heller ikke etter 30 dager).
Backfill genererer varianter og peker media-radene til dem, men originalobjektene beholdes gjennom A/B.
Permanent original-policy besluttes eksplisitt av Brage før launch, etter visuell TestFlight-validering
av 2048-masteren. Storage-kostnaden (~78 MB) er ubetydelig.

## Arbeidsregler (fra etablert praksis)

- Brage kjører selv Metro, `pod install` og typesjekk (aldri i bakgrunnen, aldri automatisk).
- PR-flyt: Brage-branch → PR → Brage merger selv. Oppdater STATUS-HANDOFF.md når en fase er ferdig.
- Exit-kriterier per fase står i Del III; launch-ready-kriteriene i P13. Effekt SKAL bevises med
  før/etter-tall (Del IV), ikke «det føles raskere».

## Neste agent starter med

Les [EGRESS-MEDIA-ARKITEKTUR-2026-08.md](EGRESS-MEDIA-ARKITEKTUR-2026-08.md) Del II–III, og implementer
**Fase A** (de 7 punktene over, hver = egen skipbar commit). A kan bygges mens Brage måler, men merges
først når baseline-rapporten i [audit-observability.md](audit-observability.md) er fylt ut.

**Brage kjører parallelt** (2 min + en kveldsøkt): Q1–Q7 + media-SQL + curl-testen i
[audit-observability.md](audit-observability.md) — Q3 (cf_cache_status) og media-SQL-en er de to som
beviser rotårsakene empirisk — pluss Usage→Bandwidth-avlesningen og den skriptede brukerreisen på
telefonen (dev-bygg, `netMetrics.dump()` i Metro-konsollen til slutt).
