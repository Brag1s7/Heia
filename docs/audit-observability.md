# Audit-observability — loggqueriene Q1–Q7 + baseline-protokollen (Fase A0)

> Opprettet 7. aug 2026 som del av Fase A0. Dette er «lag 3»-verktøyet i målemodellen
> (P9 i [EGRESS-MEDIA-ARKITEKTUR-2026-08.md](EGRESS-MEDIA-ARKITEKTUR-2026-08.md)):
> serverloggene er FASITEN for bytes — klienten (netMetrics, lag 1) teller kall,
> serverloggene beviser hvor egressen faktisk oppstår.
>
> **Baseline SKAL dokumenteres før Fase A merges** — den er beviset for effekten.
> Resultatene føres inn i rapportmalen nederst.

## Slik kjøres queriene

Supabase Dashboard → **Logs → Logs Explorer** → lim inn query → velg tidsrom.

> ✅ **Alle queriene under er kjørt og verifisert mot prosjektets faktiske edge_logs
> 2026-08-12** (via Management-API-et). Skjema, feltnavn og syntaks stemmer.

- **Tidsvindu ≤ 24 t.** Retensjonen på Free er 1 dag, og et vindu som starter utenfor
  den gir **stille 0 rader — ingen feilmelding** (verifisert: 25 t virker, 48 t gir 0).
  Kjør queriene en kveld etter at testflåten har brukt appen.
- `content_length` logges som streng (casten håndterer det), men er **null når svaret
  er chunked** (PostgREST chunker større REST-svar) og på 304-er. `mb_kjent` er altså et
  kjent MINIMUM — dårligst for REST, pålitelig for storage-200-er (bildene, som er poenget).
- `request.path` inneholder ALDRI query-strengen (tokenet ligger i `search`) — trygt å dele.

## Q1 — Egress-proxy per tjeneste

Plasserer trafikken: er det Storage (bilder), REST (data) eller Auth som dominerer?

```sql
select
  case
    when r.path like '/storage/%' then 'storage'
    when r.path like '/rest/%' then 'rest'
    when r.path like '/auth/%' then 'auth'
    when r.path like '/realtime/%' then 'realtime'
    when r.path like '/functions/%' then 'functions'
    else 'annet'
  end as tjeneste,
  count(*) as requests,
  round(sum(coalesce(cast(h.content_length as int64), 0)) / 1e6, 1) as mb_kjent
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as res
cross join unnest(res.headers) as h
group by 1
order by mb_kjent desc;
```

**Forventet funn (hypotesen):** storage ≫ alt annet.

## Q2 — Toppobjekter (uten token)

Hvilke konkrete filer koster mest? `path` er uten query, så ingen tokens i resultatet.
Filteret dekker BÅDE signerte objekter (`/object/sign/`, feed-media) og public
(`/object/public/`, club-logos) — logo-revalideringen (F3) er også egress.

```sql
select
  r.path,
  res.status_code,
  count(*) as hentinger,
  round(sum(coalesce(cast(h.content_length as int64), 0)) / 1e6, 1) as mb_kjent
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as res
cross join unnest(res.headers) as h
where r.path like '/storage/v1/object/%'
  and r.method = 'GET'
group by 1, 2
order by mb_kjent desc
limit 25;
```

**Forventet funn:** de samme fulloppløste originalene igjen og igjen — `hentinger ≫ 1`
per fil per dag er dobbeltnedlastingen i tall.

## Q3 — cf_cache_status-fordelingen (BEVISER/AVKREFTER H1) ⭐

H1: fordi hver henting får en NY signert URL (nytt token i query), nøkler CDN-en på
en URL den aldri har sett → ~100 % MISS. Dette er den viktigste enkeltqueryen.

```sql
select
  h.cf_cache_status,
  count(*) as requests,
  round(sum(coalesce(cast(h.content_length as int64), 0)) / 1e6, 1) as mb_kjent
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as res
cross join unnest(res.headers) as h
where r.path like '/storage/v1/object/%'
  and r.method = 'GET'
group by 1
order by requests desc;
```

**Tolkning:** MISS/EXPIRED ≫ HIT → H1 bekreftet (og fase A sitt URL-gjenbruk vil
snu det). HIT dominerer allerede → H1 avkreftet, og analysen må revideres FØR A bygges.

## Q4 — Repetisjon per klient per objekt per døgn

Hvor mange ganger laster SAMME klient SAMME bilde på en dag? (Målet etter A: ≈ 1.)

```sql
select
  rh.cf_connecting_ip as klient,
  r.path,
  count(*) as hentinger
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
cross join unnest(r.headers) as rh
where r.path like '/storage/v1/object/%'
  and r.method = 'GET'
group by 1, 2
having count(*) > 1
order by hentinger desc
limit 25;
```

**Forbehold:** IP er en grov klient-proxy (flere familiemedlemmer bak samme NAT
teller som én). Retningen er likevel entydig når tallene er 5–20× per dag.

## Q5 — Signeringsfrekvens per time

Hver `createSignedUrls`-batch er en POST mot sign-endepunktet. Realtime→refetch-stormen
(F17–F19) synes her som signeringstopper rundt kamper/aktivitet.

```sql
select
  timestamp_trunc(timestamp, hour) as time,
  count(*) as signeringer
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
where r.path like '/storage/v1/object/sign/%'
  and r.method = 'POST'
group by 1
order by 1;
```

## Q6 — REST/RPC: bytes + feilrate per endepunkt (avdekker H5)

H5: stille retry-/feilløkker bak de tause catch-blokkene. Feilrate > noen prosent på
ett endepunkt = en løkke som maler i det stille.

```sql
select
  r.path,
  count(*) as requests,
  round(sum(coalesce(cast(h.content_length as int64), 0)) / 1e6, 1) as mb_kjent,
  countif(res.status_code >= 400) as feil,
  round(100 * countif(res.status_code >= 400) / count(*), 1) as feilprosent
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
cross join unnest(m.response) as res
cross join unnest(res.headers) as h
where r.path like '/rest/%'
group by 1
order by requests desc
limit 25;
```

## Q7 — Døgnprofil

Når på døgnet skjer trafikken? (Kamphelg vs. hverdagskveld — og om noe går om natten,
er det en løkke, ikke en bruker.)

```sql
select
  extract(hour from timestamp) as time_paa_doegnet,
  count(*) as requests,
  round(sum(coalesce(cast(h.content_length as int64), 0)) / 1e6, 1) as mb_kjent
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.response) as res
cross join unnest(res.headers) as h
group by 1
order by 1;
```

## Media-SQL (SQL Editor — bekrefter H2: reell filstørrelse + HEIC)

```sql
select count(*) as antall,
       round(avg(size_bytes) / 1e6, 2) as snitt_mb,
       round(max(size_bytes) / 1e6, 2) as maks_mb,
       round(avg(width)) as snitt_bredde,
       mime_type
from media
where deleted_at is null
group by mime_type;
```

## curl-testen — Cache-Control på signerte URL-er (#21926-usikkerheten)

Usikkerheten: respekteres `cacheControl` satt ved upload når objektet leses via signert
URL, og cacher CDN-en i det hele tatt på tvers av tokens? Kjør lokalt (service-nøkkelen
skal ALDRI inn i appen):

```bash
# 1. Finn en storage_path (SQL Editor):
#    select storage_path from media where deleted_at is null limit 1;

# 2. Signér:
curl -s -X POST "$SUPABASE_URL/storage/v1/object/sign/feed-media/<storage_path>" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 3600}'
# → {"signedURL":"/object/sign/feed-media/…?token=…"}

# 3. HEAD to ganger på rad mot samme signerte URL:
curl -sI "$SUPABASE_URL/storage/v1<signedURL>" | grep -i 'cache-control\|cf-cache-status\|age'
curl -sI "$SUPABASE_URL/storage/v1<signedURL>" | grep -i 'cache-control\|cf-cache-status\|age'
```

**Les av:** (a) hvilken `cache-control` som faktisk sendes, (b) om kall nr. 2 gir
`cf-cache-status: HIT` (samme token). Signér deretter samme path på nytt og hent igjen —
gir det nye tokenet MISS, er H1 bekreftet også eksperimentelt.

## Usage → Bandwidth

Settings → Usage → Bandwidth for perioden: noter splitten per tjeneste og forholdet
cached/uncached. (Del V punkt 1 — plasserer totalene endelig.)

## Skriptet brukerreise (lag 1 — netMetrics)

Kjøres på fysisk iPhone. **Dev-bygg for kalltallene** (netMetrics-loggen leses i
Metro-konsollen); tid-til-innhold tas med stoppeklokke nå og instrumenteres ordentlig
i fase A (MediaImage). Bytes kommer uansett fra serverloggene over — de tre lagene
måler hver sin ting.

1. Kaldstart → vent til feeden står. Noter `(oppstart)`- og `TeamHome`-linjene.
2. Scroll feeden til bunns, og tilbake til toppen.
3. Åpne en kamp (EventDetail) med bilder, gå tilbake.
4. Livekamp-scenario hvis mulig: la en annen klient registrere 3 mål; noter kall per mål.
5. Åpne Kalender, deretter Varsler, deretter Profil.
6. Gå tilbake til Hjem og scroll feeden EN gang til (repetisjonstesten).
7. Skriv `netMetrics.dump()` i Metro/JS-konsollen og lim resultatet inn under.

## Baseline-rapport (fylles ut FØR fase A merges)

| Måling | Kilde | Baseline (dato: ____) | Etter A | Etter B |
|---|---|---|---|---|
| Kall per feedåpning | netMetrics / feedRefetch-testen | 2 rpc + 2 events + 1 kanal (målt i test 7. aug) + ___ i praksis | | |
| Bytes per feedåpning | Q2/Q3 (server) | | | |
| cf_cache_status HIT-andel | Q3 | | | |
| Repetisjon per objekt per klient per døgn | Q4 | | | |
| Signeringer per time (topp) | Q5 | | | |
| Kall per mål per tilskuer | netMetrics under livekamp | | | |
| REST-feilrate | Q6 | | | |
| Egress per dag | Usage | ~1,2 GB (estimert i audit) | | |
| Cached vs. uncached | Usage | 1 : 2,7 | | |
| Tid til første feed-innhold | stoppeklokke (A0) / MediaImage (A) | | | |
| Cache-Control på signert URL | curl-testen | | | |

**Q1–Q7-resultater (lim inn under hver):**

### Q1
### Q2
### Q3 (H1: bekreftet / avkreftet)
### Q4
### Q5
### Q6 (H5: bekreftet / avkreftet)
### Q7
### Media-SQL (H2)

**Kjørt 2026-08-12 (verifiseringen av queriene) — H2 BEKREFTET:**

| mime_type | antall | snitt MB | maks MB | snitt bredde |
|---|---|---|---|---|
| image/jpg | 33 | 2,40 | 4,85 | 3588 px |
| image/png | 4 | 4,39 | 7,09 | 1140 px |

Fulloppløste kameraoriginaler (~12 MP, snitt 2,4 MB) ligger i `feed-media`, nøyaktig
som auditen antok. 2048-masteren (fase A) er ~0,3–0,5 MB — ~6× mindre per visning.

### curl-testen
