# S3c: Broadcast for feed, varsler og kampknappen — SOURCE OF TRUTH

Bygget 2026-09-01 etter S3b-mønsteret (skaleringsplan v2.1 §9 S3c). Fasit
for `feedBroadcastDecode.ts`, transportbryteren i `subscribeToFeed`,
`subscribeToTeamLive`, notif-bryteren i `NotificationsContext` og
poll-gaten `liveMatchPollMs`. Avvik mellom kode og dette dokumentet er en
bug i koden. Konvolutt- og dedupereglene (§1–§2 i
docs/S3B2-BROADCAST-DECODE.md) gjelder ordrett og bor nå i
`broadcastEnvelope.ts` — delt med match-dekoderen.

## 1. Transportbryterne

- `subscribeToFeed`: `realtime_transport.feed` ved subscribe. Broadcast →
  privat kanal `team:{teamSpaceId}`; pgc → dagens sti uendret under
  topicet `feed:{teamSpaceId}` (kolliderer aldri med `team:` — ingen
  prefiks-variant trengs).
- `NotificationsContext`: `realtime_transport.notif` ved subscribe.
  Broadcast → privat kanal `user:{userId}` VIA REGISTRYET (race-fiksen +
  sentinelene); pgc → dagens direktekanal `notifications:{userId}` uendret.
- `subscribeToTeamLive` (kampknappen): følger `feed`-flagget — `live`
  rir på team-kanalen. På pgc en ren no-op (pollingen består).
- Team-kanalens configure binder ALLE fire eventene (`feed_post`,
  `reaction`, `comment`, `live`) uansett hvilken lytter som kommer først —
  registryets configure settes av FØRSTE acquire per topic.

## 2. CHANNEL_READY: feeden emitter INGENTING (ulikt kampens §5)

Kampens fallback-emit finnes fordi første mottatte seq ikke kan være
baseline. Feeden har ingen seq-baseline, abonnementet er fokus-bundet, og
pgc har heller ingen emit ved første join — fetch→join-vinduet dekkes av
fokus-broens 60 s-regel, som i dag (pgc-paritet). En refetch her ville
kostet ett kall per fanebytte. Varsel-lytteren ignorerer også READY
(mount-effekten har alt hentet telleren). Kampknappens live-lytter mapper
READY → `refreshLiveMatchIfStale` (gratis ved boot pga 60 s-porten, lukker
gap etter lange rejoin-hull).

## 3. Dekodetabellen team-kanal → `FeedRealtimeEvent` (pgc-paritet)

| Event | op | Krav til `data` | Emit |
|---|---|---|---|
| `feed_post` | INSERT | — | `postNew`, men ingenting hvis `deleted_at` |
| `feed_post` | UPDATE | `id` | `{kind:'postUpdate', row}` ellers `fallback` |
| `feed_post` | annen op | — | `fallback` (triggeren er kun I/U — skjemadrift) |
| `reaction` | INSERT/DELETE | `feed_post_id` (streng) ellers `fallback` | `reaction` ±1 — MEN ingenting for eget ekko (`user_id === myUserId`) eller annen emoji enn 👏 |
| `reaction` | annen op | — | ingenting |
| `comment` | INSERT | `feed_post_id` ellers `fallback` | `commentDelta` +1 |
| `comment` | UPDATE m/ `deleted_at` | `feed_post_id` ellers `fallback` | `commentDelta` −1 |
| `comment` | UPDATE u/ / DELETE | — | ingenting (redigering/hard delete — pgc-paritet) |
| `live` | — | — | ingenting i feed-dekoderen (kampknappens lytter eier den) |
| ukjent event | — | — | ingenting (fremoverkompatibilitet) |

Ugyldig konvolutt → `fallback`; kjent `message_id` → stille dropp.

## 4. Kampknappen: `live` erstatter 60 s-pollingen

- `subscribeToTeamLive` i `MatchButtonContext` (alltid montert): `live`
  (dedupet på message_id, egen tilstand) → `invalidateLiveMatch`; resync →
  samme; READY → `refreshLiveMatchIfStale`. Payloaden appliseres ALDRI
  direkte — signalet er «hent fasit». Ugyldig konvolutt behandles derfor
  som `live`.
- `liveMatchPollMs(degraded)`: pgc eller degraded → 60 s som i dag;
  broadcast → `live_fallback_poll_s` sekunder (serverstyrt fallback-poll,
  0 = av — dagens serververdi). `staleTime` består på 60 s for begge
  (port, ikke utløser). matchNonce-sporet består uendret (dobbel
  invalidering ved kampvarsel er akseptert — samme som nonce+poll i dag).

## 5. Varsler: user-kanalen

00080-triggeren fyrer kun på INSERT og sender HELE raden som `data` (uten
`op`) — `handleInsertRow` er delt mellom stiene, så badge/nonces/banner er
transportblinde. Dedupe på message_id (statement-triggeren sender én
melding per mottaker; redelivery ville ellers talt +1 dobbelt). Ugyldig
konvolutt → `handleResync` (vi vet et varsel kom, ikke hva).
`membership_revoked` bindes ikke — konsumeres i en senere skive.

## 6. Feildisiplin (S3b §7 gjenbrukt)

CHANNEL_ERROR før første join → én retry med frisk kanal; andre → terminal:

- feed → pgc-stien under `feed:{teamSpaceId}` + ett `resync`-emit;
- varsler → pgc-kanalen `notifications:{userId}` + `handleResync`;
- kampknappen → `onDegraded` → 60 s-pollingen gjenopptas for økten
  (ingen pgc-tvilling for `live` finnes).

TIMED_OUT er transient (phoenix-rejoin + resync-handleren). Feed- og
live-lytteren deler fysisk kanal; ved join-nekt nedgraderer hver for seg
(retry-no-op-avgrensningen fra S3b §7 gjelder — andre JOIN_ERROR feller
avgjørelsen).

## 7. Porter før flipp av feed/notif-flaggene

1. Suite grønn (nye dekoder-/bryter-/poll-vakter + hele huset).
2. Fysisk telefontest med dev-override
   `setDevRealtimeTransportOverride({feed:'broadcast', notif:'broadcast'})`:
   post/HEIA/kommentar lander i feeden live, badge +1 på varsel,
   kampknappen oppdaterer seg på mål UTEN 60 s-ventetid,
   bakgrunn→forgrunn OK.
3. Eksplisitt godkjenning fra Brage. Flippen = én UPDATE per felt på
   `runtime_config` (kill-switch = én UPDATE tilbake; virker ved neste
   subscribe). `live_fallback_poll_s` kan settes uavhengig (f.eks. 300)
   som belte-og-bukse-poll under utrullingen.
