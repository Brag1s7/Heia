# S3b-2: Broadcast-dekoderen for kampkanalen — SOURCE OF TRUTH

Vedtatt med Brages fire planjusteringer 2026-08-31. Dette dokumentet er
fasit for `src/lib/api/matchBroadcastDecode.ts` og transportbryteren i
`subscribeToMatch`. Avvik mellom kode og dette dokumentet er en bug i koden.

Bakgrunn: 00080/00081 (triggere + konvolutt + private join-policyer),
skaleringsplan v2.1 §9 S3b, S3b-1-beviset (WS-joins 12/12 mot prod).

## 0. Harde regler (arvet, LÅST)

- ALDRI manuell `realtime.setAuth` — supabase-js 2.100.1 vedlikeholder
  realtime-JWT selv; manuell setting skrur av automatikken.
- Registry-nøkkel = topic for begge transporter; transport avgjøres ved
  FØRSTE acquire (bibliotekets `channel(topic)`-dedupe ignorerer params).
  pgc-nødkanalen heter derfor `pgc:match:{sessionId}` — aldri samme topic.
- `runtime_config` står på pgc/pgc/pgc; ingen prod-adferd endres av S3b-2.
- pgc-stien beholdes bokstavelig uendret (dual-run);
  `eventDetailRefetch`-vaktene kjøres uendret som kontraktbevis.

## 1. Konvolutten (00080 §0.1-2, låst)

```
{v: 1, message_id: uuid, entity_id: uuid, seq: number | objekt,
 emitted_at: timestamptz, data: {…rad…, op: 'INSERT'|'UPDATE'|'DELETE'}}
```

Validering i dekoderen: konvolutten må være et objekt med `v === 1`,
`message_id` som streng og `data` som objekt. Alt annet (inkl. ukjent
fremtidig `v`) → `{kind: 'fallback'}` (debounced detalj-refetch — samme
sikkerhetsnett som pgc-stiens ufullstendige payloads).

## 2. Dedupe — KUN på message_id (planjustering 3)

- LRU på de siste 200 `message_id` per dekodetilstand (per registrering).
  Kjent id → hele meldingen droppes stille (transport-redelivery).
- 00081 garanterer unik `message_id` PER SEND — team-/match-speilene av
  samme rad har ulike id-er, så dedupen kan aldri spise speilet.
- `seq` brukes ALDRI til dedupe (se §3 — seq gjenbrukes lovlig).

## 3. seq-regler for `match_event` (planjustering 3)

`seq` = `match_events.sequence` (tall). Reglene:

- **Gap KUN ved INSERT med `seq > lastSeq + 1`** → emit `{kind: 'resync'}`
  (full resync; ingen delta-resync i v1 — planrevisjon 3 fra 2026-08-30).
  Selve raden appliseres ikke ved gap — resyncen henter alt.
- **seq-gjenbruk er lovlig og normalt:**
  - korrigering (00078) er UPDATE på plass — beholder sequence;
  - `sequence` regnes som `COALESCE(max,0)+1` over GJENVÆRENDE rader
    (00020), så etter en annullering (DELETE av høyeste) får neste INSERT
    samme seq-verdi på en NY id.
  - Derfor: INSERT med `seq <= lastSeq` er IKKE gap og IKKE duplikat —
    den appliseres.
- `lastSeq := max(lastSeq, seq)` etter HVER match_event (I/U/D) med
  numerisk seq. UPDATE/DELETE gap-sjekkes aldri (en DELETE for en ukjent
  rad fanges av skjermens applyMatchEventDelete → false → fallback-refetch).
- Baseline: `lastSeq` starter som null (ingen gap-dom på første hendelse).
  Fetch→subscribe-vinduet lukkes ikke av seq, men av fallback-emitten (§5).
- Ikke-numerisk seq på `match_event` = skjemadrift → `fallback`.

## 4. Dekodetabellen (broadcast-event → `MatchRealtimeEvent`)

Radvalidering er paritet med pgc-stiens vakter i `subscribeToMatch`
(events.ts): feiler den → `{kind: 'fallback'}`.

| Broadcast-event | op | Krav til `data` | Emit |
|---|---|---|---|
| `match_event` | INSERT | `id`, `type`, `minute !== undefined` | `{kind:'matchEvent', row: data}` (etter gap-sjekk §3) |
| `match_event` | UPDATE | samme | `{kind:'matchEventUpdate', row: data}` |
| `match_event` | DELETE | `id` | `{kind:'matchEventDelete', id: data.id}` |
| `match_event` | ukjent op | — | `fallback` |
| `session` | UPDATE (alltid) | `home_score !== undefined`, `away_score !== undefined`, `status` | `{kind:'session', row: data}` — med stale-vern §6 |
| `photo` | INSERT (alltid) | — | `{kind:'photo'}` **+ `{kind:'engagementPost'}` hvis `data.match_event_id`** |
| `engagement` | INSERT (alltid) | — | `{kind:'engagementPost'}` |
| `reaction` | INSERT | `feed_post_id` | `{kind:'reaction', postId, userId: data.user_id, delta: 1}` |
| `reaction` | DELETE | `feed_post_id` | samme med `delta: -1` |
| `comment` | INSERT | `feed_post_id` | `{kind:'commentDelta', postId, delta: 1}` |
| `comment` | UPDATE m/ `deleted_at` | `feed_post_id` | `{kind:'commentDelta', postId, delta: -1}` |
| `comment` | UPDATE u/ `deleted_at` | — | ingenting (redigering — pgc-paritet) |
| `comment` | DELETE | — | ingenting (hard delete ignoreres — pgc-paritet; soft-delete ER en UPDATE) |
| ukjent event-navn | — | — | ingenting (fremoverkompatibilitet: nye serverevents skal ikke knekke gamle klienter) |

**⚠️ Paritetsfellen photo/engagement:** pgc-stien emitter BÅDE `photo` og
`engagementPost` for et bilde festet til et mål (feed_posts-handleren,
events.ts). 00080-triggeren sender ENTEN `photo` ELLER `engagement`
(CASE på `type = 'bilde'`, 00080:294). Dekoderen MÅ derfor emitte begge
når `photo`-eventet bærer `match_event_id` — ellers kan det ferskeste
målet ikke heies på.

## 5. Fallback-emit ved første SUBSCRIBED (planrevisjon 2 fra 2026-08-30)

Hendelser mellom skjermens fetch-snapshot og kanalens join er tapt, og
første mottatte seq kan ikke være baseline alene. Registryet deler ut
`CHANNEL_READY` ved kanalens FØRSTE rene SUBSCRIBED; broadcast-lytteren
mapper den til `{kind: 'fallback'}` → skjermens debouncede
`scheduleEventRefetch` gir ett ferskt snapshot ved-eller-etter join.
Kostnad: én debounced RPC per broadcast-subscribe — korrekt state over
kalloptimalisering. Kommer joinen etter et frafall, deles CHANNEL_RESYNC
ut i stedet (aldri begge). pgc-lyttere ignorerer CHANNEL_READY —
pgc-atferden er uendret.

AKSEPTERT AVGRENSNING: fallback-emitten refetcher kun eventDetail —
bilder/engasjement i samme vindu dekkes av fokus-broen, som i dag
(pgc-paritet: pgc har INGEN emit ved første join). Skal ikke «fikses»
til trippel-invalidering — det gjeninnfører dobbelhentingen fra B2.

## 6. session-stale-vern

`session`-events sammenlignes på `data.updated_at` (Date.parse): eldre enn
sist appliserte → droppes stille (redelivery/omordning skal aldri rulle
stillingen tilbake). Lik eller nyere → appliseres, vannmerket oppdateres.
Uparserbar/manglende `updated_at` → appliser uten å røre vannmerket
(fail-open, paritet med pgc som ikke har vernet).

## 7. Terminal join-feil → pgc-nødkanalen (planjustering 4)

S3b-1-klassifiseringen: kun CHANNEL_ERROR er kandidat til terminal nekt;
TIMED_OUT er transient (dekkes av phoenix' egen rejoin + resync-handleren).

- Registryet deler ut `CHANNEL_JOIN_ERROR` per CHANNEL_ERROR FØR første
  SUBSCRIBED. Broadcast-lytteren teller:
  1. første → slipp + acquire på nytt = ÉN retry med FRISK kanal
     (race-fiksen i S3b-2a garanterer at re-acquire gir ny kanal);
  2. andre → terminal: slipp broadcast, subscribe pgc-grenen under topic
     `pgc:match:{sessionId}`, og emit `{kind: 'resync'}` én gang
     (broadcast kan ha mistet alt siden join-forsøket startet).
- Nedgraderingen skjer maks én gang per subscribe-livsløp og er lokal for
  denne skjermøkten — serverflagget røres ikke.
- Kjent avgrensning: med FLERE samtidige lyttere på samme registrering blir
  retry-steget en no-op (slipp/acquire om hverandre holder kanalen i live),
  men neste JOIN_ERROR gir uansett nedgradering. Fokus-gatingen gjør n=1
  til normaltilfellet.

## 8. Dev-override for fysisk test

`setDevRealtimeTransportOverride({match: 'broadcast'})` i runtimeConfig —
hard `__DEV__`-gate (no-op i release-bygg), overstyrer KUN lesingen i
klienten; serverraden røres ikke. Brukes til fysisk telefontest av
broadcast-stien mot prod (policyene ligger der; flåten står på pgc).
Kalles midlertidig fra App-bootstrap under testen; linjen committes aldri.

## 9. Porter før prod-flaggflipp (uendret fra godkjent plan)

1. Re-acquire-racen LUKKET med egen test (S3b-2a — gjort i denne skiva).
2. Fysisk telefontest: bakgrunn→forgrunn-sykluser på broadcast-stien.
3. Fysisk telefontest: gjennomlevd token-refresh med åpen kampskjerm.
4. Eksplisitt godkjenning fra Brage. Flippen = én UPDATE på runtime_config
   (kill-switch = én UPDATE tilbake; virker ved NESTE subscribe, ikke
   øyeblikkelig for en allerede åpen skjerm — blur/fokus roterer naturlig).
