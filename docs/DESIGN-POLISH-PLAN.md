# Heia — design- og polish-plan

_Skrevet 2026-07-31 etter gjennomgang med Brage (skjermbilde av A v2-mockupen
som referanse). Rekkefølgen P1→P3 er Brages valg; resten er anbefalt
rekkefølge og kan stokkes. **Én skive per samtale.** Start samtalen med:
«Les docs/STATUS-HANDOFF.md og docs/DESIGN-POLISH-PLAN.md, og ta neste åpne
punkt.» Kryss av her når en skive er ferdig OG sett på telefon._

**Før alt annet — venter på Brages øyne (alt kodet):**
- [x] Lagfarge-skiven — ✅ verifisert på telefon + committet 2026-07-31
- [ ] Skive 5 — kamprapporten (aldri optisk verifisert)
- [x] P1 — skeletons — ✅ godkjent på telefon + committet 2026-07-31
- [x] P2 — MÅL-øyeblikket — ✅ godkjent på telefon + committet 2026-07-31
- [x] P3 — headeren — ✅ godkjent på telefon + committet 2026-07-31

---

## P1 — Lastetilstander: skeleton + tomkort (designgjeld b) — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31 og committet.**
Kun JS → Metro-reload.

**Hva:** Erstatt de rå `ActivityIndicator`-ene på skjermnivå med
skeleton-kort på Card-språket (grå/krem flater med svak puls) og gi tomme
tilstander personlighet (copy-retningslinjene i BRAND_UI).

- Skjermer: TeamHome (feeden), Kalender, Season, Inbox, TeamMembers,
  EventDetail, Comments, Auth/CreateTeam/JoinTeamCode (mindre viktig).
- **Behold** spinneren i `Button` (inline lagre-state er riktig bruk) og
  små inline-tilfeller (MatchPhotoSheet); dette gjelder skjerm-åpninger.
- Ny delt `Skeleton`-komponent: RN `Animated` opacity-puls — **ingen
  shimmer-bibliotek, ingen nye deps.**
- Samme skive: `tintColor` på alle `RefreshControl` (i dag system-grå).
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31):**
- Ny `src/components/Skeleton.tsx`: `Skeleton` (pulserende blokk, ÉN delt
  modul-loop med refcount så alle bones puster i takt), `SkeletonCard`,
  `FeedCardSkeleton`, `EventCardSkeleton`, `ListRowSkeleton`.
- Skeleton inne: TeamHome (3 feedkort), Kalender (etikett + 3 eventkort),
  Season (stadion-KPI med `stadiumEdge`-bones + kampliste), Inbox (4 rader
  i listekortet), TeamMembers (header + 4 rader — lagnavnet vises ekte,
  det er kjent fra context), EventDetail (info-kort + RSVP-kort),
  Comments (innleggskort + 2 replikk-bobler), CreateTeam (3 sport-piller).
- **Beholdt som spinner (bevisst):** Auth (submit-state) og JoinTeamCode
  (oppslag ETTER knappetrykk) — det er handlingstilstander, samme kategori
  som `Button loading`; pluss AppNavigator-bootskjermen (før noe UI finnes).
- `RefreshControl`-tinten var allerede mint på alle 5 (fikset i
  telefontest-runden) — verifisert, ingenting å gjøre.
- Copy: TeamHome-tom «Stille her ennå …», Kalender-tom «Kalenderen er
  tom» (BRAND_UI-eksemplene); resten hadde alt personlighet.

## P2 — MÅL-øyeblikket (designgjeld c) — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31 («funker veldig
bra», inkl. banner-dempingen) og committet.**

**Hva:** Én målrettet animasjon der appen lever mest: scoren.

- Score-tallet i `ScoreBoard`/`LiveMatchBanner` spretter/skalerer når det
  endres (Animated spring). Gjelder også via realtime hos foreldre — det
  er DER magien er.
- Mål for oss: kort feiring i grønt/gult (f.eks. glød-puls på flaten).
  **Aldri coral** (låst: coral = live-status, grønt/gult = feiring).
- Reporterens «Mål oss»-knapp: liten trykk-respons (scale).
- Stretch: SEIER-øyeblikk når kampen ender med seier (pill-en animerer inn).
- **KUN innebygd RN `Animated`** — reanimated er IKKE installert, og skal
  ikke installeres for dette (rebuild-kostnad + risiko).
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31):**
- Ny `src/components/useGoalMoment.ts`: hook som oppdager scoreendring fra
  props (prop-diff = fyrer også via realtime-refetch hos foreldre) og
  driver `scoreScale` (sprett ~1.3 → fjærende ned) + `celebrate`
  (mint-glød over stadionflaten, 150 ms opp → 800 ms ut). **Mål for oss =
  sprett + glød; mål imot = kun sprett** (informasjon, ikke feiring).
  Ingen animasjon ved mount — å åpne en pågående kamp gir ro.
- `ScoreBoard`: Animated-score + glød-overlay + **SEIER-pillen spretter
  inn** (spring, liten delay) når den dukker opp — stretch-punktet tatt.
- `LiveMatchBanner`: samme hook — Hjem-banneret refetches av
  feed-subscriben (hvert mål er en feed-post), så foreldre på Hjem ser det.
- `ReporterActions`: målknappene gir etter (0.95) ved press og fjærer
  tilbake ved slipp (`GoalButton`, flex flyttet til wrapperen).
- Telefonfunn samme dag: varselbanneret la seg oppå scoreboardet på
  kampsiden. Fikset: `watchEvent(eventId)` i NotificationsContext —
  match_live-varsler for kampen du står på (i fokus, mens den er i gang)
  dempes; badge/inbox består, alle andre skjermer/kategorier urørt.

## P3 — Headeren som mockupen — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31 og committet.**

**Hva:** TeamHeader matcher A v2-mockupen: logo-sirkel + lagnavn +
undertekst «Fotball · 18 medlemmer».

- Sport kommer gratis fra `activeTeam.sport.displayName` (ligger i context,
  ubrukt av headeren i dag).
- Medlemstall: billig count-select (`memberships`, `status='active'`,
  `head: true`) — cache i TeamContext så headeren ikke spør per skjerm.
  Faller tallet bort (feil/tregt): vis «Fotball · G14» (sport + ageGroup)
  — aldri en tom undertekst.
- Logo-sirkelen, fallback-kjede: lag-logo → klubblogo → dagens initialer
  på lagfarge (med `inkOnTeamColor` — gult krever mørke initialer).
- **Vakt:** headeren skal ikke bli høyere enn mockupen — neste
  hendelse-kortet skal fortsatt synes uten scrolling.
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31):**
- `TeamHeader`: rundet firkant → SIRKEL; lagfarge-stripen under navnet er
  erstattet av underteksten (lagfargen bor i ringen + initial-fyllet).
  Høyden er uendret (40 pt sirkel, navn+undertekst ≈ 38 pt) — vakten holdt.
- Fallback-kjeden står klar FØR URL-ene finnes (P4 lager opplastingen):
  `Club`-typen fikk `logoUrl` (feltet lå alt i selecten, var bare ikke
  mappet); `onError` → initialer, husket per URL så lagbytte prøver igjen.
- `TeamContext.activeMemberCount`: ny `getTeamMemberCount()` (head-count,
  samme telling som `lookup_invite_code`), cachet per lagrom i en ref-Map.
  RLS-vakt: teller ikke før eget medlemskap finnes i listen (ellers falskt
  0 — RLS teller kun synlige rader). Singular «1 medlem».

## P4 — «Laginnstillinger»-side + KLUBBLOGO

**Modell (BESLUTTET 2026-07-31 etter diskusjon Brage ↔ Claude): logoen bor
på KLUBBEN, ikke laget.** Brages resonnement vant, og skjemaet bekrefter
det — `clubs.logo_url` FINNES allerede (00002, dødt felt):

- Oppretter Ottestad G10 «Ottestad IL» med logo, finner Ottestad G12
  klubben senere i søket med navn + logo ferdig — profesjonelt, og et
  reelt dedup-incentiv (folk gjenbruker klubben i stedet for å opprette
  duplikat når de SER den med logo).
- Klubbnavnet har ALLEREDE samme governance: første bruker skriver det,
  alle senere gjenbruker det, ingen kan endre. Write-once-logoen speiler
  bare det som alt gjelder.
- Klubb er ren metadata i Heia — lag som deler klubb deler INGENTING annet
  (ikke feed, ikke medlemmer, ikke tilgang). At vilkårlige lag deler
  klubbrad er derfor ufarlig; logoen er den eneste delte flaten.

**MVP-regler:**
- Lagadmin i klubben kan **LEGGE TIL** logo når klubben mangler en —
  **aldri overskrive**. Endringer = manuelt (SQL/dashboard) til en
  klubbadmin-/verifiseringsrolle finnes. Akseptert risiko: feil/upassende
  logo står til manuell fiks — OK på MVP-skala.
- Opplasteren blir IKKE klubbeier/klubbadmin — de er bare admin for sitt
  eget lag.

**Teknisk (krever ÉN migrasjon, INGEN rebuild — picker er alt inne):**
- RPC `set_club_logo(p_club_id, p_url)` — SECURITY DEFINER (clubs er
  client-read-only, 00016-mønsteret). Vakter, ALLE med COALESCE
  (NULL-fella fra 00020): caller er trener/lagleder/admin i et lag i
  klubben (hindrer drive-by-opplasting på fremmede klubber) +
  `logo_url IS NULL` (write-once).
- **Offentlig** storage-bucket `club-logos`, path `{club_id}/logo` —
  offentlig fordi logo ikke er persondata, og signerte URL-er utløper
  (header + søkeresultater rendres konstant). INSERT-policy speiler
  RPC-vakten.
- Resize i picker (maxWidth/maxHeight ~512) — headeren skal ikke laste
  et 12 MP-foto.

**Lag-logo som override (BESLUTTET 2026-07-31 — Brage spurte, svaret er ja):**
- `team_spaces.logo_url` (finnes alt, mappes alt som `logoUrl`) er
  per-lag-OVERRIDE: fallback-kjeden overalt er **lag-logo → klubblogo →
  initialer på lagfarge**.
- Lagadmin kan sette OG endre lag-logoen fritt — ingen write-once her,
  for blast radius er kun eget lag (i motsetning til den delte klubblogoen).
- Bor på samme «Laginnstillinger»-side. Path `{team_space_id}/logo` i
  samme bucket.

**Fleridrettslag (vurdert 2026-07-31 — Storhamar fotball vs. håndball):**
- Modellen er ALLEREDE riktig: klubb = paraply, sport bor på laget
  (`teams.sport_id`) — dette speiler NIF-virkeligheten der et idrettslag
  har grupper per idrett under ett navn og én hovedlogo.
- IKKE flytt sport til klubben, IKKE bygg gruppe-hierarki. To ventiler
  finnes allerede for grupper med egen identitet: (1) klubbnavnet er
  fritekst — «Storhamar Håndball» kan opprettes som egen klubboppføring
  med egen logo; (2) lag-logo-overriden over.
- Brukerne velger selv hvilken ventil som passer — ingen migrasjon
  trengs for noen av utfallene. La bruken svare, som Brage sa.

**UX:**
- Klubb-dropdownen i CreateTeam viser logo ved klubbnavnet (initialer
  som fallback) — dette ER dedup-incentivet.
- Ny klubb: valgfritt «Legg til klubblogo?»-steg ETTER at laget er
  opprettet (klubben må finnes først for path/RPC — logoen kan ikke
  lastes opp før klubbraden eksisterer).
- Egen **«Laginnstillinger»**-side (ProfilStack, kun trener/lagleder/
  admin): lagnavn (UPDATE dekkes av 00014-policyen, husk
  `.select('id')`-vakta), lagfarge (flytt raden fra lagfarge-skiven hit),
  og «Legg til klubblogo» KUN når klubben mangler en (finnes den: vis
  read-only).
- **Inngang: Profil-rad, IKKE header-trykk.** Headeren er også
  foreldrenes flate — et trykk som åpner admin-redigering er dødt for de
  fleste (samme prinsipp som «+-knappen skal aldri være død for en
  forelder»).

## P5 — Kampforløpet: skannbarhet (+ designgjeld f)

**Hva:** Differensier markørene i `MatchEventRow`/`MatchTimeline` så et mål
oppdages ved rask scrolling. Brages spec, med én korreksjon:

- Avspark/fortsettelse: nøytral mørk/dempet markør (i dag heiaTint — feil,
  avspark er ikke feiring).
- **Mål for oss: mint-sirkel med liten gull-detalj** (feiring: grønt/gult).
- **Mål imot: dempet NØYTRAL markør — IKKE coral.** (Brages forslag sa
  «nøytral/coral», men coral er låst til KUN live-status, «aldri coral på
  mål». Dempet nøytral er også riktig etos: mål imot er informasjon, ikke
  alarm — samme tankegang som «ingen TAP-roping».)
- Slutt: mørk sluttmarkør (stadium-tone).
- **Samme fil, samme skive:** erstatt tegn-glyfene `bytte` (↔) og `kort`
  (🟨) med tegnede ikoner i icons.tsx-mønsteret (Lucide har
  repeat/rectangle-vertical — eller egen liten svg som `Ball`).
- Ikke mer pynt enn dette — skannbarhet, ikke nytt konsept.
- Kun JS → Metro-reload.

## P5B — Hendelsessiden: hero + kampdag-modus (NY 2026-07-31 — Brages funn)

**Hva:** Brage så på telefon at hendelsessiden er «for mye hvitt og for
kjedelig hero»: info-kortet (pill + tittel + rå metaliste) er likt for
trening og kamp, og skjermen FØR kampstart blander kampdag-følelse
(«Start kamp» med glød) med et helt nøytralt kort. Tas **sammen med eller
rett etter P5** — samme skjerm, samme samtale er billigst.

- **Trening/sosialt/annet:** gi info-kortet personlighet UTEN mørk flate
  (låst: mørk flate = kamp). Retning: type-tonet aksent på kortet
  (infoSoft-topp for trening, remindSoft for sosialt — samme semantikk
  som pillene), stor tid/dato med displayfonten (Nunito) i stedet for
  metaliste-rad, sted som egen rolig rad.
- **Kamp før avspark («kampdag»):** motstander + avspark fortjener mer
  enn «kamp mot lyn» i sort på hvitt. Retning: en liten stadion-smak —
  mørk mini-platte med «oss – dem»/avsparkstid (IKKE full ScoreBoard, det
  er live-kampens språk) — og «Start kamp»-flyten under. RSVP består,
  men kampdagen skal føles som noe annet enn en trening.
- **Vakt:** ikke rør live-modusen og kamprapporten (de er alt på
  stadionspråket) — dette gjelder VANLIG event-modus + før-kamp.
- Kun JS → Metro-reload.

## P6 — Varsler-polish + globalt kontrastpass

**Hva:** Brages funn fra telefon i dagslys. Kontrasten er egentlig et
GLOBALT token-funn, ikke bare Varsler.

- **Token-grep (forsiktig!):** mørkne `textSecondary` (#5F7265) og
  `textTertiary` (#93A195) ett hakk (kandidat: ~#54685C / ~#7E8E82).
  Endrer HELE appen — sjekk på fysisk telefon i dagslys, ikke simulator.
- `NotificationRow`: tydeligere luft/hierarki mellom avsender, innhold og
  tidspunkt. Ulest har ALT heiaSoft-flate + grønn prikk (Fase 5) — juster
  styrken heller enn å bygge nytt.
- **Behold listen enkel** — ikke separate store kort (Brages ord).
- Kun JS → Metro-reload.

## P7 — Profil-polish

**Hva:** Skjermen er ryddig men generisk — løft den til resten av appen,
uten redesign.

- Toppområdet på varm bakgrunnstone (`background`, i dag hvit `surface`
  som føles frakoblet).
- Strammere vertikal luft øverst.
- `ChevronRight` på navigasjonsrader — `ListRow` har alt en ubrukt
  `right`-prop. Konsekvent ikonlogikk på radene (i dag er de fleste
  ikon-slots tomme strenger).
- Tydeligere seksjonsskille lag ↔ innstillinger (mint-strek-etiketter som
  resten av appen). «Laginnstillinger»-raden fra P4 hører hjemme her.
- Kun JS → Metro-reload.

## P8 — Hero-karusell på Hjem

**Hva:** Brages forslag — bla bortover på øverste hendelse.

- Horisontal `FlatList` med `pagingEnabled`: neste 2–3 hendelser + et
  siste «Åpne kalenderen»-kort. Prikker under (aktiv = mint).
- **Live-kampen beholder hero-prioritet** — karusellen gjelder kun
  hverdagsmodus (uten aktiv kamp).
- `pickNextEvent`-logikken generaliseres til `pickNextEvents(n)`.
- Kun JS → Metro-reload.

## P9 — Kalenderen: rytme, ikke grid

**Vurdering (anbefaling — Brage avgjør):** Listen er RIKTIG for lagrytme.
Et lag har 2–3 hendelser i uka — et månedsgrid blir stort sett tomme
ruter, og uke-visning gir lite over listen. Repetisjonsfølelsen kommer av
at alle kort er identiske, ikke av listeformen.

- Gjør: månedsskiller (dempet etikett når måneden bytter), fortidskort
  dempes, treningsrader litt kompaktere enn kamp-kort (kamp er alt mørk
  stripe — bevar hierarkiet kamp > trening > annet).
- **Parkert beslutning:** uke-/månedsvisning som toggle. Ta den opp igjen
  når lag har mer historikk/tetthet — ikke bygg nå.
- Kun JS → Metro-reload.

---

## Backlog (fra designgjeld-listen + nye idéer — ikke i P-rekkefølgen)

- [ ] **a) BRAND_UI.md skrives om til A v2** — beskytter alle fremtidige
  samtaler mot å bygge på det gamle systemet. Kan tas når som helst,
  gjerne sammen med en P-skive.
- [ ] **d) Haptikk** (mål/Heia/start/slutt) — **krever native modul →
  rebuild.** Ta den samtidig med neste rebuild uansett årsak.
- [ ] **e) Tilgjengelighet:** accessibilityLabels på interaktive elementer
  (7 stk i hele appen i dag) + vurder Dynamic Type. Målgruppa er
  foreldre 40+.
- [ ] **g) LÅS beslutning: ingen mørk modus i v1** — mørk flate BETYR kamp
  i A v2; systemvid mørk modus spiser signaturen. (Skriv inn i BRAND_UI
  når a) tas.)
- [ ] **Push deep-link ved tap** — `data.feed_post_id/event_id` sendes
  allerede, appen navigerer bare ikke (kjent v1-hull fra Fase 4).
- [ ] **Delbart invitasjonskort** — invitasjonskoden som pent bilde å dele
  i foreldregruppa (Strava-DNA: deling er vekstmotoren). Idé, ikke lovet.
- [x] **Sport + årsklasse** — ✅ dekket av P3 (undertekst); SENERE-punkt 9
  i STATUS-HANDOFF er strøket 2026-07-31.

## Faste regler for alle skivene

1. `npx eslint src` — 0 nye feil/warnings. **ALDRI kjør tsc** (låst regel).
2. Ingen nye native-deps uten eksplisitt avtale (rebuild koster).
3. Låste A v2-regler gjelder: coral = kun live; grønt/gult = feiring;
   mint aldri som tekst på lyst; glød rasjonert; ingen TAP-roping;
   «valgt skifter flate».
4. Oppdater STATUS-HANDOFF.md + kryss av her når skiven er ferdig.
