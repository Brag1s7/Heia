# Heia: Egress-, medie- og ytelsesaudit + arkitekturplan

> Read-only audit gjennomført 7. aug 2026. Metode: 8 parallelle kartleggingsagenter (undersøkelse A–G)
> + 7 adversarielle verifiseringsagenter (5 CONFIRMED, 2 CORRECTED på detaljnivå, 0 REFUTED)
> + manuell kontrollesing av kjernefilene + verifisering av Supabase-fakta og bibliotek-økosystem mot
> kilder 7. aug 2026.
>
> **STATUS: GODKJENT av Brage 7. aug 2026, med én safeguard:** eksisterende kameraoriginaler i
> `feed-media` slettes IKKE automatisk etter backfill. Legacy-originalene beholdes gjennom A/B mens
> 2048-masteren TestFlight-valideres visuelt; permanent original-policy besluttes eksplisitt før launch.
> (P2-beslutningen gjelder fullt ut for NYE opplastinger.) Implementering ikke startet.

## Kontekst

Supabase-organisasjonen er over egresskvoten andre billing cycle på rad og i grace period
(mulig HTTP 402-begrensning fra 5. september 2026). Beviste tall (30. juli–7. aug):

- Uncached egress: **6,97 GB** / 5 GB kvote — Cached egress: 2,54 GB / 5 GB — totalt ~9,5 GB på ~1 uke
- Storage: **78 MB** — Database: 32 MB — MAU: **11** — Edge invocations: 285 — Realtime: 3 353 meldinger, peak 4 tilkoblinger
- Misforhold: hvert lagrede byte er sendt ut **~90 ganger** på én uke. Appen oppleves samtidig tidvis treg.

---

## 1. Executive summary

**Hva som skjer:** Egressen er ikke mystisk — den er et produkt av fire multiplikatorer som alle er
bevist i koden, og som ganges med hverandre:

1. **Bildene er fulloppløste originaler** (2–6 MB, 12 MP) fordi pickeren aldri resizer lagbilder
   ([media.ts:13-17](src/lib/media.ts#L13-L17)) og ingen thumbnails genereres (feltet `thumbnail_path`
   finnes i DB og RPC, men skrives/leses aldri). Faktor **~20×** mot en fornuftig visningsvariant.
2. **Hver henting genererer nye signerte URL-er** med nytt token
   ([feed.ts:155-157](src/lib/api/feed.ts#L155-L157), [feed.ts:449-452](src/lib/api/feed.ts#L449-L452),
   [comments.ts:91-94](src/lib/api/comments.ts#L91-L94)). RN `Image` og Supabase-CDN nøkler cache på hele
   URL-en inkl. `?token=` → **100 % cache-miss i begge lag, hver gang**. Dette gjør enhver refetch til full
   re-nedlasting og forklarer direkte at *uncached* (6,97 GB) > *cached* (2,54 GB).
3. **Realtime trigger full refetch i stedet for kirurgisk oppdatering.** `reactions`/`comments` abonneres
   ufiltrert; én 👏 hvor som helst → 9 HTTP-kall + re-signering av hele feeden. Ett mål i livekamp → 3
   meldinger uten debounce → alle kampbilder re-signeres og re-lastes **3×** per tilskuer. Faktor **× antall hendelser**.
4. **Alle bilder lastes uansett scroll** (ScrollView + `.map()`, ingen virtualisering) og skjermer i
   bakgrunnsstacks fortsetter å refetche (abonnementer er montert-, ikke fokusbundet).

**Sikkerhet i konklusjonen:** Høy. Mekanismene 1–4 er FAKTA (lest i kode, adversarielt verifisert).
At CDN-en nøkler på token-query er en sterk inferens som bør bekreftes med én loggquery (Q3, seksjon 17),
men regnestykket går opp uavhengig: 20 poster × ~3 MB ≈ 60 MB per feed-load → 6,97 GB ≈ ~116 fulle
feed-loads/uke — lavt anslått med 11 brukere og realtime-refetch.

**Egress og treghet har i hovedsak samme rotårsak** (2+3: hver refetch laster megabytes på nytt og
re-dekoder 12 MP-bilder à ~48 MB RAM), men tregheten har i tillegg to egne årsaker som ikke gir egress:
en **sekvensiell boot-kjede** (3–4 serielle rundturer før navigasjonen i det hele tatt monteres, bl.a.
unødvendige `auth.getUser()`-nettverkskall) og et **to-runders vannfall** på kampsiden. Ingen bevis for
Supabase-throttling ble funnet (og ingen klientlogging finnes som kunne vist 402/retries — appen har
bokstavelig talt null console-kall).

**Mest kritisk:** Fristen 5. september. En liten, trygg «akutt-PR» (nivå A) fjerner anslagsvis **90–95 %**
av egressen uten arkitekturendring: resize ved opplasting, stabile/gjenbrukte signerte URL-er,
debounce + lettere realtime-refetch, fokus-gating. **`feed-media` skal forbli privat** — å gjøre
barnebilder offentlige er den fristende, men uakseptable «fiksen».

**Anbefaling i én setning:** Gjør nivå A umiddelbart (én PR, lav risiko), bygg nivå B (variantpipeline med
thumb/display på klient, signed-URL-cache med lang TTL, kirurgisk realtime, FlatList, instrumentering) før
lansering, og utsett alt av eksterne CDN-/medietjenester til målbare terskler krysses (nivå C).

---

## 2. Bekreftede funn (kun FAKTA, verifisert i kode)

**Medieflyt (A):**
- F1. Feed-/kampbilder lastes opp i full originaloppløsning — `PICKER_OPTIONS` mangler
  `maxWidth`/`maxHeight`/`quality` ([media.ts:13-17](src/lib/media.ts#L13-L17)). Kun logoer resizes (512 px,
  [media.ts:21-25](src/lib/media.ts#L21-L25)) — kommentaren «P4-regelen: resize i pickeren» viser at regelen
  finnes, men aldri ble anvendt på volum-stien. Verifikator bekreftet: ingen kompenserende resize/transform
  finnes noe sted nedstrøms; `config.toml:121-123` har image transformation utkommentert.
- F2. Ingen thumbnails: `thumbnail_path` finnes i skjema (00010:23) og returneres av `get_team_feed`
  (00029:80), men skrives aldri og leses aldri — klienten plukker kun `storage_path`
  ([feed.ts:149-152](src/lib/api/feed.ts#L149-L152)). Samme original rendres i 96×96 pt rail
  ([MatchPhotoRail.tsx:38](src/components/MatchPhotoRail.tsx#L38)), 210 pt feedkort
  ([FeedCard.tsx:173-177](src/components/FeedCard.tsx#L173-L177)), 180 pt tidslinje/kommentar, og fullskjerm.
- F3. Upload setter ikke `cacheControl` ([feed.ts:60-65](src/lib/api/feed.ts#L60-L65)) → default
  `max-age=3600`, enda filnavnene er unike/immutable ([feed.ts:55-58](src/lib/api/feed.ts#L55-L58)).
  Gjelder også logoer ([teams.ts:228-233](src/lib/api/teams.ts#L228-L233)) — den ene *public* bucketen som
  kunne hatt CDN-nytte revalideres hver time (sannsynlig hovedkilde til de 2,54 GB cached).
- F4. To buckets: `feed-media` **privat** (00018:15-17, riktig!) og `club-logos` **public** (00034:42-43).
  Ingen av dem har `file_size_limit` eller `allowed_mime_types` → global 50 MiB-grense gjelder.
- F5. Avatarer finnes ikke i praksis (ingen opplastingsflyt; `avatar_url` skrives aldri) — 0 byte egress i dag.

**URL-livssyklus (B):**
- F6. Tre uavhengige signeringspunkter for samme fysiske objekt: `getTeamFeed`
  ([feed.ts:155](src/lib/api/feed.ts#L155)), `getMatchPhotos` ([feed.ts:449-452](src/lib/api/feed.ts#L449-L452)),
  `getFeedPost` ([comments.ts:91-94](src/lib/api/comments.ts#L91-L94)) — alle med TTL 3600 s, alle kalt ved hver
  henting, ingen deling. Samme kampbilde lastes ned minst 3 ganger på en normal brukerreise.
- F7. Ingen signed-URL-cache eksisterer: ingen modul-cache, ingen state-deling, ingen AsyncStorage-persistering.
  De eneste cachene i appen er tre trivielle (sports-liste + to booleans). Kodekommentaren
  [feed.ts:13](src/lib/api/feed.ts#L13) («Signerte URL-er utløper — greit, fordi feeden refetches») viser at
  konsekvensen var usett. Kontrast: [teams.ts:216](src/lib/api/teams.ts#L216) («RN-Image cacher per URL, så en
  byttet logo MÅ få ny URL») beviser at URL-som-cachenøkkel-mekanikken er forstått — bare ikke overført til feed-media.
- F8. Navigasjon sender kun ID-er (`navigate('Comments', {postId})`), så hver skjerm signerer på nytt selv om
  forrige skjerm hadde en gyldig URL i minnet.

**RN-bilder og lokal cache (C):**
- F9. Alle remote-bilder bruker RN core `Image`; ingen FastImage/expo-image, ingen `Image.prefetch`, ingen
  `onLoad`/`onLoadEnd` noe sted; kun 3 logo-`onError`. Ingen persistent lokal cache av noe slag (AsyncStorage
  brukes kun til auth-session).
- F10. Feeden er ScrollView + `feed.map()` ([TeamHomeScreen.tsx:433, 584](src/screens/TeamHomeScreen.tsx#L584)) —
  alle ~20 kort mountes og alle bilder lastes umiddelbart. `MatchPhotoGallery` mounter alle fullskjermbilder
  samtidig ([MatchPhotoGallery.tsx:69-77](src/components/MatchPhotoGallery.tsx#L69-L77)).
  `React.memo` brukes ett sted i hele appen; inline-callbacks bryter uansett memoisering.
- F11. Ved hver refetch byttes `imageUrl`-prop (nytt token) → RN behandler det som nytt bilde: ny nedlasting,
  ny decode (12 MP ≈ 48 MB RGBA), synlig «blink». Egress- og jank-kostnad i samme mekanisme.

**Datahenting (D):**
- F12. Én `loadFeed()` = **9 HTTP-forespørsler** ([TeamHomeScreen.tsx:167-204](src/screens/TeamHomeScreen.tsx#L167-L204)):
  get_team_feed + createSignedUrls + auth.getUser + reactions-select + events (uten limit!) + auth.getUser
  + event_rsvps + live-select + support-RPC. To av kjedene er interne sekvensielle vannfall.
- F13. `getTeamEvents` henter **hele lagets historikk uten limit/datofilter + alle RSVP-rader**
  ([events.ts:167-188](src/lib/api/events.ts#L167-L188)) — for å vise 3 kort på Hjem. Kalenderen kaller samme
  funksjon ved **hvert fanefokus** ([KalenderScreen.tsx:179-184](src/screens/KalenderScreen.tsx#L179-L184));
  `HISTORY_DAYS`-vinduet er ren klientside-filtrering av allerede nedlastede data. `get_team_feed` har en
  cursor-parameter for paginering som klienten aldri sender.
- F14. `supabase.auth.getUser()` er en **nettverksrunde** (GET /auth/v1/user) og prefikser mange kall
  ([profile.ts:19](src/lib/api/profile.ts#L19), [teams.ts:72](src/lib/api/teams.ts#L72),
  [feed.ts:176](src/lib/api/feed.ts#L176), [events.ts:127](src/lib/api/events.ts#L127) m.fl.) — sekvensielt
  FØR dataspørringen. Boot-kritisk sti: getSession → getUser → select ×2 kjeder, og NavigationContainer
  monteres ikke før alt er ferdig ([AppNavigator.tsx:449-458](src/navigation/AppNavigator.tsx#L449-L458)).
- F15. CommentsScreen: medlemslisten hentes 2× per tråd-åpning ([comments.ts:9-14](src/lib/api/comments.ts#L9-L14)
  kalt fra både getFeedPost og getComments), og hele lasten (inkl. ny bildesignering) kjøres på nytt etter hver
  sendte/slettede kommentar. `getUserMemberships` bruker nøstet `select('*')` i 4 nivåer
  ([teams.ts:77-94](src/lib/api/teams.ts#L77-L94)).
- F16. InboxScreen refetcher topp-50 varsler + livekamp **per realtime-melding**, uten debounce, via `useEffect`
  (ikke fokusbundet) ([InboxScreen.tsx:96-100](src/screens/InboxScreen.tsx#L96-L100)). Ulest-telleren hentes fra
  7 uavhengige triggere; fanebytte gir to identiske count-spørringer. `markAllAsRead` → N rader → N meldinger →
  N inbox-reloads (sjekken `eventType !== 'INSERT'` kommer ETTER refetch-kallene,
  [NotificationsContext.tsx:135-140](src/context/NotificationsContext.tsx#L135)).

**Realtime (E):**
- F17. `subscribeToFeed` abonnerer **ufiltrert** på `reactions` og `comments`
  ([feed.ts:270-279](src/lib/api/feed.ts#L270-L279)) — de har ingen team_space_id-kolonne å filtrere på
  (dokumentert i kodekommentar). Callback → full `loadFeed` (400 ms debounce). Egen 👏 er allerede optimistisk
  oppdatert, men trigges likevel tilbake til full refetch.
- F18. `subscribeToMatch` lytter på 3 tabeller; `report_match_event` skriver alle 3 i én transaksjon → **3
  meldinger per mål**; handleren har **ingen debounce** og kaller `loadEvent()` + `loadPhotos()`
  ([EventDetailScreen.tsx:321-328](src/screens/EventDetailScreen.tsx#L321-L328)) → alle kampbilder re-signeres
  og re-lastes 3× per mål per tilskuer. Reporteren gjør i tillegg egen eksplisitt refetch.
- F19. Abonnementene er montert-, ikke fokusbundet: TeamHome refetcher i bakgrunnen bak kampsiden
  ([TeamHomeScreen.tsx:215-226](src/screens/TeamHomeScreen.tsx#L215-L226) er `useEffect`; tabs har ingen
  unmountOnBlur), og EventDetail er registrert i **3 stacks** (AppNavigator 147/168/186) → to monterte instanser
  av samme kamp gir dobbel kanal og 12 lastekall per mål. Opprydding ved unmount er derimot korrekt overalt.
- F20. Ingen `.subscribe()`-statushåndtering, ingen reconnect-/resume-resync → etter bakgrunn kommer brukeren
  tilbake til frossen stilling (en del av «henger etter»-opplevelsen). Meldingsvolumet i seg selv (3 353) er
  IKKE problemet — forsterkningen per melding er (~19 HTTP-kall per målhendelse per klient).

**Backend (migrasjoner/policies/functions):**
- F21. Edge Functions er ikke egress-driver (285 kall × få KB < 1 MB totalt). push-fanout sender ren tekst.
- F22. Storage-DELETE-policyen lar **ethvert lagmedlem slette alle lagets filer** (00018:36), mens DB-siden
  begrenser soft-delete til opplaster/admin (00014:274) — inkonsistent, gir «hull i feeden» uten spor.
- F23. `club-logos` SELECT-policy mangler `TO`-klausul (00036:19) → anon kan liste mappenavn
  (club_id/team_space_id-UUID-er). `team_spaces.logo_url` kan settes til vilkårlig ekstern URL (ingen validering,
  i motsetning til klubblogo) — sporingspiksel-vektor, eksponert via `lookup_invite_code` til anon.
- F24. Manglende indekser: `feed_posts(event_id)` (get_match_photos gjør seq scan — kampbildeskjermen!),
  `notifications(source_entity_type, source_entity_id)` (cron skanner hvert 10. min). Den lovede
  storage-oppryddingsjobben («background job cleans up after 7 days», 00010:9) finnes ikke.
- F25. RLS-designet for media er **solid**: privat bucket, path = `{team_space_id}/…`, `is_team_member` på første
  segment, index-only scan via `idx_memberships_user_active`. `get_team_feed` er SECURITY DEFINER med egen vakt.

**Observerbarhet (G):**
- F26. **Null** console-kall i src/ (28 532 linjer), ingen fetch-interceptor, ingen timing, ingen analytics/
  crash-rapportering/ErrorBoundary, 57 bevisst stille catch-blokker, ingen CI. Ingen test kan fange en
  refetch-regresjon (Supabase mockes ikke; testene dekker kun rene funksjoner i src/shared/).
- F27. Bildenedlasting går gjennom nativelaget (NSURLSession/Fresco), ikke JS-fetch — en fetch-interceptor kan
  telle *signeringer*, men aldri *bildebytes*. Bytes må bevises fra Supabase-loggen; appen kan måle antall og
  repetisjon via `onLoadEnd` nøklet på path uten token.

## 3. Hypoteser som ikke er bevist (og hva som mangler)

- H1. **CDN-en nøkler cache på token-query** (svært sannsynlig; forklarer uncached > cached). Bevis: loggquery
  Q3 (cf_cache_status-fordeling) i seksjon 17.
- H2. **Reell snittstørrelse per bilde 2–4 MB og evt. HEIC i bucketen.** Bevis: SQL mot `media`-tabellen
  (seksjon 17) — `size_bytes`/`width`/`mime_type` lagres allerede.
- H3. **NSURLCache ville uansett nektet å diskcache 3 MB-responser** (~5 %-av-kapasitet-regelen). Ikke målbart
  fra repoet (native-config utenfor lesemandat); irrelevant etter fiks (varianter blir 100–500 kB).
- H4. **DELETE-events på `reactions` broadcastes uten RLS-filtrering** (uten REPLICA IDENTITY FULL har
  old_record kun PK) → un-heia hvor som helst kan trigge refetch hos alle tilkoblede klienter på tvers av lag.
  Bevis: test med to konti i ulike lag.
- H5. **Stille retry-/feilløkker** bak de 57 tause catch-blokkene. Bevis: Q6 (status_code ≥ 400 per endepunkt).
- H6. **Simulator/dev-modus bidrar til opplevd treghet** (Metro, ingen release-optimalisering) — udokumenterbart
  uten måling på fysisk enhet i release-modus; mekanismene over finnes uansett i produksjon.
- H7. **`.in('event_id', […])`-URL-en sprenger 8 KB-grensen** ved ~200+ hendelser → 414-feil i kalender/hjem.
  Bevis: telle events i prod, eller vente (dårlig plan).
- H8. **Ingen throttling fra Supabase i dag.** Ingen bevis for 402/429 finnes — men ingen logging finnes som
  kunne vist det. Grace period-datoen (5. sept) er den reelle risikoen.

## 4. Rotårsaker rangert

| # | Rotårsak | Sannsynlighet | Konsekvens | Bevis | Verifisering |
|---|---|---|---|---|---|
| 1 | Ny signert URL per henting → 100 % cache-miss (F6–F8) | Meget høy | Gjør ALT annet til full re-nedlasting; hovedmotor | FAKTA (kode) + H1 (CDN) | Q3/Q4-logg, 5 min |
| 2 | Fulloppløste originaler uten varianter (F1–F2) | Meget høy | ~20× byte-kostnad per visning + 48 MB decode/jank | FAKTA | SQL mot media-tabellen |
| 3 | Realtime → full refetch, udebouncet på kamp, ufiltrert på feed (F17–F19) | Meget høy | ×3 per mål, ×1 per 👏/kommentar; skalerer kvadratisk med følgere | FAKTA | Q5 (signeringsfrekvens) |
| 4 | Ingen virtualisering; alle bilder lastes uansett scroll (F10) | Høy | 20 bilder per load i stedet for ~4 synlige | FAKTA | — |
| 5 | Bakgrunnsskjermer refetcher (F19, F16) | Høy | Dobler/tripler kostnad per hendelse | FAKTA | — |
| 6 | Overhenting i queries (F12–F15) | Høy | DB-egress + opplevd treghet (~260 KB per kalenderfokus osv.) | FAKTA | Q6 |
| 7 | Sekvensiell boot + auth.getUser()-rundturer (F14) | Høy | 0,6–1 s+ ren ventetid ved kaldstart (treghet, ikke egress) | FAKTA | måling |
| 8 | cacheControl=3600 på immutable objekter (F3) | Sikker | Del av cached egress; logo-revalidering | FAKTA | Q3 med cache_control |
| 9 | Edge/Auth/Realtime-bytes som egress-kilde | Lav | Neglisjerbart (F21) | FAKTA | Usage-split |

## 5. Dagens arkitektur (slik den faktisk er)

**Medieflyt:** Kamera/bibliotek → `pickTeamImage` (ingen resize, base64 over bridgen) → `uploadTeamImage` →
privat `feed-media/{team_space_id}/{ts}-{rand}.{ext}` (ingen cacheControl) + `media`-rad (sti, aldri URL;
`thumbnail_path` alltid NULL) → lesing via tre uavhengige `createSignedUrls`-punkter med 1 t TTL → RN `Image`
uten cache-lag. Logoer: resize 512 px → public `club-logos` → `getPublicUrl` (stabil URL — eneste cachebare).
Sletting: best-effort `remove()`; ingen oppryddingsjobb; opplasting er ikke-atomisk (foreldreløse filer mulig).

**Dataflyt:** Håndrullet, ingen query-cache. Boot: sekvensiell kjede session→profil→memberships→gate før
navigasjonen monteres. Hjem: `loadFeed` = 9 kall. Kamp: 2 serielle runder (event → medlemmer/bilder/turnering).
Kalender: full historikk per fanefokus. Inbox: full reload per varsel. Ingen deling av data mellom skjermer.

**URL-livssyklus:** Signert per henting, aldri cachet, aldri gjenbrukt, utløp håndteres ikke (ingen onError).

**Caching:** Ingen — verken bilder, queries eller URL-er (tre trivielle unntak). RN-Image-cachen finnes,
men treffes aldri pga. token-rotasjonen.

**Realtime:** 3 kanaler (match/feed/notifications). Alle handlere = full refetch. Feed-kanalen ufiltrert på
reactions/comments. Kamp-kanalen udebouncet. Montert-bundet, ikke fokusbundet. Ingen resync ved resume.

## 6. Konkrete kodefunn

Se F1–F27 i seksjon 2 — hvert funn har fil, linje og mekanisme, og de 7 viktigste er adversarielt verifisert
av uavhengige agenter som aktivt forsøkte å avkrefte dem (alle overlevde; to fikk presisert linjenummer/omfang:
rail-thumbs signeres i `getMatchPhotos` [feed.ts:449-452], ikke :151; feed-map ligger på :584, ikke :583).
Fullstendige områderapporter med kodeutdrag ligger i scratchpad (`audit-*.md`) og kan limes inn i docs/ ved behov.

## 7. Hvor egressen sannsynligvis oppstår

| Kilde | Andel (estimat) | Begrunnelse |
|---|---|---|
| **Storage uncached** (feed-/kampbilder, token-roterte signerte URL-er) | **~85–90 %** av 6,97 GB | 60 MB per full feed-load × ~116 loads; kampfotos ×3 per mål |
| **Storage cached** (logoer med max-age=3600 + gjentatte signerte treff innen samme time) | mesteparten av 2,54 GB | stabile logo-URL-er revalideres hver time på mange flater |
| **Database/API** (get_team_feed, events+rsvps uten limit, inbox-reloads, memberships `select('*')`) | ~5–10 % | payloads 10–260 KB, men høy frekvens |
| **Auth** (getUser-rundturer) | liten i bytes, stor i antall | ~2× kall-antall |
| **Realtime** | neglisjerbar | 3 353 små meldinger |
| **Edge Functions** | neglisjerbar | < 1 MB totalt (F21) |

Bekreftes endelig med Usage → Bandwidth-splitten (seksjon 17, 2 minutters jobb).

## 8. Hva som sannsynligvis gjør appen treg

1. **Nettverk (kaldstart):** 3–4 sekvensielle rundturer før navigasjonen monteres (F14) — 0,6–1 s+ på 4G.
2. **Nettverk (kampside):** to-runders vannfall (F12/D1-2.1) før siden er komplett.
3. **Bilder:** hver refetch → nye URL-er → re-nedlasting av megabytes + re-decode (12 MP ≈ 48 MB RAM per
   bilde; galleri = N samtidige decodes; samme foto dekodes 2× i to størrelser på ferdigspilte kamper) → jank,
   blinking, minnetrykk på eldre enheter.
4. **Refetch-stormer:** hver 👏/kommentar/mål river innhold ned og opp igjen; Inbox reloader per varsel.
5. **Opplasting:** base64 over bridgen (10–15 MB toppminne) → frys rundt «Legg ut».
6. **Rendering:** 20 umemoiserte kort re-rendres ved hver state-endring (inkl. tastetrykk i compose-feltet).
7. **«Henger etter»:** ingen resume-resync etter bakgrunn (F20) — oppleves som treghet, er egentlig stale data.
8. **Dev-miljø (H6):** kan forsterke alt over, men mekanismene finnes i produksjon.

## 9. Sikkerhetsanalyse

- **`feed-media` MÅ forbli privat.** Bilder av identifiserbare mindreårige; public bucket = permanent
  utilbakekallelig eksponering (GDPR art. 8; team_space_id lekker allerede via invite-flyt, og «Anyone can
  view»-listefeilen fra club-logos viser hvor lett listing åpnes ved et uhell). Dagens RLS-design (F25) er
  riktig og beholdes. Egress løses med varianter + URL-gjenbruk + cache — ikke med å åpne bucketen.
- **Signert-URL-TTL:** 1 t i dag. Lengre TTL (12–24 t) øker lekkasjevinduet for en delt URL marginalt —
  akseptabelt fordi URL-ene aldri lagres/deles utenfor appminnet og RLS fortsatt gate-er nye signeringer.
  7 døgn er unødvendig langt. Anbefalt: 24 t med refresh ved `onError`/utløpssjekk.
- **Lokal diskcache av bilder** (nivå B) er kryptert av iOS file protection som resten av appens sandbox;
  akseptabelt for formålet. Cachen skal ryddes ved utlogging og ha størrelsestak.
- **Rettes i samme løp:** storage-DELETE-policy strammes til opplaster/admin (F22); `TO authenticated` på
  club-logos-SELECT eller behold public-lesing men fjern list-muligheten (F23); valider `team_spaces.logo_url`
  som klubblogoen (F23); eksplisitt `REVOKE FROM anon` på lese-RPC-ene (defense-in-depth, F25-notat).
- **Sletting:** i dag fjernes objekter best-effort, men CDN-cachede kopier lever til TTL utløper — med
  `max-age=31536000` på varianter må sletting derfor også invalidere (Supabase gjør dette ved objekt-sletting;
  verifiseres i test). Utløpte medlemskap: tilgang stopper ved neste signering (maks TTL-vinduet etterpå).

## 10. Skaleringsanalyse

Antakelser: 3 feedåpninger/bruker/dag, 8 bilder synlig-lastet per åpning, livekamp: 30 følgere, 6 mål,
15 kampbilder. «I dag» = 3 MB originaler + token-rotasjon (0 % cache). «Fikset» = 250 kB display-variant +
60 kB thumb, stabile URL-er, ~85 % cache-hit, kirurgisk realtime.

| Skala | Dagens arkitektur | Fikset arkitektur |
|---|---|---|
| Pilot (11) | ~9,5 GB/uke (målt) → 402-risiko | ~0,3–0,5 GB/mnd |
| 1 000 MAU | 1000×3×24 MB×30 ≈ **2,2 TB/mnd** + livekamper (~1,5 GB per kamp) → umulig selv på Pro (250 GB) | 1000×3×(8×250 kB×15 % miss)×30 ≈ **27 GB/mnd** + kamper (~10 MB/kamp) → godt innenfor Pro |
| 10 000 MAU | ~22 TB/mnd → absurd | ~270 GB/mnd → Pro + liten overage (~2 USD/GB×20 ≈ småpenger) |
| 100 000 MAU | — | ~2,7 TB/mnd → her blir ekstern CDN/medietjeneste økonomisk riktig (terskel, nivå C) |

**Farlige multiplikatorer i dagens flyt:** (følgere × hendelser × 3 refetch × full bildeliste) er kvadratisk-aktig
i livekamp — én populær kamp med 30 følgere ≈ 1,5 GB per mål-sekvens; (ufiltrert reactions × tilkoblede klienter)
vokser med aktivitet på tvers av lag. **Lineært og sunt etter fiks:** bytes ∝ nye bilder × unike seere.
**Terskler for nivå C:** > ~1 TB/mnd egress, video på veikartet, eller > 5 000 samtidige livekamp-følgere.

# DEL II — Arkitekturbeslutninger (revidert etter tilbakemelding)

> Premiss: B er launch-fundamentet. A er trygge, målbare steg *inn i* B — ikke en midlertidig fiks.
> Ingenting i A skal kastes. C er terskelstyrt og reversibelt.

## P1. Private medier: signed URL, TTL og cache-livssyklus

**Motsetningen (7 døgn vs. 24 t) løses slik: TTL settes til 24 timer — fast policy i alle faser.**
Nøkkelinnsikten er at TTL-en bare er cache-økonomisk viktig *så lenge OS-HTTP-cachen (nøklet på URL) er
eneste cache*. Fra B har vi en **lokal disk-cache nøklet på `storage_path`** (aldri token) — da er bildet på
disk uavhengig av URL-ens levetid, og TTL-en koster kun én re-signering (et lite API-kall, ikke bytes) per
døgn. Vi trenger altså ikke kjøpe cache-treff med et langt lekkasjevindu.

- **TTL 24 t, lat re-signering når < 6 t gjenstår** (margin for klokkeskjev), batch per skjermlast.
- **I fase A** (før disk-cachen) betyr 24 t at feedens bilder re-lastes ~daglig. Med nye, resizede bilder
  (~350 kB) er det ubetydelig. Det som IKKE er ubetydelig er de eksisterende fulloppløste originalene —
  derfor **flyttes backfill-scriptet (varianter av eksisterende media) fra «valgfritt i B» til
  obligatorisk A-oppfølger**. Bonus: backfill hjelper også gamle appversjoner (de signerer `storage_path`
  ferskt uansett og får da den lette varianten).
- **Tilgangs-livssyklus:**
  - *Utlogging:* `signOut` tømmer URL-cachen (AsyncStorage + minne) og (fra B) hele disk-cachen. Delt
    enhet er dermed ren.
  - *Fjernet fra laget:* nye signeringer stopper umiddelbart (RLS ved signering). Allerede utstedte URL-er
    lever maks 24 t. Lokalt cachede kopier på den fjernedes enhet er ekvivalent med skjermbilder — ingen
    klientarkitektur kan fjerne dem; men ved medlemskaps-refresh **purges cache per lag-prefiks**
    (path-konvensjonen `{team_space_id}/…` gjør dette trivielt og presist).
  - *Slettet bilde:* objektet slettes i Storage → 404 ved origin. **Verifisert nyanse:** automatisk
    CDN-invalidering (≤ 60 s, inkl. transformerte varianter) er en *Smart CDN*-egenskap — dvs. Pro.
    Free-planens basic CDN invaliderer IKKE ved sletting, og browser-/OS-cache invalideres aldri av
    serveren. Klient-hook: `invalidateMediaCache(paths)` i `deletePost` ([feed.ts:247](src/lib/api/feed.ts#L247)
    er riktig sted — begge slette-inngangene passerer der); andre klienter evicter ved feed-sync + LRU.
  - *Lekket URL:* gir lesetilgang til ÉN fil i ≤ ~24 t (token) + ≤ 24 t (ev. CDN-kopi, se cache-policy
    under), og krever i praksis en allerede kompromittert enhet eller bevisst deling fra et medlem (som
    uansett kunne delt selve bildet). **Verifisert:** signerte URL-er kan ikke revokeres selvbetjent før
    utløp (kun Supabase support kan rotere signeringsnøkkelen — nødbrems som dreper ALLE utestående URL-er);
    de signeres med en dedikert intern nøkkel, så Auth-nøkkelrotasjon hjelper ikke. TTL-en ER derfor hele
    tilbakekallingsmekanismen — enda en grunn til 24 t, ikke 7 døgn.
  - *Realistisk residualtilgang for tidligere autorisert bruker:* ≤ ~24–48 t for allerede signerte objekter
    (token + ev. cache-kopi), 0 for alt nytt. (Mot 7-døgns-forslaget: opptil ~8 døgn. Det er forskjellen
    vi kjøper med backfill + disk-cache.)
- **Cache-Control-policy per bucket (revidert — viktig endring fra v1):**
  - `feed-media` (privat, barnebilder): **`cacheControl: '86400'` (24 t)** — IKKE ett år. Grunn: en
    CDN-/OS-cachet kopi skal ikke kunne overleve tilgangsvinduet vesentlig, og på Free/basic CDN finnes
    ingen invalidering ved sletting. Kostnaden er null i praksis: URL-en roterer uansett hvert døgn, så
    ingen cache ville blitt gjenbrukt lenger enn det. Fra B er disk-cachen (nøklet på path) ytelseslaget —
    HTTP-cache-metadataen er da bare et sekundært sikkerhetsnett.
  - `club-logos` (public, ikke-sensitivt): `cacheControl: '31536000'` — immutable filnavn, maksimal CDN-nytte.
  - **Verifisert:** cacheControl kan i praksis IKKE endres etter opplasting (ingen metadata-API; delete +
    re-upload kan servere stale fra CDN). Policyen må være riktig fra første prod-opplasting — derfor låses
    den her. Usikkerhet som testes empirisk i A0 (`curl -I` mot signert URL): om signerte responser i det
    hele tatt sender objektets Cache-Control-header (GitHub #21926 antyder at kun `Expires` sendes).
- **Verifisert CDN-mekanikk (lukker H1 på dokumentasjonsnivå):** Smart CDN-docen sier ordrett at hver unik
  token er en egen cache-nøkkel — «the first request with any given signed URL results in a cache miss».
  Gjenbruk av samme URL gir treff. URL-gjenbruk er altså obligatorisk for cache-økonomien, nøyaktig som
  designet her. (Loggquery Q3 bekrefter det empirisk for vårt prosjekt.)
- **Hvorfor dette ikke blir en ytelsesflaskehals:** cache-treff er TTL-uavhengige fra B (expo-image
  `cacheKey = storage_path` — disk-treff uansett token); re-signering er batch (ett kall per skjermlast,
  ikke per bilde) og skjer bak eksisterende visning (stale-while-revalidate).
- **Fjernet-medlem-hullet (nytt funn fra kodeanalysen, tas i A):** klienten til en fjernet bruker får i dag
  INGEN signal — `refreshMemberships` kjører kun ved join/create/settings, så offeret blir stående med
  `activeTeamSpaceId` mot et lag de ikke er medlem av til appen restartes. Tiltak: lett memberships-resync
  ved AppState `active`; når laget er borte → nullstill aktivt lag + purge URL-cache per lag-prefiks +
  (B) `clearDiskCache()`. «Forlat laget»-flyt finnes ikke i appen i dag (kun admin-fjerning via RPC).
- **signOut-sentralisering (nytt funn):** cache-rydding ligger i dag KUN i ProfilScreens handleSignOut —
  [WelcomeIntentScreen.tsx:102](src/screens/WelcomeIntentScreen.tsx#L102) kaller `signOut()` rått og lekker
  modul-cachene. Tiltak: én `clearLocalCaches()` i [account.ts](src/lib/account.ts) kalt fra selve
  `signOut` i UserContext (eneste punkt begge inngangene passerer) — URL-cache + (B) disk-cache + modul-cacher.
- **Kontosletting (dokumentert designvalg, uendret):** `delete_account_data` anonymiserer og beholder
  laginnhold inkl. bilder (00042: «ANONYMISER, IKKE UTRADER»); memberships hard-slettes → fremtidig tilgang
  borte, samme TTL-hale som ellers.
- **Gamle appversjoner:** roterer fortsatt URL-er (dyrt, men sikkerhetsmessig ufarlig — deres TTL er 1 t).
  Backfill gjør nedlastingene deres ~10× billigere uten klientendring.

## P2. Originalbilder og kvalitet — eksplisitt beslutning

| | A: original + display + thumb | **B (anbefalt): 2048-master + thumb** | C: B nå + lat original-opplasting på wifi senere |
|---|---|---|---|
| Visuell kvalitet iPhone | identisk | identisk (skjerm er ~1179–1320 px bred; 2048 px @ q0.85 er over gjengivelsesgrensen) | identisk |
| Zoom/fullskjerm | perfekt | god (~1,7× zoom før 1:1; utover det mykner det) | perfekt (når original er oppe) |
| Fremtidig web | perfekt (lightbox/print) | god (2048 dekker web-feed og lightbox) | perfekt |
| Cropping/redigering senere | full frihet | begrenset til 2048-rammen | full frihet |
| Storage per foto | ~3–6 MB + 0,45 MB | **~0,45 MB** (−92 %) | 0,45 nå, + original asynkront |
| Egress | lik (original serveres aldri i feed) | lik | lik |
| Upload på 4G sidelinje | 5–15 s (original) + varianter | **1–3 s** | 1–3 s nå, resten senere |
| RAM/decode | håndterbar (streaming) | lav | lav |
| Migrering av eksisterende | genererer varianter, beholder original | genererer varianter; **safeguard: legacy-originaler beholdes inntil eksplisitt pre-launch-beslutning** | som A |
| Reversibilitet | full | **per-foto irreversibel** (originalen finnes ikke hos oss) | full |

**Anbefaling: B.** Begrunnelse: Heia er live-deling, ikke fotoarkiv (produktidentiteten er feed/live, ikke
album); **opplasterens kamerarull ER originalarkivet** — originalen finnes allerede hos den som eier den;
sidelinje-opplasting på 4G er kjerneflyten og skal være 1–3 s, ikke 15; og 92 % av storagekostnaden ville
vært bytes som aldri serveres. Dette er en bevisst, låst produktbeslutning — ikke en bieffekt: *«Heia lagrer
en høyoppløselig visningsmaster (2048 px, q0.85), ikke kameraoriginalen.»* Skjemaet holdes åpent for C
(en nullable `original_path`-kolonne er en additiv migrasjon den dagen «lagets album/minner» blir produkt).
Terskel for å revurdere: hvis album/minner kommer på veikartet → bygg C (bakgrunnsopplasting på wifi), ikke A.

Kvalitetsparametre som låses: **display/master 2048 px lang side, JPEG q0.85 (~350–600 kB); thumb 480 px,
q0.7 (~25–50 kB)**. Verifiseres visuelt på fysisk enhet mot 3 ekte kampbilder før B fryses.

## P3. A skal ikke være throwaway — varighetstabell

| A-artefakt | Skjebne i B | Kontrakt som låses i A |
|---|---|---|
| `signedUrlCache` (resolver) | **PERMANENT** — blir URL-laget inne i MediaService/`MediaImage` | `resolve(path) → Promise<url>`, TTL/refresh internt |
| `MediaImage`-komponent (se P4) | **PERMANENT** — innmaten byttes fra RN-Image+URL-cache til disk-cache; call-sites urørt | props: `{media: MediaRef, variant, style, …}` |
| `MediaRef` på FeedItem/MatchPhoto (path, ikke URL) | **PERMANENT** — selve pivot-forsikringen | UI ser aldri en leverandør-URL |
| `getUserId()`-helper | **PERMANENT** (kallsteder klassifisert i P5) | én auth-lesevei |
| Picker-resize (2048/q0.85) | **UTVIDES** — B legger til thumb-generering (to varianter); A-koden er steg 1 av 2, ikke kast | `PickedImage` beholder form |
| Realtime-hygiene (debounce, fokus-gating, INSERT-filter, splitt) | **PERMANENT** — B legger kirurgiske oppdateringer OPPÅ; hygienen forblir sikkerhetsnettet | handler-kontrakten i P6 |
| `netMetrics`-interceptor + skjermattribusjon | **PERMANENT** — får prod-aggregatmodus i B | |
| Bildemåling | bor i `MediaImage` fra dag 1 (onLoadStart/End + repetisjonsteller) — **ingen separat TrackedImage som kastes** | |
| `cacheControl` + bucket-limits (00058) | **PERMANENT** | |
| Backfill-script | kjøres én gang, arkiveres | |

Netto planlagt kast: **null**. Det eneste som «erstattes» er interne implementasjoner bak stabile kontrakter.

## P4. Medieabstraksjonen (innføres i A, bevisst minimal)

```
src/lib/media/
  types.ts        MediaRef = { path: string; thumbPath?: string | null }
  resolver.ts     resolveMediaUrl(ref, variant: 'thumb'|'display') → Promise<string>   // + refreshMediaUrl(path)
  MediaImage.tsx  <MediaImage media={ref} variant="display" style … />
```

- API-laget mapper DB-rader → `MediaRef` og slutter å legge ferdige URL-strenger på FeedItem/MatchPhoto.
  FeedCard/MatchPhotoRail/MatchPhotoGallery/CommentsScreen/MatchTimeline/MatchEventRow bytter til
  `<MediaImage>` — dette er hele A-flatendringen i UI, og den gjøres ÉN gang.
- UI-et vet: path + ønsket variant. UI-et vet IKKE: signering, token-utløp, CDN, leverandør.
  Bytte Supabase Storage → annen CDN/medietjeneste = ny `resolver.ts` (+ evt. `MediaImage`-innmat). Ferdig.
- `variant`-oppslaget: `thumb` → `thumbPath` med fallback `path`; `display` → `path`. `'full'` reserveres
  (finnes ikke som lagret variant etter P2-beslutningen — display ER master).
- Ikke mer enn dette: ingen DI-rammeverk, ingen provider-interfaces, ingen konfig. ~150 linjer totalt.
  Logoer (public URL i DB) beholdes som i dag og normaliseres først i C — dokumentert asymmetri.

## P5. getSession vs. getUser — kallsted-for-kallsted (verifisert mot RLS-policyene)

Alle **9** kallsteder er gjennomgått med tilhørende RLS-policy. Ingen leser noe annet enn `user.id` —
ingen e-post, ingen metadata. Og avgjørende: datakallet som følger bærer *samme JWT* som `getUser()` ville
validert — en utløpt/revokert sesjon feiler uansett med 401 på selve spørringen. `getUser()` gir her null
sikkerhetsgevinst, kun én ekstra RTT.

| Kallsted | Flyt | Server-håndhevelse | Kategori |
|---|---|---|---|
| [profile.ts:19](src/lib/api/profile.ts#L19) getProfile | LES | RLS `id = auth.uid()` (00005:11) — eneste SELECT-policy | **C** — userId finnes i UserContext:56 |
| [profile.ts:69](src/lib/api/profile.ts#L69) updateProfile | SKRIV | `USING`+`WITH CHECK` på auth.uid() (00005:15) | **A** (C mulig via context) |
| [teams.ts:72](src/lib/api/teams.ts#L72) getUserMemberships | LES | policy på auth.uid()/is_team_member (00014:31) — `.eq` er korrekthets-, ikke sikkerhetsfilter | **C** — TeamContext:52 har userId |
| [comments.ts:147](src/lib/api/comments.ts#L147) createComment | SKRIV | `WITH CHECK author_id = auth.uid()` + medlemskap (00014:210) | **A** |
| [feed.ts:177](src/lib/api/feed.ts#L177) getTeamFeed (iReacted) | LES | lag-scopet SELECT (00014:237); verste utfall ved feil id = feil UI-markør | **C** — dyreste kallstedet, ligger serielt i varmeste lesesti |
| [feed.ts:299](src/lib/api/feed.ts#L299) toggleReaction | SKRIV | INSERT/DELETE bundet til auth.uid() (00014:243) | **A** |
| [feed.ts:346](src/lib/api/feed.ts#L346) createTextPost | SKRIV | `WITH CHECK author_id = auth.uid()` (00014:172) + pin-trigger | **A** |
| [feed.ts:392](src/lib/api/feed.ts#L392) createImagePost | SKRIV | media/storage/attachments alle bundet til auth.uid() + is_team_member (00014:267, 00018:22) | **A** |
| [events.ts:127](src/lib/api/events.ts#L127) getRsvpSummaries (myStatus) | LES | lag-scopet SELECT (00014:81); id brukes kun til å plukke «min» rad i minnet | **C** |

**Konklusjon: ingen kallsteder er kategori B.** Alle skriv er allerede bundet til `auth.uid()` server-side
(RLS `WITH CHECK` eller SECURITY DEFINER-RPC). Presedens finnes i kodebasen: `comments.ts:47` bruker
allerede `getSession()` til samme formål, og `setRsvp` går via RPC helt uten getUser. Tiltak: én
`getUserId()`-helper (getSession-basert) for A-kategoriene; C-kategoriene får id-en som parameter fra
context (fjerner kallet helt). `getUser()` beholdes ikke noe sted — det finnes ingen flyt der server-fersk
brukervalidering tilfører noe RLS ikke allerede gjør.

## P6. Realtime-kontrakten (endelig, launch-ready)

**Prinsipp: payload-først. Refetch er unntak, ikke regel.**

| Hendelse | Klientreaksjon (B) |
|---|---|
| `reactions` INSERT/DELETE (andres) | Juster teller lokalt på berørt post (payload/`feed_post_id`). Ingen refetch. |
| `reactions` (egne, ekko av optimistisk handling) | Ignoreres (match på `user_id`). |
| `comments` INSERT/soft-DELETE | Juster `comment_count` lokalt; åpen CommentsScreen appender ved samme post. |
| `feed_posts` INSERT (team-filtrert) | Debounced (400 ms) hent av side 1 — billig fordi bilder aldri re-lastes (stabile URL-er + disk-cache). |
| `feed_posts` UPDATE/DELETE | Oppdater/fjern posten lokalt. |
| `match_events` INSERT | **Append til tidslinjen fra payload. Ingen refetch.** |
| `match_sessions` UPDATE | **Scoreboard fra payload (stillingen ligger i raden). Ingen refetch.** |
| `feed_posts` INSERT med `event_id` (kampbilde) | Kun DA `loadPhotos()` (debounced). Skilt fra score-stien. |
| `notifications` INSERT | +1 ulest lokalt + prepend i fokusert inbox. Ingen count-spørring. |
| `notifications` UPDATE (egen lest-markering) | Ignoreres. |
| Fokus / resume fra bakgrunn | Resync av aktiv skjerm hvis stale-flagg satt eller > 60 s siden sist sync + unread-count. |
| Reconnect (`CHANNEL_ERROR`/`TIMED_OUT` → resubscribe) | Full resync av aktiv skjerm — vi kan ha mistet hendelser. Status-callback på alle `.subscribe()`. |
| Duplikatvern | Modulnivå kanal-registry: én kanal per topic, uansett hvor mange skjerminstanser (løser 3-stacks-problemet strukturelt). Fokusbinding i tillegg. |

- **Resultat:** 1 mål = 0 refetch (ren payload-applisering hos alle tilskuere); 1 reaksjon = 0 refetch;
  egne optimistiske endringer trigges aldri tilbake; bakgrunnsskjermer arbeider ikke; resume resyncer alltid.
- **Fallback-nett:** hvis en payload mangler forventede felter → debounced refetch (1 s) av det ene objektet.
  Hygienen fra A (debounce/fokus) ligger under som sikkerhetsnett.
- **Migrasjon 00059:** `REPLICA IDENTITY FULL` på `reactions` (DELETE-payload får `feed_post_id` OG Realtime
  kan RLS-filtrere DELETE — lukker H4). `comments` er soft-delete (UPDATE) og trenger det ikke.
- **postgres_changes → Broadcast:** terskel ~500–1000 samtidige på én kamp (RLS-evaluering per abonnent per
  endring er skaleringsgrensen). Kontrakten over er transportnøytral — byttet skjer inne i `subscribeTo*`,
  skjermene merker ingenting. Dette er C, ikke B.

## P7. Query-arkitekturen: TanStack Query i B (revidert beslutning)

Forrige utkast foreslo håndrullet `staleCache` nå og React Query «senere». Etter launch-fundament-premisset
er det feil rekkefølge — revidert beslutning: **TanStack Query v5 innføres i B, på de varme lesestiene.**

- **Hvorfor:** (1) Realtime-kontrakten i P6 *krever* en sentral, imperativt oppdaterbar klientcache
  (`queryClient.setQueryData` er det kanoniske mønsteret for payload-baserte oppdateringer — håndrullet
  ville vi gradvis gjenoppfunnet nettopp dette, dårligere). (2) SWR, inflight-dedupe, fokus-revalidering,
  retry og offline-oppførsel følger med gratis og testet. (3) Webklienten (klubbsider) gjenbruker samme
  query-lag — håndrullet cache er nøyaktig den typen gjeld punkt 7 advarer mot. (4) Ren JS — ingen pod,
  ingen New Arch-risiko.
- **Avgrensning (ikke overbygging):** kun feed, events/kalender, event-detalj, members, notifications får
  useQuery/queryKeys. Payments/ops/onboarding beholder dagens imperative kall — de er kalde stier.
- **A→B-kontinuitet:** api-laget (`src/lib/api/*`) er allerede rene async-fetchere = ferdige `queryFn`-er.
  A endrer dem ikke; B pakker dem inn. Null kast.
- **queryKey-konvensjon låses i B:** `['feed', teamSpaceId]`, `['events', teamSpaceId, window]`,
  `['event', eventId]`, `['matchPhotos', eventId]`, `['members', teamSpaceId]`, `['notifications', teamSpaceId]`.
  Realtime-handlere muterer disse nøklene.

## P8. Bildebibliotek og native avhengigheter (verifisert mot npm/GitHub 7. aug 2026)

Premisset fra forrige utkast — «ingen Expo SDK matcher RN 0.83» — var **faktafeil**: Expo SDK 55
(25. feb 2026) er nøyaktig RN 0.83 + React 19.2, og bare-RN-installasjon via `install-expo-modules` er
offisielt støttet. Det endrer bildevalget.

| Behov | Valg | Hvorfor | Nest best / bytt hvis |
|---|---|---|---|
| **Bildevisning + disk-cache** | **expo-image 55.0.11** (SDK 55-linjen) | Eneste kandidat med alle tre: **`source.cacheKey`** (= `storage_path` — løser roterende `?token=` på komponentnivå), **`configureCache({maxDiskSize})`** + `clearDiskCache()` (kontrollert cache, signOut-tømming), og institusjonelt vedlikehold. | react-native-turbo-image 1.24.3 (også cacheKey, null ekstra infra — men bus factor 1, ingen disk-størrelseskonfig). Bytt hvis install-expo-modules gir bygg-trøbbel i testbranch, eller SDK↔RN-koblingen bremser RN-oppgraderinger. |
| **Variantgenerering (display + thumb)** | **react-native-compressor 2.0.3** (Nitro; fallback **1.19.4** samme API uten Nitro) | Aktivt vedlikeholdt NÅ (4 releaser sommeren 2026); dekker video-komprimering den dagen det kommer. Verifisert: pickeren kan IKKE gi to størrelser fra ett kall — riktig flyt er pick → compress. | @bam.tech/image-resizer 3.0.11 (TurboModule, men 20 mnd stillstand + åpen iOS-EXIF-bug). Fall til compressor 1.19.4 samme dag hvis Nitro gir pod-friksjon. EXIF-orientering MÅ telefontestes før frys. |
| **Fil-lag** | **expo-file-system** (følger SDK 55-familien — én infra, opplasting via `uploadAsync`, base64-brua bort) | Én vedlikeholdsgaranti i stedet for to. | react-native-blob-util 0.24.10 hvis turbo-image-sporet velges i stedet. |
| **Observability** | **@sentry/react-native 8.22.0** | Ukentlig releasetakt, eksplisitt New Arch-støtte. Uten forbehold. | — |

- **Diskvalifisert:** react-native-fast-image (dødt siden 2022); @d11-forken (New Arch ja, men **ingen
  cacheKey** — verifisert i README — og dermed ubrukelig mot token-rotasjon); react-native-nitro-image
  (0.x, cache-nøkkel ikke eksponert ennå — følges).
- **Egen CachedImage (~200 linjer) — droppet.** Ærlig regnskap: LRU-eviction, samtidighets-dedupe, retry,
  minnecache og decode-downsampling måtte alle bygges og eies selv — reell kostnad 3–4× «200 linjer».
  expo-image gir alt, vedlikeholdt av Expo-teamet. Dette svarer på spørsmålet i punkt 8: biblioteket vinner.
- **Konsekvens for flyt:** pickeren beholder 2048/q0.85 fra A (display-masteren — steg 1 videreføres
  uendret); compressor avleder KUN thumb 480/q0.7 fra display-fila (verifisert: pickeren kan ikke levere to
  størrelser fra ett kall). `MediaImage`-innmaten i B blir expo-image med `cacheKey=storage_path`,
  `cachePolicy: 'disk'`, 150 MB tak.
- **Prosess:** `install-expo-modules` + pod install kjøres av Brage, manuelt, i egen testbranch først —
  aldri i bakgrunnen (etablert arbeidsregel).

## P9. Observability som produksjonsverktøy — lagdelt målemodell

| Lag | Måler | Verktøy | Fase |
|---|---|---|---|
| 1. JS-HTTP | kall, bytes (content-length), varighet, status — per skjerm | `netMetrics`-interceptor i supabase.ts (dev: full; prod: aggregater, aldri URL-er/tokens) | A0 |
| 2. Native bildelasting | antall lastinger, repetisjon per objekt (nøkkel = path uten token), tid-til-første-bilde, (B:) disk-cache hit/miss | `MediaImage` innebygd måling | A0/B |
| 3. Servertall (fasit for bytes) | egress per tjeneste, topp-objekter, **cf_cache_status**, signeringsfrekvens, feilrate | Supabase Usage + Logs Explorer Q1–Q7 (seksjon 17) | alltid |
| 4. Prod-helse | crashes, trege skjermoverganger, breadcrumbs ved refetch-stormer | Sentry | B |
| 5. Regresjonsvakter | «feedåpning = ≤ N kall», «én realtime-burst = ≤ 1 refetch», «mål = 0 bilde-nedlastinger» | jest + supabase-mock, CI | A0/B |

**Baseline-protokoll (kjøres i A0, gjentas etter A og etter B, fysisk iPhone, release-bygg):** skriptet
brukerreise — kaldstart→feed, scroll, åpne kamp, 3 mål i livekamp, kalender, inbox — mens lag 1–3 logger.
Leveransen er setningen brukeren ba om: *«Feedåpningen gikk fra X MB / Y requests / Z s til A MB / B
requests / C s»* — der MB kommer fra lag 3 (serverfasit), requests fra lag 1, sekunder fra lag 2.
Lag 2 alene beviser aldri nettverksbytes (F27) — derfor er lag 3 obligatorisk i protokollen.

## P10. Sikkerhetsfunnene — klassifisert (mistes ikke)

**Må fikses før launch (inn i B3):**
1. Storage DELETE-policy: ethvert medlem kan slette alle lagets filer (00018:36) → stram til opplaster/admin.
2. `team_spaces.logo_url` uten validering → sporingspiksel-vektor mot barn/foreldre via anon invite-preview
   (teams.ts:274 + 00050) → valider som klubblogo (00034:99-mønsteret).
3. Eksplisitt `REVOKE FROM anon` på lese-RPC-ene (get_team_feed m.fl.) — defense-in-depth, minutter å gjøre.

**Bør fikses før launch (B3 hvis kapasitet, ellers rett etter):**
4. `club-logos` SELECT-policy uten TO-klausul → anon kan liste mappenavn (00036:19).
5. Indeks på `feed_posts(event_id)` (kampbildeskjermen gjør seq scan) og `notifications(source_entity_type,
   source_entity_id)` (cron hvert 10. min).
6. Oppryddingsjobb for soft-slettet media + foreldreløse filer (kommentaren i 00010 lover en som ikke finnes).
7. `getRsvpSummaries` `.in(...)`-URL → 414-risiko ved ~200 hendelser (H7) — løses naturlig av events-vinduet i B.

**Kan vente (C/vedlikehold):** RLS IN-subquery-optimalisering (10k+ poster), ops brreg_snapshot-payload,
push-fanout-parallellisering (til klubb-brede varsler), `max_rows` 1000 → 300.

## P11. Skaleringsmodell (parametrisert — pris plugges inn når verifisert)

**Modellens variabler (dette er tallene vi styrer på, ikke kronene):**

```
bytes/feedåpning   = synlige_bilder × variantstørrelse × miss_rate
bytes/bruker/dag   = feedåpninger × bytes/feedåpning + nye_bilder × (thumb + display)
bytes/kamp/klient  = kampbilder × variantstørrelse × miss_rate   (mål = 0 bytes: payload-only)
realtime-amp       = HTTP-kall per hendelse per klient           (i dag ~19; mål ≤ 1)
```

Med B-arkitekturen (varianter ~350 kB / 40 kB, disk-cache-hit > 85 %, payload-realtime):
- 1 000 MAU ≈ 25–40 GB/mnd — **måltall, uavhengig av leverandør**
- 10 000 MAU ≈ 250–400 GB/mnd
- 100 000 MAU ≈ 2,5–4 TB/mnd

**Terskler (målbare, ikke datoer):**
- **Supabase Pro:** ved offentlig launch — for log-retensjon (observability-behovet i P9 lag 3), kvote-headroom
  og image-transform-opsjonen. Ikke som fiks for noe.
- **Ekstern CDN vurderes:** vedvarende > 60–70 % av planens egress-kvote i 2+ måneder, ELLER cache-miss-raten
  i cf_cache_status ikke kommer under ~30 % etter B (da er CDN-laget selve problemet).
- **Ekstern video-/medietjeneste:** den dagen video er på veikartet. Punktum (uavhengig av MAU).
- **Broadcast erstatter postgres_changes:** > ~500 samtidige klienter på samme kamp, eller målt
  realtime-leveringsforsinkelse > 2 s under kamp.

**Verifisert prising (supabase.com/pricing, 7. aug 2026):** Free: 5 GB uncached + 5 GB cached egress,
1 GB storage, 1 dags logg-retensjon; overskridelse → grace period → **HTTP 402** (`exceed_egress_quota`),
og **ingen ny grace period ved gjentak** — vi er altså på siste advarsel. Pro: 25 USD/mnd, 250 GB + 250 GB
egress, 100 GB storage, 7 dagers logger, Smart CDN (auto-invalidering) og image transformation
(5 USD/1000 origin-bilder; fungerer med signerte URL-er mot private buckets). Overage: 0,09 USD/GB uncached,
0,03 USD/GB cached; spend cap er PÅ som default (stopper i stedet for å fakturere). Kron-konsekvens av
modellen: 1 000 MAU ≈ 25–40 GB/mnd ≈ dekket av Pro; 10 000 MAU ≈ 250–400 GB ≈ Pro + ~0–15 USD overage;
100 000 MAU ≈ 2,5–4 TB ≈ ~250–350 USD/mnd i egress alene — det er terskelen der ekstern CDN regnes hjem,
ikke før. Feil-prising er dermed ikke lenger en risiko for for-tidlig CDN-flytting: tallene sier tydelig
at Supabase bærer oss gjennom både launch og god vekst.

## P12. Pivot-sikring: kontrakter som gjøres riktige NÅ (uten å bygge featurene)

1. **Media refereres alltid som path + variant (`MediaRef`), aldri URL** — i DB (allerede riktig for
   feed-media), i API-laget og i UI (P4). → bytte av lagrings-/CDN-leverandør er én resolver-fil.
2. **`media`-tabellen er allerede flerbilde-klar** (media-array + sort_order i RPC-en) → flere bilder per
   post er kun klientarbeid senere.
3. **Realtime bak `subscribeTo*`-funksjoner med payload-kontrakt** (P6) → Broadcast-bytte er usynlig for skjermene.
4. **API-laget som rene async-fetchere + TanStack queryKeys** (P7) → webklient gjenbruker query-laget.
5. **`notifications.data` bærer allerede deep-link-id-er** → push-som-åpner-riktig-innhold er klart.
6. **Variant-severdien i kolonner (storage_path/thumbnail_path, + evt. original_path additivt)** → nye
   varianter (web-størrelser, AVIF) er additive migrasjoner, ikke omskrivinger.
7. **Offline-retning:** disk-cache for bilder (B) + TanStack persistering (C ved behov) — ikke egen lokal DB nå.
8. Offentlige klubbflater får **eget public-innholdslag** når de kommer — feed-media forblir privat uansett pivot.

## P13. Launch-ready: exit-kriterier for B

Målt på fysisk enhet (iPhone 12-klasse), release-bygg, over 2 uker TestFlight før «launch-ready» erklæres:

- **Egress:** flåte < 100 MB/dag vedvarende (dagens skala); median < 5 MB/bruker/dag; cached > uncached i Usage.
- **Cache:** disk-cache-hit > 85 % på andre feedåpning; repetisjonsteller ~1,0 nedlasting per objekt per enhet.
- **Feed:** kald åpning → første innhold < 1,5 s, alle synlige bilder < 2,5 s (4G); varm åpning < 0,5 s.
- **Cold start** → interaktiv Hjem < 2,5 s.
- **Bilder:** display p95 ≤ 600 kB; ingen full-res-decode i lister; decode-RAM < 5 MB per feedbilde.
- **RAM:** feed-scroll peak < 350 MB; galleri med 20 bilder uten OOM på eldre enhet.
- **Scrolling:** ingen dropped-frame-burst > 100 ms ved normal feed-scroll (dev-menu perf-monitor / Sentry).
- **Livekamp:** 5 samtidige klienter: mål synlig < 1 s hos alle, **0 bilde-nedlastinger og ≤ 1 HTTP-kall per
  klient per mål** (regresjonstest + enhetstest).
- **Background/resume:** retur etter > 5 min → korrekt resync < 2 s; aldri frossen stilling.
- **Offline/dårlig nett:** flymodus → feed + bilder vises fra cache; ingen crash; opplasting feiler tydelig
  og kan gjentas trygt.
- **Sikkerhet:** signOut tømmer URL- + disk-cache (testet); medlemsfjerning purger lag-prefiks (testet);
  TTL 24 t verifisert; P10 «må»-punktene deployet.
- **Feil/retries:** alle nettfeil når Sentry; ingen stille retry-løkker; 4xx/5xx-rate < 1 % i edge-logs.
- **Observability:** Sentry crash-free > 99,5 %; netMetrics-prod-aggregat rapporterer; baseline→B-målingene
  dokumentert som «X MB / Y req / Z s → A / B / C».
- **Regresjonstester:** kall-antall-vaktene grønne i CI på hver PR.

---

# DEL III — Revidert faseplan

## Fase A0 — Baseline og observerbarhet

- **Arkitekturmål:** målbarhet før endring — «X MB / Y req / Z s»-fasiten etableres.
- **Endringer:** (1) `netMetrics`-interceptor i supabase.ts (dev: detalj; prod-klar aggregatmodus) +
  skjermattribusjon via NavigationContainer; (2) refetch-regresjonstest med supabase-mock;
  (3) baseline-protokoll: skriptet brukerreise på fysisk iPhone (release-bygg) + loggqueriene Q1–Q7 +
  media-SQL + `curl -I`-test av Cache-Control på signert URL (#21926-usikkerheten); (4) Usage→Bandwidth-avlesning.
- **Hvorfor:** F26/F27 — uten dette kan ingen fase bevises. Bilderepetisjon måles i A0 fra serverlogger
  (Q4), ikke fra klienten — derfor ingen bildekomponent-endringer her (unngår throwaway).
- **Videreføres:** alt — netMetrics blir prod-verktøyet (P9), testen blir CI-vakt.
- **Risiko:** minimal (dev-only). **Migrering:** ingen. **Rollback:** revert.
- **Exit:** baseline-rapport dokumentert (kall/bytes/tid per skjerm; Q1–Q7-resultater; H1 bekreftet/avkreftet via Q3).

## Fase A — Lavrisiko stabilisering (ren delmengde av B-kontraktene)

- **Arkitekturmål:** stabile medie-URL-er bak MediaRef-kontrakten, riktige payloadstørrelser, rolig
  realtime, ren boot — uten native avhengigheter. Mål: −85–95 % egress, trygt før 5. september.
- **Endringer (hver = egen commit, skipbar uavhengig):**
  1. `src/lib/media/`-modulen (P4): MediaRef + resolver + signedUrlCache (**TTL 24 t**, AsyncStorage,
     versjonert, prune, inflight-dedupe) + `MediaImage` (RN-Image-innmat + bildemåling) + bytte av de 6
     UI-flatene. `onError` → `refreshMediaUrl` (rate-limit 1/min/path).
  2. Picker: 2048 px / q0.85 (P2-beslutningen; base64-veien beholdes i A — filen er nå liten).
  3. `cacheControl` **'86400'** feed-media / **'31536000'** club-logos (P1-policyen) + bucket-limits
     (10 MiB / 2 MiB + mime-typer) via dashboard/Management API — ikke rå SQL (verifisert flate).
  4. Realtime-hygiene (P6s fallback-lag): debounce kamp-handler, splitt foto/score-refetch, INSERT-gate i
     NotificationsContext, fokus-gating (Inbox/TeamHome/EventDetail), kanal-registry (dedupe topics).
  5. Auth: `getUserId()`-helper + parameterisering (P5: 5×A, 4×C — getUser fjernes overalt) +
     AppState-styrt `startAutoRefresh`/`stopAutoRefresh`.
  6. Livssyklus-kroker (P1): `clearLocalCaches()` i account.ts kalt fra `signOut` (fikser
     WelcomeIntent-lekkasjen); `invalidateMediaCache(paths)` i deletePost; memberships-resync ved AppState
     active + nullstill aktivt lag og prefix-purge ved medlemskapstap.
  7. **Backfill (A-oppfølger, obligatorisk):** lokalt script (service-nøkkel + sharp) genererer display
     2048/q0.85 + thumb 480/q0.7 for alle eksisterende media-rader, skriver `thumbnail_path` (klienten
     leser den først i B), setter riktig cacheControl. **Safeguard (godkjent): originalobjektene beholdes
     inntil videre — ingen automatisk sletting.** Eksplisitt original-policy besluttes før launch, etter
     visuell TestFlight-validering av 2048-masteren. (Storage-kostnad ~78 MB — ubetydelig.)
- **Hvorfor:** fjerner de fire multiplikatorene (seksjon 1) med minimal risiko; hver kontrakt peker inn i
  B (P3: null planlagt kast). Backfill er obligatorisk fordi 24 t-TTL-en ellers gjør legacy-originalene til
  et daglig re-nedlastingsproblem — og den hjelper også gamle appversjoner (~10× mindre filer).
- **Videreføres:** alt. MediaImage-innmaten byttes i B (kontrakt uendret); picker-2048 suppleres med
  compressor-thumb i B.
- **Risiko:** lav. Størst: onError-refresh-løkke (rate-limited), klokkeskjev (6 t-margin på TTL-sjekk).
- **Migrering:** ingen SQL (bucket-limits er config via API/dashboard).
- **Test:** jest på signedUrlCache (TTL/gjenbruk/prune/dedupe) + regresjonstesten + manuell enhetstest:
  «scroll feeden to ganger → 0 nye bildenedlastinger i netMetrics», «mål i livekamp → 1 event-refetch,
  0 bilde-nedlastinger».
- **Rollback:** revert per commit + forrige TestFlight-bygg; cachen er versjonert og selvutløpende.
- **Exit:** dags-egress −80 %+ innen 48 t etter flåteoppdatering; feedåpning ≤ 6 kall; Q4-repetisjon ≈ 1
  per objekt per døgn per enhet; cached > uncached-trend synlig i Usage.

## Fase B — Launch-ready produksjonsfundament (3 PR-er, starter når A er verifisert stabil)

- **Arkitekturmål:** P13-kriteriene. Dette er arkitekturen Heia lanserer offentlig med.
- **B1 — Media-pipeline:** `install-expo-modules` (SDK 55; egen testbranch; Brage kjører pod install
  manuelt) → expo-image inn i MediaImage (`cacheKey = storage_path`, `cachePolicy: 'disk'`,
  `configureCache({maxDiskSize: 150 MB})`, `clearDiskCache()` inn i clearLocalCaches) →
  react-native-compressor 2.0.3 (fallback 1.19.4): pickeren beholder display 2048/q0.85 fra A; compressor
  avleder thumb 480/q0.7 fra display-fila → `thumbnail_path` skrives ved opplasting og leses med fallback →
  opplasting via expo-file-system `uploadAsync` (base64-brua fjernes). EXIF-orientering telefontestes før frys.
- **B2 — Data + rendering:** TanStack Query v5 på varme stier (queryKeys fra P7); FlatList-feed +
  React.memo + cursor-paginering (RPC-ens ubrukte param); galleri → FlatList `windowSize: 3`;
  `getTeamEvents({from, to, limit})` + deling Hjem/Kalender; members via query-cache (fikser
  CommentsScreen-dobbelthenting); inkrementell inbox.
- **B3 — Realtime + sikkerhet + prod-observability:** payload-kontrakten (P6) via
  `queryClient.setQueryData`; migrasjon 00059 (`REPLICA IDENTITY FULL` på reactions); status-callbacks +
  resync ved reconnect/resume; P10 «må»-fiksene (+ «bør» hvis kapasitet); Sentry; CI (tsc + jest på PR).
- **Avhengigheter:** B2s bildedeler avhenger av B1; B3 er uavhengig og kan gå parallelt.
- **Risiko:** middels — install-expo-modules (mitigeres i testbranch), FlatList-oppførsel (test
  pull-to-refresh/compose-fokus), Nitro-pod (dagsfallback til 1.19.4).
- **Migrering:** 00059 (additiv; reversibel med `REPLICA IDENTITY DEFAULT`) + policy-/indeksfikser fra P10.
- **Test:** P13-protokollen; enhetstester for resolver-livssyklus (signOut-tømming, prefix-purge,
  delete-invalidering); livekamp-test med 5 samtidige klienter; flymodustest; eldre-iPhone-scroll.
- **Rollback:** per-PR; native deps krever nytt bygg → A skal være verifisert stabil før B1 merges.
- **Exit:** hele P13-listen, målt over 2 uker TestFlight.

## Fase C — Skalering/pivot (terskelstyrt, ingenting bygges nå)

Pro-plan ved launch (P11); Broadcast ved > ~500 samtidige per kamp; ekstern CDN ved vedvarende > 60–70 %
av Pro-kvoten eller miss-rate > 30 % etter B; ekstern videotjeneste (Mux/Cloudflare Stream) den dagen video
besluttes; original-arkiv (`original_path`, additiv kolonne + wifi-bakgrunnsopplasting) hvis album/minner
blir produkt; offentlig innholdslag (egen bucket + CDN) når klubbflater/web kommer; TanStack-persistering
for sterkere offline ved behov.

## Konklusjon

1. **Endelig anbefalt arkitektur før launch:** privat `feed-media` med 24 t signerte URL-er gjenbrukt via
   resolver (MediaRef-kontrakt i UI); 2048-master + 480-thumb generert på klient ved opplasting;
   expo-image med path-nøklet, 150 MB LRU disk-cache; TanStack Query på de varme lesestiene;
   payload-først realtime der refetch er unntaket; netMetrics + Sentry + CI-kallvakter; Supabase Pro fra
   launch. Livssyklus: signOut tømmer alt, medlemskapstap purger lag-prefiks, sletting invaliderer.
2. **Beslutninger som låses nå:** MediaRef/path-kontrakten (UI ser aldri leverandør-URL-er); 2048-master
   uten original hos Heia for NYE opplastinger (P2 — opplasterens kamerarull er originalarkivet;
   **safeguard: eksisterende legacy-originaler beholdes til eksplisitt pre-launch-beslutning**); TTL 24 t +
   cacheControl-policy per bucket (P1 — kan ikke endres per objekt i etterkant); TanStack som query-lag;
   SDK 55-familien (expo-image/expo-file-system) + react-native-compressor; payload-kontrakten P6;
   **feed-media forblir privat — for alltid.**
3. **Bevisst IKKE låst:** CDN-/lagringsleverandør (resolver-seamen), realtime-transport
   (subscribeTo*-seamen), videotjeneste, offentlig innholdslag, original-arkiv (additivt), avatar-pipeline,
   offline-persistering av query-cachen.
4. **A0 → A → B står.** Baseline må foreligge før adferd endres (ellers kan effekten aldri bevises); A er
   en ren delmengde av B-kontraktene (P3: null planlagt kast); B uten A ville dyttet native-avhengigheter
   inn i akuttvinduet før 5. september.
5. **Endret fra opprinnelig plan etter denne runden:** signed-URL-TTL 7 døgn → **24 t**; cacheControl på
   privat media 1 år → **24 t** (Free har basic CDN uten slette-invalidering; policyen kan ikke endres i
   etterkant); backfill valgfri → **obligatorisk A-oppfølger** (hjelper også gamle klienter); håndrullet
   staleCache → **TanStack Query i B** (realtime-kontrakten trenger sentral, imperativt oppdaterbar cache;
   web gjenbruker laget); egen CachedImage + blob-util + bam-resizer → **expo-image + expo-file-system +
   react-native-compressor** (SDK 55 matcher RN 0.83 eksakt — premisset for å avvise expo-modules var
   faktafeil; `cacheKey` løser token-rotasjonen på komponentnivå); bucket-limits via SQL →
   **API/dashboard**; getUser: **ingen kategori B fantes** — alle 9 kallsteder erstattes; tre nye A-punkter
   fra kodeanalysen (fjernet-medlem-resync, signOut-sentralisering, delete-invalidering).

# DEL IV — Test- og måleplan

**Instrumentering (~70 linjer, __DEV__-gatet, del av fase A/B):**
1. Fetch-interceptor i [supabase.ts](src/lib/supabase.ts) (`global: {fetch: tracked}`): kall, bytes
   (content-length), varighet, statuskode per path (query strippes, UUID-er normaliseres). Fanger 100 % av
   REST/RPC/Auth/Storage-signering — 39 rpc + 20 auth + 8 storage + 3 from + 3 functions kallsteder.
2. Skjermattribusjon via `NavigationContainer onStateChange` (~5 linjer) → «kall per skjermåpning».
3. `MediaImage` (fra fase A) med innebygd `onLoadStart/End`-måling nøklet på `storage_path` → teller «samme
   objekt lastet N ganger» (beviser dobbeltnedlasting direkte) + tid-til-første-bilde; i B også disk-cache
   hit/miss. (Bildebytes kan IKKE måles fra JS — F27; de hentes fra serverloggene, jf. P9.)
4. Én refetch-regresjonstest (`__tests__/refetch.test.tsx`): mock supabase, monter TeamHomeScreen,
   `expect(rpc).toHaveBeenCalledTimes(målt tall)`.

**Før/etter-metrikker (mål ved baseline, etter fase A, etter fase B):**

| Metrikk | I dag (estimert/målt) | Mål etter A | Mål etter B |
|---|---|---|---|
| Bytes per feedåpning (bilder) | ~24–60 MB | < 3 MB (cache-miss) | < 2 MB første gang, ~0 ved cache-hit |
| HTTP-kall per feedåpning | 9 | ≤ 6 | ≤ 4 |
| Signeringer per skjermåpning | 1 batch × hver refetch | gjenbruk innen TTL | ~0 (cache) |
| Samme objekt lastet N ganger (MediaImage) | N ≫ 1 | N ≈ 1 per døgn (24 t-TTL) | N ≈ 1 per install (disk-cache) |
| Kall per målhendelse per tilskuer | ~19 | ≤ 4 | ≤ 2 (kirurgisk) |
| Tid til første feed-innhold (4G, kaldstart) | ~2–4 s (est.) | −30 % | < 1,5 s |
| Supabase-egress per dag | ~1,2 GB | < 150 MB | < 30 MB |
| Uncached/cached-forhold | 2,7 : 1 | snudd | cached ≫ uncached |

**Suksesskriterium for fase A:** dags-egress i Usage-grafen faller > 80 % innen 48 t etter at testflåten har
oppdatert appen.

# DEL V — Informasjon som fortsatt trengs (fra deg/dashbordet)

1. **Settings → Usage → Bandwidth** (perioden 30/7–7/8): splitt per tjeneste (Storage/DB/Auth/Realtime/Functions).
   2 minutter — plasserer de 6,97 GB endelig.
2. **Sjekk loggretensjon først** (Settings → Billing): Free = 1 dag, Pro = 7 dager. Ved Free kjøres queriene
   under på *dagens* trafikk i stedet.
3. **Logs → Logs Explorer** (SQL ligger klar i `audit-observability.md`, Q1–Q7): egress per tjeneste (Q1),
   topp-objekter uten token (Q2), **cf_cache_status-fordeling (Q3 — beviser H1)**, repetisjon per klient (Q4),
   signeringsfrekvens per time (Q5), RPC-bytes + feilrate (Q6 — avdekker H5), døgnprofil (Q7).
4. **SQL Editor:** `SELECT count(*), avg(size_bytes)/1e6, max(size_bytes)/1e6, avg(width), mime_type FROM media
   WHERE deleted_at IS NULL GROUP BY mime_type;` — bekrefter H2 (reell filstørrelse + HEIC-innslag).
5. **Reports → Storage:** cache hit rate for perioden.
6. **Fysisk enhet (senere, etter fase A):** TestFlight-måling av tid-til-innhold med instrumenteringen på.

# DEL VI — Estimert omfang og filliste (v2)

| Fase | Omfang | Kode | Migrering | Eldre medier | Gamle appversjoner |
|---|---|---|---|---|---|
| A0 | Liten | ~120 linjer, 3–4 filer | nei | uberørt | uberørt |
| A | Middels | ~600 linjer, ~18 filer + backfill-script | ingen SQL (bucket-config via API) | backfill → varianter; originalene beholdes (safeguard — ingen automatisk sletting, pre-launch-beslutning) | fortsetter gammel adferd, men får lette varianter via backfill |
| B | Middels–stor | ~1 000 linjer, ~20 filer, native deps via SDK 55-familien | 00059 + P10-policyer/indekser | ferdig migrert i A | uberørt (fallback-lesing) |
| C | — | — | — | — | — |

Risiko samlet: A lav, B middels (install-expo-modules + FlatList-konvertering — begge mitigert med
testbranch og per-PR-rollback). Ingen fase endrer RLS-modellen, path-konvensjonen eller privatlivsmodellen.

**Fase A0:**
- Nye: `src/lib/netMetrics.ts`, `__tests__/feedRefetch.test.tsx`
- Endres: [src/lib/supabase.ts](src/lib/supabase.ts), [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx)

**Fase A:**
- Nye: `src/lib/media/types.ts`, `src/lib/media/resolver.ts` (inkl. signedUrlCache),
  `src/lib/media/MediaImage.tsx`, `src/lib/api/authUser.ts`, `scripts/backfill-media-variants.ts`,
  `__tests__/mediaResolver.test.ts`
- Endres: [src/lib/media.ts](src/lib/media.ts) (picker 2048/q0.85),
  [src/lib/api/feed.ts](src/lib/api/feed.ts) (MediaRef ut, signering inn i resolver, cacheControl,
  delete-invalidering), [src/lib/api/comments.ts](src/lib/api/comments.ts),
  [src/lib/api/teams.ts](src/lib/api/teams.ts), [src/lib/api/profile.ts](src/lib/api/profile.ts),
  [src/lib/api/events.ts](src/lib/api/events.ts) (getUser-fjerning),
  [src/lib/account.ts](src/lib/account.ts) (clearLocalCaches),
  [src/context/UserContext.tsx](src/context/UserContext.tsx) (signOut-hook),
  [src/context/TeamContext.tsx](src/context/TeamContext.tsx) (memberships-resync + prefix-purge),
  [src/context/NotificationsContext.tsx](src/context/NotificationsContext.tsx) (INSERT-gate),
  [src/screens/InboxScreen.tsx](src/screens/InboxScreen.tsx) (fokus-gate),
  [src/screens/EventDetailScreen.tsx](src/screens/EventDetailScreen.tsx) (debounce + splitt + fokus),
  [src/screens/TeamHomeScreen.tsx](src/screens/TeamHomeScreen.tsx) (stale-flagg),
  [src/app/App.tsx](src/app/App.tsx) (AppState-autoRefresh),
  [src/components/FeedCard.tsx](src/components/FeedCard.tsx),
  [src/components/MatchPhotoRail.tsx](src/components/MatchPhotoRail.tsx),
  [src/components/MatchPhotoGallery.tsx](src/components/MatchPhotoGallery.tsx),
  [src/components/MatchTimeline.tsx](src/components/MatchTimeline.tsx),
  [src/components/MatchEventRow.tsx](src/components/MatchEventRow.tsx),
  [src/screens/CommentsScreen.tsx](src/screens/CommentsScreen.tsx) (alle → MediaImage)
- Config (ikke SQL): bucket-limits + mime-typer via dashboard/Management API

**Fase B (i tillegg):**
- Nye: `src/lib/queries/` (queryKeys + hooks for feed/events/event/members/notifications),
  `supabase/migrations/00059_reactions_replica_identity.sql`,
  `supabase/migrations/00060_sikkerhet_policyer_indekser.sql` (P10 må+bør),
  `.github/workflows/ci.yml`
- Endres: `package.json` + Podfile/gradle (install-expo-modules: expo, expo-image, expo-file-system;
  react-native-compressor; @sentry/react-native; @tanstack/react-query),
  `src/lib/media/MediaImage.tsx` (expo-image-innmat), `src/lib/media.ts` (pick uten resize +
  compressor-varianter), feed.ts (to opplastinger + thumbnail_path-lesing + uploadAsync),
  TeamHomeScreen.tsx (FlatList + TanStack + payload-realtime), EventDetailScreen.tsx (payload-realtime),
  MatchPhotoGallery.tsx (FlatList windowSize 3), events.ts (datovindu),
  [src/lib/api/members.ts](src/lib/api/members.ts),
  [src/screens/KalenderScreen.tsx](src/screens/KalenderScreen.tsx), `src/app/App.tsx` (QueryClientProvider, Sentry)
