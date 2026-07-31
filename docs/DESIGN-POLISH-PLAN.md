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
- [x] P4 — laginnstillinger + klubblogo — ✅ godkjent på telefon 2026-07-31
- [x] P5 + P5B — kampforløpet + hendelsessiden — ✅ godkjent på telefon
  2026-07-31
- [x] P6 — Varsler-listen (omskrevet scope, se P6) — ✅ godkjent på
  telefon 2026-07-31
- [x] P7 — Profil-polish (+ logo i «Dine lag», Brages ønske) — ✅ godkjent
  på telefon 2026-07-31
- [x] P8 — Hero-karusell på Hjem — ✅ godkjent på telefon 2026-07-31
- [x] P9 — Kalenderen: rytme + kompakthero-kort — ✅ godkjent på telefon
  2026-07-31 (etter tre retningsrunder) — HELE P1–P9-PLANEN ER I MÅL

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

## P4 — «Laginnstillinger»-side + KLUBBLOGO — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31.** Første
telefontest fant «new row violates RLS» ved opplasting → to policy-fikser
(00035: kvalifiser `objects.name` i policy-subqueries; 00036: bucket som
lastes opp til trenger SELECT-policy pga. `INSERT … RETURNING` — også
offentlige). Runde 2 fant Hjem-hoppet (stille refresh i TeamContext) og
manglende logo på kampsiden (ny delt `TeamBadge`).

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

**Slik ble det (2026-07-31):**
- Migrasjon `00034`: `is_club_team_admin()`-helper, offentlig
  `club-logos`-bucket, klubb-INSERT-policy (write-once også på filnivå),
  lag-INSERT/DELETE-policyer, `set_club_logo`-RPC (COALESCE-vakter,
  `FOR UPDATE`, URL må peke i klubbens mappe). Laglogo-UPDATE dekkes av
  00014-policyen — ingen ny RLS.
- `TeamSettingsScreen` (ProfilStack): lagnavn + lagfarge (inline picker,
  trykk = lagre) + laglogo (Velg/Bytt/Fjern, ring-forhåndsvisning) +
  klubblogo (read-only når satt, «Legg til» når den mangler).
  Profil-raden «Laginnstillinger» erstatter Lagfarge-raden;
  `TeamColorSheet` er slettet.
- Nytt filnavn per opplasting (RN cacher per URL) + `pickLogoImage()`
  med 512 px resize, rett til kamerarullen.
- CreateTeam: `ClubBadge` (logo/initialer) i klubb-dropdownen, og
  valgfritt «Legg til klubblogoen?»-alert etter opprettelse av NY klubb —
  lagt i `executeCreate` så auth-before-commit-veien også dekkes.
- Runde 2 (Brages funn): stille `refreshMemberships` (lagring på
  Laginnstillinger kastet deg til Hjem — AppNavigator river navigatoren
  på loading), og ny delt `TeamBadge` så logoen vises på ALLE
  lagmerke-flater: ScoreBoard (kampside/kamprapport), LiveMatchBanner og
  TeamHeader (hvit plate bak logo på mørk stadionflate).

## P5 — Kampforløpet: skannbarhet (+ designgjeld f) — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31 (sammen med
P5B).**

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

**Slik ble det (2026-07-31):**
- `markerFor(event)` i `MatchEventRow` erstatter de statiske
  ikon/farge-tabellene — markøren avhenger nå av `teamSide`, ikke bare type.
- **Ballen betyr MÅL og ingenting annet:** avspark/fortsettelse bruker
  Play-pilen (dempet `surfaceMuted`, ikke lenger heiaTint — avspark er ikke
  feiring). Mål for oss: mint-sirkel (`heiaTint`) + liten gull-prikk med
  hvit kant øverst til høyre. Mål imot (og mål uten `teamSide`): dempet
  nøytral — aldri coral. Slutt: stadion-mørk markør (`colors.stadium`,
  Flag i `stadiumText`).
- Glyfene erstattet: `bytte` = Lucide `ArrowLeftRight` (den tegnede
  versjonen av ↔), `kort` = ny egen svg `BookingCard` i icons.tsx (FYLT
  gull-rektangel med lett helning og goldInk-kant — Lucide har kun
  stroke-rektangler, og et dommerkort er en fylt flate).
- `MatchPhotoSheet` bruker fortsatt tegn-glyfer — bevisst: der er de del
  av en ren TEKST-etikett i øyeblikk-velgeren («⚽ 34' Mål oss»), ikke
  tidslinje-markører.

## P5B — Hendelsessiden: hero + kampdag-modus (NY 2026-07-31 — Brages funn) — ✅ FERDIG (godkjent på telefon 2026-07-31)

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

**Slik ble det (2026-07-31):**
- **Info-kortet (trening/sosialt/turnering/annet + avlyst kamp):**
  type-tonet aksentbånd øverst i kortet (infoSoft/remindSoft/sun/
  surfaceMuted — samme semantikk som pillene) med typeetiketten skrevet
  rett i båndets ink-farge (en pill i softfargen ville druknet i bånd av
  samme farge), stort klokkeslett i displayfonten (Nunito, 24 pt) til
  høyre, dato i fet under. Metalisten (Dato/Tid/Sted-rader) er borte;
  sted er en rolig MapPin-rad i den hvite kortkroppen under tittelen.
- **Kampdag (kommende kamp med motstander):** mørk mini-platte
  (`StadiumSurface`, cardResting-skygge — roligere enn ScoreBoard):
  «KAMPDAG»-etikett + dato øverst, lagmerkene (TeamBadge med logo/
  initialer + motstander-initialer på samme grå som ScoreBoard) rundt
  stort avsparkstidspunkt i mint (Nunito 32, UTEN glød — gløden er
  live-scorens signatur), «Avspark»-caption, sted sentrert nederst.
  Standardtittelen («Kamp mot Lyn») vises ikke — platta sier det samme;
  en egendefinert tittel vises. Kamp uten motstander faller tilbake til
  info-kortet (kamp-aksent). ReporterBar + «Start kamp» + RSVP under, urørt.
- Live-modus og kamprapporten er ikke rørt (vakten holdt).

## P6 — Varsler-listen: luft + tidsbolker — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31.
SCOPE OMSKREVET 2026-07-31 av Brage: det tidligere globale
kontrastpasset (mørkne textSecondary/textTertiary) var en MISFORSTÅELSE
og er STRØKET — dette er kun Varsler-listen, polish, ikke nytt konsept.**

**Hva (Brages ord):**
- Tydeligere avstand mellom avsender, innhold og tidspunkt i raden.
- Behold listen enkel — ikke separate store kort.
- En tidsinndeling, f.eks. «i går / siste 7 dager / siste 30 dager» —
  Claude bestemmer detaljene.
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31):**
- **Bolker:** «I dag / I går / Siste 7 dager / Tidligere» med appens
  mint-strek-etikett (`SectionHeader`) mellom listekortene. Radene kommer
  nyest først, så grupperingen er en enkel run-deling — ingen ny modell.
  Tomme bolker vises ikke.
- **`NotificationRow` — mer luft:** paddingVertical md→lg (radene puster),
  gap tittel↔innhold 2→4, gap tittel↔tidspunkt sm→md. Fortsatt samme
  enkle liste; ulest-flaten (heiaSoft) og prikken er urørt.
- **Tidsstempelet:** «I går»/«3 d» ble ukedag («tir.») for 1–6 dager
  siden — bolk-etiketten sier alt «I går», raden skal ikke gjenta den.
- Luften under «Varsler»-headeren eies nå av seksjonsetikettens eget
  topp-rom; tilstander uten bolker (skeleton/feil/tom) har egen
  `standalone`-margin.

## P7 — Profil-polish — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31.
Brages tillegg samme dag: lagmerkene under «Dine lag» skal vise LOGOEN
(samme fallback-kjede som headeren) når den finnes, ikke bare
fargeprikken.**

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

**Slik ble det (2026-07-31):**
- **Toppen på varm bakgrunnstone:** profilseksjonen (avatar/navn/rolle)
  er ikke lenger et hvitt kort med skygge — den ligger rett på
  `background`, og luften øverst er strammet (paddingTop 2xl→lg, gap
  sm→xs). Forelder-rollepillen fikk hvit flate + subtil kant
  (background-tonen dens forsvant mot den nye bakgrunnen).
- **«Dine lag» viser lagmerket (Brages ønske):** fargeprikken er
  erstattet av `TeamBadge` (36 pt sirkel) per medlemskap — lag-logo →
  klubblogo → initialer på lagfarge. `TeamBadge` fikk `logoUrl`/`color`-
  props som overstyrer context (den var låst til AKTIVT lag; Profil viser
  alle lagene dine) — utelatt prop = context-kjeden, alle gamle
  kallsteder urørt. Aktiv-haken er tegnet `Check` i heiaInk.
- **To menykort med mint-strek-etiketter** (seksjonsskillet lag ↔
  innstillinger): «[lagnavnet]» (Lagoversikt, Laginnstillinger (trener),
  Inviter til laget) og «Innstillinger» (Telefonnummer, Bli med i et lag,
  Opprett et nytt lag, Varslinger, Logg ut, Om Heia).
- **Konsekvent ikonlogikk:** alle rader har tegnet Lucide-ikon
  (textSecondary, 20 pt) i fast slot — tomme streng-slots og 🔔-emojien er
  borte; nye eksporter `LogOut`/`Settings`/`Share2`/`UserPlus` i
  icons.tsx. `ChevronRight` på navigasjonsrader (`right`-propen i bruk);
  handlingsrader (Telefonnummer/Varslinger/Logg ut) har bevisst ingen.
  Laginnstillinger-raden bruker Settings-ikonet — fargeprikken der er
  borte, identiteten bor nå i «Dine lag»-kortene.

## P8 — Hero-karusell på Hjem — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31.**

**Hva:** Brages forslag — bla bortover på øverste hendelse.

- Horisontal `FlatList` med `pagingEnabled`: neste 2–3 hendelser + et
  siste «Åpne kalenderen»-kort. Prikker under (aktiv = mint).
- **Live-kampen beholder hero-prioritet** — karusellen gjelder kun
  hverdagsmodus (uten aktiv kamp).
- `pickNextEvent`-logikken generaliseres til `pickNextEvents(n)`.
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31):**
- Ny `NextEventCarousel` (components): horisontal FlatList med
  `pagingEnabled` — sidene er skjermbredde og bærer skjermmargen selv,
  så TeamHome legger karusellen i wrapper UTEN horisontal padding. Alle
  sidene (maks 4) rendres med én gang (`initialNumToRender`) så høyden
  ikke hopper når man blar.
- Sidene: de neste inntil 3 hendelsene som `NextEventHero` (urørt) + et
  siste «Åpne kalenderen»-kort (hvit flate, Calendar-ikon i
  heiaTint-sirkel, «Treninger, kamper og alt som skjer») som fyller
  sidehøyden og navigerer til Kalender-fanen
  (`getParent().navigate('KalenderStack')` — NewEvent-idiomet).
- Prikker under: aktiv = mint pill (18×6, samme språk som RSVP-fyllet),
  inaktive = dempet mørkgrønn; spores via `onMomentumScrollEnd`.
- `pickNextEvent` → `pickNextEvents(events, 3)` (samme filter som før:
  avlyst/ferdig hoppes over, uten sluttid = start + 2 t).
- Live-kampen beholder hero-prioritet (karusellen rendres kun uten
  liveMatch), og uten kommende hendelser vises ingen karusell — aldri
  et ensomt kalenderkort.

## P9 — Kalenderen: rytme, ikke grid — ✅ FERDIG

**Status: FERDIG — godkjent på telefon av Brage 2026-07-31 («Alt dette
ser bra ut»), etter tre retningsrunder samme dag. Historikken:** Claude anbefalte «miniatyr
av hendelsessiden» (P5B-bånd på hvite kort); Brage valgte den i
samtalen, men AVVISTE den på telefon — for store hvite «admin»-flater,
og spilte kamper ble dobbelt mørke-tunge. **Brages endelige retning
(GJELDER): kompakt hero-variant** — Hjem-heroens designspråk i
kalenderformat (mint/varm gradient, runde former, svak banegrafikk,
tydelig type-chip, dato/tid i kortet, RSVP/progress nederst), kamp
mørk/dramatisk, ingen store hvite flater; kalenderen skal være
skannbar OG umiddelbart kjennes som samme Heia som Hjem.

**Vurdering (anbefaling — Brage avgjør):** Listen er RIKTIG for lagrytme.
Et lag har 2–3 hendelser i uka — et månedsgrid blir stort sett tomme
ruter, og uke-visning gir lite over listen. Repetisjonsfølelsen kommer av
at alle kort er identiske, ikke av listeformen.

- Gjør: månedsskiller (dempet etikett når måneden bytter), fortidskort
  dempes, treningsrader litt kompaktere enn kamp-kort (kamp er alt mørk
  stripe — bevar hierarkiet kamp > trening > annet).
- **LÅST (Brage spurte selv 2026-07-31, ved P9-godkjenningen): INGEN
  visningstoggle i v1.** Listen er kalenderens ene, gjennomtenkte
  visning — en toggle dobler designflaten (hvert fremtidige kalendergrep
  må virke i to visninger), og hero-kortene har ingen god grid-form.
  Uke-/månedsvisning tas opp igjen ved reell tetthet (turneringshelger,
  brukere med flere lag) eller når foreldre faktisk spør.
- Kun JS → Metro-reload.

**Slik ble det (2026-07-31, runde 2 — kompakt hero):**
- **`EventCard` = kompakt hero.** Lys variant (trening/sosialt/turnering/
  annet): SAMME mint→krem-gradient og banedekor som NextEventHero (arcs
  skalert ned), type-pill med prikk + dagetikett (heroens dayLabel:
  «I dag», «I morgen», «Fredag 12. jun») + tid i displayfonten (19,
  heiaDeep), tittel 18, MapPin-rad, mint-progress + «N kommer».
  Datoblokken (SØN/17/JUN) er borte — dagetiketten bærer datoen, og
  ingen hvite adminflater igjen.
- **Kamp = mørk/dramatisk:** `StadiumSurface` med RINGEN PÅ og flomlys
  AV (runde 3: Brage OPPHEVET «maks ett sted per skjerm»-regelen —
  ringen er kampens signatur; flomlyset forblir live-kampens), kamp-pill,
  mint avsparkstid, sted i stadiumDim. Standardtittelen «Kamp mot Lyn»
  strammes til «Mot Lyn» (pillen sier alt Kamp); egne titler vises.
  **Spilt/pågående kamp: stillingen som bunnrad I kortet** (label +
  SEIER-pill + score i mint display) — den doble mørke stripa fra runde
  1 er borte, kortet ER mørkt. Live: coral «PÅGÅR NÅ» + prikk, featured
  = coral kant.
- **Avlyst kamp:** lys variant med nøytral «Avlyst»-pill — en avlyst
  kamp er ingen kampdag.
- **Fra runde 1 består:** månedsseksjoner («August»; årstall ved annet
  år), dempede månedsskiller i arkivet, `past`-prop (opacity + skjult
  oppmøte), og skeleton som speiler kortformen (pill + tid, linjer,
  progress-bone).
- Turneringslisten på hendelsessiden bruker samme kort → kampene der er
  mørke kompakthero-kort.

**Runde 3 (samme dag — hero-språket til hendelsessiden + Hjem-kampen):**
- Ny delt **`HeroSurface`** (StadiumSurfaces lyse tvilling: mint→krem-
  gradient + banedekor) — brukes av EventCard og hendelsessidens
  infokort, som mistet P5B-aksentbåndet og ble hero-flate (pill, stor
  tid 24 i heiaDeep, dato i fet, tittel, sted, beskjed; avlyst kamp =
  nøytral «Avlyst»-pill). Kampdag-platta/live/kamprapport urørt.
- **Kommende kamp i Hjem-heroen = stadionmørk med ring** (flomlys av —
  «litt svakere» enn live, Brages ord), mint avspark, «Mot X»-regelen,
  RSVP på mørk track — samme uttrykk som kalenderens kampkort.

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
