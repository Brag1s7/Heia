# Heia — statusoverlevering (for ny chat)

## ▶️▶️ START HER (oppdatert 2026-08-21 — SKIVE 5 LEVERT OG TELEFONGODKJENT. NESTE: SKIVE 6)

**✅ SKIVE 5 — KAMPENS PULS — ER TELEFONGODKJENT AV BRAGE 2026-08-21:
«Det er godkjent nå så vi kan gå videre.»**

⚠️⚠️ **GODKJENNINGEN KOM ETTER FIRE RUNDER, OG BARE ÉN AV DEM VAR EN
VANLIG BUG.** Dette er den dyreste skiva i sporet så langt, og grunnene er
verdt å lese før neste flate bygges:

1. **Runde 1** — kurven gikk fram og tilbake over seg selv. x var lineær
   klokketid, og alt var rapportert i minutt 0.
2. **Runde 2** — teknisk grønn, og **avvist likevel**: «ikke en tilfeldig
   bølge basert på antall hendelser». En flate kan bestå alle testene sine
   og fortsatt være feil produkt.
3. **Runde 3** — modellen (`docs/KAMPENS-PULS-MODELL.md`), bestilt og
   godkjent av Brage FØR bygging.
4. **Runde 4** — sekundakse. Modellen brukte avrundet `minute` med et gulv
   på fem minutter; en kamp på under ett minutt kollapset til venstre kant.

**➡️ `docs/KAMPENS-PULS-MODELL.md` ER KONTRAKTEN.** Rør ikke pulsen uten å
lese den. **`__tests__/pulseModel.harness.test.ts` er designriggen** —
kjør den og SE på flaten før du leverer noe som tegner (se `### ⏳ SKIVE 5.1`).

✅ **`00072`, `00073` OG `00074` ER I PROD** (pushet 2026-08-21, bekreftet i
`supabase migration list --linked`). Kampuret er telefontestet av Brage:
«Tiden funker riktig på alle tre flatene.»

⚠️ **`00074` KOM AV EN REGRESJON `00073` INNFØRTE**, og den er verdt å lese
før noen rører pulsen eller klokka — se `### ⏳ SKIVE 7 BYGGET`, punktet om
TO AKSER.

**Skive 1–5 er levert og telefongodkjent. SKIVE 6 (sticky-bar + Reduce
Motion) ER PÅ RUNDE 2** — runde 1 brukte `stickyHeaderIndices` og ble avvist
på telefonen; bevegelsen er nå muntlig godkjent («Nå funker det veldig
bra!»), resten av lista står igjen. Se `### ⏳ SKIVE 6 — RUNDE 2`.
**Les punktet om `stickyHeaderIndices` der før du legger noe fast i en topp.**
Skive 6 er den SISTE rene flateskiva; 7–10 er funksjonalitet.

**✅ SKIVE 4 ER TELEFONGODKJENT AV BRAGE 2026-08-21: «Godkjent nå!»**
Kanonisk kobling + HEIA/kommentarer, `00071_kampfeed.sql` **ER I PROD**
(`supabase db push`, bekreftet i `supabase migration list --linked`;
anon-døren bevist mot ekte prod: 42501, med kontrollrader).

⚠️ **GODKJENNINGEN KOM ETTER FIRE RUNDER, OG BARE DEN FØRSTE HANDLET OM
FUNKSJONALITET.** 4.1 var en ren PRODUKSJONSOVERSETTELSE (prototypen var
fulgt for bokstavelig: egen hånd-SVG, displayfont på brødtekst, «2 HEIA» som
måleenhet, navigasjon der det skulle vært et ark), 4.2 bevegelsen og den
svarte faden, 4.3 at draget ikke virket, 4.4 at utglidningen rykket.
**Det er derfor `## ⚖️⚖️ AUTORITETSREGELEN` finnes — les den før du bygger.**

Skive 1–3 er levert og telefongodkjent (`93e75ca`, `23df9ed`, `1b0390d` +
`95c092f`).

⚠️ **`SKIVE 3.1` er fortsatt den viktigste feilhistorien i sporet:**
målswellen dekket ikke bildet, og årsaken var IKKE gradienten skive 2.2
rettet, men `height="100%"` inne i svg. **Les 3.1 før du rører en flate i
kampverdenen; diagnosemetoden der gjelder alt som ligger over innhold av
variabel høyde.**

**LES I DENNE REKKEFØLGEN:**
0. `## ⚖️⚖️ AUTORITETSREGELEN` — **permanent, gjelder alle skiver.** Prototypen
   bestemmer intensjon og hierarki; Heias designsystem bestemmer komponenter,
   ikoner, typografi og språk. Les den FØR du skriver en ny komponent.
1. `### 🔒🔒 PRODUKTBESLUTNINGER LÅST AV BRAGE 2026-08-20` — P1 mål imot ·
   P2 kampuret · P3 angre · P4 kampknappen · PulseCurve-memoiseringen.
   Ingen av dem skal relitigeres. **P1 er bygget i skive 4.**
2. `### ✅ SKIVE 1 LEVERT` — hva som er bygget, og **to rettelser til den
   frosne bolken som fortsatt står feil i den**.
3. `### ✅ SKIVE 1.1` — fem rettelser fra telefontesten, og PRINSIPPET de
   satte: prototypen er fasit for identitet og hierarki, ikke noe som
   kopieres piksel for piksel når det fungerer dårligere med ekte data.
4. `### ✅ SKIVE 2 LEVERT` — grunnen, arenaen, uttrekket og hele
   a11y-jobben. **Les også 2.1 og 2.2 i samme bolk: to feil som var RIKTIG
   kode i skive 1 og ble feil av at flaten under endret seg.**
5. `### ✅ SKIVE 3 LEVERT` — kamprapporten, de tre beslutningene den tvang
   fram (påmeldte, «Rediger», SLUTT/SEIER), og **3.1: prosenthøyde i svg,
   den feilen som overlevde skive 2.2 fordi bare halve årsaken var rettet.**
6. `### ⏳ SKIVE 4 BYGGET` — kanonisk kobling, HEIA/kommentarer,
   `00071_kampfeed.sql`, det ene stedet der P1 og fasiten var uenige, og
   **4.1–4.4: prototype-lånene som ble rettet, og kommentararket.**
7. `### ⏳ SKIVE 5 BYGGET` — kampens puls: hvorfor x-aksen er ØYEBLIKKENE og
   ikke klokka, hvorfor pausen ikke viser et minutt, og hvordan
   memoiseringsnøkkelen faktisk ble bygget.
8. `### ♿ TILGJENGELIGHET` — akseptansekriteriet. Oppfylt for skive 1–5s
   flater; pulskurven er skjult, overskriften og minuttet leses.
9. `### ▶️▶️ NESTE SAMTALE: SKIVE 2` — skivetabellen (skive 6 er neste).
10. `### 🕯 STADIUM LIGHT` — Brage vurderer en LYSERE palett, **etter alle
   skivene**. Påvirker hvordan tester skrives NÅ: vokt struktur, ikke farge.
11. `### ▶️▶️ KAMPSKJERMEN — DESIGNRETNING FROSSET` — selve retningen.
   Prototypen `docs/prototypes/kampskjerm/index.html` er fasit og ligger i
   repoet.


**✅ PROFILBILDE ER TELEFONTESTET OG GODKJENT AV BRAGE 2026-08-19: «Alt
funker på telefon!»** Del to av skiva — SELVVALGT AVATARFARGE — er bygget
rett etterpå, på Brages bestilling.

---

## ⚖️⚖️ AUTORITETSREGELEN — PERMANENT, GJELDER ALLE KOMMENDE SKIVER (Brage 2026-08-21)

**Prototypen bestemmer INTENSJON, HIERARKI, RYTME og ØNSKET OPPLEVELSE.
Heias eksisterende designsystem bestemmer KOMPONENTER, IKONER, TYPOGRAFI og
PRODUKTSPRÅK. Native bruk og tilgjengelighet bestemmer INTERAKSJONEN.
Telefonen avgjør SLUTTRESULTATET.**

> **Før du lager et nytt ikon, komponentmønster, ordvalg eller fontuttrykk,
> skal du FØRST søke etter hva Heia allerede bruker.** Prototypen er aldri
> automatisk fasit for SVG-path, CSS, tekst, font, mål eller midlertidige
> demonstrasjonsvalg.

**Hvorfor regelen finnes:** skive 4 brøt den fire ganger i én liten
komponent — egen hånd-SVG kopiert fra prototypens CSS, displayfonten på et
brødteksttall, «2 HEIA» som om HEIA var en måleenhet, og navigasjon bort fra
kampen der prototypen faktisk hadde riktig interaksjon (ark). Ingen av dem
var vanskelige å oppdage; de var vanskelige å oppdage FOR MEG, fordi
prototypen lå åpen og appen ikke gjorde det. Se `### ✅ SKIVE 4.1`.

**Sjekklista før du skriver en ny komponent:**
1. `grep` etter handlingen i `src/components` — finnes den som pill, rad
   eller ark et annet sted i appen?
2. Er teksten allerede formulert? (`FeedCard`, `CommentThread`, `matchCopy`)
3. Finnes stemmen som token i `typography`? Hvis du skriver `fontSize:` med
   et tall, må du kunne forsvare hvorfor det ikke er et token.
4. Er ikonet i `icons.tsx`? Et nytt ikon krever en grunn som ikke er
   «prototypen tegnet det sånn».
5. Er interaksjonen native-riktig — ark vs. skjerm, tilbake-gest, tastatur,
   VoiceOver-fokus?

---

### 🎨 DEL TO: SELVVALGT AVATARFARGE (✅ TELEFONGODKJENT 2026-08-19 — «Alt fungerer»)

**BRAGES BESLUTNING (LÅST, og den overstyrer min anbefaling om å vente på
piloten — ikke relitigér):** fargen er **ikke** en unik identifikator og
skal ikke behandles som en. Den gir personlighet, og den er et godt
alternativ for brukere som **bevisst ikke vil ha profilbilde**. Det er et
reelt segment i en app for ungdomslag, og for dem er avataren ellers to
bokstaver i en farge de ikke har valgt.

- ✅ **Migrasjon `00070_avatar_farge.sql` PUSHET TIL PROD.**
  `profiles.avatar_color` (FORMAT-check `^#[0-9a-fA-F]{6}$`, ikke
  verdi-check — paletten er kuratert i appen, samme valg som
  `team_spaces.color` tok, så en ny farge aldri krever en migrasjon).
  **NULL = ingen valgt farge**, og da gjelder navne-hashen som før: ingen
  backfill, ingen default, alle eksisterende kontoer ser nøyaktig like ut
  som før migrasjonen.
- ✅ **Tre leseflater bærer fargen** — den er verdiløs hvis den bare vises
  for deg selv: `get_team_feed` (+`author_avatar_color`),
  `get_team_members` og `get_team_authors` (+`avatar_color`). Alle tre er
  DROP+CREATE med **gjenskapte 00060-grants** (00061-fella).
- ✅ **VERIFISERT MOT EKTE PROD, 7/7**, med samme engangsrigg-metode som
  storage-beviset (egen klubb/lag/brukere, alt revet ned; kontrollert
  etterpå: 0 igjen, og 0 profiler i prod har farge satt). Bevist: bruker
  kan sette sin egen farge · ugyldig verdi avvises av CHECK-en (400) ·
  **alle tre RPC-ene svarer 200 og bærer fargen** (altså overlevde
  grantene DROP+CREATE) · farge kan tilbakestilles til null · **kan ikke
  settes på en ANNEN** (RLS treffer null rader).
- ✅ **Appen:** `src/shared/avatarColors.ts` med **TO lister, og det er
  hele poenget**: `AVATAR_HASH_COLORS` er **FROSSET** (den avgjør fargen
  til alle som ikke har valgt — endrer du innhold ELLER rekkefølge,
  flytter `% length` seg og halve laget bytter farge over natten), mens
  `AVATAR_COLORS` er valgpaletten på 12 som kan vokse fritt og som
  INNEHOLDER alle åtte hash-fargene (så den som liker fargen sin kan
  velge nettopp den). `Avatar` tar `color`; ny `AvatarColorPicker` er en
  bevisst tvilling av `TeamColorPicker`. Inngangen er SAMME ark som
  bildevalget («Velg farge»), så «gjør avataren min» er én inngang og
  ikke to konkurrerende — og velgeren har en **levende forhåndsvisning**,
  som er selve forklaringen på hva fargen gjør.
- ✅ **Gult er med i paletten med vilje** — den eneste virkelig lyse
  tonen, uten den er alt mørkt og alvorlig. `inkOnAvatarColor` flipper
  initialene til mørkt blekk der det trengs, og delegerer til lagfargens
  luminans-regel (samme spørsmål, én terskel).
- ✅ **VARSLENE ER BEVISST IKKE MED I MIGRASJONEN.**
  `notifications.data` FRYSER avsenderen (00051: «et varsel er et
  historisk faktum»), og det er riktig for navn og bilde — de VAR sånn da
  det skjedde. **En farge er ikke et historisk faktum, den er en stående
  preferanse**; fryses den, viser et gammelt varsel en farge personen
  forlot. Varsellista slår derfor opp fargen LIVE fra forfatter-cachen
  (ny `useTeamAuthors`-hook, samme 5-min-cache kommentartråden bruker).
  Ingen av de tre trigger-funksjonene er rørt.
- ✅ Suiten grønn: **218 tester, 19 filer** (ny `avatarColors.test.ts`
  vokter den frosne hash-poolen med GULLVERDIER — det er den ene
  endringen som ellers ville vært helt stille; pluss to nye
  render-tester). Lint gikk 13 → **12** kjente (no-bitwise-advarselen
  forsvant da hashen flyttet til shared med eslint-disable).

**✅ TELEFONTESTET OG GODKJENT AV BRAGE 2026-08-19: «Alt fungerer.»**
Runden (behold som regresjonssjekk hvis noen rører avataren igjen):
avatar → «Velg farge» → forhåndsvisning · fargen slår gjennom i feeden,
kommentarer, lagoversikten og varslene · «Tilbakestill farge» → tilbake
til navne-hashen · gult har lesbare mørke initialer · en som HAR bilde
ser fortsatt bildet, ikke fargen.

**HELE PROFILBILDE-SKIVA ER DERMED GODKJENT OG LUKKET.** Ikke rør den
uten grunn — og ruller du den likevel, les de to delene her FØRST.

---

### ▶️▶️ KAMPSKJERMEN — DESIGNRETNING FROSSET 2026-08-20. NESTE SAMTALE = IMPLEMENTERING

**Prototypen er fasit:** [`docs/prototypes/kampskjerm/index.html`](prototypes/kampskjerm/index.html)
(kjør lokalt, eller https://claude.ai/code/artifact/d8592f04-c731-4994-9b24-f0296910412c).
Mellomrundene (`kampskjerm-runde3.html.bak`, `kampskjerm-lab5.html.bak`) er
BEVISST IKKE committet — kun fasiten ligger i repoet. De finnes lokalt i
`docs/prototypes/` på Brages maskin og er forkastede runder, ikke referanse.
**Ingen produksjonskode er rørt.** Retningen ble valgt etter sju runder; alt
annet enn det som står her er forkastet — ikke gjenoppfinn kampvær, kampbånd,
equalizer, hvit/cream topp, fem kandidater eller «Kampens nerve».

#### 🔒 LÅST VISUELT

- **Hele skjermen er grønn**, statuslinje til tab-bar. Ingen hvit eller
  creamfarget flate. «Lysere» betyr lysere grønn.
- **Tre grønne rom**, skilt av tone og lys — aldri av bokser eller rammer.
  Trinnene er satt i opplevd lyshet (L*), ikke på øyemål:
  | Rom | Farge | L* | tekst / dempet / mint |
  |---|---|---|---|
  | Arena topp | `#25563F` | 32.7 | 8.1 / 4.9 / 6.4 |
  | Arena bunn | `#1D4633` | 26.4 | 10.2 / 6.1 / 8.0 |
  | Puls | `#1A4433` | ~23 | 11.7 / 7.0 / 9.2 |
  | Kampforløp | `#123325` | 18.5 | 13.2 / 7.9 / 10.4 |
  Grunnen: `--g-top #0B1911` → `--g-mid #183F30` → `--g-low #0E291D`.
  ⚠️ **`#3B8062` er LYS, ikke en tekstflate** (4.5:1 — kun stor tekst).
  ⚠️ **På arenaflaten faller dempet tekst til 3.7:1** og må løftes til
  `#C8E6D8`. Dette er den ene detaljen som ellers ser riktig ut og måler feil.
- **Stadionkritt** er linjespråket: 1 px, 20–24 % opasitet, varm off-white
  (`rgba(234,255,246,…)`). Buet lyskant under arenaen (inset-skygge så den
  følger radiusen), kort venstrestilt strek som avslutter pulsen, lyskant på
  målswellens overkant. Aldri rette linjer over hele bredden, aldri rammer.
- **Fargesemantikk (LÅST):** mint `#02FFAB` = stilling, mål for oss, HEIA,
  energi · varm off-white = banemarkeringer og viktig tekst · gull `#FFC53D`
  = reporterens stemme, pausemarkør, enkelte pulspunkter (5–10 % av uttrykket)
  · coral `#FF5A5F` = KUN LIVE · skifer = motstander og mål imot · lagfarge =
  lokalt lys rundt logo og i måløyeblikket.
- **Feiringens kjerne er alltid mint/krem med mørkt blekk.** Mållyset er
  `#DDFFEF` med `heiaDeep` = 12:1; lagfargen er en STRÅLE i ytterkanten,
  klemt til maks 56 %. **Dette er grunnen til at rødt lag aldri blir brunt** —
  lagfargen ligger aldri under tekst.
- **Tab-baren** er `rgba(237,250,243,.93)` med mint hårstrek. Ikke rent hvit.

#### 🔒 LÅST FUNKSJONELT

- **Hendelsesgrid: ikonnode → minutt → innhold.** Faste kolonner:
  node sentrert på x=27, minuttkolonne x=44–74 (høyrestilt), innhold fra
  x=82. **Minuttet står ALLTID i samme kolonne** — aldri over overskriften ett
  sted og etter navnet et annet. Avstanden er kompakt, ikke proporsjonal med tid.
- **Ikonene er appens egne**, videreført fra `MatchEventRow.tsx`/`icons.tsx`.
  Ingen emoji, ingen ny familie. **Regelen «ballen betyr MÅL og ingenting
  annet» står.**
  | Hendelse | Ikon | Node |
  |---|---|---|
  | Mål for oss | `Ball` | `heiaTint` + gulldetalj + glød |
  | Mål imot | `Ball` | skifer, dempet — ingen feiring, ingen HEIA |
  | Reporteroppdatering | `MessageCircle` | gullfylt |
  | Bilde | `Camera` | lys |
  | Avspark / ny omgang | `Play` | nøytral |
  | Pause | `Pause` | gulltonet |
  | Slutt | `Flag` | lys med ring |
  | Bytte / kort | `ArrowLeftRight` / `BookingCard` | kun historiske data |
- **Tidslinja er én sammenhengende krittlinje** i varm off-white (22 %),
  dempet mellom hendelsene. Et mål **tenner den samme linja** i mint (samme x,
  samme bredde) — ingen hendelse får sin egen ekstra vertikale linje.
- **Retningsmarkør øverst:** `NÅ · 40′` med «Nyeste øverst — bla nedover i
  kampen». Ved ferdig kamp: `SLUTT` + «Kampen leses forfra».
- **Reporteroppdateringen har ingen boks, ramme, skygge eller sidestrek.**
  Gull `MessageCircle`-node på linja · avatar + «Jarle oppdaterer» · minuttet i
  kolonnen · teksten fritt på stadiongrunnen · ekstremt svakt grønt lys bak som
  toner ut mot høyre. **Noden sier HVA som skjedde, avataren sier HVEM.**
  To på rad skilles av luft, node og minutt — aldri av bokser.
- **Kampens puls** er en egen kompakt seksjon (~90 px) under stillingen,
  sted/reporter og avatarene. Åpent på grunnen, ingen container. «KAMPENS PULS»
  til venstre, **`NÅ 40′`** til høyre — aldri et nakent minutt.
  Formen kommer av ØYEBLIKKENE, ikke av en energimodell: mål for oss = minttopp,
  mål imot = søkk, bilde = lys mint, oppdatering = gull.
  **HEIA endrer gløderadien, aldri kurvens høyde** — derfor kan den ikke bli en
  påstand om hvem som presser. Ingen akser, tall, prosenter eller analyseestetikk.
- **Reduce Motion fjerner bevegelsen, men beholder lysresponsen.**

#### 🐛 ÉN EKTE BUG FUNNET I PROTOTYPEN — MÅ IKKE GJENSKAPES

Kamphodet viste 40′ mens pulsen viste 37′. Årsaken var ikke design:
minuttickeren oppdaterte `.a-clock`, men ikke pulsens etikett, som sto igjen
fra forrige render. **Alt som viser kampminuttet må oppdateres fra samme kilde
i samme tick** — hodet, pulsen, retningsmarkøren og sticky-baren.

#### 🛠 IMPLEMENTERINGSOVERSIKT FOR NESTE SAMTALE

**Beholdes uendret:** `StadiumSurface` · `HeroSurface` · `TeamBadge` ·
`StatusPill` · `LiveBadge` · `ScoreChip` · `MatchPhotoRail`/`Gallery` ·
`ReporterSheet` · `CommentsScreen` · `useGoalMoment` · alle ikonene i
`icons.tsx` (ingen nye trengs).

**Endres:**
- `MatchEventRow.tsx` → hendelsesgriddet (node/minutt/innhold). `markerFor()`
  overlever som ikonvalg; flatene byttes fra lyse kort til grunn + lys.
- `MatchTimeline.tsx` → krittlinja, retningsmarkøren, gate-markørene.
  Stillings- og bildeflettingen beholdes uendret — den er god.
- `ScoreBoard.tsx` → arenaen med buet underkant og mintlyskant.
- `EventDetailScreen.tsx` → kampen bør bli en egen komponent (fila er 1449
  linjer); ruten, de tre stackene og B2-cachen røres ikke.
- `theme/tokens.ts` → de fire grønntonene + `#C8E6D8` som dempet-på-arena.

**Må bygges nytt:** `MatchPulse` (SVG-kurve, `react-native-svg` er allerede
inne) · `EventNode` (delt node-komponent) · retningsmarkøren · krittlinja.

**Ingen nye pakker.** All bevegelse er `transform` + `opacity` → native driver;
`reanimated` er fortsatt bevisst ikke installert.

#### ⚠️ REELLE PROBLEMER Å LØSE FØR/UNDER IMPLEMENTERING

1. **82 px venstremarg** koster innholdsbredde på 430 pt. Grunnen til at det
   likevel er riktig: uten fast minuttkolonne kan man ikke skanne. Må kjennes
   på telefon med STOR TEKST — der er den strammest.
2. **Krittlinja tegnes i dag med CSS.** I RN blir den en `View` med gradient
   (trivielt), men mål-«tenningen» er et absolutt plassert lag som må ligge
   bak noden — sjekk z-index mot `MatchTimeline`s eksisterende struktur.
3. **Pulsen tegnes om ved hvert nytt øyeblikk.** Med realtime + scroll samtidig
   må den memoiseres på `matchEvents.length` + heia-summen, ellers re-rendres
   SVG-en ved hver tick.
4. **Kontrastvakten bør bli en test**, ikke en kommentar: gullverdier for de
   fire grønntonene × tre blekkfarger, samme mønster som `avatarColors.test.ts`.
5. **`Reduce Motion` brukes i dag kun i Kalender.** `useReducedMotion` må
   kobles på `useGoalMoment`, SEIER-pillen, `LiveBadge` og pulsen.
6. **Reporterpanelets knapper bruker fortsatt tegnene `▶ ❚❚ ⚑`** (arv fra
   runde 3). Utenfor tidslinja, så ikke en regresjon — men bytt til
   `Play`/`Pause`/`Flag` når panelet uansett røres.
7. **Dynamic Type XXL** på det store tallet: 62 px score i tre kolonner
   sprenger på 430 pt. Trenger stablet fallback.

---

### 🕯 STADIUM LIGHT — MULIG LYSERE PALETT, ETTER ALLE SKIVENE (Brage 2026-08-21)

**Brage vurderer å gjøre kampverdenen LYSERE.** Ikke en ny retning:
**alt er likt — kun fargene justeres.** Struktur, geometri, hierarki,
hendelsesgriddet, de tre rommene, krittspråket og fargeSEMANTIKKEN står.

**⛔ DETTE GJØRES IKKE NÅ.** Det tas som ÉN samlet runde når alle ti skivene
er ferdige. Grunnen er den samme som gjorde skive 2.1/2.2/3.1 dyre: endrer
man flaten under mens nye flater bygges oppå, oppdages feilene én og én på
telefonen i stedet for samlet.

**Konsekvenser for hvordan det bygges i mellomtiden:**

- ⚠️ **Ingen test skal frysse paletten.** `liveMatch.test.tsx` sin
  «ingen kremfamilie»-vakt er en KLASSE-vakt (ikke lyse flater i kampen), og
  den kan bli feil når retningen blir lysere — den skal revurderes i samme
  runde, ikke omgås underveis. Nye vakter skal derfor teste STRUKTUR, ikke
  farge: skive 4s engasjementstest sjekker «ingen pill/boks/fyllflate», og
  ikke én eneste hex-verdi. **Bygg videre på det mønsteret.**
- **Kontrastvaktene (`matchContrast.test.ts`, `swellCap`, `arenaLightCap`,
  `floodCap`) er nettopp det som gjør en palettflytt trygg.** De regner ut fra
  fargene i stedet for å hardkode dommen, så en lysere grunn gir nye
  gullverdier — ikke ny logikk. Ikke fjern dem for å «rydde».
- **Dominanten er `#02FFAB` mot lyse flater.** Mint er fortsatt stillingen,
  målet for oss, HEIA og energien.

#### `CommentsScreen` — KREM ER IKKE EN FEIL (Brage 2026-08-21)

Kommentartråden er lys, og du trykker deg dit fra den grønne kampverdenen.
**Det er BESLUTTET at den står uendret i skive 4.** Krem kan godt være Heias
lyse LESEFLATE — overgangen fra kampen vurderes på telefon, og en eventuell
`#02FFAB`-innramming tas i den samlede Stadium Light-runden, ikke som en
egen liten skive nå.

---

### 🔒🔒 PRODUKTBESLUTNINGER LÅST AV BRAGE 2026-08-20 — IKKE RELITIGÉR

Disse ble tatt etter at skive 1 var bygget og telefongodkjent. De er
BESLUTNINGER, ikke forslag. Les dem før du rører kampsporet.

#### P1 — MÅL IMOT: kommentarer, ingen HEIA

**Ingen HEIA på mål imot — verken i kampen ELLER i feeden.** Kommentarer er
tillatt begge steder. Det er samme kanoniske post, så regelen må gjelde
begge flatene; en HEIA-knapp i feeden på et mål imot bryter beslutningen selv
om kampskjermen skjuler sin.

- ✅ **GODKJENT: `00071_kampfeed.sql` med `get_match_feed(evt_id)`, UTEN
  skjemaendring.** Skrivestien er allerede robust: `report_match_event`
  (00021:150-153) og `start_match` (00020:83) gjør en UBETINGET
  `INSERT INTO feed_posts (…, match_event_id)` i samme transaksjon som
  hendelsen, utenfor alle IF-grener. Alle seks typene som kan opprettes får
  post. Det som manglet var LESESTIEN: `get_event_with_rsvp` returnerer ingen
  `feed_post_id` (00020:289-303), så klienten kunne ikke finne posten.
  - **Ingen indeks på `match_event_id`.** RPC-en filtrerer på `fp.event_id`,
    som allerede er indeksert (`idx_feed_posts_event_id`, 00060:96-98), og
    grupperer klientside — samme mønster som `MatchTimeline` bruker for
    bilder. En indeks på `match_event_id` ville vært død vekt.
  - **Ingen UNIQUE.** Koblingen er 1:N MED VILJE — kampbilder bærer samme
    `match_event_id` (00028:5-8). En unique-constraint ville brutt
    `createImagePost` og kunne feilet mot prod-data. Kanonisk post velges
    deterministisk klientside: raden der `post_type <> 'bilde'`.
- ⏳ **`get_team_feed`-endringen (feedens HEIA-gate) er EGEN SKIVE, TATT
  ETTER at kampskjermen er telefontestet.** Ikke i samme migrasjon: en
  grant-feil skal ikke kunne ta ned feeden og kampen på én gang. Feeden kan
  i dag ikke se forskjell på et mål og en beskjed (00070:147-150 gir bare
  `match_minute/status/home/away`), så den trenger `match_events.type` og
  `team_side` ut. **DROP+CREATE ⇒ grantene MÅ gjenskapes (00061-fella), og
  vanlig medlemsadgang skal kontrolleres eksplisitt etterpå.**

#### P2 — KAMPURET: faktisk spilt tid

**Heia viser FAKTISK SPILT TID.** Klokka starter ved avspark, **fryses i
pause**, og andre omgang **fortsetter fra minuttet første omgang sluttet**.
Ingen normert 45/35/30/25-modell. Ingen «45+2». **Ingen ekstra opplysning
ved kampstart** — reporteren skal ikke taste omgangslengde i appens mest
tidskritiske øyeblikk, og Heia har uansett ikke datagrunnlag for en
fotballkonvensjon som varierer per aldersklasse og idrett.

**Implementeringen skal være SERVERAUTORITATIV:** akkumulert spilletid +
tidspunktet klokka sist startet. **`started_at` skal ALDRI skrives om** —
historikken er historikk.

**App, server, push, puls, tidslinje og sticky-bar skal arve SAMME beregnede
tid.** I dag finnes tre uavhengige regnestykker (`EventDetailScreen`,
`LiveMatchBanner`, `InboxScreen`), og ingen av dem trekker fra pausen —
serveren gjør det heller ikke (`FLOOR((now() - started_at)/60)`, 00021, og
`status` settes til `'pause'` uten at `started_at` røres).

⚠️ **Deployrekkefølge: server FØRST, verifisert med en manuell
pause/gjenoppta-runde mot prod, DERETTER app.** Motsatt rekkefølge gir en
skjerm som viser 25′ over en tidslinje som sier 35′.

#### P3 — ANGRE: 10 sekunder, og da fantes målet aldri

**Angrevinduet er 10 sekunder.** Innenfor vinduet skal målet forsvinne fra
BRUKERFLATENE som om det aldri skjedde:

- hendelsen og feed-posten fjernes fra brukerflatene
- stillingen reverseres
- reaksjoner og kommentarer fjernes
- innboksvarselet fjernes eller markeres trukket tilbake
- **intern audit BEHOLDES** (`audit_log`, 00012, service-role-only)

**En allerede levert push kan ikke trekkes tilbake.** Er den sendt, skal
brukeren få et kort KORRIGERINGSVARSEL med riktig stilling.

⚠️ **TO FARLIGE HALVVEIER FINNES ALLEREDE I PROD, og de skal stenges i samme
slag:**
1. RLS-policyen «Reporter or admin can delete match events» (00014:163-172)
   er kallbar fra hvilken som helst klient, uten opprydding.
2. **«Slett innlegget» i feeden treffer målposter.** Trykker reporteren den:
   posten forsvinner, men stillingen står på 2–1, hendelsen står i
   kampforløpet og varselet ligger i innboksen. Brukeren tror hun har
   angret. Det er verre enn ingen angre-funksjon.

**Den generelle «Slett innlegget» skal stenges for systemgenererte poster
med `match_event_id` — BÅDE i UI og i databaserettigheter.** De skal kun
kunne endres gjennom autoritativ kamp-RPC.

⚠️ `match_events` trenger `REPLICA IDENTITY FULL`, ellers når en DELETE
aldri tilskuerne (samme begrunnelse som 00059 ga for `reactions`): uten FULL
bærer payloaden kun PK, filteret matcher ikke, og tilskueren sitter igjen
med korrigert stilling i toppen og to mål i forløpet.

#### P4 — KAMPKNAPPEN

**Sluttmodellen står:**

| Tilstand | Knappen |
|---|---|
| Ingen livekamp (idle) | `KAMP` → Sesongen |
| Én livekamp, utenfor kampen | live-resultat/status → åpner kampen (registrerer IKKE HEIA) |
| Inne i livekamp, publikum | `HEIA!` |
| Inne i livekamp, reporter | `RAPPORTER` |
| Ferdig / ingen live | tilbake til `KAMP` |

- **Dagens pluss kan beholdes MIDLERTIDIG mens inngangene flyttes, men er
  IKKE den endelige idle-tilstanden.**
- ⚠️ **FØR plussen fjernes MÅ:** «Del med laget» ha fått en **permanent**
  inngang på Hjem, og «Ny hendelse» en **permanent** inngang i
  Kalender/Sesongen. I dag finnes Kalender-inngangen kun i tom-tilstand
  (`KalenderScreen.tsx`), så fjernes plussen før det, mister en trener med
  ikke-tom kalender enhver vei til å opprette noe.
- **Flere samtidige livekamper utsettes til cross-team-støtten finnes.**
- **Tab-barens stadionvariant skal være RUTESPESIFIKK.** Hjem, Kalender,
  Varsler og Profil skal ikke endres som en bieffekt. Det er mulig rent uten
  custom `tabBar`: biblioteket leser `tabBarStyle` kun fra den FOKUSERTE
  rutens options, så de andre fanene er uendret ved konstruksjon. Behold
  `height: 88` i begge varianter — endres den, reflower scenen midt i en push.

#### PulseCurve — memoiseringsnøkkelen

**IKKE memoiser på `matchEvents.length` alene.** Det gir stale kurver ved
redigering, sletting, angre eller endret hendelsesdata uten endret antall.

Nøkkelen må dekke **event-ID, type, sekvens/minutt, slettestatus og relevant
HEIA-sum**. Bruk stabil arrayreferanse eller en strukturell avhengighet.

**Minutt-tickeren skal ALDRI tegne kurven på nytt** — kun reelle hendelses-
og engasjementsendringer skal gjøre det. (Samme regel som allerede gjelder
`MatchTimeline`s flettememo: et tick-tall i deps ville regnet hele
stillings- og bildeflettingen på nytt hvert 30. sekund.)

Rydd samtidig `?? []` i `EventDetailScreen` (fersk tom array per render) med
en stabil `NO_MATCH_EVENTS`-konstant ved siden av `NO_MEMBERS`/`NO_PHOTOS` —
men **`length` skal ikke være eneste sannhet**.

---

### ✅ SKIVE 1 LEVERT OG TELEFONGODKJENT 2026-08-20 — HENDELSESGRIDDET

Commit `93e75ca`. **Ren JS**, ingen nye pakker, ingen native endringer,
ingen migrasjon. 261 tester / 22 suiter grønt, lint ett hakk UNDER baseline.

- **`src/shared/matchGridGeometry.ts` (ny) — geometrien er RESPONSIV.**
  Prototypens 27/44/74/82 er målt på 430 pt og er fasit for UTTRYKKET, ikke
  en universell konstant. Tallene dekomponerer til én kjede
  (`railLeft + node + gap1 + minutt + gap2`), og innrykk/gap komprimeres i
  tre trinn på smale telefoner. **Ikonets og minuttkolonnens VERTIKALE FLUKT
  er låst** og holder ved alle tekststørrelser. Voktet på
  **320 / 375 / 390 / 393 / 430 pt × fontScale 1 / 1.235 (XXL) / 1.6** i
  `__tests__/matchGrid.test.ts`.
  ⚠️ `GRID_FONT_CAP` (1.6) må settes som `maxFontSizeMultiplier` på HVER
  `<Text>` i griddet — klemmer du geometrien men ikke teksten, åpner det seg
  et gap som vokser til iOS' ×3.571.
- **`src/components/EventNode.tsx` (ny)** — node- og ikongeometrien lå i to
  pikselidentiske kopier i `MatchEventRow` og `MatchTimeline`. Nå én.
- **Avspark og pause fikk FYLTE glyfer** (`PlaySolid`/`PauseSolid` i
  `icons.tsx`) etter fasiten. **De delte Lucide-eksportene `Play`/`Pause` er
  URØRT** — de brukes av reporterknappene og klubbetalingsloggen, der
  outline er riktig. (Handoff-linja «alle ikonene i icons.tsx, ingen nye
  trengs» er dermed ikke lenger helt sann.)
- **`swellCap()` i `teamColors.ts` — KONTRASTVAKTEN ER KODE, IKKE EN
  KOMMENTAR.** Den klemmer lagfargens styrke i målswellen til brødteksten
  holder 7:1 og mint-stillingen 4.5:1. **Dette er grunnen til at et rødt lag
  aldri blir brunt.** Første utkast hardkodet 0.55; funnet av review.
  Gullverdier for åtte lagfarger i `__tests__/matchContrast.test.ts`.
- **`authorFor` slår opp i `get_team_authors`, IKKE `get_team_members`.**
  Sistnevnte filtrerer på `status IN ('active','invited')`, så en reporter
  som forlater laget ville mistet navn og avatar på hver oppdatering i en
  FROSSET kamprapport — samme hull som 00067 §2 lukket for kommentarfeltet.
  **RPC-budsjettet står stille på 3**: rosteret gates bort på ferdig kamp,
  der `ReporterBar`/`ReporterSheet` uansett ikke finnes.
- **`MatchEventRow` har en `engagement`-slot.** Plassen til HEIA og
  kommentarer er RESERVERT, så raden ikke må omskrives når den kanoniske
  koblingen bygges.

**⚠️ TO RETTELSER TIL BOLKEN OVER — de står der fortsatt, og de er feil:**

1. **«På arenaflaten faller dempet tekst til 3.7:1»: TALLET REPRODUSERER
   IKKE.** `colors.stadiumDim` (#A9CCBC) på #25563F måler **4.86:1**, og
   tabellen i samme bolk sier 4.9 på nøyaktig samme linje. De to påstandene
   er uenige, og tabellen har rett. **Byttet til `#C8E6D8` er likevel
   riktig** — men fordi 4.86 er marginalt (ingen luft mot 4.5-grensen) og
   langt under 7:1-kravet brødtekst skal ha. #C8E6D8 gir 6.35.
2. **Punkt 6 («reporterpanelet bruker fortsatt `▶ ❚❚ ⚑`») VAR ALLEREDE
   FIKSET** da bolken ble skrevet. `ReporterActions.tsx` mapper alle seks
   handlingene til ekte ikonkomponenter. De siste emojiene i kampsporet
   sitter i `MatchPhotoSheet.tsx`.

**Én bevisst rettelse AV PROTOTYPEN:** den har `.node{left:26}` og
`.thread{left:27}` — nodesenter 26, trådsenter 27.75, altså 1.75 pt
skjevhet. Usynlig i nettleseren, synlig på @3x der noden sitter PÅ linja.
Handoff-en sier «node sentrert på x=27», og den vant: `railLeft` er 13.5.
44 / 74 / 82 er uendret.

---

### ✅ SKIVE 1.1 — FEM RETTELSER ETTER TELEFONTEST 2026-08-20

**Prinsippet Brage satte, og som gjelder resten av implementeringen:**
> Prototypen er fasit for IDENTITET og HIERARKI — ikke noe som skal kopieres
> piksel for piksel når det fungerer dårligere med ekte data på telefon.

Fem ting så riktige ut i nettleseren og feil på enhet:

1. **Den permanente hjelpeteksten er borte.** «Nyeste øverst — bla nedover i
   kampen» (og «Kampen leses forfra») sto som varig bruksanvisning på en
   flate som skal være kampen. `NÅ · 81′` og minuttkolonnen under forklarer
   retningen selv.
2. **Reporteroppdateringen har ingen flate i det hele tatt.** Prototypens
   «ekstremt svake» grønne lys bak teksten leste som en synlig rektangulær
   grønn boks — nøyaktig det den frosne retningen forbyr. Gradienten toner ut
   mot HØYRE, men aldri opp eller ned, så kantene sto. Teksten står nå rett
   på grunnen; noden og minuttet bærer skillet.
3. **Meldingsnoden er dempet.** Heldekkende gull konkurrerte med målet om
   blikket. Nå transparent gullflate + gullkant + gullikon: samme semantikk,
   uten volumet. Målet skal vinne.
4. **Ingen permanent gullprikk på målnoden.** Den leste som et stående
   BADGE, ikke som feiring. Gulldetaljen hører hjemme i MÅLTENNINGEN — et
   kort blink som forsvinner. Fjernet helt til animasjonen finnes
   (skive 5/6), ikke stående statisk.
5. **Ingen automatisk «Mål for oss» under MÅL!.**
   ⚠️ **Dette var en ekte datafeil, ikke bare pynt.** `describeMatchEvent`
   (`lib/api/events.ts:762-766`) STEMPLER alltid en beskrivelse på et mål og
   legger reporterens frie tekst i `player` i stedet
   (`player: description || undefined`). Rendret man begge, sto det «Mål for
   oss» under hvert eneste mål uten at noen hadde skrevet det. Nå vises kun
   `player` — det er det ENESTE brukerskrevne feltet et mål har.
   **Mål IMOT beholder sin `description`**: der ER etiketten innholdet.

#### ✔️ 0′ PÅ HENDELSENE MENS KLOKKA STO PÅ 81′ — RIKTIG, IKKE EN FEIL

Bekreftet i koden. To forskjellige tall med to forskjellige liv:

- **`event.minute` er FROSSET ved innsetting.** Serveren regner
  `FLOOR(EXTRACT(EPOCH FROM (now() - started_at))/60)` ÉN gang i
  `report_match_event` (00021) og lagrer tallet. Appen leser det rått
  (`mapMatchEventRow`: `minute: me.minute`) — det regnes ALDRI om klientside.
- **`matchMinute` er LEVENDE.** `EventDetailScreen` regner den fra
  `event.startedAt` mot en `nowMs` som tikker hvert 30. sekund.

En hendelse opprettet rett etter avspark har altså minutt 0 for alltid, mens
klokka fortsetter. **Testhendelsene ble laget ved kampstart — derfor 0′.**
Ingenting skal endres. Kontrollen på ekte data: rapporter en hendelse NÅ og
se at den får inneværende minutt, ikke 0.

⚠️ **P2 (kampuret) endrer semantikken til nettopp dette tallet** — da skal
`minute` regnes fra akkumulert spilletid, ikke `now() - started_at`. Gamle
rader beholder sine verdier; de skal ikke backfilles.

---

### ✅ SKIVE 2 LEVERT OG TELEFONGODKJENT 2026-08-20 — GRUNNEN OG ARENAEN

Commit `23df9ed` (skive 2 + 2.1 + 2.2 i én — rettelsene traff de samme
filene og kunne ikke deles uten en mellomtilstand som ikke bygger).
**Ren JS. Ingen nye pakker, ingen native endringer, ingen migrasjon.**
316 tester / 25 suiter grønt (var 263/22). Lint 12 kjente — ett hakk UNDER
baseline. Ruten, de tre stackene og B2-cachen er urørt.

#### HVA SOM ER BYGGET

- **`src/components/match/MatchGround.tsx` (ny) — verdenens bunn**,
  statuslinje til tab-bar. Prototypens `.ground` lag for lag: base 172°,
  gull- og mintflomlys, lagets lys i venstre skulder, motstanderens skifer i
  høyre, gresslyset nedenfra, midtlinje + to banebuer i kritt. Faser
  (live / pause / ferdig / avlyst) demper lagene fra ÉN tabell.
  ⚠️ **Lagfargen rører aldri grunnen** — den legges bare som lys oppå.
- **`src/components/match/ArenaSurface.tsx` (ny) — platået med buet
  underkant.** Fasitens elliptiske radius finnes ikke i RN, og heller ikke
  inset-skygge: hele flaten er ÉN svg-`Path`, og alt innhold klippes til den
  med `ClipPath`. Da oppstår de firkantede hjørnene aldri, og de trenger ikke
  males bort slik målswellen må gjøre det. Lyskanten er kurven strøket i
  kritt. **Prisen er en `onLayout`-måling** — én frame flat grønn, samme
  mønster som `ProfileHeader`.
  ⚠️ **`StadiumSurface` er URØRT.** Den har 11 kallesteder og `ScoreChip`
  arver alt fra den; en buet underkant der ville truffet feed, lister og
  varselkort i samme slag.
- **`src/components/match/MatchArena.tsx` (ny) — kampens hode.** LIVE-pill +
  klokke, lagmerker med lagfarget/skifer strek, stort mint-tall, metalinja
  «sted · hvem rapporterer · nå» som TYPE PÅ FLATEN. Ingen chips, ingen kort.
- **`src/components/match/LiveMatch.tsx` (ny) — uttrekket.**
  `EventDetailScreen` er 147 linjer lettere. State, handlere, realtime og
  modalene ble IGJEN i skjermen — de hører til livssyklusen; komponenten er
  flaten og tar alt den viser som props.

#### TRE VAKTER SOM ER KODE, IKKE KOMMENTARER

1. **`arenaLightCap()`** (`teamColors.ts`) — arenaen er kampens LYSESTE rom
   (8.11:1 for brødtekst, altså nesten ingen luft mot 7:1). Lagets lys ligger
   nøyaktig der lagmerket og lagnavnet står. Uten klemmen ville et gult lag
   spist sitt eget navn. Klemmer alltid HARDERE enn `swellCap` — det er
   testet, så en dag flatene endres oppdages det.
2. **`floodCap()`** — måløyeblikkets flod over hele verdenen. Kravet er et
   annet enn swellens: det eneste som må overleve floden er STILLINGEN, og
   den er stor tekst (3:1). Porten fra prototypens egen `floodCap`.
3. **Grunnen ble en TEKSTFLATE.** Reporterlinja og forløpet ligger nå rett på
   den. Nye gullverdier i `matchContrast.test.ts` for alle tre grunntoner,
   pluss vakten som sier at grunnens midttone er LYSERE enn kampforløpet —
   det fjerde rommet kan derfor ikke oppstå av seg selv, og
   `MatchTimeline ground` må tegne scrimet.

#### MÅLFEIRINGEN FLYTTET FRA KORTET TIL VERDENEN

`ScoreBoard`s firkantede mint-vask over stadionflaten ville tegnet et
rektangulært blink over arenaens BUEDE underkant. Floden ligger derfor på
grunnen, der fasiten har den (`.g-flood`). Spretten på tallet er uendret, og
**begge arver samme `useGoalMoment`** — to kall ville gitt to animasjoner som
drifter fra hverandre.

#### INGEN HVITE FLEKKER — ALT SOM MÅTTE FÅ EN VARIANT

`BackBar` · `ReporterBar` · `ReporterActions` · `MatchPhotoRail` fikk
**`variant`, aldri endret default** — `BackBar` alene deles med 17 skjermer.
I tillegg: `StatusBar` light-content med fokusvakt (ProfileHeader-mønsteret),
stackens `contentStyle` satt mørk for kampen, og skive 1s lokale
`styles.timeline` erstattet av rom-scrimet.

- **«Du følger kampen direkte» var et hvitt kort.** Beskjeden er verdt å
  beholde — den forklarer hvorfor det ikke finnes en oppdater-knapp — men
  den er en fotnote, ikke et kort. Nå én dempet linje på grunnen.
- **Tilbakelinja heter «Kampen», ikke «Hendelse».** Fasitens navtitle.
- **`__tests__/liveMatch.test.tsx` vokter regelen maskinelt:** ingen farge i
  kampverdenen får tilhøre kremfamilien. Den fant én ekte lekkasje under
  bygging (en overlevende `borderSubtle` i reporterlinja).
  ⚠️ Rent hvitt er BEVISST ikke bannlyst: den frosne retningen har selv to
  hvite ting i kampen — platen bak lagets logo, og typen på LIVE-pillen.

#### ♿ TILGJENGELIGHET — KRAVET ER OPPFYLT FOR SKIVE 1+2s FLATER

- **Setningen bor i `matchCopy.ts`**, ikke i JSX: `matchEventA11yLabel`,
  `matchPhotoA11yLabel`, `matchScoreA11yLabel`. Rekkefølgen MINUTT → HVA →
  HVEM → DETALJ er en regel som skal kunne testes.
- ⚠️ **Labelen SIER hva som skjedde på et mål, selv om skjermen ikke gjør
  det.** Etter skive 1.1 viser raden bare `player` under MÅL! — for øyet er
  noden nok, for øret er den ingenting.
- ⚠️ **HVORFOR RADEN BLE RESTRUKTURERT:** en `accessible`-beholder SVELGER
  alt inni seg — bildet og engasjement-sloten ville sluttet å være egne
  stopp, altså umulige å trykke med VoiceOver. Labelen sitter derfor på en
  inner-wrapper rundt node + minutt + innhold, mens bildet og HEIA ligger
  utenfor. **Geometrien er urørt** (paddingene flyttet, bunnpaddingen ble
  igjen ute så luften under et bilde er den samme), og `matchGrid.test.ts`
  står grønn.
- Dekorativ svg skjult overalt: krittlinja, nodene, swellen, skrimene,
  grunnen, arenaen, rom-scrimet.
- 44 pt: `hitSlop` på «Bytt»; resten måler over fra før.

#### 📱 TELEFONKONTROLLEN — GJENNOMFØRT, TRE RUNDER

Runde 1 → skive 2.1 (bildene). Runde 2 → skive 2.2 (swellen og krittlinja).
Runde 3 → **godkjent**. Alt annet på lista under sto Brage til ved første
gjennomgang: buen, de tre rommene, lagets lys, det store tallet,
reporterpanelet, kanten under push og VoiceOver.

<details><summary>Sjekklista som ble brukt (til gjenbruk i skive 3)</summary>

1. **Buen under arenaen.** Er den for dyp? For grunn? Ser lyskanten ut som en
   kant, eller som en strek?
2. **Er de tre rommene faktisk tre rom?** Arena → (tom plass der pulsen skal
   inn i skive 5) → forløp. Uten pulsen mellom er overgangen kanskje for brå.
3. **Lagets lys på arenaen** — prøv et lyst lag (gult). Vakten sier det er
   lesbart; spørsmålet er om det fortsatt ser ut som LAGETS farge.
4. **Det store tallet med stor tekst.** Stabler det seg pent på XXL, eller
   ser det ut som en feil?
5. **Reporterpanelet uten hvite knapper** — er «Mål oss» fortsatt tydelig
   nok hovedhandling når naboene er krittkanter og ikke hvite kort?
6. **Kanten under push.** Blinker det fortsatt krem når kampen åpnes fra
   Hjem/Kalender/Varsler?
7. **VoiceOver** (Innstillinger → Tilgjengelighet): sveip gjennom forløpet og
   hør at hver hendelse er ETT stopp som starter med minuttet.

#### ✅ SKIVE 2.1 — ÉN RETTELSE FRA TELEFONTESTEN 2026-08-20

Brage: **«Alt funker på telefonen utenom dette.»** Én ting, og den var reell.

**BILDENE DEKKET HELE SKJERMEN.** Den frosne retningen sier «bildet ER
flaten, kant til kant», og prototypen har det slik. Med ekte data på den nye
grunnen ble det feil: et fullbredt, lyst rektangel kutter den grønne verdenen
i to og drar blikket bort fra kampen — motsatt av regelen om at ingenting
skal konkurrere med stillingen.

⚠️ **Og det er derfor det så riktig ut FØR skive 2:** i skive 1 lå bildet på
en flat, mørk egen flate (`styles.timeline`). Det var flaten som bar bildet.
Da grunnen tok over, hadde bildet ingenting å ligge på lenger — det ble
liggende OPPÅ verdenen i stedet for i den. Bredden var uendret; det var
konteksten som endret seg.

**Nå står bildene i innholdskolonnen som all annen tekst**, med node og
minutt i skinna — nøyaktig som hver eneste andre rad. Gjelder begge
bildeflatene:
- **Bilde på en hendelse** (`MatchEventRow`): venstremarg = `contentLeft`.
- **Generelt kampbilde** (`MatchTimeline.PhotoRow`): var kant-til-kant med
  tekst OPPÅ bildet. Nå node + minutt i skinna, bildet i kolonnen, teksten
  UNDER. **De to skrimene forsvant samtidig** — de fantes bare for å holde
  hvit tekst lesbar over et vilkårlig fotografi.

**Fast høyde (200/300 pt) er byttet mot `aspectRatio: 4 / 3`.** Kolonnen er
smalere enn skjermen og varierer med enhet og tekststørrelse; en fast høyde
ville vært nesten kvadratisk på én telefon og en stripe på en annen. Begge
bildeflatene bruker samme forhold, så to bilder etter hverandre ikke får hver
sin form. `radius.md` på begge.

**Voktet i `matchTimeline.test.tsx`** («bildene står i innholdskolonnen»):
begge bildeflatene måles mot `grid.contentLeft`, og bilderaden må ha minuttet
i den faste kolonnen. Hele poenget med griddet er at ALT innhold står i samme
kolonne — den regelen skal ikke kunne skli tilbake ved neste redigering.

#### ✅ SKIVE 2.2 — TO RETTELSER TIL, SAMME KVELD

Brage: **«det er fremdeles stygt ved mål, ved oppdatering ser det bedre ut
men tidslinjen kuttes.»** To feil, og de hang sammen — begge kom av at
målraden fortsatt oppførte seg som om den lå på skive 1s flate.

**1. LAGETS LYS RAKK IKKE NED TIL BILDET.** Swellens lagfarge-gradient var
`x1=0% y1=0% x2=100% y2=30%` — altså litt på skrå. I `objectBoundingBox`
roterer en slik gradient med boksens FORM: en målrad med bilde er tre ganger
så høy som en uten, og da ble gradienten nesten loddrett i stedet for
vannrett. Lyset sluttet midtveis, og bildet ble hengende løsrevet under et
mål som visuelt stoppet før det var ferdig.
**Nå `y2="0%"` — helt horisontal, altså høyde-uavhengig.** Feiringen dekker
hele øyeblikket, bildet inkludert, og bildet leses som en del av målet.

**2. KUPPELEN KUTTET KRITTLINJA.** Den buede overkanten ble laget ved å male
GRUNNFARGEN (`matchColors.timeline`, #123325) tilbake over de firkantede
hjørnene — den eneste måten å kutte en kurve i RN uten maskepakke, og helt
usynlig så lenge raden lå på nettopp den fargen. Fra skive 2 ligger den på
GRUNNEN. Da var overmalingen plutselig en ugjennomsiktig plate i FEIL farge,
tvers over hele bredden, i de øverste 34 punktene av hver målrad — og der
forsvant tidslinja.
**Nå klippes swellen til formen sin** (`ClipPath`, samme teknikk som
`ArenaSurface`). Ingen dekkende flate legges noe sted, og linja går
uavbrutt gjennom. `swellDome`-stilen er borte.

⚠️ **MØNSTERET ER VERDT Å HUSKE:** begge feilene var kode som var RIKTIG i
skive 1 og ble FEIL av at flaten under endret seg. Se etter flere av dem —
alt som «maler grunnen tilbake» eller antar en fast radhøyde.

**Voktet i `matchTimeline.test.tsx`:** ingen `fill` i kampforløpet får være
noe annet enn `none` eller en gradient (`url(#…)`) — altså ingen plate over
skinna — og måltenningen må ligge på nøyaktig `threadLeft`/`threadWidth`.

</details>

#### ÅPENT / BEVISST UTELATT

- **Tab-baren er fortsatt krem.** Rutespesifikk stadionvariant er skive 6/10
  (P4), ikke denne skiva.
- **`MatchPhotoRail`s `match`-variant er bygget, men ubrukt** — stripa vises
  kun på ferdig kamp, altså skive 3. Den lå på skive 2-lista i handoffen og
  er tatt mens fila uansett ble rørt.
- **Ingen løpende bevegelse i grunnen.** Fasitens pustende `g-pulse-a/b`,
  bølgen og aurora hører til skive 5/6 sammen med `useReducedMotion`.
- **Kampuret er urørt** (P2 / skive 7). Arenaen viser derfor INGEN minutt i
  pause — klokka teller fortsatt under pause i dag, så tallet ville vært
  feil. «Etter 1. omgang» er sant uansett.
- **Omgangen leses av forløpet** (finnes det en `andre_omgang`-rad?), ikke av
  klokka. Det er den eneste sanne kilden vi har før P2.

#### ⚠️ FELLE FUNNET UNDERVEIS: PRETTIER-KONFIGEN MATCHER IKKE HUSSTILEN

`.prettierrc.js` setter bare `arrowParens`, `singleQuote` og `trailingComma`.
Husstilen i repoet er i tillegg **`bracketSpacing: false`** og
**`bracketSameLine: true`** (`{left: x}`, og `>` på samme linje). Kjører man
`prettier --write` uten flaggene, formateres HELE fila om — og en
15-linjers endring blir en 600-linjers diff.
**Til den slår til igjen:** `--no-bracket-spacing --bracket-same-line`.
Bør trolig bare skrives inn i `.prettierrc.js`, men det er en egen liten
beslutning og ble ikke gjort her.

⚠️ **DEL TO AV FELLA, FUNNET I SKIVE 3: repoet er pinnet på prettier 2.8.8,
men flere filer er formatert av en prettier 3.x.** Kjører man repoets egen
prettier på en slik fil, REVERSERES formateringen — parentesene rundt `??` i
ternærer forsvinner, malstrenger brytes om, importlister kollapser. På
`EventDetailScreen.tsx` ble en 100-linjers endring til en 577-linjers diff,
med FLAGGENE PÅ. Det er ikke mellomromsstøy man kan ignorere; det er ekte
kodeendringer i kode man ikke har rørt.
**Regelen inntil versjonen er avklart: kjør prettier på NYE filer, og
håndformatér endringer i gamle.** Kontroller alltid med
`git diff --stat` etterpå — en diff som er mye større enn endringen ER
fellen.

---

---

### ✅ SKIVE 3 LEVERT OG TELEFONGODKJENT 2026-08-20 — KAMPRAPPORTEN

Commit `1b0390d` + `95c092f` (3.1). **Ren JS. Ingen nye pakker, ingen native
endringer, ingen migrasjon.** 345 tester / 26 suiter grønt (var 316/25).
Lint 12 kjente — uendret. Ruten, de tre stackene og B2-cachen er urørt.

#### HVA SOM ER BYGGET

- **`src/components/match/FinishedMatch.tsx` (ny)** — samme mønster som
  `LiveMatch`: `showReport`-grenen deles med trening, sosialt, kommende kamp,
  turnering og avlyst kamp, så verdenen kan ikke legges rundt hele returen.
  Rekkefølgen er arena → (egen tittel + beskrivelse) → bildestripe → forløp →
  påmeldte → «Rediger».
- **`MatchArena` tar nå `phase: 'live' | 'paused' | 'finished'`**, ikke
  `paused: boolean`. En boolsk kunne ikke uttrykke den tredje tilstanden, og
  to boolske ville latt «pause OG ferdig» oppstå. `LiveMatch` sender
  `paused ? 'paused' : 'live'`.
- **`src/components/match/MatchAttendance.tsx` (ny)** — påmeldte som
  ansikter på rad, ikke som liste. **Brages valg**, se beslutningen under.

#### RAPPORTEN ER DEN SAMME ARENAEN — TRE TING SKIFTER, IKKE FLERE

Det er hele poenget: kampen du fulgte er kampen du kommer tilbake til.
Verdenen er den samme, bare roligere (`phase="finished"` demper lagene i
grunnen — den slukker dem ikke, en slukket verden ville gjort rapporten til
en arkivside).

1. **LIVE → SLUTT.** Flat krittpill (`rgba(255,255,255,.13)`), ikke et nytt
   flagg på `LiveBadge`. ⚠️ **Grunnen er fargesemantikken:** `LiveBadge` er
   coral, og coral betyr LIVE og ingenting annet. En «ferdig»-tilstand på
   badgen ville gjort den til en generell statuspill, og da lekker coral ut i
   rapporten. Voktet som test.
2. **Klokka → datoen.** Klokkeslotten er «når», og hva «når» betyr skifter
   med fasen: minutt under kampen, omgang i pause, `20. aug · 18:00` etterpå.
   **Utledet ÉN gang**, samme regel som prototypens ene ekte bug satte.
3. **SEIER-pillen.** Gull med gullblekk (fasitens `.a-result .seier`) — ikke
   appens mint `StatusPill`: stillingen står i mint rett over, og to
   mintflater over hverandre gjør feiringen til en gjentakelse av tallet.
   Ingen tap-pill, ingen uavgjort-pill. Gløden på tallet slukkes; den er den
   pågående kampens signatur.

⚠️ **INGEN MÅLFLOD, INGEN `useGoalMoment` I RAPPORTEN.** Stillingen er ferdig,
og en feiring som fyrer hver gang rapporten åpnes ville vært en påstand om at
noe skjer nå. SEIER-pillen er rapportens eneste øyeblikk.

#### 🔒 TRE BESLUTNINGER SOM MÅTTE TAS (handoffens «reelle beslutning»)

1. **PÅMELDTLISTA BLE EN AVATARSTRIPE — Brages valg 2026-08-20.**
   På en KOMMENDE kamp er påmeldingen en handling (hvem mangler svar, hvem må
   purres), og da er radene riktige — de står urørt der. På en SPILT kamp er
   den et faktum, og en radtabell med hvite linjer midt i kampverdenen er
   akkurat det admin-språket retningen holder ute. Fasitens eget uttrykk for
   en gruppe mennesker på arenaen er ansikter på rad (`.a-crowd`).
   **Prisen, bevisst tatt:** «Meldt av <forelder>» vises ikke i rapporten.
   Navnene står i sin helhet, ikke klippet — rapporten er eneste sted de
   finnes etter kampen, og det finnes ingen «vis alle» å trykke på.
2. **«REDIGER» MÅTTE FØLGE MED NED.** Det var ikke en smakssak: kampsiden er
   ENESTE inngang til å rette en spilt kamp, så blir knappen igjen på den
   lyse flaten finnes det ingen vei til den i det hele tatt. Krittkantet
   trykkflate nederst (44 pt), samme språk som reporterknappene, aldri hvit.
3. **`MatchPhotoGallery` FLYTTET IKKE.** Den er en fullskjerms modal på svart
   og har ingen flate i verdenen — den var aldri en hvit flekk.

#### ⚠️ 2.2-MØNSTERET FANT ÉN TIL

**`MatchPhotoRail`s lasteplate var `matchColors.timeline`.** Varianten ble
bygget i skive 2 for en flate som ikke fantes ennå, og fargen var
kampforløpets. Men stripa står ikke i kampforløpet — den står på GRUNNEN,
over det rommet. En flat romfarge på feil rom er nøyaktig fella fra skive 2.2.
**Nå et scrim** (`rgba(8,27,19,.55)`), som senker det som ligger under og
derfor er riktig uansett hvilken tone stripa havner på.

Samme resonnement traff ringen rundt de overlappende ansiktene: prototypen
bruker `border: 2px solid var(--arena-b)`, altså flaten malt tilbake. Ringen
er derfor et scrim her også — den ble aldri bygget som grunnfarge.

#### NYE GULLVERDIER

- **`matchContrast.test.ts`**: SLUTT-pillen (kritt med alfa **regnet ut mot
  arenaen under**, ikke som om den var hvit — da ville den «bestått» med 17:1
  og målt noe som ikke finnes noe sted), gullpillen med gullblekk, og «+N» i
  påmeldtstripa mot grunnen.
- **`finishedMatch.test.tsx` (ny)**: rapporten monterer som én grønn verden,
  ingen kremfamilie, **ingen coral**, forløpet leses forfra, «Rediger» finnes
  for trener og ikke for medlem, påmeldte er ett stopp med BARNETS navn.
  ⚠️ **Fixturen har bilder med vilje** — både bildestripa og bilderadene
  rendres kun når det finnes bilder, og begge var lyse flater før denne
  skiva. En tom `photos`-liste ville gjort fargetesten blind for nettopp de to.
- **`matchArena.test.tsx`**: fasen, coral-forbudet, datoen i klokkeslotten,
  SEIER kun ved seier (ikke ved uavgjort), og at gløden slukkes.

#### REDUCE MOTION ER MED FOR DENNE ANIMASJONEN

`useReducedMotion` er koblet på SEIER-pillen. Skive 6 kobler den på det som
allerede animerer (`useGoalMoment`, `LiveBadge`, pulsen) — men å legge inn en
NY animasjon uten den ville vært å bygge den regresjonen med vilje.
«Reduse bevegelse fjerner bevegelsen, ikke innholdet»: pillen står der, den
spretter bare ikke.

#### ÅPENT / BEVISST UTELATT

- **Publikumstallet fra fasiten** («17 var med gjennom kampen» med ansikter)
  er IKKE bygget. Det er engasjement, og engasjementet kommer i skive 4 med
  den kanoniske koblingen. Påmeldtstripa er påmelding, ikke publikum — de to
  skal ikke blandes.
- **Kampuret er urørt** (P2 / skive 7). Rapporten viser ingen spilletid, kun
  dato og klokkeslett for avspark.
- **`styles.timeline` i `EventDetailScreen` lever fortsatt**, men bare som
  sisteutvei: en FERDIG kamp uten stilling eller motstander blir aldri en
  rapport og faller ned i den lyse grenen. Begge felt er `?`-typet, så
  tilfellet kan ikke typebevises bort.
- **Avlyst kamp er ikke rørt.** Den har `phase="cancelled"` klar i
  `MatchGround`, men står fortsatt på den lyse flaten — «FØR KAMP ER UTE I
  DENNE RUNDEN» gjelder den også.

#### ✅ SKIVE 3.1 — ÉN RETTELSE FRA TELEFONTESTEN 2026-08-20

Brage: **«Alt det andre funker»** — men bildet i en målrad var tilbake som
en feil. **Lagets lys stoppet rett over bildet**, så målet sluttet visuelt
midtveis og bildet hang løsrevet under.

**Skive 2.2 trodde den hadde lukket dette**, og rettelsen den gjorde
(gradientens rotasjon, `y2="0%"`) var riktig — men den var ikke HELE årsaken.

**Den andre halvparten: `height="100%"` inne i svg.** Radens flater
(målswellen og skiferstripa) er svg-er i en `absoluteFill`-beholder.
Beholderen strekker seg korrekt over hele raden — RNs layout gjør alltid det.
Men `<Rect height="100%">` regnes mot svg-ens EGEN oppmålte lerretstørrelse,
og den blir stående på verdien fra første layout. En målrad uten bilde er
~83 pt; med bilde er den tre ganger så høy.

⚠️ **BEVISET LÅ I SAMME SKJERMBILDE, OG ER VERDT Å HUSKE SOM METODE:**
måltenningen (`styles.ignition`) er en vanlig `View` med `top: 0, bottom: 0`,
og den gikk hele veien ned forbi bildet. Samme rad, samme beholder, samme
høyde — den ene brukte RNs layout, den andre en prosent inne i svg. **Når to
lag i samme boks er uenige om høyden, er det ikke layouten som tar feil.**

**Nå måles radens høyde (`useRowHeight`) og sendes inn som PUNKTER.** Ingen
prosent noen steder i radflatene, og klippet er eksakt i stedet for «vilkårlig
dypt». Samme mønster som `ArenaSurface`; prisen er den samme — én frame uten
flaten før målingen lander.

**Begge flatene er rettet.** Mål imot fikk `AgainstStripe` som egen komponent
med samme måling: skiferstripa hadde nøyaktig samme prosenthøyde, og en
målrad imot med bilde er like høy. Rettes bare den ene, er feilen fortsatt
der — bare vanskeligere å få øye på.

**Voktet i `matchTimeline.test.tsx`:** begge radflatene må ha radens målte
høyde i punkter, og swellen må arve den FAKTISKE høyden (ikke høyden uten
bilde). Den gamle vakten («ingen dekkende fyllfarge») ble samtidig blind —
uten `onLayout` tegnes swellen ikke i det hele tatt, så testen «bestod» på
ingenting. Den kjøres nå med målingen fyrt av.

345 tester / 26 suiter grønt. Lint 12 kjente, uendret.

#### 📱 TELEFONKONTROLLEN — GJENNOMFØRT, TO RUNDER

Runde 1 → «Alt det andre funker» (kun målswellen, se 3.1). Runde 2 →
**godkjent: «Nå funker det».** Alt annet på lista sto Brage til ved første
gjennomgang.

<details><summary>Sjekklista som ble brukt (til gjenbruk i skive 4)</summary>

Åpne en FERDIGSPILT kamp (Hjem/Kalender/Sesongen → en kamp med resultat):

1. **Er det åpenbart samme kamp som live-flaten?** Buen, de tre rommene,
   lagets lys — eller føles rapporten som en annen skjerm?
2. **SLUTT-pillen og datoen** øverst: leses de som «dette er over», eller ser
   den flate pillen bare ut som en dempet LIVE?
3. **SEIER-pillen** — spretter den inn ~250 ms etter at siden lander? Er gull
   riktig ved siden av det mint-tallet, eller konkurrerer de?
   (Test også en kamp som ble TAP eller uavgjort: da skal det ikke stå noe.)
4. **Bildestripa på grunnen.** Blinker det krem mens thumbene lastes?
5. **Forløpet leses forfra** — «Kampens historie», avspark øverst,
   SLUTT-markøren, og krittlinja UAVBRUTT gjennom målradene (2.2-regresjonen).
6. **Påmeldtstripa**: ser den ut som mennesker, eller som en avkortet liste?
   Blir navnerekka for lang på et lag med 18?
7. **«Rediger»** — tydelig nok som krittkant, og fører den til
   redigeringsskjermen?
8. **Stor tekst (XXL)** på rapporten: stabler tallet seg, og holder
   navnerekka?
9. **VoiceOver**: sveip fra toppen — SLUTT, stillingen som én setning, SEIER,
   forløpet ett stopp per hendelse, påmeldte som ETT stopp, «Rediger».
10. **Kanten under push** — blinker det krem når rapporten åpnes fra Hjem?

**⚠️ LEGG TIL I RUNDE 2 HVIS EN RADFLATE RØRES:** et mål MED bilde og et mål
IMOT med bilde. Det var den ene kombinasjonen som avslørte 3.1, og
skiferstripa hadde aldri vært testet med bilde i det hele tatt.

</details>

---

### ✅ SKIVE 4 LEVERT OG TELEFONGODKJENT 2026-08-21 — KANONISK KOBLING + HEIA/KOMMENTARER

**✅ TELEFONGODKJENT 2026-08-21 etter fire runder (4.1–4.4 under).**
Ren JS + ÉN MIGRASJON.
Ingen nye pakker, ingen native endringer. 377 tester / 28 suiter grønt (var
345/26). Lint 12 kjente i `src`+`__tests__` — uendret.

⚠️ **`00071_kampfeed.sql` MÅ PUSHES TIL PROD FØR APPEN VIRKER.** Kampsiden
kaller `get_match_feed`; uten funksjonen feiler kallet, og engasjementslinja
står med nuller og disablede knapper på hver rad. Resten av kampen lever
videre (query-en er isolert), men skiva kan ikke telefontestes før den er ute.

#### ✅ MIGRASJONEN ER I PROD 2026-08-21 — OG DELVIS VERIFISERT

`supabase db push` la ut **kun** 00071 (dry-run bekreftet at ingenting annet
sto i kø), og `supabase migration list --linked` viser den som anvendt.
Ingen andre produksjonsendringer er gjort.

**✅ DØREN ER BEVIST MOT EKTE PROD**, med anon-nøkkelen fra `.env`:

| Kall | Svar |
|---|---|
| `get_match_feed` som anon | **401 `42501 permission denied for function`** |
| `get_match_photos` som anon (kontroll, samme REVOKE/GRANT) | 401 `42501` — identisk |
| `get_invite_preview` som anon (kontroll, finnes ikke) | 404 `PGRST202` |
| `get_match_feed` helt uten nøkkel | 401 `No API key found` |

Kontrollradene er hele poenget: en funksjon som ikke finnes gir **PGRST202**,
mens vår gir **42501**. Altså er funksjonen DEPLOYET og døren LUKKET for anon
— de to tingene kan ikke forveksles.

#### ⛔ RESTEN AV PRODVERIFIKASJONEN ER BLOKKERT — MANGLER EN VEI TIL Å KJØRE SQL

De sju andre punktene krever en INNLOGGET bruker eller vilkårlig SQL mot prod.
Ingen av delene finnes i dette oppsettet, og det er ikke noe som kan «prøves
en gang til»:

- **`.env` har kun `SUPABASE_URL` + `SUPABASE_ANON_KEY`.** Ingen
  service-role-nøkkel, ingen testkonto. De tidligere `verify-*.mjs`-skriptene
  tar `TEST_EMAIL`/`TEST_PASSWORD` fra MILJØET ved kjøring — Brage har dem,
  repoet har dem aldri hatt.
- **`psql` er ikke installert, og Docker finnes ikke** på maskinen, så
  verken direkte tilkobling eller `supabase db start` (lokal Postgres) er
  mulig. Skriptet kan derfor heller ikke tørrkjøres.
- **`supabase`-CLI 2.75 har ingen kommando for vilkårlig SQL** — kun
  `diff/dump/lint/pull/push/reset/start`.
- **`supabase/.temp/pooler-url` inneholder ingen passord** (CLI-en henter det
  fra nøkkelringen), så en connection string kan ikke settes sammen.

⚠️ **EN NY BRUKER KAN IKKE LAGES SOM RIGG HELLER**, og det er verdt å vite
hvorfor: prod krever e-postbekreftelse (6-sifret kode), og
`delete_account_data` (00042) er **service-role-only** og ANONYMISERER i
stedet for å slette — en signup-basert rigg ville altså både vært umulig å
logge inn på og etterlatt varige rader. «Riv den helt ned» er ikke oppnåelig
den veien.

#### ▶️ DEN FERDIGE BEVISFILA: `scripts/verify-00071.sql`

Skrevet i repoets egen bevisform (samme som `verify-00067.sql` /
`verify-00068.sql`): **alt skjer i en subtransaksjon som rulles tilbake med
en marker-exception**, så riggen er revet ned VED KONSTRUKSJON — det finnes
ingen opprydding å glemme. Kjøres ved å lime hele fila inn i
Supabase SQL-editoren; siste `SELECT` gir en grid med ✅/❌ per punkt, og en
etterkontroll som skal vise 0/0/0.

⚠️ **INGEN PUSH SENDES.** Trigger-kjeden bak `start_match`/`report_match_event`
skriver `notifications` og fyrer `net.http_post` (pg_net). pg_net KØER kallet
i en tabell inne i transaksjonen og sender først ETTER COMMIT (00049) — en
rollback fjerner køraden. Dette er grunnen til at rollback-formen er den
eneste trygge måten å teste kampskriving mot prod på i det hele tatt.

Den dekker: **A** døren (grants + gate for anon/ikke-medlem/medlem/ukjent
hendelse) · **B** HEIA av/på, både antall og «valgt», inkludert at en ANNENS
heia flytter telleren men ikke min tilstand · **C** ny og slettet kommentar ·
**D** at en fersk kamphendelse har sin kanoniske post i SAMME transaksjon ·
**E** at rytmemarkørene HAR poster (linja skjules av vår regel, ikke av
manglende data) · **F** at mål imot har en kommenterbar post · **G** bilde på
samme øyeblikk, eldst-først-rekkefølgen og FALLBACKEN når den kanoniske
posten er slettet · **H** regresjon på `get_match_photos` og `get_team_feed`.

⚠️ **FILA ER IKKE TØRRKJØRT** (ingen lokal Postgres). Feiler noe uventet,
kommer alt likevel ut som «⛔ UVENTET FEIL» med meldingen, og resten av
rapporten står — den er skrevet med det som sikkerhetsnett.

**To ting SQL ikke kan bevise, og som derfor MÅ tas på telefonen:**
«uten refetch» (realtime-kanalen) og «Kalender → Comments» (navigasjon).

#### MIGRASJONEN — NØYAKTIG SLIK P1 SPESIFISERTE DEN

`get_match_feed(evt_id)`, `SECURITY DEFINER STABLE`, `is_team_member`-gate,
`REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated` (00060/00061-malen).
**Ingen skjemaendring, ingen indeks på `match_event_id`, ingen UNIQUE.**
Én rad per ikke-slettet post på kampen: `post_id`, `match_event_id`,
`post_type`, `created_at`, `comment_count`, `reaction_counts`, `my_reactions`.

- **`reaction_counts` (jsonb) + `my_reactions` (text[]), ikke
  `heia_count`/`i_reacted`.** 👏 bor ETT sted — `HEIA_EMOJI` i `feed.ts`.
  Et ferdig `heia_count` ville gitt emojien et andre hjem som kan drifte.
  Formen er ordrett den `get_team_feed` alt returnerer — og `my_reactions`
  gjør at «har JEG heiet» ikke koster den ekstra `reactions`-spørringen
  **feeden fortsatt betaler per skjermlast** (mulig opprydding senere).
- **`ORDER BY created_at ASC, id ASC`** fra serveren, fordi det kanoniske
  valget klientside er «eldste ikke-bilde».

#### KANONISK VALG — OG FALLBACKEN SOM IKKE ER TEORI

`pickCanonicalPost()` (`src/shared/matchEngagement.ts`) velger **eldste rad
der `post_type <> 'bilde'`**, med `post_id` som tie-break — uten den kunne to
telefoner heiet på hver sin post for samme mål, og tellerne blitt uenige for
alltid uten at noen fikk en feilmelding.

⚠️ **Den faller tilbake til eldste tilgjengelige post når det bare finnes
bildeposter.** Skrivestien kan ikke lage den situasjonen — `start_match`
(`match_start`), `report_match_event` (`match_event`/`match_end`) og
`createImagePost` (`bilde`) er verifisert, og hendelsens egen post skrives
alltid — **men «Slett innlegget» i feeden treffer i dag målposter (P3s andre
halvvei, ÅPEN i prod til skive 8).** Sletter reporteren målposten, står
hendelsen igjen med bare bildet sitt, og uten fallbacken ville raden tilbudt
HEIA uten noe å henge det på.

#### REGLENE ER KODE I `shared/`, IKKE I JSX

- `showsEngagement()` — **rytmemarkørene får ALDRI en linje.** De HAR
  feed-poster, men er kampens gater, ikke øyeblikk. Fasiten kaller ikke
  `engRow()` på dem. `bytte`/`kort` er historiske importdata uten post.
- `allowsHeia()` — **P1: ingen HEIA på mål imot.** Mål uten `teamSide`
  behandles som mål imot (samme forsiktighetsregel som `nodeKindFor`).
- `matchHeiaA11yLabel` / `matchCommentA11yLabel` i `matchCopy.ts` — setningen
  bor der, ikke i JSX, som resten av kampens språk.

#### 🔒 DEN ENE STEDET FASITEN OG P1 VAR UENIGE — BRAGE AVGJORDE

Prototypens `momentHtml` gir mål-imot-raden **ingen** engasjementslinje i det
hele tatt (`engRow` kalles bare på mål-for-oss, oppdatering og bilde). P1 sier
«ingen HEIA, men kommentarer er tillatt begge steder».
**Brages avgjørelse 2026-08-20: P1 vinner. Mål imot får kommentarhandling,
aldri HEIA — og linja skal være HELT NAKEN og kompakt, uten boks eller pill.**

**HEIA-knappen RENDRES IKKE på mål imot** — den er ikke disablet. En avslått
knapp ville sagt «du kan heie hvis du får lov», og det er ikke beslutningen.

#### UTTRYKKET — FASITENS `.eng`

`src/components/match/MatchEngagementRow.tsx` (ny). Ingen pill, ingen boks,
ingen flate: ikon + tall rett på grunnen. Hvile dempet, PÅ er mint. Tallet i
displayfonten. `tone="goal"` løfter blekket der linja ligger på målswellen —
samme skille fasiten gjør mellom `.eng button` og `.goal .eng button`.

- **`HeiaHand` i `icons.tsx` (ny)** — fasitens egen hånd-path, med `filled`.
  Emojien 👏 er riktig i FEEDEN, men bærer sin egen farge: den kan verken bli
  mint når knappen er på eller dempes til kritt når den er av. Samme presedens
  som `PlaySolid`/`PauseSolid` fra skive 1. Boblen er `MessageCircle`, som
  fantes fra før.
- ⚠️ **SLOTEN FLYTTET: ENGASJEMENTET AVSLUTTER ØYEBLIKKET, ETTER BILDET.**
  Den sto mellom teksten og bildet fordi den var TOM da plassen ble reservert
  i skive 1. Med innhold i den ble rekkefølgen «MÅL! → HEIA → bildet» — en
  handling midt inne i det den handler om. Fasiten legger `engRow()` sist, og
  et bilde festet til et mål er en del av målet. Voktet som test.

#### ♿ TILGJENGELIGHET — OPPFYLT FOR SKIVE 4s FLATER

- Rolle, label med BETYDNING («Heia på målet på 34 minutter. 12 heier.»),
  og `accessibilityState={{selected}}`. Tilstanden leses av state-en, ikke av
  labelen — ellers sies den to ganger på ulikt vis.
- ⚠️ **44 pt ER LAYOUT (`minHeight`/`minWidth`), IKKE `hitSlop`.** De to
  knappene er NABOER: to raus hitSlop gir OVERLAPPENDE treffområder, og da
  avgjør view-rekkefølgen hvem som «vant» trykket i overlappet. `hitSlop`
  ligger kun på topp/bunn som romslighet. Voktet som test (venstre/høyre
  hitSlop må være 0).
- Sloten ligger UTENFOR radens samlede label — voktet som test at ingen
  forelder har `accessible`. Ryddes den inn, slutter knappene å være egne
  stopp i VoiceOver, altså umulige å trykke.

#### REALTIME OG CACHE

- **`subscribeToMatch` fikk tre nye hendelser:** `reaction`, `commentDelta`
  (begge fra UFILTRERTE `reactions`/`comments`-abonnementer — samme løsning og
  samme RLS-begrunnelse som `subscribeToFeed`; DELETE på reactions trenger
  `REPLICA IDENTITY FULL`, som 00059 alt ga) og **`engagementPost`**, som er
  en `feed_posts`-INSERT med `match_event_id`. Uten den siste ville det NYESTE
  målet vært det eneste man ikke kunne heie på — og det er nettopp det målet
  folk vil heie på.
- ⚠️ **Eget HEIA-ekko filtreres I SKJERMEN, ikke i kanalen.**
  `acquireChannel` deler kanalen, så en «hvem er jeg» fanget i oppsettet ville
  tilhørt den FØRSTE abonnenten for alltid. `userId` følger derfor med i
  payloaden. (Feeden har samme latente problem i `subscribeToFeed` — ikke rørt
  her, men verdt å vite.)
- **`CommentsScreen` patcher kampens cache for ALLE tre mutasjonene** — ny
  kommentar, slettet kommentar og HEIA av/på — via `post.eventId`. Derfor er
  ekkofiltreringen trygg fra begge innganger. Kommentarer trenger ikke
  avsenderfilter: mens tråden er åpen er kampen ute av fokus og abonnementet
  revet.
- **Feed-cachen patches også** når du heier fra kampen. Samme post, to tall —
  uten patchen ville feeden vist din applaus som ikke gitt til neste refetch.

#### ⚠️ RPC-BUDSJETTET ER FIRE, OG DET ER BEVISST

`get_event_with_rsvp` · `get_match_photos` · `get_team_authors` ·
**`get_match_feed`**. Lesestien var det som manglet (P1), og den kunne ikke
presses inn i `get_event_with_rsvp` — den RPC-en deles av alle hendelsestyper,
og en trening skal ikke betale for kampens engasjement.
`eventDetailRefetch.test.tsx` vokter lista UTTØMMENDE: dukker
`get_team_members` opp igjen, faller testen.

#### ⚠️ EN DØD KNAPP SOM MÅTTE LUKKES I SAMME SLAG

**`Comments` fantes i Home- og Inbox-stacken, men IKKE i Kalender-stacken** —
der `EventDetail` også bor. Kommentarknappen ville kastet på hver kamp åpnet
fra Kalender. Ruten er lagt inn samme sted, av nøyaktig samme grunn som
`Invite` måtte følge lagoversikten inn i varselstacken.

#### ÅPENT / BEVISST UTELATT

- **`get_team_feed`-gaten for mål imot er skive 9, ikke denne.** Ikke samme
  migrasjon: en grant-feil skal ikke kunne ta ned feeden og kampen på én gang.
  Til den finnes, kan man fortsatt heie på et mål imot FRA FEEDEN.
- **Ingen `bump`-animasjon på trykket.** Fasiten har den; den hører til
  skive 6 sammen med `useReducedMotion`, og en ny animasjon uten den ville
  vært å bygge regresjonen med vilje (samme resonnement som SEIER-pillen).
- **Publikumstallet** («17 var med gjennom kampen») er fortsatt ikke bygget.
- **Kommentartråden er krem, også i arket — BESLUTTET (Brage 2026-08-21).**
  Krem er Heias lyse LESEFLATE. Etter skive 4.1 kommer den opp som bunnark
  over kampen i stedet for som egen skjerm; en eventuell `#02FFAB`-innramming
  tas i den samlede Stadium Light-runden. Se `### 🕯 STADIUM LIGHT`.
- **Luften under et øyeblikk er større enn i fasiten**, fordi 44 pt-boksen
  sentrerer innholdet sitt. `marginTop` er senket til 2 for å kompensere over;
  under står radens egen `paddingBottom`. Kjennes på telefon.

#### ✅ SKIVE 4.1 — PRODUKSJONSOVERSETTELSE 2026-08-21

**Funksjonaliteten fra skive 4 var telefongodkjent.** Denne runden rettet
noe annet: prototypen var fulgt for bokstavelig, og handlingen hadde blitt
en ANNEN enn den appen allerede har. Fire brudd på `AUTORITETSREGELEN` i én
liten komponent. **388 tester / 29 suiter grønt** (var 377/28). Lint 12
kjente — uendret.

**1. `HeiaHand` ER SLETTET FRA `icons.tsx`.**
Skive 4 tegnet en egen hånd-SVG kopiert fra prototypens CSS-path, med den
begrunnelsen at «en emoji kan ikke farges mint». ⚠️ **Begrunnelsen var
feil, og det er den viktigste lærdommen her:** i feeden skifter 👏-glyfen
ALDRI farge — det er TEKSTEN og pillen som bærer på/av. Det var altså aldri
noe problem å løse, bare et nytt ikon å vedlikeholde. Kampen bruker nå
`👏` og `MessageCircle` (14 pt), akkurat som `FeedCard`/`CommentThread`.

**2. SPRÅKET ER APPENS.** «2 HEIA» behandlet HEIA som en måleenhet. Nå
ordrett feedens mønster: **«Heia» på null, «1 heier», «2 heier»** — og
kommentaren **«Kommenter» på null, ellers tallet**. Voktet som test.

**3. NY TOKEN `typography.action` — DEN DELTE STEMMEN.**
HEIA-tallet sto i `fonts.display`, som `theme/tokens.ts` uttrykkelig sier
«aldri brødtekst/titler». Stemmen (12.5 / 700 / systemfont) lå fra før som
RÅ TALL i både `FeedCard` og `CommentsScreen`, så skive 4 laget den tredje
kopien. Nå ett token, og **alle tre flatene peker på det** — identiske
verdier, så feeden er visuelt uendret. Ingen `letterSpacing`, ingen rå
`fontFamily` igjen i skivas komponenter.

**4. PÅ/AV ER DET ENESTE SOM OVERSETTES.** Feeden viser «på» som en FLATE
(`heiaTint`-pill + `heiaInk`). Kampen har ingen flater — retningen sier
skillet kommer av lys og luft. Tilstanden flyttet derfor til BLEKKET:
`matchColors.dim` i hvile, `colors.heia` når du har heiet. Samme semantikk
(mint = HEIA), kampens språk. `tone="goal"`-varianten er BORTE — den var
enda et prototype-lån (`.goal .eng button` i CSS) og ga to utseender der
appen har ett.

#### 📱 KOMMENTARENE KOMMER OPP FRA BUNNEN — HER HADDE PROTOTYPEN RETT

**Skive 4 navigerte til `CommentsScreen`.** Riktig fra feeden, feil fra
kampen: en pågående kamp er noe du STÅR I, og å bli skjøvet ut av den for å
lese en kommentar er å forlate kampen.

- **`src/components/CommentThread.tsx` (ny)** — hele tråden løftet ut av
  `CommentsScreen`: lasting, mutasjoner (kommentar, sletting, HEIA), de
  optimistiske patchene mot BÅDE feed-cachen og kampens engasjement-cache,
  moderasjonsmenyene og uttrykket. **Én tråd, to innganger** — det var hele
  poenget med å ikke bygge en parallell kommentarløsning.
- **`src/components/match/CommentSheet.tsx` (ny)** — `Modal` +
  `animationType="slide"`, nøyaktig mønsteret `MatchPhotoSheet`,
  `ReporterSheet` og `TimeSheet` alt bruker. **Ingen ny pakke, ingen native
  rebuild.**
- **`CommentsScreen` er nå 46 linjer** — bare rammen (tastatur, `BackBar`,
  flate). Den lever videre for feedens og varslenes innganger.
- **Arket er KREM.** Et ark er ikke en flate I verdenen, det ligger OVER
  den. Krem er Heias lyse leseflate, og en tråd er lesing.
- **Fast høyde 78 %**, ikke innholdsstyrt: en tom tråd og en tråd med tolv
  replikker skal ikke gi to ulike ark, og skrivefeltet skal sitte samme sted.
- **Alle tre veiene ut finnes**, og alle tre er voktet som test:
  bakgrunnstrykk (med egen a11y-label — ellers er det et stort navnløst
  trykkfelt VoiceOver leser først), **`onRequestClose` for Android-tilbake**
  (uten den er arket en blindvei på Android), og slettet innlegg → arket
  lukker seg i stedet for å stå tomt over kampen.
- **`accessibilityViewIsModal`** på arket: uten den fortsetter VoiceOver å
  lese KAMPEN bak, og fokus vandrer mellom to lag som visuelt ikke finnes
  samtidig.
- **`key={postId}`** på tråden: bytter du øyeblikk uten at arket lukkes,
  lastes tråden på nytt i stedet for å vise forrige samtale.

⚠️ **`Comments`-RUTEN I KALENDER-STACKEN ER TRUKKET TILBAKE.** Den ble lagt
inn i skive 4 fordi kampen navigerte dit. Nå gjør den ikke det, og
Kalender-stacken har ingen annen inngang til tråden — en registrert rute
ingenting kan nå er verre enn ingen rute. `AppNavigator.tsx` og
`KalenderStackParamList` er tilbake til utgangspunktet.

#### ⚖️ HVA SKIVE 4.1 ETTERLOT SOM REGEL

Se `## ⚖️⚖️ AUTORITETSREGELEN` øverst. Den ble skrevet på grunn av denne
runden, og gjelder alle kommende skiver.

#### ✅ SKIVE 4.2 — TRE RETTELSER FRA TELEFONTESTEN 2026-08-21

Brage: **«Nå er kommentarsiden slik vi vil ha den»** — men arket selv var
feil på tre punkter. Alle tre kom av at `MatchPhotoSheet`-mønsteret ble
kopiert rått, uten å spørre om det passet for DENNE flaten.

1. **ARKET KOM OPP ALTFOR AGGRESSIVT.** `animationType="slide"` er systemets
   egen, og den KASTER arket opp. En samtale skal gli inn og lande.
   Nå `animationType="none"` + egen `Animated.timing` med
   `Easing.out(Easing.cubic)`, 340 ms inn / 210 ms ut — full fart i starten,
   myk landing. Samme verktøy som `DateField` og `MatchPulseCard` alt bruker;
   `transform`/`opacity` går på native driver, **ingen ny pakke**.
   `useReducedMotion` er koblet på: er innstillingen på, står arket bare der.
2. **DEN SVARTE VASKEN ER BORTE.** `rgba(0,0,0,0.5)` slukket den grønne
   verdenen — og da er hele grunnen til å bruke et ark borte, for kampen
   skal fortsatt være DER bak. Nå **kampens eget scrim** (`#081B13`, samme
   som `MatchTimeline` og `MatchPhotoRail`) på 0.32, som SENKER verdenen i
   stedet for å male over den. Den toner inn med arket i stedet for å slå på.
   Voktet som test: ingen svart bakgrunn bak arket.
3. **TOPPEN ER EN GRIPEFLATE.** `PanResponder` (innebygd i RN) på hodet —
   håndtaket og tittelen. Dra ned forbi 28 % av høyden, eller slipp med fart,
   så lukker den; kortere enn det spretter den tilbake.
   ⚠️ **Gesten ligger på HODET, ikke på hele arket:** under ligger en
   scrollende tråd, og en drag-to-dismiss over den ville kjempet med
   scrollen på hver eneste sveip. Voktet som test.

⚠️ **ALLE VEIER UT GÅR NÅ GJENNOM SAMME ANIMASJON** (`requestClose`) —
bakgrunnstrykk, Android-tilbake, dra ned og slettet innlegg. Ellers ville
noen av dem fått arket til å forsvinne med et klipp.
⚠️ **Testene måtte lære det:** lukkingen er animert, så `onClose` kommer
FØRST når bevegelsen er ferdig. Uten `jest.advanceTimersByTime` ville testene
«bevist» at knappene er døde.

390 tester / 29 suiter grønt. Lint 12 kjente — uendret.

#### ✅ SKIVE 4.3 — DRAGET VIRKET IKKE 2026-08-21

Brage: **«siste som mangler er at jeg kan bevege kommentarseksjonen ved å ta
på toppen av den»** — gripeflaten fra 4.2 var der i koden, men ikke i
fingeren. To ting kunne stoppe den, og begge er rettet, fordi bare den ene
kan ikke bevises uten enhet:

1. **RESPONDEREN BLE ALDRI VUNNET.** 4.2 hadde BARE
   `onMoveShouldSetPanResponder` med en 4 pt-terskel — riktig tanke på en
   flate med knapper, feil her. Hodet har ingenting å trykke på, og
   berøringen starter som regel på tittel-`Text`-en, så responderen måtte
   vinnes gjennom en forhandling andre lag kan komme i veien for. Nå tas den
   **ved berøring og i capture-fasen** (`onStartShouldSetPanResponder` +
   `…Capture`), pluss `onPanResponderTerminationRequest: () => false` så
   ingen kan overta MIDT i draget. Et rent trykk lander i release med
   `dy ≈ 0` og blir en no-op. Voktet som test.
2. ⚠️ **DRIVEREN ER BYTTET TIL JS FOR DETTE ARKET — bevisst unntak.**
   Resten av appen animerer `transform`/`opacity` på native driver, og det er
   riktig for fyr-og-glem-bevegelser. Her følger verdien FINGEREN, og
   fingeren kommer inn via `PanResponder` — altså fra JS-tråden uansett. Med
   native driver må hver `setValue` under draget krysse brua til den native
   grafen, og nettopp den kombinasjonen (native tween + JS `setValue` på
   samme node) gjør et bunnark-drag upålitelig. Prisen er at åpne-/
   lukkebevegelsen på 340 ms kjører på JS-tråden — ett `transform` på én
   flate, på en skjerm som ellers står stille. **`DRIVER`-konstanten er ett
   sted, så den kan flippes tilbake hvis dette viser seg unødvendig.**

Dessuten `collapsable={false}` på hodet: på Android kan en View som bare
bærer layout bli optimalisert bort av det native treet, og da forsvinner
treffområdet med den. (Ikke årsaken på iPhone, men gratis forsikring.)

390 tester / 29 suiter grønt. Lint 12 kjente — uendret.

#### ✅ SKIVE 4.4 — UTGLIDNINGEN RYKKET 2026-08-21

Brage: **«hvis jeg drar litt fort ned så skal den gå smooth ned av seg
selv»** og **«den rykker litt når man gjør dette nå»**.

**Årsaken var ÉN kurve.** Alle utganger delte `Easing.in(Easing.cubic)` — en
kurve som starter på NULL fart. Slapp du arket mens det var i bevegelse,
stoppet det altså HELT OPP i slippøyeblikket og tok sats på nytt. Det er
rykket. Det er også hvorfor «gå smooth ned av seg selv» ikke virket: arket
gjorde det, bare med et fartssprang først.

**Nå følger fingerens fart med ut.** `slideOut` tar en `flickSpeed` (px/ms):

- **Fra fingeren:** `Easing.linear`, og varigheten regnes som *hvor langt det
  er igjen / farten*. Da finnes det **ikke noe fartssprang i det hele tatt**
  i slippøyeblikket. Den brå stoppen på slutten ser ingen — arket er utenfor
  skjermen da. Gulv 1.2 px/ms (et treigt slipp skal ikke bli snegle) og tak
  360 ms.
- **Fra et TRYKK** (bakgrunn, Android-tilbake, slettet innlegg): arket står
  stille, og da er det riktig å ta av. `Easing.in(Easing.cubic)` beholdes.

⚠️ **`dragY`-refen er en del av fiksen, ikke bokføring:** uten den regnet
utglidningen varigheten fra FULL høyde selv om arket allerede lå halvveis
nede, og gikk dermed halvparten så fort som fingeren.
`translateY.__getValue()` ville gitt samme tall, men er privat API.

**Terskelen senket til 0.5 px/ms** (var 0.7), så «litt fort» faktisk teller —
0.7 krevde et bevisst kast.

390 tester / 29 suiter grønt. Lint 12 kjente — uendret.

#### 📱 TELEFONKONTROLLEN — RUNDE 2

1. **HEIA-linja:** står det «Heia» før noen har heiet, og «1 heier» /
   «2 heier» etterpå? Ser den ut som SAMME handling som i feeden?
2. **Trykk HEIA:** går teksten til mint? Trykk igjen — tilbake til dempet?
3. **Kommentaren:** står det «Kommenter» på null og tallet ellers?
4. **Trykk kommentaren i en LIVE kamp:** glir arket opp og LANDER, i stedet
   for å bli kastet opp? Ser du den grønne kampen bak, bare dempet — ingen
   svart vask? Skriv en kommentar, **dra arket ned etter toppen**:
   **er du fortsatt i kampen, på samme sted i forløpet?**
   Prøv også en kort drag som IKKE skal lukke — spretter den tilbake?
   Og et lite KAST nedover: glir arket videre i samme fart, uten å stoppe og
   ta sats på nytt (4.4)?
   Og en drag som starter nede i tråden — den skal SCROLLE, ikke lukke.
5. **Tastaturet i arket:** dekker det skrivefeltet, eller løftes feltet?
6. **Android-tilbake / sveip:** lukker arket, ikke skjermen.
7. **Samme fra en FERDIGSPILT kamp.**
8. **Fra FEEDEN** skal kommentaren fortsatt åpne fullskjerm som før — og fra
   et VARSEL likeså. Tråden skal se helt lik ut begge steder.
9. **Tallet:** kommenter fra arket, lukk det — står tallet riktig på raden?
10. **VoiceOver med arket åpent:** leses BARE arket, ikke kampen bak?
11. **Stor tekst (XXL)** på HEIA-linja og i arket.

#### 📱 TELEFONKONTROLLEN — SJEKKLISTE

Åpne en LIVE kamp (eller start en), og etterpå en FERDIGSPILT:

1. **Leses linja som del av øyeblikket, eller som en knapperad?** Den skal
   ikke ha boks, ramme eller pill noe sted.
2. **Trykk HEIA på et mål.** Slår tallet til med én gang? Blir hånden fylt og
   mint? Trykk igjen — går det tilbake?
3. **Mål IMOT: er det INGEN HEIA der, bare kommentaren?** Og er den naken nok
   — eller gjør den skiferstripa for høy? (Dette er stedet P1 vant over
   fasiten; si fra hvis du heller vil ha fasitens helt tomme rad.)
4. **Rytmemarkørene** (avspark, pause, 2. omgang, slutt): ingen linje i det
   hele tatt.
5. **Et mål MED bilde:** kommer HEIA UNDER bildet, ikke mellom «MÅL!» og
   bildet? (Og se samtidig etter 3.1-regresjonen — lagets lys skal nå helt
   ned forbi bildet.)
6. **Trykk kommentaren** → tråden åpnes → skriv en kommentar → tilbake:
   **står tallet riktig med én gang?** Gjenta med kampen åpnet fra
   **Kalender-fanen** — det var en død knapp før denne skiva.
7. **To telefoner:** heia fra den ene, se at tallet beveger seg på den andre
   uten refresh. Og at DIN egen ikke telles to ganger.
8. **Et ferskt mål:** rapporter et mål og prøv å heie på det med én gang.
   Knappen skal bli levende i løpet av et øyeblikk — ikke være stille død.
9. **Stor tekst (XXL):** holder linja, eller sprenger «12 HEIA» kolonnen?
10. **VoiceOver:** sveip gjennom et mål — øyeblikket er ETT stopp, og HEIA og
    kommentar er TO EGNE stopp etterpå, med hele setningen og «valgt» når du
    har heiet.
11. **Trykkpresisjon:** treffer du HEIA og kommentaren hver for seg uten å
    bomme, også med tommelen i fart?

---

### ⏳ SKIVE 5 BYGGET 2026-08-21 — KAMPENS PULS (VENTER PÅ TELEFONKONTROLL)

⚠️ **RUNDE 1 BLE AVVIST PÅ TELEFONEN: «fungerer ikke i det hele tatt».**
Se `#### ⏳ SKIVE 5.1` nederst i bolken — den er den viktigste delen av
denne skiva, og den handler om noe større enn pulsen.

**Ren JS**, ingen nye pakker, ingen native endringer, ingen migrasjon.
427 tester / 31 suiter grønt (+37 nye). Lint 12 kjente, uendret.

**Nye filer**
- **`src/shared/matchPulse.ts`** — formen som ren regning, testbar uten
  skjerm. Samme begrunnelse som `matchEngagement.ts`: reglene her er
  PRODUKT, ikke tegning.
- **`src/components/match/MatchPulse.tsx`** — ~90 pt, åpent på grunnen,
  ingen container. «KAMPENS PULS» til venstre, `NÅ 40′` til høyre.
- **`__tests__/matchPulse.test.ts`** (25) + **`matchPulseSection.test.tsx`** (9).

**Tre beslutninger som ble tatt underveis, og som er verdt å kjenne:**

1. ⚠️ **X-AKSEN ER ØYEBLIKKENE, IKKE KLOKKA — og det er det som gjør
   memoiseringsregelen fysisk umulig å bryte.** Prototypen skalerer kurvens
   siste punkt til `S.minute`; da regnes HELE formen om hvert minutt, altså
   nøyaktig det P-bolken forbyr. Her ender kurven i en FAST utklingning etter
   siste øyeblikk, og nå-prikken sitter i kurvens ende. `pulseShape(moments,
   box)` tar ikke imot et minutt i det hele tatt, så tallet kan ikke snike
   seg inn i en avhengighet senere heller. Voktet med `toHaveLength(2)` på
   selve signaturen.
2. **I PAUSE STÅR DET «PAUSE», IKKE «PAUSE · 25′».** Arenaen 90 pt lenger opp
   skjuler minuttet med vilje (klokka teller fortsatt i pause til kampuret
   blir serverautoritativt, P2/skive 7). Et tall i pulsen ville motsagt hodet
   rett over seg. Ferdig kamp: «SLUTT». Både det synlige og det leste
   kommer fra ÉN kilde, `matchPulseClock` i `matchCopy` — samme lærdom som
   arenaens klokkeslott.
3. **INGEN `pflash`.** Prototypen blinker i pulsen ved mål og HEIA;
   `useGoalMoment` flommer allerede hele verdenen ved mål, og to feiringer på
   samme hendelse drifter fra hverandre. Bare nå-prikken puster — og den har
   `useReducedMotion` fra første linje (voktet: `Animated.loop` skal ikke
   kalles med Reduce Motion på, og prikken skal fortsatt være der).

**Memoiseringsnøkkelen (LÅST) er bygget i to trinn, med vilje:** signaturen
regnes på REFERANSENE (billig, og bare når en query har levert nye objekter),
formen på SIGNATUREN. Nøkkelen dekker event-id, type, side, minutt, sekvens,
HEIA-sum og `startedAt`. **Sletting fanges av at id-en forsvinner** —
`MatchEvent` har ingen slettestatus, hendelsen ER borte. **Kommentartallet er
bevisst UTE:** det tegner ingenting, og med det i nøkkelen ville en samtale i
forløpet tegnet pulsen på nytt. Ni tester vokter nøkkelen, og alle unntatt to
holder ANTALLET konstant — det er hele poenget med at `length` ikke holder.

**HEIA endrer gløderadien, aldri høyden.** Bevist tegn for tegn: samme
øyeblikk med og uten heier gir IDENTISK `line` og `area`, og markørene ligger
på nøyaktig samme punkt — bare `glow` vokser, klemt så 4000 heier ikke fyller
rommet. Mål imot gløder aldri, og det følger av P1 uten en egen regel: det
finnes ikke HEIA på mål imot, så det finnes ingen glød å vokse.

**Autoritetsregelen anvendt** (dette er første skive etter at den ble skrevet):
krittfargene, `colors.heiaTint` (som ER prototypens #C6FFE9), `colors.gold`,
`matchColors.opponentInk`, eyebrow-typografien fra `MatchTimeline` og
`fonts.display` på minuttet. Ingen nye farger, ingen ny font, ingen nytt
ikon. A11y-teksten ligger i `matchCopy.ts`, ikke i komponenten.

**Andre ting som ble gjort, og hvorfor:**
- **`minuteOf` flyttet ut av `MatchTimeline`** til `matchPhotoMinute` i
  `shared/matchPulse`. Pulsen og forløpet ligger rett over hverandre; to
  kopier av det regnestykket kunne satt det samme bildet på to ulike
  minutter i samme scroll.
- **Rapporten har pulsen også** — samme verden, og pulsen er det ene bildet
  av hele kampen som får plass på én linje. Den står og faller med forløpet.
- **Ingen prosenter i svg (3.1).** Seksjonen måles, alt tegnes i punkter.
  Voktet: ingen `width`/`height` i treet inneholder «%».
- **Nå-prikken er en vanlig `View` oppå lerretet**, ikke et svg-element — da
  går pusten på native driver, og gløden er den samme skyggen
  retningsmarkørens prikk har. Prisen er to koordinatsystemer som må stemme;
  de gjorde det ikke i første utkast (seksjonens luft ble lagt til én gang
  for mye), så det er nå en egen test.


#### ⏳ SKIVE 5.1 — RUNDE 1 BLE AVVIST PÅ TELEFONEN 2026-08-21

**Brage: «den puls funksjonen fungerer ikke i det hele tatt! Og jeg som
syntes den så dårlig ut i HTML!!! der fungerte den hvert fall.»**

På skjermbildet gikk kurven fram og tilbake over seg selv i venstre kant.

**ÅRSAK 1 — x VAR LINEÆR KLOKKETID, OG DEN KOLLAPSER.**
Brages kamp sto 4–1 med **alt rapportert i minutt 0**. Da fikk alle fem
markørene `x = 10` — samme punkt — mens utklingningspunktet etter hvert mål
lå 1,4 minutt SENERE og ble kastet 40 % ut til høyre. Kurven gikk
`10 → 147 → 10 → 147 → …`. **Prototypens demodata var håndlaget og spredt
over 40 minutter, så feilen KUNNE ikke oppstå der.** En reporter rapporterer
i serier; flere øyeblikk i samme minutt er normalen, ikke unntaket.

**ÅRSAK 2 — FORMEN VAR EN KUMULATIV VANDRING, IKKE UTSLAG.**
Denne var verre, fordi den ville sett «riktig» ut i alle testene mine.
Energien ble akkumulert fra punkt til punkt, så kurven RAMPET mellom to
øyeblikk i stedet for å svaie rundt dem. Med ett mål — det vanligste i en
ungdomskamp — ble hele pulsen én doven skråning. **Det er dette Brage så i
HTML-en og ikke likte;** jeg oversatte det trofast i stedet for å se på det.
Og den kunne stige på et tap: 0–3 endte høyere enn den startet, fordi
utklingningen hadde sitt eget gulv.

**NÅ: EN ROLIG GRUNNLINJE MED ETT LOKALT UTSLAG PER ØYEBLIKK.**
Kurven samples over bredden (110 punkter), og hvert øyeblikk legger en kort
svai rundt sitt eget punkt — rask oppgang, langsommere utklingning. Tre ting
gjelder nå av seg selv, ikke fordi noen husket dem:
- **x er strengt økende.** Kurven KAN ikke folde seg over seg selv. x er
  øyeblikkenes REKKEFØLGE med et drag (35 %) av klokka: rekkefølgen
  garanterer spredning, minuttene skyver punktene mot der de hørte hjemme.
  Klokkeleddet holdes ikke-synkende med et løpende maks, så invarianten er
  en egenskap ved funksjonen — ikke en antakelse om at kalleren sorterte.
- **Ett mål gir ett tydelig utslag; tolv gir tolv.** Formen skalerer.
- **Grunnlinja ligger midt i rommet (38 av 100), ikke nær bunnen.** Første
  forsøk la den på 24, og da hadde et søkk bare 24 å falle på: 0–3 ble en
  flat strek, altså det samme som en kamp der ingenting hadde skjedd.
  Utslagene er ASYMMETRISKE med vilje (+50 for oss, −30 imot): Heia feirer
  OSS, men søkket må være ekte.

**⚠️ ARBEIDSMÅTEN SOM FANT DETTE, OG SOM SKAL BRUKES IGJEN:**
**jeg bygget et riggverk og SÅ på kurven før jeg leverte.** En midlertidig
jest-test skriver en HTML-side med den ekte `pulseShape`-utskriften mot
kampverdenens farger; headless Chrome tar skjermbilde
(`--force-device-scale-factor=2`); jeg leser PNG-en. Tretten scenarier ble
kjørt gjennom: Brages egen kamp, en realistisk 88-minutters, avspark uten
hendelser, 0–3, ett mål, 30 øyeblikk, bare oppdateringer, bare bilder, tre
mål på fire minutter, 12–0, og to med HEIA. **Fire feil ble funnet og rettet
UTEN å gå via telefonen:**
1. søkkene forsvant i gulvet (0–3 så ut som ingenting)
2. HEIA-gløden var en flat skive på 30 % — den leste som et klistremerke
   limt oppå kurven. Nå en radialgradient (som regnes mot elementets egen
   bounding box, så én def gjelder alle radier)
3. tre mål på fire minutter smeltet til ÉN bred platå — svaiene var for
   brede i forhold til avstanden mellom dem
4. grunnlinja var en helt rett strek, som leste som en skillelinje

**Siste steg lukket sløyfa:** riggen ble kjørt på **komponentens egen
utskrift** (montert i jest, `onLayout` fyrt, `Path`/`Circle`-propene hentet
ut og tegnet), ikke bare på den rene modulen. Da er det bevist at det jeg så
på er det RN faktisk får.

**Riggen er IKKE sjekket inn** (den var fire midlertidige `zz_*.test.ts`),
men oppskriften står her, og den er verdt å gjenta for alt som TEGNER noe:
kritt, swell, grunn, nodene. **Å levere en flate jeg aldri har sett er å
bruke telefonrunden som første kontroll — og det er Brages tid, ikke min.**

**⚠️ EN TING BRAGE MÅ SI JA ELLER NEI TIL:** grunnlinja har en svak,
fast bølge (±6 av 100, ca. ±2 pt) når ingenting har skjedd. Uten den er en
0–0-kamp en helt rett strek som leser som en DIVIDER, ikke som en puls. Den
har ingen tall og ingen markører — samme kategori som stadionlyset i
grunnen. **Men den er ikke data, og hvis den føles som juks, fjernes den ved
å sette `ambient()` til 0.**

<details><summary>📱 TELEFONSJEKKLISTA FOR SKIVE 5</summary>

Åpne en LIVE kamp med minst ett mål for oss, ett mål imot og en oppdatering:

1. **Leser pulsen som atmosfære eller som en graf?** Ser du deg selv lete
   etter tall og akser — da er den feil, uansett hvor pen den er.
2. **Er det tre rom nedover?** Arena (lysest) → puls → forløp (mørkest), uten
   en eneste synlig kant mellom dem.
3. **Kjenner du igjen kampen i formen?** Toppen skal ligge der DU husker at
   målet kom.
4. **`NÅ 40′` til høyre** — står det samme minutt som i arenaen og i
   retningsmarkøren, i samme øyeblikk? (Det var prototypens ene ekte bug.)
5. **Vent 60–90 sekunder uten at noe skjer.** Kurven skal stå BOM STILLE
   mens minuttet teller. Rykker den, er memoiseringen brutt.
6. **Heia på et mål** — vokser gløden rundt punktet, mens kurven står stille?
7. **Sett kampen i PAUSE:** står det «PAUSE», og ikke et minutt?
8. **Rapporter et nytt mål:** kommer toppen, og henger nå-prikken med ut?
9. **Ferdig kamp:** står det «SLUTT», og er nå-prikken borte?
10. **Reduce Motion på** (Innstillinger → Tilgjengelighet → Bevegelse):
    prikken skal slutte å puste, men fortsatt lyse.
11. **Stor tekst (XXL):** holder seksjonen seg rundt 90 pt, eller sprenger
    label-raden?
12. **VoiceOver:** sveip fra arenaen — pulsen er ÉTT stopp («Kampens puls.
    40 minutter spilt.»), og kurven finnes ikke for skjermleseren.
13. **En kamp der ingenting har skjedd ennå** (rett etter avspark): rolig
    linje, ikke et hull eller en rar strek. **Si fra om den svake bølgen i
    grunnlinja føles riktig eller som juks — se 5.1.**
14. **En turneringskamp** og **et lag med lys farge** — samme verden?

**⚠️ DE FIRE FRA 5.1 — DE MÅ MED I DENNE RUNDEN:**
15. **Rapporter 4–5 hendelser rett etter hverandre** (som du gjorde sist):
    ligger markørene spredt over hele bredden, eller klumper de seg?
16. **Tre mål tett i tid:** ser du TRE topper, eller én bred platå?
17. **En kamp du LIGGER UNDER i:** synker kurven, eller ser den ut som en
    kamp der ingenting har skjedd?
18. **Heia mye på ett mål:** blir gløden rundt punktet et LYS, eller en
    flat skive limt oppå?

</details>

---

### ▶️▶️ NESTE SAMTALE: SKIVE 2 — GRUNNEN OG ARENAEN

**Skiverekkefølgen er godkjent av Brage.** Skive 1 er levert. Neste er
skive 2. Ikke åpne designretningen på nytt med mindre React Native avdekker
en REELL begrensning.

| # | Skive | Status |
|---|---|---|
| 1 | **Hendelsesgriddet** | ✅ LEVERT OG TELEFONGODKJENT `93e75ca` + 1.1 |
| 2 | **Grunnen og arenaen** (live) + uttrekk av kampen til egen komponent | ✅ LEVERT OG TELEFONGODKJENT `23df9ed` (+2.1 +2.2) |
| 3 | **Kamprapporten på samme grunn** | ✅ LEVERT OG TELEFONGODKJENT `1b0390d` + 3.1 `95c092f` |
| 4 | **Kanonisk kobling + HEIA/kommentarer** (`00071_kampfeed.sql`) | ✅ LEVERT OG TELEFONGODKJENT + 4.1–4.4. Migrasjon I PROD |
| 5 | **Kampens puls** (`MatchPulse`) | ✅ LEVERT OG TELEFONGODKJENT — 4 runder. Modellen: `docs/KAMPENS-PULS-MODELL.md` |
| 6 | **Sticky-bar + Reduce Motion** | ⏳ RUNDE 2 — bevegelsen godkjent, resten venter |
| 7 | **Kampuret** (serverautoritativt) | ⏳ BYGGET — `00073` IKKE PUSHET ⚠️ |
| 8 | **Angre mål** (10 s) | se P3 |
| 9 | **`get_team_feed`-gaten for mål imot** | ⏳ BYGGET — `00072` IKKE PUSHET |
| 10 | **Kampknappen** | se P4 — krever at inngangene finnes først |

#### ▶️ SKIVE 5 — KAMPENS PULS: HVA SOM ALLEREDE ER AVKLART

**Plassen finnes fysisk allerede.** Telefonkontrollen i skive 2 spurte
uttrykkelig om «arena → (tom plass der pulsen skal inn i skive 5) → forløp»
var for brå overgang — Brage sa den sto til. Pulsen fyller det rommet.

**Fra den frosne retningen (ikke relitigér):**
- Egen kompakt seksjon (~90 px) UNDER stillingen, sted/reporter og
  avatarene. **Åpent på grunnen, ingen container.**
- «KAMPENS PULS» til venstre, **`NÅ 40′` til høyre — aldri et nakent minutt.**
- **Formen kommer av ØYEBLIKKENE, ikke av en energimodell:** mål for oss =
  minttopp, mål imot = søkk, bilde = lys mint, oppdatering = gull.
- **HEIA endrer GLØDERADIEN, aldri kurvens høyde** — derfor kan den ikke bli
  en påstand om hvem som presser.
- **Ingen akser, tall, prosenter eller analyseestetikk.**
- Det tredje rommet har sin egen tone klar og UBRUKT: `matchColors.pulse`
  (#1A4433, L*~23). Kontrastvakten i `matchContrast.test.ts` har allerede
  gullverdier for den.

**⚠️ MEMOISERINGSNØKKELEN ER LÅST (se `PulseCurve` i P-bolken):**
IKKE `matchEvents.length` alene — det gir stale kurver ved redigering,
sletting, angre eller endret hendelsesdata uten endret antall. Nøkkelen må
dekke **event-ID, type, sekvens/minutt, slettestatus og relevant HEIA-sum**.
**Minutt-tickeren skal ALDRI tegne kurven på nytt.** (Samme regel som
`MatchTimeline`s flettememo: et tick-tall i deps ville regnet hele
stillings- og bildeflettingen på nytt hvert 30. sekund.)

**HEIA-summen finnes nå.** Skive 4 ga `useMatchEngagement` →
`buildMatchEngagement`, som allerede har tellerne per øyeblikk. Pulsen skal
lese DERFRA, ikke hente på nytt — og HEIA-summen er en del av
memoiseringsnøkkelen.

**⚠️ IKKE FORVEKSLE MED `MatchPulseCard`.** Den finnes i `src/components/`,
heter nesten det samme og brukes av **InboxScreen** («lagets puls» i
varslene). Den har ingenting med kampens pulskurve å gjøre og skal ikke
røres.

**Alt som viser kampminuttet arver SAMME beregnede tid i samme tick** —
hodet, pulsen, retningsmarkøren og sticky-baren. Det var prototypens ene
ekte bug (hodet 40′, pulsen 37′). `MatchTimeline` tar allerede `nowMinute`
som PROP og kaller aldri `Date.now()`; pulsen skal gjøre det samme.

**A11y:** pulskurven er atmosfære, ikke innhold —
`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`,
som krittlinja, nodene, swellen og skrimene. Seksjonens OVERSKRIFT og
minuttet skal derimot leses.

**Bevegelse:** `useReducedMotion` er koblet på SEIER-pillen (skive 3) og
kommentararket (4.2). Skive 6 kobler den på `useGoalMoment`, `LiveBadge` og
pulsen — men **legger du inn en NY animasjon i pulsen nå, skal den ha den
med én gang.** Å bygge regresjonen med vilje er ikke et alternativ.

**Ryddejobb som ligger og venter (egen liten sak, ikke skive 5):**
`ScoreBoard.tsx` har ingen kallesteder igjen i det hele tatt — kun
`components/index.ts` eksporterer den. Kan trolig slettes.


#### ⏳ SKIVE 5 RUNDE 3 — MODELLEN BYGGET 2026-08-21

**Runde 2 var teknisk grønn og ble avvist likevel.** Det er den viktigste
lærdommen i hele skiva: en flate kan bestå alle testene sine og fortsatt
være feil produkt. Brage bestilte en modell i stedet for en kurve, og den
er nå kontrakten i `docs/KAMPENS-PULS-MODELL.md`.

**Hva pulsen er nå:** ekte tidsakse (en hendelse i 10′ ligger en firedel inn
i en 40-minutters kamp), midtlinje der OPP = oss og NED = motstanderen,
markører med appens egne ikoner, HEIA som halo og kommentarer som boble —
aldri egne punkter i tid — og to avledede faser, `MEST LIV` og `ROLIG`.

**Nye/endrede filer:** `src/shared/matchPulse.ts` (modellen som ren
regning), `src/components/match/MatchPulse.tsx` (flaten),
`matchCopy.ts` (+5 tekstfunksjoner), `MatchTimeline.tsx` (`onRowLayout`),
`LiveMatch`/`FinishedMatch` (`ScrollView`-ref + «Vis i historien»),
`__tests__/matchPulse.test.ts` (44), `matchPulseSection.test.tsx` (17),
`__tests__/pulseModel.harness.test.ts` (designriggen, hoppes over).

**Fem ting som er verdt å kjenne før noen rører dette:**

1. ⚠️ **TO NIVÅER AV KOLLISJON, OG DE ER IKKE DET SAMME.** Visuell
   sammenslåing skjer på 12 pt. Trykkflater kan ikke: en 44 pt Pressable
   overlapper naboen sin for lengst da. Trykkgruppene legges ut sekvensielt,
   og alt som ikke får sin egen flate havner i den forrige — panelet blar
   mellom øyeblikkene. **Din 10–4 i minutt 0 gir ÉN trykkflate, ikke
   fjorten**, og det er voktet.
2. ⚠️ **TIDSAKSEN ER KVANTISERT TIL FEM MINUTTER**, og det er den ENESTE
   grunnen til at «ekte tid» og «tickeren regenererer ikke kurven» kan være
   sanne samtidig. `span` er i memo-nøkkelen; `nowMinute` er det aldri.
   Reposisjoneringen får en 220 ms opacity-overgang, Reduce Motion bytter
   direkte.
3. ⚠️ **PULSEN ER ÉN JUSTERBAR TILGJENGELIGHETSENHET.** Markørene skal
   ALDRI bli et dusin VoiceOver-stopp rett før den samme tidslinjen. Rolle
   `adjustable`, sveip opp/ned blar, `accessibilityValue` leser det valgte,
   aktivering viser det i historien. Voktet: null `button`-roller inne i
   pulsen.
4. ⚠️ **MARKØRENE ER VIEWS, IKKE SVG-ELEMENTER.** Lucide-ikoner rendrer sin
   egen `<Svg>`, og svg-i-svg er ikke pålitelig i RN. Kurve, midtlinje,
   halo og rytmestreker er svg; markørene ligger oppå.
5. ⚠️ **`MatchTimeline` MÅLER RADENE SINE** (`onRowLayout`) i stedet for at
   noen regner ut høyden. Samme regel som 3.1: en målrad med bilde er tre
   ganger så høy som en uten.

**Designriggen fant ni feil i modellen før telefonen fikk se den** — se
`### ⏳ SKIVE 5.1` for oppskriften. Den er nå sjekket inn og bruker den
EKTE modulen, så neste runde kan starte med å se på flaten:

```
PULSE_OUT=/tmp/p.html npx jest __tests__/pulseModel.harness.test.ts
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --screenshot=/tmp/p.png --window-size=393,1560 file:///tmp/p.html
```

<details><summary>📱 TELEFONSJEKKLISTA FOR RUNDE 3</summary>

1. **Forstår du kampen på tre sekunder?** Når skjedde det mye, når var det
   stille, hvem scoret — uten å lese et eneste tall.
2. **Ligger hendelsene der de faktisk skjedde?** Et mål i 10′ av en
   40-minutters kamp skal ligge en firedel inn.
3. **Er en stille periode faktisk lang?** Eller føles den komprimert?
4. **Rapporter 4–5 hendelser rett etter hverandre:** samler de seg ved
   starten (som er sant), eller sprer de seg utover kampen (som er løgn)?
5. **Trykk på en markør.** Treffer du den du sikter på — også med tommelen
   i fart, også når to står tett?
6. **Valgpanelet:** står det «20′ · Mål — Jarle · 3–1» og heier/kommentarer
   under? Stemmer stillingen med den i kampforløpet?
7. **«Vis i historien»** — ruller den til RIKTIG rad, og lander den et sted
   du kan lese?
8. **Stepperen `‹ 3/11 ›`** når flere hendelser deler flate.
9. **En kamp du ligger under i:** synker kurven under midtlinja?
10. **Heia mye på ett mål:** blir gløden et LYS rundt markøren — og står
    kurven helt stille mens den vokser?
11. **MEST LIV / ROLIG:** kjenner du deg igjen? Og TIER de i en kamp med få
    hendelser?
12. **Vent 5–6 minutter i en live kamp:** reposisjonerer tidsaksen seg mildt,
    eller rykker den?
13. **Reduce Motion:** bytter den direkte, uten fade?
14. **LITEN IPHONE (SE/mini)** og **STOR TEKST (XXL)**: holder de to
    tekstlinjene i panelet, eller klippes de?
15. **VoiceOver:** er pulsen ÉTT stopp? Sier labelen hva kampen har vært?
    Blar sveip opp/ned mellom øyeblikkene? Leser den valgte hendelsen
    minutt, type, aktør, stilling, heier og kommentarer? Viser
    dobbelttrykk den i historien? **Og kommer du IKKE gjennom et dusin
    markørstopp før kampforløpet?**

</details>

#### ⏳ SKIVE 6 — STICKY-BAR + REDUCE MOTION (RUNDE 2) 2026-08-21

**Nye/endrede filer:** `src/components/match/MatchTopBar.tsx` (flaten +
`useMatchTopBar`), `BackBar.tsx` (`labelOpacity`/`labelsHidden`, rent
additivt), `LiveMatch`/`FinishedMatch`, `useGoalMoment.ts`, `LiveBadge.tsx`,
`__tests__/matchTopBar.test.tsx` (24).

**⚠️⚠️ RUNDE 1 BRUKTE `stickyHeaderIndices` OG BLE AVVIST PÅ TELEFONEN.**
Brage: «den forsvinner ikke smooth når man blar opp og den kommer for sent
når man blar ned.» **Dette er den viktigste permanente lærdommen i skiva, og
den gjelder alt som skal ligge fast i toppen:**

> **`stickyHeaderIndices` fester barnet til en posisjon i INNHOLDET, ikke i
> skjermen.** `ScrollViewStickyHeader.js` regner
> `translateY = max(0, scrollY − layoutY)`. Blar du tilbake forbi
> festepunktet blir translateY 0 i samme frame, og baren HOPPER ned til der
> den bor i innholdet — midt på skjermen — hvor fadet så spilles av. Den glir
> ikke bort; den teleporterer og løses opp. «For sent nedover» er samme sak
> speilvendt: ankeret lå under hele arenaen, så den kunne ikke feste seg før
> ~430 pt var rullet. Prototypens bar slår til på 190 fordi den er forankret
> i SKJERMKANTEN (`position: absolute; top: 0`).

**Ingen terskel- eller varighetsjustering kunne rettet det.** Kalenderbolkens
«ingen egen sticky-løsning» gjelder fortsatt en NAVIGATOR INNE I
scroll-flaten — den er ikke et forbud mot toppchrome utenfor den.

**LØSNINGEN (Brages valg): HEADEREN BLIR BAREN.** Navlinja og stillingen er
SAMME rad. Chevronen står stille hele veien — samme knapp før og etter, så
det finnes aldri et øyeblikk uten tilbakevei og aldri to tilbakeknapper i
treet. «Tilbake · Kampen» toner ut, «● Stange G10 6–2 Kåffa · SLUTT» toner
inn. **Krysstoningen drives av scroll-POSISJONEN på native driver**, ikke av
en boolsk bryter med en `Animated.timing` etterpå: da finnes det ingen
forsinkelse å ta igjen, og veien ut er veien inn baklengs. Den boolske
`shown` finnes fortsatt, men styrer BARE tilgjengelighet.

**Seks ting som er verdt å kjenne før noen rører dette:**

1. ⚠️⚠️ **DE TO LAGENE TONER I HVER SITT BÅND — DE KRYSSTONER IKKE.**
   Runde 3s feil (Brage: «den fader over det som allerede er der. jeg vil at
   den skal gå over det som står fra før av, slik som html også gjør»):
   «Tilbake · Kampen» og stillingen lå i SAMME bånd, så midtveis sto begge på
   50 % oppå hverandre og var uleselige. **Å gjøre platen mer ugjennomsiktig
   ville ikke hjulpet** — en plate som selv toner inn er halvt gjennomsiktig
   på halvveien, uansett hvor solid den er til slutt. Grunnen til at HTML-en
   ikke har problemet er STRUKTURELL: der har navlinja allerede rullet vekk,
   så det finnes ingenting bak baren. Vi løser det samme med TID i stedet for
   plass: det gamle er helt borte (0–45 % av båndet) før det nye begynner
   (50–100 %). Voktet av en test som leser de faktiske inndataområdene.
2. ⚠️ **REKKEFØLGEN I JSX ER FUNKSJONELL.** Runde 2s ene feil: platen sto
   ETTER `BackBar` og malte — ugjennomsiktig — rett over chevronen i det
   baren tonet inn. Tilbakeknappen forsvant nøyaktig når baren kom. (Brage:
   «Burde det være en tilbakeknapp på den headeren som dukker opp?» — den VAR
   der, den lå begravd.) Rekkefølgen er **plate → brikke → BackBar →
   stillingen**, og den er voktet av en test.
3. ⚠️ **`Animated.event` MED NATIVE DRIVER ER ET OBJEKT, IKKE EN FUNKSJON.**
   Det er dét som lar `Animated.ScrollView` hekte hendelsen på native side —
   og det betyr at en ny identitet river koblingen ned og opp igjen.
   Handleren er derfor STABIL (`[scrollY]`), og båndet leses fra en ref.
   Lå `band` i deps, ville koblingen blitt revet hver gang arenaen ble målt.
   (JS-lytteren ligger bak `__getHandler()` — det er slik testene når den.)
4. ⚠️ **BÅNDET MÅLES, DET GJETTES IKKE.** Arenaen er ikke like høy i en live
   kamp som i en rapport, og den vokser med stor tekst og lange lagnavn. Et
   fast tall (prototypens 190) ville truffet feil sted på halvparten av
   kampene. Samme regel som 3.1: MÅL raden, ikke regn den ut.
5. ⚠️ **BAREN BLOKKERER IKKE TRYKK, OG SKAL IKKE.** `ScrollView`-en begynner
   under raden, så det ruller aldri innhold under den. Begge lagene er
   `pointerEvents="none"` med vilje — ellers ville de drept chevronen som
   ligger under dem. (Runde 1 måtte tvert imot sende `pointerEvents` gjennom
   slot-stilen for å hindre at en usynlig bar spiste trykk på reporterraden;
   det problemet finnes ikke lenger.)
6. ⚠️ **`useReducedMotion` SVARER GJENNOM ET LØFTE.** Første frame kjenner
   ikke innstillingen, så en sløyfe REKKER å starte før svaret kommer. Det
   som betyr noe er derfor ikke «ble det startet noe», men «står det noe
   igjen og kjører» — og det er dét testene måler. Samme grunn til at
   `useGoalMoment` nå SPEILER innstillingen i en ref i stedet for å ha den i
   deps: en ny kjøring av effekten måtte stoppet feiringen midt i fadet, og
   floden ville blitt stående på en halv opacity for alltid.

**Én ekte bug funnet underveis, uavhengig av skiva:** `useGoalMoment` lot
både spretten og målfloden overleve komponenten. Fjæren kjørte videre etter
at kampskjermen var forlatt og forsøkte å koble seg til en `View` som ikke
fantes lenger. Begge stoppes nå i opprydningen.

**Reduce Motion, hva som faktisk skjer:** spretten på scoren uteblir,
LiveBadge-prikken slutter å puste (merket blir stående i coral og sier
fortsatt LIVE), toppflaten bytter HARDT uten krysstoning — en toning som
følger fingeren er fortsatt bevegelse utløst av scroll, og prototypen gjør
det samme. **Og målfloden BLIR.** Det er den frosne retningen ordrett:
bevegelsen fjernes, lysresponsen ikke.

**IKKE BYGGET, MED VILJE:** prototypens pustende `g-pulse-a/b`, bølgen og
auroraen i `MatchGround`. Det er NY bevegelse, ikke Reduce Motion-kobling.

⚠️ **DESIGNRIGGEN BLE IKKE BYGGET OM FOR RUNDE 2.** Runde 1s rigg
(`stickyBar.harness.test.tsx`) tegnet den samme innholdsraden i åtte scener
og er slettet med komponenten. Raden er uendret bortsett fra ÉN ting, og den
er verdt et blikk på telefonen: **stillingen begynner nå 40 pt inn** i stedet
for 20, fordi chevronen har sin egen bane. Det er 20 pt mindre bredde i det
trangeste tilfellet (liten iPhone + XXL + langt lagnavn) — se punkt 9 under.

<details><summary>📱 TELEFONSJEKKLISTA FOR SKIVE 6</summary>

**✅ Bevegelsen er allerede godkjent muntlig av Brage etter runde 2: «Nå
funker det veldig bra!»** Resten står igjen.

1. **Tilbakeknappen er synlig HELE veien** — også når baren er framme, og
   også midt i overgangen. (Det var runde 2s feil.)
1b. **Ingen dobbel tekst midtveis.** Rull SAKTE gjennom overgangen og stopp
   midt i den: «Tilbake · Kampen» skal være borte før stillingen kommer, og
   de to skal aldri stå oppå hverandre. (Det var runde 3s feil.) Kjennes
   glippen der headeren er tom bortsett fra pila som et bytte — eller som et
   hull?
2. **Brikken bak chevronen:** leser pilen som en knapp når ordet «Tilbake»
   er borte, eller ser den ut som dekor?
3. **Ingen layout-hopp.** Toppen skal stå der den alltid har stått i ro.
4. **Ingen flimring ved terskelen.** Rull sakte til baren akkurat kommer og
   stopp der; fling hardt ned og la den sprette tilbake.
5. **Live, pause og slutt viser samme tekst som hodet og pulsen**, i samme
   øyeblikk.
6. **Ferdig kamp:** står det «SLUTT» og riktig sluttresultat?
7. **Rapporter et mål mens baren er framme:** oppdaterer stillingen i baren
   seg samtidig som arenaen?
8. **Reduce Motion på:** baren bytter direkte uten å tone; LIVE-prikken
   slutter å puste, men merket er der; et mål gir ingen sprett på tallet —
   **men verdenen skal fortsatt lyse opp.** Er det riktig?
9. ⚠️ **LITEN IPHONE (SE/mini) + XXL + et LANGT lagnavn samtidig.** Dette er
   det eneste punktet riggen ikke har sett i den nye utformingen. Klippes
   noe? Navnene kortes ned til «Ham…» og «Rida…» — er det godt nok, eller
   skal baren droppe motstanderens navn helt når det blir så trangt?
10. **VoiceOver:** baren er ÉTT stopp når den er framme («Ham-Kam G14 2,
    Ridabu G14 1. 36 minutter spilt.»), og finnes IKKE når den er borte.
    «Kampen» skal være borte for skjermleseren når den er tonet ut. **Og
    baren skal aldri lese seg selv opp av seg selv når minuttet tikker.**

</details>

#### ⏳ SKIVE 7 BYGGET — KAMPURET 2026-08-21 (MIGRASJONEN IKKE PUSHET)

🛑🛑 **IKKE KJØR APPEN FRA DENNE GRENEN MOT PROD FØR `00073` ER PUSHET.**
Dette er strengere enn jeg først antok, og det er verdt å forstå hvorfor:

> `get_event_with_rsvp` returnerer **jsonb**, så kampskjermen tåler at
> nøklene mangler — der er reserven i `matchClock.ts` nok. Men banneret og
> innboksen går via **PostgREST med en eksplisitt kolonneliste**
> (`SESSION_COLUMNS`), og en kolonne som ikke finnes gir en HARD FEIL på
> spørringen. Live-banneret og innboksens live-stripe blir altså BORTE, ikke
> unøyaktige, mot en prod uten 00073.

Det bryter ikke deployrekkefølgen P2 allerede krever (server først) — men det
gjør den obligatorisk i stedet for anbefalt.

**Nye/endrede filer:** `supabase/migrations/00073_kampuret.sql`,
`src/shared/matchClock.ts` (NY — den ene utregningen),
`lib/api/events.ts` (`SESSION_COLUMNS` + mapping), `types.ts`,
`EventDetailScreen`, `LiveMatchBanner`, `InboxScreen`,
`__tests__/matchClock.test.ts` (11).

**MODELLEN:** `played_seconds` (akkumulert spilt tid fram til forrige stopp)
+ `clock_started_at` (når uret sist startet; NULL = det står). Spilt tid nå =
summen. To tall, ingen historikk å tolke.

**⚠️ HVORFOR IKKE SUMMERE PAUSENE FRA `match_events`:** det ville gjort
klokka avhengig av at forløpet er komplett og riktig sortert — og **skive 8
(angre) kommer til å fjerne hendelser fra nettopp det forløpet.**

**Fem ting som er verdt å kjenne:**

1. ⚠️ **`started_at` SKRIVES ALDRI OM.** Den er historikk («når begynte
   kampen»), ikke klokke. Etter første pause er `started_at` og
   `clock_started_at` FORSKJELLIGE tall, og det er hele poenget.
2. ⚠️ **REKKEFØLGEN I `report_match_event` BETYR NÅ NOE.** `v_minute` regnes
   FØR overgangene. Ellers ville pausehendelsen fått minuttet den fryser på,
   og «andre_omgang» fått minuttet fra et ur som nettopp ble nullstilt.
   Rekkefølgen er den samme som 00021 alltid har hatt — men den var tilfeldig
   riktig før, og er nødvendig nå.
3. ⚠️ **EN `DO`-BLOKK MED `pg_get_functiondef` BLE PRØVD OG FORKASTET.**
   `get_event_with_rsvp` er gjengitt ORDRETT (00020:245-393) med nøyaktig to
   nye nøkler. En run-time omskriving av en SECURITY DEFINER-funksjon kan
   ikke leses i en diff, og er ikke noe man skal måtte stole på i prod.
4. ⚠️ **BACKFILLEN ER BESKJEDEN MED VILJE.** Pausene som allerede har vært
   finnes ikke som varighet noe sted. Målet er kun: vis det SAMME som i dag i
   det øyeblikket migrasjonen kjører, og la den nye modellen gjelde derfra.
   En kamp i pause vil altså FRYSE der den står — det er den ønskede
   endringen, ikke et hopp.
5. ⚠️ **RESERVEN I `matchClock.ts` GJENSKAPER DAGENS FEIL, DEN RETTER DEN
   IKKE.** Mangler `playedSeconds`, teller klokka gjennom pausen som før —
   fordi et 0′ på en kamp som spilles er verre enn et for høyt tall. Den er
   dokumentert i en egen test, og **kan fjernes når 00073 har stått i prod en
   stund.**

<details><summary>📱 REKKEFØLGE OG TEST FOR SKIVE 7</summary>

**Steg 1 — SERVER (må gjøres først):** `supabase db push`, deretter
KONTROLL 1 og 2 nederst i `00073_kampuret.sql`.

**Steg 2 — DEN MANUELLE PAUSE/GJENOPPTA-RUNDEN MOT PROD.** P2 krever den, og
den er ikke en formalitet: det er det eneste stedet modellen møter ekte tid.
· start testkamp, vent ~2 min → teller
· PAUSE, vent ~2 min → **står bom stille**
· andre omgang, vent ~1 min → fortsetter fra der det sto
· rapporter et mål → `match_events.minute` skal være SPILT tid
· `SELECT minute FROM match_events ORDER BY sequence;` → ingen hopp

**Steg 3 — FØRST DA: appen.** På telefonen:
1. Kampskjermen, live-banneret og innboksens live-stripe viser **samme
   minutt i samme øyeblikk.** (Var tre uavhengige regnestykker.)
2. I pause: står minuttet stille alle tre stedene?
3. Pulsen og sticky-baren arver samme tall som arenaen.
4. En kamp som ble spilt FØR migrasjonen: er minuttene i kampforløpet
   uendret? (De skal være det — historikk skrives ikke om.)

</details>

#### ⚠️ 00074 — TO AKSER, OG FELLA MELLOM DEM (2026-08-21)

**Brage, rett etter at 00073 var i prod:** «Når man legger til en hendelse så
vises de først helt til venstre på pulsskiva, deretter hopper den til høyre
hvor den skal ligge.»

**⚠️ DETTE ER DEN VIKTIGSTE LÆRDOMMEN FRA SKIVE 7, og den gjelder alt som
skal plassere noe i kampen:**

> **ETTER 00073 FINNES DET TO TIDSAKSER, OG DE ER IKKE LENGER DEN SAMME.**
> `minute` er FAKTISK SPILT TID — den hopper ikke over pausen.
> `created_at`/`started_at` er KLOKKETID — den gjør det.
> **Minuttet er en ETIKETT. Klokketid er en POSISJON.** Blander man dem,
> havner ting nøyaktig én pauselengde for langt til venstre.

**Hvordan feilen oppsto:** `stampOf` i `matchPulse.ts` har tre kilder til
hendelsens tidspunkt. Kilde 1 (`event.createdAt`) sto i typen, men ble
**aldri mappet** — `get_event_with_rsvp` returnerte den ikke. Kilde 2 (den
kanoniske feed-postens `created_at`) kommer via en EGEN RPC, et par hundre
millisekunder senere. I det vinduet gjaldt kilde 3:
`started_at + minute * 60_000` — en gjetning som var riktig helt til 00073
gjorde `minute` til spilt tid.

**Rettelsen er den kodekommentaren allerede forutså:** «Den dagen
`created_at` kommer ut av den RPC-en, blir pulsen bedre uten at en linje her
endres.» `match_events.created_at` har eksistert siden 00009:47 med
`DEFAULT now()` — den har bare aldri blitt lest ut. Nå gjør den det, og da:
· ingen vindu — tidspunktet kommer i SAMME svar som hendelsen
· ingen gjetning — kilde 3 blir uåpnet i praksis
· ingen blanding av akser

**Samme feil satt i NÅ-PRIKKEN, og den var ikke oppdaget ennå:**
`matchPulseTimeline` og `MatchPulse` regnet begge høyre kant som
`startedAt + minute * 60_000`. Etter en pause ville nå-prikken ligget til
VENSTRE for den ferskeste hendelsen. Begge tar nå `nowMs` — klokketid fra
skjermens tick, aldri `Date.now()` inne i komponenten (P2).

**Nye/endrede filer:** `00074_hendelsens_tidspunkt.sql`,
`lib/api/events.ts` (`mapMatchEventRow` → `createdAt`), `matchPulse.ts`
(`nowMinute` → `nowMs`), `MatchPulse.tsx` (+`nowMs`), `LiveMatch.tsx`,
`EventDetailScreen.tsx`, `__tests__/matchPulse.test.ts` (+3 regresjonsvakter
med en fixtur som HAR pause — uten pause i fixturen er de to aksene like og
feilen usynlig).

⚠️ **`FinishedMatch` sender ikke `nowMs`, og skal ikke:** en ferdig kamp har
`slutt` som høyre kant, ikke «nå».

#### ⏳ SKIVE 9 BYGGET — P1 I FEEDEN 2026-08-21 (MIGRASJONEN IKKE PUSHET)

⚠️ **DETTE VAR EN LEVENDE FEIL I PROD, ikke bare «neste skive».** P1 er låst
og gjelder BEGGE flatene fordi det er den SAMME kanoniske posten: fram til
denne skiva kunne man **heie på et baklengsmål fra Hjem-skjermen**, og heiet
dukket så opp inne i kampskjermen — på et øyeblikk der knappen bevisst ikke
finnes siden skive 4.

**Årsaken var lesestien, ikke skrivestien:** `get_team_feed` returnerte bare
`match_minute/status/home/away` (00070), så et baklengsmål og en beskjed fra
treneren så identiske ut for klienten.

**Nye/endrede filer:** `supabase/migrations/00072_feedgaten_maal_imot.sql`,
`matchEngagement.ts` (+`isOpponentGoal`), `types.ts` (`FeedItem.matchEvent`),
`lib/api/feed.ts`, `FeedCard.tsx`, `__tests__/feedHeiaGate.test.tsx` (14).

⛔ **`00072` ER IKKE PUSHET TIL PROD.** Den venter på deg:
`supabase db push`, deretter de tre KONTROLL-stegene som står nederst i
migrasjonsfila (grants uten `anon`, et vanlig medlem ser feeden sin,
og at et ekte baklengsmål kommer ut som `('mål','away')`).

**Fire ting som er verdt å kjenne:**

1. ⚠️ **INGEN SKJEMAENDRING.** `LEFT JOIN match_events` har stått i
   funksjonen siden 00029 (den brukes til `me.minute`); vi leser `me.type`
   og `me.team_side` fra samme rad. Ingen ny join, ingen indeks.
2. ⚠️ **DROP+CREATE ⇒ 00061-FELLA.** Ny kolonne i `RETURNS TABLE` kan ikke
   gjøres med `CREATE OR REPLACE`, og da forsvinner grantene med funksjonen.
   De gjenskapes i fila. Uten dem er feeden borte for alle i samme sekund.
3. ⚠️ **GATEN ER SMAL MED VILJE, OG DET ER DEN FARLIGSTE DETALJEN HER.**
   Feedens gate er IKKE kampens. Kampen viser engasjement kun på mål og
   meldinger; feeden har HEIA på avspark, bilder, resultater og vanlige
   innlegg — og skal beholde det. Derfor `isOpponentGoal` (delt spørsmål) og
   ikke `allowsHeia` (kampens strengere politikk). Bruker noen `allowsHeia`
   her ved et uhell, **forsvinner HEIA fra halve feeden**, og en enkelttest
   på et mål ville ikke fanget det. Voktet med en `it.each` over
   rytmemarkørene.
4. ⚠️ **KLIENTEN GATER, IKKE SKRIVERETTIGHETENE.** En spesiallaget klient kan
   fortsatt skrive reaksjonen. Det er samme nivå som kampskjermen har i dag,
   og å legge policy/trigger på `reactions` i en migrasjon som ellers bare
   leser ville vært feil sted. **➡️ Hører hjemme i SKIVE 8**, som uansett
   åpner RLS-policyene og stenger «Slett innlegget» for målposter — da
   gjøres skrivesidens gate ETT sted, med prod-verifisering.

**Appen tåler at migrasjonen ikke er der ennå:** mangler `match_event_type`,
blir `matchEvent` `undefined`, og feeden oppfører seg nøyaktig som før. Det
betyr også at **feilen består til du pusher.**

<details><summary>📱 TELEFONSJEKKLISTA FOR SKIVE 9 (etter push)</summary>

1. **Et baklengsmål i feeden:** HEIA-pillen skal være BORTE, ikke avslått.
   Kommentarpillen står igjen alene.
2. **Vårt eget mål i feeden:** HEIA er der som før.
3. **«Kampen er i gang», bilder, resultater og vanlige innlegg:** HEIA er der
   som før. (Dette er punktet som avslører om gaten ble for bred.)
4. **Et baklengsmål du HAR heiet på fra før:** pillen forsvinner, men det
   gamle heiet ligger fortsatt i basen — er det greit, eller skal de ryddes?
5. **Tom feed = grant-feil, ikke tom database.** Skjer det, se KONTROLL i
   migrasjonsfila.

</details>

#### ▶️ SKIVE 4 — HVA SOM VAR AVKLART FØR BYGGING (historikk)

➡️ **Skiva er BYGGET — se `### ⏳ SKIVE 4 BYGGET` over for hva som faktisk
ble laget, og for telefonsjekklista.** Bolken her står som den var, fordi den
er kartleggingen som ble brukt.

**Migrasjonen er GODKJENT og spesifisert: `00071_kampfeed.sql` med
`get_match_feed(evt_id)`, UTEN skjemaendring.** Hele begrunnelsen — hvorfor
skrivestien allerede er robust, hvorfor det IKKE skal være indeks på
`match_event_id`, og hvorfor det IKKE skal være UNIQUE — står i `P1` over.
Les den før du skriver SQL.

Fra kampskjermens side er plassen alt reservert:
- **`MatchEventRow` har en `engagement`-slot**, og `MatchTimeline` tar
  `renderEngagement({event, photo})`. Raden skal ikke omskrives.
- **Sloten ligger UTENFOR den samlede a11y-labelen med vilje** — HEIA og
  kommentarer er handlinger med egne labels og egen state, ikke en del av
  setningen om hva som skjedde. Ikke «rydd» den inn i `accessible`-gruppa.
- **A11y-kravet gjelder skive 4s flater:** `accessibilityRole="button"`,
  en label som sier hva som skjer («Heia på målet på 34 minutter»),
  `accessibilityState={{selected}}`, og **44 pt** — HEIA/kommentar-radene er
  ikon + tall og optisk små, så de trenger `hitSlop`.
- **P1 er låst: ingen HEIA på mål imot.** Kommentarer er tillatt.
- **`get_team_feed`-gaten er skive 9, ikke denne.** Ikke samme migrasjon: en
  grant-feil skal ikke kunne ta ned feeden og kampen på én gang.

⚠️ **`ScoreBoard.tsx` er nå UBRUKT i kampsporet.** Kamprapporten bruker
`MatchArena`, live-kampen gjør det samme. Sjekk om den har andre kallesteder
før den eventuelt fjernes — det er en egen liten opprydding, ikke skive 4.

#### 📎 SKIVE 3 — KARTLEGGINGEN SOM BLE BRUKT (historikk)

Rapportgrenen ble lest gjennom rett før skive 2 ble lukket. Dette er hva
den består av i dag (`EventDetailScreen`, «VANLIG EVENT-MODUS + KAMPRAPPORT»),
så neste samtale slipper å finne det på nytt:

- `showReport` = ferdig kamp MED score og motstander. Grenen deles med
  trening, sosialt, kommende kamp, turnering og AVLYST kamp — **det er
  derfor rapporten ikke bare kan få `MatchGround` rundt hele returen.**
  Mønsteret fra skive 2 gjelder: en egen `FinishedMatch`-komponent ved siden
  av `LiveMatch`, og resten av grenen står urørt på krem.
- Rapporten i dag: `ScoreBoard` (uten minutt) + tittel + «hvor og når» på én
  linje + beskrivelse → `MatchPhotoRail` → `MatchTimeline` på den lokale
  `styles.timeline`-flaten → påmeldtliste.
- **Disse må enten flytte med eller bli igjen — det er en reell beslutning:**
  «Rediger»-knappen (admin, hvit `Button`), påmeldtlisten
  (`AttendanceSection`, hvite rader) og `MatchPhotoGallery`.
  RSVP-baren er allerede gatet bort på ferdig kamp.
- **Klart siden skive 2:** `MatchPhotoRail` har `variant="match"` ferdig
  bygget og ubrukt · `MatchTimeline` tar `ground` · `MatchGround` har
  `phase="finished"` · `MatchArena` må utvides med SLUTT/SEIER-pill i stedet
  for LIVE (i dag typet `paused: boolean`, live/halfTime only).
- **A11y-kravet gjelder rapportens flater** — `MatchPhotoRail` og
  `AttendanceSection` har ingen labels i dag.
- ⚠️ **Se etter mønsteret fra 2.1/2.2** i alt som flytter ned på grunnen:
  kode som maler en flat farge «tilbake», eller som antar en fast høyde.

**FØR KAMP ER UTE I DENNE RUNDEN.** Ingen nedtelling, ingen «13 av 18
kommer». Kommende kamp beholder dagens flate. Live og ferdig kamp først.

**⚠️ SKIVE 2 MÅ TA MED alt som ellers blir hvite flekker på grønt:**
`ReporterBar` · `ReporterActions` · «Du følger kampen direkte»-kortet ·
`MatchPhotoRail` · `BackBar` (hardkoder `colors.textPrimary` — trenger
VARIANT, ikke endret default; den deles med 17 skjermer) · `StatusBar`
(mønsteret finnes i `ProfileHeader.tsx`) · stackens
`contentStyle: colors.background`, som ellers blinker krem i kantene under
push · og den lokale mørke flaten fra skive 1 (`styles.timeline`), som skal
BORT når grunnen tar over.

**Arenaformen skal i en NY `ArenaSurface`** — `StadiumSurface` har 11
kallesteder og `ScoreChip` arver alt fra den.

---

---

### ♿ TILGJENGELIGHET — OBLIGATORISK AKSEPTANSEKRITERIUM (Brage 2026-08-20)

**Funnet:** appen har 66 `accessibilityLabel` og 62 `accessibilityRole` —
men kampsporet hadde NULL. Ikke én prop i `MatchEventRow`, `MatchTimeline`,
`EventNode`, `ScoreBoard`, `MatchPhotoRail` eller `ReporterActions`.

**En kamptidslinje VoiceOver ikke kan lese, er en kamp en blind forelder
ikke kan følge.** Dette er derfor ikke en «nice to have» — det er et
AKSEPTANSEKRITERIUM. En skive er ikke ferdig før dens flater oppfyller:

1. **SAMLET LABEL PER HENDELSE.** Én hendelse = ett stopp i VoiceOver, ikke
   fire (node, minutt, overskrift, tekst). Raden setter `accessible={true}`
   + `accessibilityLabel` som leser hele øyeblikket i rekkefølgen
   MINUTT → HVA → HVEM → DETALJ: «34 minutter. Mål for oss, 2–1. Erlend
   Hagen.» · «31 minutter. Jarle oppdaterer: Vi presser høyt nå.»
2. **DEKORATIVE SVG-ER SKJULES.** Krittlinja, målswellen, skiferstripen,
   skrimene og pulskurven er atmosfære, ikke innhold:
   `accessibilityElementsHidden` (iOS) + `importantForAccessibility="no-hide-descendants"`
   (Android). `EventNode` er allerede `pointerEvents="none"`, men det
   skjuler den ikke for skjermleser.
3. **HANDLINGER HAR LABEL OG STATE.** HEIA, kommentarer, bilde og
   reporterknappene trenger `accessibilityRole="button"`,
   en label som sier hva som skjer («Heia på målet på 34 minutter»), og
   `accessibilityState={{selected}}` der noe er på/av. En teller alene
   («34») er ikke en label.
4. **44 pt TRYKKFLATER.** Alt som kan trykkes måler minst 44×44 pt, om
   nødvendig via `hitSlop`. Kampsporet har i dag 0 `hitSlop`. Gjelder
   særlig HEIA/kommentar-radene, som er ikon + tall og optisk små.

**Hvor:** skive 2 og 3 tar flatene sine (arena, reporterbar, rapport),
skive 4 tar HEIA/kommentarer, skive 5 skjuler pulskurven.
**Griddet fra skive 1 tas i skive 2**, mens radene uansett røres.

✅ **OPPFYLT FOR SKIVE 3s FLATER:** SLUTT- og SEIER-pillene er egne stopp med
label · påmeldtstripa er ÉTT stopp («Påmeldt, 14. Erlend Hagen, …») med
ansiktene skjult · «Rediger» har rolle, label og 44 pt · bildestripas
overskrift er `header`, thumbene hadde rolle og label fra før.

✅ **OPPFYLT FOR SKIVE 4s FLATER:** HEIA og kommentar har rolle, label med
betydning fra `matchCopy`, `accessibilityState={{selected}}`, og **44 pt som
LAYOUT — ikke `hitSlop`** (naboknapper med raus hitSlop får overlappende
treffområder). Sloten ligger utenfor øyeblikkets samlede label, voktet som
test. Se `### ⏳ SKIVE 4 BYGGET`.

---

### 🧩 CLAUDE SKILLS — VURDERT 2026-08-20, INGENTING INSTALLERT

Kildebasert gjennomgang bestilt av Brage før skive 2. **Ingen skill er
installert, og ingen skal installeres uten at han sier fra.**

| Skill | Dom | Når |
|---|---|---|
| `apple-design` (emilkowalski/skills, MIT) | **Bruk senere, som review** | ETTER skive 5–6, aldri som styring av skive 2 |
| `react-native-best-practices` (callstackincubator, MIT) | **Bruk senere, som ytelses-review** | Når pulsen + mange rader finnes (skive 5) |
| `animate-expo` (samme repo) | **AVVIS** | — |
| `emil-design-eng`, `animate`, `review-animations` | **AVVIS** (web/CSS-spesifikke) | — |
| `awesome-skills/mobile-app-design` | **AVVIS** (ulisensiert, foreldet, generiske «2026-trender») | — |
| Web-a11y-skills (axe-core/jsx-a11y/WCAG) | **AVVIS** — forutsetter DOM/ARIA | — |

**⚠️ `animate-expo` er ikke bare dårlig tilpasset — den er direkte i strid.**
Dens HARDE REGEL er «Reanimated, not core `Animated`», og den krever
`react-native-worklets`, `react-native-gesture-handler`, `expo-router` og
`expo-haptics`, installert med `npx expo install`. Heia er bar RN 0.83 med
React Navigation, og har bevisst IKKE reanimated.

**⚠️ To ting `apple-design` ALDRI får styre i Heia:**
1. **§12 Materials & depth** anbefaler `backdrop-filter`-translusens som
   bærende hierarki. Det er Liquid Glass-retningen, RN kan det ikke uten en
   native blur-pakke, og kampskjermens hierarki kommer av TONE OG LYS i tre
   grønne rom. Frosset.
2. **§15 Typografi** sier «default to the platform's system font». Heia
   bundler Nunito med vilje.

Den har **ikke** `disable-model-invocation`, og beskrivelsen treffer
«reviewing gesture-driven UI / typography / reduced-motion» — altså ville
den kunne fyre av seg selv midt i skive 2. Installeres den, skal
`disable-model-invocation: true` legges til i frontmatteret lokalt.

**🔴 DET SKILLENE AVDEKKET, SOM INGEN SKILL TRENGS FOR Å FIKSE:**
Appen har 66 `accessibilityLabel` og 62 `accessibilityRole` — men
**kampsporet har NULL.** `MatchEventRow`, `MatchTimeline`, `EventNode`,
`ScoreBoard`, `MatchPhotoRail` og `ReporterActions` har ikke én eneste
a11y-prop eller `hitSlop`. En kamptidslinje VoiceOver ikke kan lese, er en
kamp en blind forelder ikke kan følge. **Husmønsteret finnes allerede 66
steder — dette er ikke et kunnskapshull, det er en jobb som ikke er gjort.**
Legg den inn i skive 2/3 mens flatene uansett røres.

---

### 📚 KAMPFLATENS HISTORIKK OG STÅENDE AVGRENSNINGER (bakgrunn, ikke en oppgave)

**Denne bolken var «neste samtale» frem til 2026-08-20.** Den samtalen er
holdt, retningen er valgt og skive 1 er levert — men LISTENE UNDER GJELDER
FORTSATT, og de er grunnen til at flere nærliggende ideer allerede er
avvist. Les dem før du foreslår noe på kampflaten.

**LES DISSE BOLKENE FØRST** (de er kampflatens historikk, og alt der er
allerede godkjent på telefon — ikke gjenoppfinn dem):
`## 🎨 P5 + P5B — KAMPFORLØPET + HENDELSESSIDEN` · `## ⚽ P2 —
MÅL-ØYEBLIKKET` · `## Fase 3C` + `## Fase 3D` (live kamp, pause⇄andre
omgang) · `### ✅ Skive 5 — KAMPRAPPORTEN` · `## ✅ Fase 7/8/9`
(kampbilder, feed→kamp, push→kamp) · B2-bolken om event-detalj-skiva
(query-cache, thumb-varianter, payload-først realtime).

**LÅST — SKAL IKKE FORESLÅS PÅ NYTT:**
· **Alle medlemmer kan legge bilder på kampen: AVVIST av Brage
  2026-07-30** («nei, alle skal ikke legge bilder»). Kampbilder er
  reporterens jobb. Backend-en tillater det, men det er en bevisst
  avgrensning — ikke et hull.
· **Ingen toppscorer eller spillerstatistikk** før en strukturert
  spillerstall finnes (låst 2026-07-30).
· Kampen bor alltid på MØRK flate (A v2). Mørk modus i appen ellers er
  bevisst «nei i v1» nettopp fordi mørk flate BETYR kamp.
· Trener tildeler reporter; +-knappen er et rollestyrt valgark.

**KJENTE KANDIDATER PÅ KAMPFLATEN (ingen er lovet, ingen er prioritert):**
1. **Kommentarer + heiing synlig i kamptidslinja** — «var der»-følelsen
   ligger i de andres stemmer. De FINNES i dag, men bor på feed-poster og
   er usynlige på kampsiden. Planens kandidat 2.
2. **Før kamp-innhold** — nesten gratis når 1 finnes: samme knapp, bare
   ikke låst til live-grenen.
3. **«Kampen på 30 sekunder»** — SIST, og med en ÅPEN
   PERSONVERNAVKLARING: en delbar oppsummering bryter med at bildene
   ligger i privat bucket nettopp fordi de er av barn. Norske klubber har
   samtykkeregler for billedbruk. Deling til foreldregruppa er noe helt
   annet enn en offentlig lenke.
4. **«Start kamp»-snarvei på +-knappen** — siste rest av låst beslutning 1.
5. **Designgjeld PÅ kampflaten:** `MatchPhotoSheet.tsx` har appens siste
   rå `ActivityIndicator` OG tegn-glyfene `⚽ ↔ 🟨` blant Lucide-ikonene.
   Ta dem samlet hvis skiva uansett rører fila.
6. **Ingen bevegelse i appen** (kun LiveBadge-puls). Størst effekt per
   innsats er MÅL-øyeblikket — scoren som teller opp, en feiring.
   Haptikk krever native modul → ved neste rebuild uansett.

**RESTEN AV KØEN** (ikke kampflaten, men det som ellers står igjen):
cache-persistering (velspesifisert, egnet for Fable) · fase B / web
(invitasjonslanding KREVER innlogging på web — `redeem_manager_invitation`
gater på `auth.uid()` + verifisert e-post; B4-stackvalget er ÅPENT og er
Brages) · «Legg ned laget» (§4) + ops-RPC-ene (§3f-5) — IKKE bygget,
verifisert i skjemaet 2026-08-20; lite hastende, se blindvei-notatet.
⚠️ **Blindvei 1 i det notatet er uoppnåelig i dag** — den forutsetter
spillerkontoer, og `spiller` kan ikke oppnås fra appen.

**KJENT OG AKSEPTERT:** `delete_account_data` nuller `display_name` og
`avatar_url`, men ikke `avatar_color` — funksjonen er 150 linjer og ble
ikke rørt for én linjes gevinst. Det lekker ingenting: spøkelsene har
allerede hver sin profil-id som appen ser, så fargen skiller ikke to
slettede brukere på noen måte id-en ikke allerede gjør. Tas hvis
funksjonen uansett skal endres.

---

### 📸 DEL ÉN: PROFILBILDE (telefongodkjent 2026-08-19)

**PROFILBILDE (avatar-opplasting) ER BYGGET 2026-08-19.** Migrasjonen er
PUSHET TIL PROD og `report-notify` er DEPLOYET. Appsiden er ren JS —
Metro-reload holder, ingen nye pakker, ingen native-endringer.

**TO PRODUKTBESLUTNINGER, LÅST AV BRAGE 2026-08-19 (ikke relitigér):**

1. **HVEM: alle med konto.** Grunnlaget er at det ikke finnes noen
   barne-rolle å skille ut. Alle rollene som faktisk brukes er designet
   for voksne — `forelder`, `supporter` (00045 sier det rett ut:
   «besteforeldre/tanter/venner … eneste forskjell er etiketten») og
   lagadmin. `spiller` godtas av `join_team_space` server-side, men
   appens innmeldingsskjerm tilbyr den ikke (Forelder/Supporter/Trener),
   og `set_member_role` nekter å gi den til noen — i praksis finnes det
   null spillerkontoer. **Moderasjonsvaktene ble bygget i SAMME skive**,
   som en del av beslutningen.
2. **BUCKET: privat** (feed-media-mønsteret), ikke klubblogo-mønsteret.

   ⚠️ **RAMMEN I DEN GAMLE 2b HOLDT IKKE, og det er verdt å huske:** 2b
   sa at hvem-valget «avgjør også bucket-spørsmålet». Det gjør det ikke.
   Norske foreldre bruker ofte et bilde av barnet sitt som profilbilde,
   så spørsmålet «kan et bilde av et barn havne her?» har svaret JA i
   hvert eneste alternativ som skiper opplasting. Bucket-valget måtte
   derfor avgjøres av dét, ikke av hvem. **Det som faktisk avgjorde det:**
   `delete_account_data` nuller `avatar_url` men sletter ALDRI fila
   (00042:99) — i en offentlig bucket ville bildet overlevd en
   GDPR-sletting på en åpen URL. I tillegg serverer en offentlig bucket
   bytene helt utenom RLS, og akkurat den klassen feil traff dette
   repoet én gang alt: 00060 måtte stramme club-logos fordi anon kunne
   LISTE hele bucketen.

**LEVERANSEN:**

- ✅ **Migrasjon `00068_profilbilde.sql` PUSHET TIL PROD.** Privat bucket
  `avatars` (2 MiB, kun bilde-mime — grensene satt i SQL, altså
  versjonert, i motsetning til feed-media/club-logos som ble satt via
  Storage-API-et i fase A) · `shares_team_with(uuid)` = leserettens
  kanoniske definisjon · storage-policyer (skriv kun i EGEN mappe; se
  eget + alt fra folk du deler lag med; slett eget ELLER som lagadmin) ·
  profiles-UPDATE-policyen strammet med en WITH CHECK som hindrer at du
  setter en ANNENS path på deg selv · `remove_member_avatar` ·
  `content_reports`/`report_content` utvidet med `'avatar'`.
- ✅ **Migrasjon `00069_avatar_path_cleanup.sql` PUSHET** — etterslep fra
  00068, funnet ved gjennomlesing etter push. Den nye WITH CHECK-en
  evaluerer HELE den nye raden, ikke bare kolonnene som endres: lå det en
  verdi i `avatar_url` som ikke pekte på eierens egen mappe, ville
  profilen blitt umulig å oppdatere i det hele tatt — brukeren hadde ikke
  fått endret telefonnummeret sitt engang, med «new row violates
  row-level security policy» som eneste forklaring. **Kjøringen ga 0
  rader**, altså var ingen faktisk rammet — men nå er det verifisert i
  stedet for antatt.
- ✅ **`report-notify` DEPLOYET** — «profilbilde» som entitetsnavn, og
  e-posten viser path-en + SQL-en som fjerner bildet.
- ✅ **Appen:** `Avatar` er flyttet INN i mediepipelinen (expo-image,
  150 MB disk-cache, `cacheKey = bucket/path`) — den var utenfor, og å
  koble på opplasting uten det ville vært en egress-regresjon på appens
  MEST gjentatte bilde. Initialene ligger nå ALLTID under bildet, så
  ingen tilstand gir tom sirkel. `resolver.ts` er bucket-bevisst
  (cache-nøkkel `bucket/path`, AsyncStorage-nøkkel bumpet til v2).
  Inngangen er å trykke på avataren i profilheaderen — velg/bytt/fjern.
  Lagoversiktens ⋯ har fått «Rapporter profilbildet» (ALLE medlemmer,
  også mot en trener) og «Fjern profilbildet» (kun lagadmin).
- ✅ **Navnet er ærlig på appsiden:** feltet heter `avatarPath` overalt,
  ikke `avatarUrl`. **DB-kolonnen heter fortsatt `avatar_url` og BÆRER
  EN PATH** — bevisst: åtte deployede RPC-er leser `p.avatar_url` inne i
  plpgsql-kropper, og plpgsql binder kolonnenavn ved FØRSTE KJØRING. Et
  `RENAME COLUMN` ville ikke feilet i migrasjonen, men i produksjon, én
  RPC av gangen. `COMMENT ON COLUMN` er kanonisk.
- ✅ Suiten grønn: **208 tester, 18 filer** (nye: `avatarMedia.test.ts` —
  bucket-isolasjon, én signeringsbatch, opplastingskontrakten;
  `avatarFallback.test.tsx` — initialene under, inkludert det stygge
  tilfellet: FJERNET bilde med fortsatt levende signert token hos alle
  ANDRE enheter). Lint uendret på de 13 kjente.

**✅ VERIFY KJØRT AV BRAGE 2026-08-19: 25/26** (`scripts/verify-00068.sql`
i SQL-editoren). Alt grønt unntatt ett ⚠️-hopp, som er en egenskap ved
Supabase — ikke ved skiva. **NB i SQL-editoren: velg «Run without RLS».**
Dialogen advarer mot at skriptet lager en tabell uten RLS; det er
`CREATE TEMP TABLE`-resultattabellen, som bor i din egen sesjon.
«Run and enable RLS» kan gjøre den avsluttende SELECT-en tom.

**BEVIST som `authenticated` (altså som en ekte bruker, ikke som
postgres):** bucketen er privat med grenser · `shares_team_with` i alle
fire retninger, inkludert asymmetrien · opplasting i EGEN mappe godtas
og i en ANNENS avvises · eier og lagkamerat ser bildet, **en FREMMED gjør
det ikke** (selve personvernsgrensen) · identitetsvakten på profiles
(du kan ikke sette en annens path på deg selv) · hele
`remove_member_avatar` med vaktene · avatar-rapportering + at
feed_post-grenen og kontoslettingens anonymisering fortsatt virker.

**⛔ FUNN: SLETTE-POLICYEN KAN IKKE TESTES I SQL.** Supabase avviser ALL
direkte `DELETE FROM storage.objects` («Direct deletion from storage
tables is not allowed. Use the Storage API instead»), og vakten fyrer
etter alt å dømme på STATEMENT-nivå — da er «kastet» og «0 rader» ikke
til å skille fra hverandre, og en test der ville påstått noe den ikke
vet. INSERT slipper derimot gjennom (C1/C2 beviser det); asymmetrien er
Supabase sin. Skriptet er ryddet: de to slettetestene er FJERNET og
erstattet av C8/C9, som beviser at policyene er installert med rett navn
og rett kommando. **Appen er upåvirket** — `deleteAvatarFile` går via
Storage-API-et, som er nettopp det vakten ber om.
**Å kjøre skriptet på nytt er valgfritt og gir lite:** de 25 grønne er
uendret, og C8/C9 vil nesten sikkert passere siden migrasjonen gikk rent.

**✅ TELEFONTESTET OG GODKJENT AV BRAGE 2026-08-19: «Alt funker på
telefon!»** Runden som ble kjørt (behold som regresjonssjekk hvis noen
rører avataren igjen): sett bilde fra kamerarull og
   kamera · se at det dukker opp i feed, kommentarer, lagoversikt og
   varsler · bytt bilde (gammelt skal forsvinne) · fjern bilde
   (initialer tilbake) · som trener: ⋯ → «Fjern profilbildet» på et
   annet medlem · som VANLIG medlem: ⋯ → «Rapporter profilbildet» skal
   finnes, «Fjern» skal IKKE · sjekk at rapport-e-posten lander.

✅ **SLETTE-POLICYEN ER NÅ BEVIST — hele storage-matrisen er grønn.**
   Kjørt av Claude 2026-08-19 mot ekte prod-Storage-API med en ENGANGSRIGG
   (engangsklubb, engangslag, fire engangsbrukere opprettet med
   service-nøkkelen, alt revet ned etterpå — verifisert: 0 klubber, 0 lag,
   0 lagrom, 0 testbrukere, 0 objekter igjen). Ingen ekte konto eller lag
   ble rørt. **9/9 grønt:**
   opplasting i EGEN mappe · opplasting i en ANNENS mappe avvist (400) ·
   eier ser sitt eget · lagkamerat ser det · **FREMMED ser det ikke** ·
   fremmed kan ikke slette · **vanlig medlem kan ikke slette andres** ·
   **LAGADMIN KAN slette en lagkamerats** (moderasjonsknappen virker) ·
   eier kan slette sin egen.

   ⚠️ **NYANSEN SOM GJØR EN NAIV SJEKK VERDILØS, og som kjøringen bekreftet
   svart på hvitt:** Storage svarte **HTTP 200 med «0 slettet»** på begge
   avslagene. Bulk-DELETE returnerer en LISTE over det som faktisk ble
   slettet, og tom liste er det normale utfallet av et RLS-avslag.
   Statuskoden beviser INGENTING. Enhver test her må asserte på om
   objektet FINNES etterpå — en variant som sjekker `res.ok` ville vist
   grønt på en vidåpen policy.

   Riggen lå i scratchpad og er borte. Den varige, IKKE-destruktive
   varianten for to eksisterende testkontoer står i repoet:
   `scripts/verify-avatar-storage.mjs` (EIER/ANNEN/ADMIN som env-variabler)
   — bruk den hvis policyene endres senere.

**BEVISSTE GRENSER (ikke glemt):**
- **Barn UTEN konto får IKKE bilde.** `managed_children.avatar_url` finnes
  i basen (00003:90) og er fortsatt ubrukt. Å la foreldre legge bilde på
  barna sine er et HELT annet produkt: bildet er da av et barn per
  definisjon, lagt inn av en annen enn den avbildede. Døra står lukket.
- **Ett format, én variant:** 256 px (56 pt × 3 = 168 px er det største
  som tegnes). Ingen thumb avledes — `avatarRef()` setter bevisst ikke
  `thumbPath`, så en fremtidig thumb kan legges til uten å røre et eneste
  kallsted.
- **Fjerning er best-effort på selve fila** (som `updateTeamLogo` og
  `deletePost`): DB-kolonnen er fasiten, og er den NULL er bildet borte
  fra alle levende flater med én gang. Kun frosne varselrader (00051
  `actor_avatar`) bærer den gamle path-en videre, og de faller til
  initialer i det fila faktisk er slettet — det er nettopp derfor
  `MediaImage` nå melder fra om døde objekter.
- **Signerte avatar-URL-er purges ikke ved medlemskapstap.**
  `purgeMediaCacheByPrefix` er lag-scopet (`{team_space_id}/…`); avatarer
  er person-scopet, så det finnes ingen prefiks. En gammel signert URL
  lever til den utløper (≤ 24 t). Selve BILDET er utilgjengelig med én
  gang — `shares_team_with` nekter ny signering.
- **INVARIANT for hele `storage.objects`:** flere permissive policyer
  OR-es, så avatars-policyens `::uuid`-cast evalueres også mot rader i
  feed-media og club-logos. Det holder fordi ALLE tre bucketene har en
  uuid som første mappesegment. **Legger du til en bucket: første segment
  MÅ være en uuid.** (00018 har nøyaktig samme forutsetning.)

**DERETTER (uendret rekkefølge):** cache-persistering · fase B (nettsiden).

---

## ✅ «FORLAT LAG»-SKIVA — GODKJENT OG LUKKET 2026-08-19

**«FORLAT LAG»-SKIVA (dormant-modellen) ER BYGGET, PUSHET OG DEPLOYET
2026-08-19.** Modellen står FROSSET i `docs/FORLAT-LAG-DORMANT-2026-08.md`
(kanonisk — §-referansene under peker dit). Leveransen, hele §7-omfanget:

- ✅ **Migrasjon `00067_forlat_lag.sql` PUSHET TIL PROD** (bekreftet i
  migration list). Innhold: `memberships.left_reason` + `ended_by`
  (backfill: alle removed-rader → 'removed', ended_by NULL=ukjent) ·
  `memberships.requested_role` ('trener') · `team_spaces.dormant_at`
  (backfillet for alt tomme lag) · `profiles.onboarding_completed_at`
  (backfill = eldste medlemsrads created_at + INSERT-TRIGGER
  `stamp_onboarding_completed` som dekker ALLE innmeldingsdører, også
  fremtidige) · hjelperne `has_active_team_admin` (den KANONISKE
  §3a-porten, utledet) og `register_team_dormant_if_empty` (delt av
  leave/delete; ops-varsel kun når laget har innhold/avtaler).
- ✅ **RPC-ene:** `leave_team` (settbasert flip m/ left_reason='left',
  RSVP-rydding, siste-admin-vakt som UTFALL 'last_admin', advisory-lås
  `team_admin_guard` mot samtidige utmeldinger, dormant-registrering) ·
  `set_member_role` + `decline_role_request` (personlig rad, aldri
  spillere, laget kan aldri stå uten aktiv lagadmin, varsler til den
  det gjelder) · `join_team_space` **v4** (NY signatur m/ `p_reopen` —
  gammel 3-args DROPPET; lagleder/admin avvises §5; «trener» → supporter
  + requested_role + varsel til alle aktive lagadmins; §3b-porten
  «siste episode avgjør» også i levende lag; §3a-låsen med
  beboer-unntak — forelder i låst lag kan legge til barn nr. 2;
  gjenåpning §3f-2 gjeninnsetter gammel adminrolle; nuller dormant_at)
  · `remove_team_member` v2 (left_reason='removed' + ended_by) ·
  `delete_account_data` v4 (dormant-registrering; GDPR ellers urørt).
- ✅ **Leseflater:** `get_team_members` v2 (+requested_role — DROP+CREATE
  m/ gjenskapte 00060-grants) · NY `get_team_authors` (forfatteroppslag
  som overlever utmelding — kun navn/avatar/rolle, aldri telefon/
  status; kommentarfeltet bruker den nå via egen query-nøkkel
  `['authors', ts]`) · `lookup_invite_code` v4 (+has_active_admin for
  §3f-UX-en) · `get_club_payments_overview` (+dormant_at på lagradene —
  §3f-4-innsynet, markering i ClubPayments).
- ✅ **A3-RIDERNE ER MED I 00067 OG UTE:** «Klubbetalinger»-teksten i
  `request_team_support_approval` · nominee-feltene i `ops_claim_payload`
  (OpsClaimDetail viser nå navn/e-post/telefon) · `manager`-navnet i
  `get_support_activation_status` (trenerkortet navngir hvem KYC venter
  på). **`payments-notify` ER DEPLOYET** med tekstrettelsene + ny
  hendelsestype `team_dormant` (ops-e-post når lag m/ innhold tømmes).
- ✅ **Appflatene:** «Forlat laget» på Profil (bekreftelse navngir barna
  fra nye `managedChildName`; levende avtale på laget → «støtten
  fortsetter» + «Administrer støtte»-knapp; 'last_admin' →
  blokkeringsdialog som deep-linker til lagoversikten) · TREDJE
  NAVIGATOR-GREN (§3d: innlogget + stempel + null lag → hele
  Profil-stacken som rot; ProfileHeader uten rollebadge; lagløs er
  førsteklasses) · rollemeny i lagoversikten (⋯ → Endre rolle/Fjern;
  «Vil bli trener»-chip m/ Godkjenn/Avslå for lagadmin) ·
  join-flaten viser portene FØR knappen (`shared/teamReentry.ts` — ren
  §3b-logikk over egne rader + `hasActiveAdmin` fra lookup): låst-lag-
  stopp m/ kontaktvei, fjernet-stopp, «Gjenåpne laget»-kort, trenernote
  («godkjennes av en trener — til da supporter») · varsel-trykk
  `team_members` åpner lagoversikten i varselstacken ·
  `executeJoin`/`executeCreate` refresher profilen (stempelet) og
  executeJoin returnerer utfallet (pendingRole-alerten).
- ✅ Suiten grønn: **198 tester, 16 filer** (ny: `teamReentry.test.ts` —
  §3b-ordningen, tiebreak, legacy-null='removed', gjenåpningsmyndighet).
  Lint ren (kun de gamle kjente advarslene).

- ✅ **SKIVA ER GODKJENT OG LUKKET AV BRAGE 2026-08-19.**
  * **Serverbeviset:** `scripts/verify-00067.sql` kjørt — **34/34
    GRØNT**. Dekker begge backfillene, onboarding-triggeren,
    §5-innløserflaten (rolleavvisning, trener→supporter+forespørsel,
    godkjenn/avslå), §3c-sporet, §2-utmeldingen med RSVP-rydding og
    siste-admin-vakten, §3b «siste episode avgjør» begge veier,
    §3a-låsen med beboer-unntaket, §3f gjenåpning (avvist OG
    innvilget), §3e dormant fra både leave og kontosletting,
    `get_team_authors`, og alle tre A3-riderne.
    FØRSTE kjøring stoppet på test 6 — feil i SKRIPTET, ikke i 00067:
    `set_config(...,true)` er transaksjonsbundet, så en fanget
    exception rullet JWT-claimet tilbake til forrige bruker. Claimet
    settes nå utenfor alle fire avvisningsblokkene (felle-notatet står
    i skriptet — IKKE gjeninnfør det).
  * **Telefonbeviset:** §3d-porten er verifisert på enhet i BEGGE
    grener — onboardet bruker som forlot sitt siste lag → Profil-rotet
    stack; helt ny bruker (plus-adressering `+test1@gmail.com`) → den
    LÅSTE onboardingen (WelcomeIntent). Det var den ene skjelningen som
    IKKE kan leses ut av databasen: begge tilstander har null aktive lag.

**RIR MED I PRE-TESTFLIGHT-QA (ikke blokkerende — skiva er lukket).**
Alle er bevist på RPC-nivå av verify; det som gjenstår er om knappene
vises og tekstene stemmer:
· forlat lag MED BARN (navngivingen i bekreftelsen) · levende
støtteavtale-teksten + «Administrer støtte»-knappen ·
siste-trener-blokkeringen + rollemeny/overdragelse ·
trenerforespørsel (join som trener → chip → godkjenn/avslå) ·
«Gjenåpne laget» · kommentar fra utmeldt forfatter beholder navn ·
HELE B6-runden (profilrydding 1+2 — husk Metro-RESTART, nytt asset) ·
push-trykk på rollevarsel (kun testbart i TestFlight) · valgfritt:
`verify-membership-hardening.mjs` på nytt nå som removed-rader finnes.

**BEVISST UTENFOR SKIVA (ikke glemt):** «Legg ned laget» (§4) er EGEN
skive · ops-RPC-ene for gjenåpne/overdra/legge ned dormant lag (§3f-5)
er IKKE bygget — står ikke i §7-omfanget; ops-fallbacken er i dag
SQL/service-rolle, tas sammen med «Legg ned laget»-skiva ·
medlemstall teller fortsatt rader, ikke personer (kjent restanse §6) ·
`author_role` NULL på historiske feed-innlegg (kosmetisk, §6).

**TRE BLINDVEIER SOM ALLE ENDER I §3f-5 (funnet i reviewen 2026-08-19,
BEVISST ikke fikset — de krever ops-flaten, som er neste skive):**
1. **Trener i et lag der alle andre er spillerkontoer kan ikke gå.**
   Siste-admin-vakten blokkerer (det finnes andre aktive medlemmer),
   og `set_member_role` nekter å promotere spillere (§2 sier «spillere
   kan ikke promoteres i v1»). Begge halvdelene er låst i frysdokumentet
   — konsekvensen er en ekte blindvei til ops kan overdra rollen.
2. **Tidligere trener som er tilbake som forelder kan ikke gjenåpne.**
   `join_team_space` sin reopen-gren krever at nyeste PERSONLIGE rad er
   `removed`+`left` — en som alt bor i laget treffer aldri den grenen.
   Oppstår når laget mistet sin siste admin via KONTOSLETTING (ikke via
   utmelding, som vakten hindrer). Ops må tildele rollen.
3. **Trenerforespørsel i et låst lag varsler ingen.** `requested_role`
   blir stående som §3f-3 krever, men det finnes ingen aktive admins å
   varsle, og ingen ops-e-post sendes. Ops ser den først ved oppslag.
   Vurder en `notify_payments_event`-gren når ops-flaten bygges.

**DERETTER:** ~~Profilbilde (avatar-opplasting)~~ — ✅ BYGGET
2026-08-19, se START HER øverst · cache-persistering · fase B
(nettsiden).

**ÉN produksjonsendring fra B6 står utenfor koden:** dashboard-bryteren
«Require current password when updating» = PÅ. Se punkt 1b under og
notatet i `supabase/config.toml`.

**SIKKERHETSSKIVA 00066** (pushet 2026-08-19) er verifisert: Brage
kjørte `verify-membership-hardening.mjs` — ALT GRØNT (test 2 og
egen-historikk-delen av test 5 hadde ingen removed-rader å bite i;
mekanismen er bevist av test 1/3, og leave-skiva lager nå slike rader —
se punkt 3 over).

---

## ▶️ NESTE SAMTALE: KUN MERGE + TESTFLIGHT GJENSTÅR AV FASE A — SÅ FASE B

**Status 2026-08-17 kveld — alt av Fase A-arbeid er FERDIG unntatt selve
mergen (blokkert av GitHub-trøbbel den kvelden, ikke av oss):**

- ✅ **Telefontestet OK** (Brage 2026-08-17): «Alt ser ut til å fungere
  helt fint på telefon.»
- ✅ **Bucket-limits SATT og verifisert** (via Storage-API med
  service-nøkkel): feed-media 10 MiB, club-logos 2 MiB, begge låst til
  image/jpeg+png+webp+heic. (Var helt åpne før — global 50 MiB.)
- ✅ **Backfill KJØRT med `--apply`**: 38/38 bilder konvertert, 0 feil.
  Snitt 2,4 MB → 479 kB (~5×), alle rader har thumbnail_path. Manifest:
  `scripts/backfill-manifest-2026-08-17T150558.json` (gitignorert — TA
  VARE PÅ DEN til pre-launch-beslutningen om originalene). SAFEGUARD
  holdt: originalobjektene står urørt i bucketen. NB: gamle TestFlight-
  klienter får ALLEREDE de lette variantene (de signerer storage_path
  ferskt), så egressen skal synke i Usage før mergen også.
- ✅ **Baseline regnes som dekket**: Q1–Q7 ble kjørt og verifisert mot
  ekte edge_logs 2026-08-12 (Management-API), H1 og H2 er bevist med
  tall. Hovedbeviset for exit-kriteriet leses uansett av
  Usage→Bandwidth-HISTORIKKEN (før/etter). Valgfritt, ikke blokkerende:
  et kvelds-snapshot av Q1–Q7 før TestFlight-bygget skipper.
- 🔧 **Praktisk**: Supabase-CLI-en på maskinen er innlogget mot
  prosjektet (`supabase projects list` virker). Service-nøkkelen hentes
  med `supabase projects api-keys --project-ref sswncdrbsrfieudkdmhj`
  — slik ble både bucket-limits og backfillen kjørt uten dashboard.
  Backfill-miljøet (sharp/tsx) ble satt opp i scratchpad, IKKE i
  prosjektets node_modules (Metro kjørte).

**FASE B ER PÅBEGYNT 2026-08-17** (Brages beslutning: GitHub var nede,
og han vil ikke skipe TestFlight før B er med — A+B går som ÉN slipp):

- ✅ B3 grunnmur: migrasjon 00059 (REPLICA IDENTITY FULL på reactions)
  + 00060 (alle P10 må+bør-fiksene) + `.github/workflows/ci.yml`.
  **Begge migrasjonene er PUSHET TIL PROD 2026-08-17** (`supabase db
  push`; 00060 trengte én signaturrettelse — get_season_stats er
  `(uuid, int, int, uuid)`). Verifisert: anon får nå «permission denied»
  på get_team_feed allerede ved funksjonsdøren.
- ✅ B2 fundament: @tanstack/react-query 5.101.4 installert;
  `src/lib/queries/` (queryClient med P6-defaults 60 s/retry 1, låste
  P7-queryKeys, members-query); QueryClientProvider + focusManager i
  App.tsx; `queryClient.clear()` i clearLocalCaches;
  CommentsScreen-medlemsdubletten fjernet via `ensureQueryData`.
  Suiten grønn (141), lint ren (kun gamle kjente advarsler).
- Kartleggingsnotater (fra agentkart 2026-08-17): `get_team_feed` har
  UBRUKT cursor-param (klar for useInfiniteQuery); stillingen ligger
  komplett i match_sessions-payload; INGEN kanaler har status-callbacks
  (payload-først MÅ få resync-ved-SUBSCRIBED samtidig, ellers tapes
  hendelser ved reconnect); getTeamEvents mangler {from,to,limit};
  notifications-paginering krever nytt `before`-argument; TeamHome/
  Inbox/galleri er ScrollView (B2 gjør dem til FlatList).

- ✅ B2 events-skiven: `getTeamEvents` har fått valgfritt datovindu
  (12 mnd bak / 18 frem — dekker ALL eksisterende data, tak på P10 #7);
  Hjem og Kalender deler nå ÉN events-query (`useTeamEvents`, nøkkel
  `['events', ts, 'w12b18f']`); `useScreenFocusRefetch` er broen
  navigasjonsfokus→TanStack (60 s-regelen fra P6, med vern mot
  dobbelhenting ved mount — invalidateQueries cancelRefetch-fella);
  mutasjonene (create/update/avlys/RSVP) invaliderer selv via
  `queries/invalidate.ts` (egen modul UTEN api-import = ingen sirkel);
  feed-burst refetcher IKKE lenger events — kallbudsjett-vakten i
  `feedRefetch.test.tsx` er oppdatert til å BEVISE det (from-count 4→3)
  og harnessen bruker appens queryClient + tømming per test.
  Kalenderbolkens regler fulgt: kun datalaget rørt, behold-ved-feil
  bevart (keepPreviousData + isError-mapping). Suiten grønn (141).

- ✅ B2 feed-skiven (2026-08-17): feeden over på `useInfiniteQuery`
  (`src/lib/queries/feed.ts`; cursor-parameteren fra 00029 endelig i bruk,
  nøkkel = låste `['feed', ts]`); pinned-fellene løst i REN modul
  `src/shared/feedPaging.ts` (cursor = eldste U-pinnede rad, dedupe på id
  på tvers av sider) med egen testfil. TeamHome er FlatList: compose i
  ListHeaderComponent som ELEMENT (remount-fella), memoisert `FeedRow` med
  stabile callbacks, onEndReached → neste side, optimistiske oppdateringer
  (👏/unpin/slett) via `patchFeedItem`/`removeFeedItem` rett i cachen;
  fokus-resync = 60 s-regelen + NY `markFeedStale`-bro (blur midt i
  realtime-debouncen markerer stale uten fetch — F19 består, og
  `useScreenFocusRefetch` resyncer straks ved retur via `isInvalidated`).
  Inbox er FlatList (blokk-granularitet: kort/kampkort/overskrift) med
  inkrementell henting: `getNotifications` fikk `{before, after}`,
  realtime-burst henter kun nyere-enn-nyeste, eldre sider pagineres på
  scroll, `mergeNotifications` (shared/inbox) deduper med readAt-vern
  (nedgraderer aldri lokal lest-markering); hull-vakt (disjunkt topp-50 →
  nullstill, aldri flett over et usynlig gap) + generasjonsvern mot
  lagbytte-/reset-racer. Galleri + kampbilde-rail er FlatList med
  windowSize 3. KALLBUDSJETT-VAKTEN feedRefetch.test.tsx passerte
  UENDRET (åpning 2 rpc + 2 events + 1 kanal; burst = én refetch, rpc 4 /
  from 3). Suiten grønn (151), lint ren. Adversariell review kjørt;
  bekreftede funn fikset (hull-vakten, generasjonsvernet, readAt-vernet,
  markFeedStale, LayoutAnimation-gating). AKSEPTERTE kjente grenser,
  dokumentert i kode: ms-trunkert cursor uten id-tiebreaker (fiks = ny
  RPC-signatur + gjenskapte 00060-grants, tas ved observasjon); refetch av
  ALLE lastede sider ved invalidering (dyp scroll × realtime — `maxPages`
  er knappen hvis det svir, men den klipper synlig liste); Android-clipping
  av composeren i ListHeader (removeClippedSubviews-default — irrelevant
  før Android-runden). NESTE EGRESS-KANDIDAT funnet i kartleggingen:
  MatchTimeline rendrer ALLE kampbilder i display-variant i EventDetails
  ytre ScrollView — ta den i event-detalj-skiven.

- ✅ B2 event-detalj-skiven (2026-08-17): EventDetailScreen over på
  query-cachen (`src/lib/queries/eventDetail.ts`, P7-nøklene
  `['event', id]` + `['matchPhotos', id]`); optimistisk RSVP/reporter som
  CACHE-patch (`patchEventDetail`, patchFeedItem-mønsteret — speil-staten
  myStatus/reporterId er borte); fokus-broen med 60 s-regelen — live-
  kampens ferskvare løses IKKE med staleMs 0 (en staleMs som flipper
  re-fyrer fokus-effekten → dobbelhenting ved åpning av live kamp;
  FUNNET av adversariell review, bevist med ekte timere), men ved at
  realtime-OPPRYDDINGEN alltid markerer begge nøklene stale (refetchType
  'none'): appen er døv for kampen fra blur-øyeblikket, broen ser
  `isInvalidated` ved retur og resyncer straks (B3-status-callbacks
  løser reconnect-hullet ordentlig);
  redigeringsmodal-fella dekkes av updateEvents invalidering (observeren
  står montert under modalen). setMatchReporter/startMatch/
  reportMatchEvent invaliderer IKKE i api-laget — skjermen refetcher
  eksplisitt (bevisst: samme som før, vurder api-invalidering i B3).
  Turneringskamplisten står BEVISST imperativt (P7-avgrensningen).
  EGRESS-FIKSEN: MatchTimeline + MatchEventRow over på thumb-variant
  (display bor kun i galleriet) + **migrasjon 00061** — get_match_photos
  returnerer nå thumbnail_path (uten den falt thumb STILLE tilbake til
  2048px-masteren; railen fra feed-skiven hadde samme hull!); DROP+CREATE
  med gjenskapte 00060-grants. **00061 er PUSHET TIL PROD 2026-08-17**
  (`supabase db push`, verifisert med `supabase migration list`).
  getMatchPhotos primer begge varianter i én batch. NY VAKT:
  `__tests__/eventDetailRefetch.test.tsx` (trening = 1 RPC og gjenåpning
  innen 60 s = 0; ferdig kamp = 3 RPC + thumb-bevis for BEGGE
  renderstiene — MatchEventRow og timelinens frittstående gren; live =
  én kanal, burst = én event-refetch og INGEN bilde-refetch). Testtriks:
  TanStacks notifyManager varsler via setTimeout → `flushWaves()` for
  avhengige queries, og den flytter klokka 1 ms per runde — med frossen
  klokke er vakten blind for tid-avhengige dobbelhentinger. Adversariell
  review kjørt (to bekreftede funn, begge fikset: dobbelhenting ved
  staleMs-flip + utestet MatchEventRow-thumb). ⚠️ Reviewen kostet
  ~1,15 M tokens i subagenter og traff sesjonstaket — bruk LETTERE
  review på småskiver fremover. Suiten grønn (154), lint ren.

- ✅ B3 payload-realtime + Sentry (2026-08-18): hele P6-tabellen
  implementert — realtime-handlerne applisererer payloads rett i
  query-cachen (P7-nøklene) i stedet for refetch-per-hendelse:
  * **Kanal-laget** (`realtimeChannels.ts`): `.subscribe()` har fått
    status-callback overalt. `createResyncStatusHandler` (eksportert, ren)
    roper resync ved SUBSCRIBED etter frafall ELLER etter tidligere
    SUBSCRIBED (socket-rejoin) — men ALDRI ved første join (ellers
    dobbelhenting ved åpning, staleMs-flip-lærdommen). Registryet deler ut
    sentinelen `CHANNEL_RESYNC` til alle lyttere; `isChannelResync` i
    konsumentene. DETTE var forutsetningen for payload-først: uten
    resync-ved-SUBSCRIBED tapes hendelser ved reconnect. Egen vakt:
    `__tests__/realtimeChannels.test.ts`.
  * **Feed** (`subscribeToFeed` klassifiserer nå payloads → typed events;
    ny signatur med `myUserId`): andres 👏 = teller-patch i cachen (0 kall,
    0 hero-refetch — før: full refetch + heroer per burst!), egne
    reaksjons-ekko filtreres (00059 gir full old-rad på DELETE), kommentar
    inn/soft-ut = ±1 `commentCount`, feed_posts UPDATE = patch/fjern lokalt
    (pin-flip → side 1-henting, posten resorteres), feed_posts INSERT =
    debounced henting av KUN side 1 (`refetchFeedFirstPage` skjøter inn
    pages[0]; dype sider urørt — B2-grensen «alle sider per invalidering»
    gjelder nå kun reconnect/fokus). Fallback (payload uten felter) =
    debounced FULL invalidering (hygienen fra A som nett).
  * **Kamp** (`subscribeToMatch` → typed events): match_events INSERT
    appenderes i `['event', id]` fra payload via eksportert
    `mapMatchEventRow` (SAMME mapping som getEventDetail; dedupe på id —
    reporterens eksplisitte refetch og ekkoet kolliderer aldri);
    match_sessions UPDATE patcher stilling/status/reporter/startedAt fra
    raden (komplett i payloaden). Ett mål hos N tilskuere = 0 refetch.
    Foto-stien uendret (debounced loadPhotos, P6). Cache-miss → fallback.
  * **Varsler** (NotificationsContext): INSERT = +1 lokalt (team-scopet,
    null = global — samme scope som getUnreadCount), INGEN count-spørring
    per varsel lenger; InboxScreens loadNewer dropper også sin. HEAD-
    spørringen er nå henvist til resync-stiene (fokus/forgrunn/reconnect/
    lest-markering). Kanalens resync bumper også liveNonce → fokusert
    inbox drar inkrementell henting (hull-vakten der tar store gap).
  * **CommentsScreen**: egne kommentarer patcher `commentCount` i
    feed-cachen direkte (±1) — ekko kan ikke doble (feed-kanalen er
    fokus-bundet til TeamHome som er blurret mens tråden er åpen).
  * **Sentry** (`src/lib/sentry.ts`, init i index.js): helt AV uten
    SENTRY_DSN i .env (modulen lastes ikke engang); tracesSampleRate 0,
    sendDefaultPii false. JS-feil fanges så snart DSN settes; NATIVE
    crash-handler krever pod install + nytt bygg (tas i B1-runden).
    ⚠️ EKSTERNE STEG FOR BRAGE: opprett Sentry-prosjekt → legg DSN i .env
    (+ TestFlight-byggets env). `pod install` er KJØRT 2026-08-18 (RNSentry
    8.23.0 i Podfile.lock) — nativedelen er med fra NESTE bygg.
  * Vaktene OPPDATERT + utvidet: feedRefetch (payload-først-test: 👏 = 0
    kall og ingen heroer, ekko ignorert, DELETE-teller, kommentar ±,
    post-patch/-fjerning, nytt innlegg = kun side 1, reconnect = resync),
    eventDetailRefetch (mål = cache-patch 0 kall, duplikat-ekko, reconnect
    resyncer begge stier; gamle bursts er nå eksplisitt FALLBACK-bevis),
    mockene fikk `__fire(table, payload)` + `__reconnect()`. Suiten grønn
    (160), lint ren.
  * BEVISSTE grenser: CommentsScreen har ingen live-append av andres
    kommentarer (ingen P7-nøkkel — kald sti, tråden refetcher ved fokus);
    match_events DELETE (korreksjoner = delete+reinsert) lyttes ikke på —
    ingen app-flyt skriver den ennå, refetch-stiene healer; reconnect
    refetcher fortsatt ALLE lastede feed-sider (akseptert, sjeldent).
    setMatchReporter/startMatch/reportMatchEvent beholder eksplisitt
    refetch i skjermen (reporterens fasit; dedupen gjør ekkoet ufarlig).

- ✅ B1 JS-delen (2026-08-18, rett på Brage-branchen — Brages beslutning,
  git-commits er sikkerhetsnettet): expo-image 55.0.11 + expo-file-system
  55.0.25 + expo 55.0.29 + react-native-compressor 2.0.3 installert
  (SDK 55-linjen matcher RN 0.83, som planlagt).
  * **MediaImage** er expo-image: `source.cacheKey = storage_path` (disk-
    cachen nøkles på PATH — roterende `?token=` er ikke lenger cache-miss),
    `cachePolicy: 'disk'`, `configureCache({maxDiskSize: 150 MB})` ved
    modul-last; `resizeMode`-prop-en beholdt utad og oversettes til
    `contentFit` (kallstedene urørt). Målingen (imageMetrics) og
    onError→refreshMediaUrl-fornyingen står.
  * **Opplasting**: `src/lib/media/upload.ts` (uploadAsync + Bearer fra
    getSession + P1-headerne; utenom netMetrics — bevisst, det er ingress);
    pickeren har `includeBase64` AV, base64-arraybuffer er AVINSTALLERT;
    compressor lager thumb 480/q0.7 av 2048-masteren ved pick (feilet
    thumb = null, aldri blokkert innlegg); uploadTeamImage laster opp
    BEGGE med backfill-navnene (`-d2048`/`-t480`) og skriver
    thumbnail_path; logo-stien (teams.ts) bruker samme helper.
  * `clearLocalCaches` tømmer også expo-images disk-cache (P1, delt enhet).
  * NY VAKT: `__tests__/mediaUpload.test.ts` (2 kall m/ headere +
    thumbnail_path; uten thumb; feilet thumb blokkerer ikke; ingen økt =
    feil før bytes). Suiten grønn (164), lint ren. Diffen manuelt
    gjennomgått før commit.
  * PROSESSNOTAT: `install-expo-modules` ble IKKE kjørt av Claude
    (permission-klassifisereren blokkerte kjøringen, og den ville uansett
    endt i pod install — Brages steg). JS-pakkene er installert manuelt i
    stedet; native-wiringen gjenstår (under).

- ✅ B1 native-runden (2026-08-18): `npx install-expo-modules@latest`
  kjørt av Brage (nei til Expo CLI-integrasjonen — vi bruker expo-modules
  som BIBLIOTEKER, ikke Expo som toolchain), pods installert (36 s!),
  **dev-bygg GRØNT på telefon**. To byggefeil underveis, begge fikset og
  committet:
  * Mellomrommet i prosjektstien («Heia Prod») knakk EXConstants-
    scriptfasen (`bash -l -c "$PODS_TARGET_SRCROOT/…"` ordsplittes).
    Fikset med fnutter — patchet i Pods-prosjektet OG som idempotent
    post_install-hook i Podfilen (overlever pod install). Følgefeilen
    «No such module 'Expo'» forsvant med den.
  * AppDelegate: `override` på de fire app-event-metodene
    ExpoAppDelegate også implementerer (deep links + push); oppførsel
    uendret, super bevisst ikke kalt (ingen av våre expo-moduler lytter).
  * PROSESSLÆRDOM: `npm run ios` passer IKKE Brages flyt — den spawner
    egen Metro i eget terminalvindu (port 8081-konflikt-risiko). Flyten
    er: Metro via `npm start` i Cursor, bygg fra Xcode.

- ✅ **B1 TELEFONTESTET OK (Brage, 2026-08-18): HELE FASE B ER FERDIG.**
  Rotasjon/EXIF i orden (kamera + kamerarull), opplasting virker, bildene
  «lastes inn med en gang» (disk-cachen + thumbs i praksis). Ett funn under
  testen, fikset og committet: pickeren rapporterer ugyldige `image/jpg`
  som bucket-grensene fra A avviser med 415 — normaliseres nå til
  `image/jpeg` i pickeren. Feilen VAR svelget i to ledd (composerens
  tomme catch + upload uten svarkropp); dev-alerter viser nå serverens
  feilmelding, prod er fortsatt rolig. Valgfritt, ikke gjort: eksplisitt
  flymodus-test av disk-cachen og thumbnail_path-sjekk i DB.

**SLIPPEN ER UTE (2026-08-18 kveld):** PR merget til main (Brage),
Sentry satt opp (EU-region; DSN i gitignorert .env, VERIFISERT bakt inn
i binæren), TestFlight-bygg **1.0 (4)** lastet opp og i Testing hos
interne + Friends and family (main.jsbundle verifisert i arkivet FØR
upload — regelen fra bygg 1.0 (2) holdt). Sentry-lesetilgang for Claude
er BEVISST utsatt til første ekte feil (DSN er skrivevei; lesing krever
User Auth Token som Brage lager da).

**GJENSTÅR AV EGRESS-PLANEN (kun avlesning — intet arbeid):**
1. Exit-avlesning: −80 % egress i Usage→Bandwidth over ~2 uker fra nå
   (P13-lista er feilsøkingskartet hvis grafen skuffer).
2. Pre-launch-beslutningen om gamle kameraoriginaler (manifestet ligger).
Fase C er terskelstyrt — bygg ingenting.

**NESTE BYGGESPOR (revidert 2026-08-18 — ERSTATTER den gamle
«klubbdør-skiva»-definisjonen):**
1. **AUTORITETSSKIVA for klubbbetalinger** — produksjonsklar v1 av
   hvem-får-myndighet-modellen: nominasjon i «Aktiver støtte»-skjemaet,
   eksplisitt rolletildeling ved ops-godkjenning, sikre invitasjoner m/
   avvikskontroll (aksept på WEB), enhets-scope for betalingsansvarlig,
   KYC-gate (Share-arket fjernes), varslingsmatrise, ops-flater i stedet
   for SQL-runbooks. ALT i Stripe testmodus.
   **Status: GODKJENT AV BRAGE 2026-08-18 (B1–B6 avgjort; B4 web-stack
   åpen til fase B) — ✅ FASE A1 (backend) BYGGET OG DEPLOYET TIL PROD
   2026-08-18 (kveld):** migrasjon `00062_autoritetsmodell` +
   `00063_autoritet_varsling` + `00064_redeem_outcomes` pushet (backfill ren: 0 foreldreløse,
   alle 5 manager-rader enhets-scopet — Ridabu/Stange/Nes);
   Edge Functions deployet: NY `payments-notify` (varslingsnav +
   token-eierskap B3), NY `submit-club-claim` (server-side brreg),
   `stripe-onboarding` (gate = aktiv betalingsansvarlig, Share-flyt
   død server-side), `claim-notify` (nominee-bevis). Røyktestet:
   anon → 42501 på alle nye RPC-er, payments-notify/submit uten
   auth → 401, `heia_support_defaults` = 7900/2405/6000.
   **✅ A1 ER FERDIG OG VERIFISERT 2026-08-18: verify-00062.sql kjørt
   av Brage i SQL-editoren — 38/38 GRØNT** (selvforsynt, rullet
   tilbake). Første kjøring ga 36/37 og avdekket et EKTE FUNN, ikke en
   testfeil: PL/pgSQL ruller tilbake alt arbeid i en funksjon som
   avslutter med RAISE EXCEPTION, så forsøkslogging
   (`invite_attempt_invalid`), utløps-statusflippen og
   sikkerhetsvarselet ved suspendert utsteder forsvant sammen med
   feilmeldingen — tre låste krav var ikke oppfylt i praksis (ingen
   rolle ble gitt, så sikkerheten var intakt; det var SPORET som
   manglet). Fikset i **00064**, som gir den BINDENDE KONTRAKTEN for
   A2 og web: `redeem_manager_invitation` →
   `accepted|awaiting_review|invalid|expired|suspended`,
   `decline_manager_invitation` → `declined|invalid`,
   `issue_manager_invitation` → `issued (+invitation_id)|suspended`.
   Exceptions kun der ingen sideeffekt skal bevares. Verify dekker nå
   38 tester (17/21/24 beviser at loggingen OVERLEVER, 38 = decline).

   **✅ FASE A2 ER FERDIG 2026-08-18 (ren JS — ingen migrasjoner, ingen
   native). Suiten grønn (164), lint identisk med baseline (13 kjente),
   og TELEFONTESTET OK av Brage samme kveld: «Alt funker på
   telefonen.»** Alt under er implementert; to kjente avvik er
   DOKUMENTERT nederst i bolken (ingen av dem blokkerer A3).
   Innholdet, fra faseplanens Del V:
   * `SupportSetupScreen`: nominasjonsvalget «Jeg» / «En annen i
     klubben» (sistnevnte BAK FEATUREFLAGG til web-landingen er live —
     ingen død brukerreise); nye `awaiting_manager`-kort
     (invitert/avslått/utløpt → kontaktvei hello@heiaapp.no);
     KYC-kortet viser CTA kun ved `can_onboard` (aktiv
     betalingsansvarlig), ellers «venter på at [navn] fullfører hos
     Stripe»; **Share-arket FJERNES** (gaten er alt død server-side);
     `submitClubClaim` går over til Edge-funksjonen `submit-club-claim`
     (dev-bygg beholder direkte-RPC som «Send likevel (testdata)»).
   * `ClubPaymentsScreen`: enhets-gruppering (payload har nå `entity`,
     `clubs[]`, `managers[]`, `invitations[]`); rolleadmin-seksjon med
     «Inviter ny betalingsansvarlig»; **«Fullfør deaktiveringen»** når
     `unresolved_cancellations > 0` (delfeil-fiksen fra gamle K2);
     designavstemming (ikoner i stedet for emoji-loggen, tokens i
     stedet for hardkodet gult #FFF4D6).
   * Ops: `OpsClaimDetailScreen` viser nominee + tildelingsutfall; NY
     `OpsEntitiesScreen` («Klubber og roller» i Profil-stacken) på
     `ops_list_payment_entities` — enheter, managere, invitasjoner,
     REVIEW-KØEN (bekreft/avvis avvik), suspender/reaktiver/fjern,
     utsted/trekk invitasjon, flytt lag (`ops_move_team_to_club`).
   * API-laget (`payments.ts`, `clubPayments.ts`, `ops.ts`): nye typer
     + outcome-håndtering etter 00064-kontrakten.
   * Exit A2: suite grønn + lint ren, alle nye flater navigerbare i
     dev-bygg, «En annen»-flagget AV, ingen døde CTA-er.

   **SLIK BLE A2 BYGGET (filer + avgjørelser):**
   * NY `src/shared/flags.ts` → `WEB_INVITE_LANDING_LIVE = false`.
     UTVIDET SCOPE mot faseplanen, bevisst: flagget skjuler BEGGE
     inngangene som ender i en invitasjon — «En annen i klubben» i
     SupportSetup OG «Inviter ny betalingsansvarlig» i
     ClubPayments-rolleadmin. Grunn: aksept skjer kun på web, e-posten
     er gated på `WEB_INVITE_BASE_URL`, og rå-tokenet finnes ALDRI i
     basen (B3) — en manager-utstedt invitasjon i dag kan derfor ikke
     innløses av noen, heller ikke med ops-hjelp. Det er en død CTA, og
     exit-kriteriet forbyr dem. Ops-flatens «Utsted invitasjon» er
     BEVISST ikke flagget (behandlet beslutning m/ begrunnelse, og
     flaten viser selv «IKKE SENDT»). ÉN flipp i fase B-1 slår på alt.
   * `payments.ts`: `awaiting_manager` + `canOnboard` + `managerPending`
     i statustypen; `submitClubClaim` går nå via Edge-funksjonen
     (`submitClubClaimDirect` er dev-veien for «Send likevel
     (testdata)»); `edgeMessage` trukket ut og delt med clubPayments.
   * `clubPayments.ts`: enhets-payloaden (`entity.id`, `clubs[]`,
     `managers[]`, `invitations[]`, `unresolvedCancellations`) +
     `issueManagerInvitation` med 00064-utfallet som DATA
     (`issued|suspended` — aldri exception, ellers ryker
     sikkerhetsvarselet).
   * `ops.ts`: `opsListPaymentEntities` + hele ops-settet (utsted/trekk,
     bekreft/avvis review, suspender/reaktiver/fjern, flytt lag),
     `opsApproveClaim` returnerer nå tildelingsutfallet, og brreg-
     snapshotet mapper nominee-feltene (`nomineeIsSelf`,
     `nominertIRegisteret`, `matchNominert`). `opsListTeamsForClubs`
     leser `teams` direkte (RLS: alle innloggede, 00005) — grunnlaget
     for «Flytt lag» uten ny RPC.
   * `SupportSetupScreen`: nominasjonsvalget (to ChoiceCards, bak
     flagg), `awaiting_manager`-kortene med kontaktvei per
     invitasjonsutfall, KYC-CTA kun ved `canOnboard`, Share-arket +
     `Share`-importen BORTE, klubbdør-kortet trukket ut i
     `renderDoorCard(managerless)` (gjenbrukt i `active` og
     `awaiting_manager`; managerløs variant sier at Heia er varslet —
     II.9-fallbacken).
   * `ClubPaymentsScreen`: enhets-gruppering (juridisk navn som
     overskrift, klubbrader listet når det er flere),
     BETALINGSANSVARLIGE-seksjon (managere + åpne invitasjoner),
     «Fullfør deaktiveringen» i eget solskinnskort per lag med
     `unresolvedCancellations > 0`, emoji-loggen → Lucide-ikoner,
     `#FFF4D6`/`#8A6D1A` → `colors.sun`/`sunBorder`/`goldInk`.
   * NY `OpsEntitiesScreen` + rute `OpsEntities` i Profil-stacken (rad
     «Klubber og roller» under Heia internt). AVVIKSKØEN ligger øverst
     på tvers av enheter. Begrunnelse er påkrevd i alle skrivende
     RPC-er, så skjermen har ÉN felles `Modal`-prompt i stedet for
     `Alert.prompt` (den finnes kun på iOS).
   * `OpsClaimDetailScreen`: nominasjonsraden + ★/◆-markering i
     registerrollene, og en bekreftelse etter godkjenning som sier hva
     som skjedde med myndigheten (rolle vs. invitasjon vs. ingen).

   **TO KJENTE AVVIK (begge krever backend — derfor IKKE gjort i A2).
   INGEN av dem blokkerer A3, som kun kjører SELV-nominasjon; de biter
   først i fase B-4 (nominasjon av en annen person). Begge løses av ÉN
   liten, rent additiv migrasjon (foreslått `00065_ops_payload_nominee`)
   — ta den som oppvarming til fase B:**
   1. `ops_claim_payload` (00046) bærer ikke `nominee_is_self`/
      `nominee_name`/`nominee_email`/`nominee_phone`. Ops-detaljskjermen
      kan derfor si AT en annen er nominert (lest fra
      `brreg_snapshot.checks.nominee_is_self`, som claim-notify skriver)
      og markere registertreff med ◆, men ikke vise navn/e-post — de
      står kun i claim-notify-e-posten. Fiks = `CREATE OR REPLACE
      ops_claim_payload` med de fire feltene; appen mapper dem allerede
      strukturelt likt resten.
   2. `get_support_activation_status` bærer manager-navnet KUN i
      `awaiting_manager` (`manager_pending`). Når `canOnboard` er false
      fordi en ANNEN er aktiv betalingsansvarlig, kan kortet derfor
      ikke si «venter på at [navn] fullfører hos Stripe» — teksten sier
      «klubbens betalingsansvarlige» i stedet (presist, uten å påstå et
      navn vi ikke har). Fiks = legg `manager: {name}` på payloaden.
   **✅ FASE A3 ER FERDIG 2026-08-19 — ALLE SEKS SCENARIENE (a–f) GRØNNE
   PÅ TELEFON mot Stripe sandbox.** Exit-kriteriet er innfridd.

   *Testrigg:* Ridabu G15 (nytt lag — farens J2019 ble bevisst unngått) ·
   engangskonto `brage.lothe.weium+dogfood@gmail.com` («brage Bowling»,
   SLETTET i (d)) · ny testklubb BRISKEBYEN BOWLINGKLUBB (orgnr
   **983550134**, ekte FLI i Hamar, valgt fordi en bowlingklubb aldri
   forveksles med en ekte Heia-kunde) med Lag 1–4 · «Testklubb duplikat»
   fra (f). ALT dette er testdata som ryddes sammen med Stange/Nes etter
   fase B.

   *Bevist:* (a) lagforespørsel → varsel i app + E-POST til ALLE aktive
   ansvarlige (første gang II.9-e-posten er sett med to managere) →
   godkjenning → arv 79/60 og offering v1 UTEN SQL → sandbox-checkout m/
   Apple Pay → pause → re-godkjenning som IKKE rørte eksisterende
   abonnement (fornyelsesdato uendret — invarianten holder) → deaktivering.
   (b) claim via Edge-funksjonen m/ server-side brreg → claim-notify traff
   den ALDRI TESTEDE grenen «søkeren står IKKE i registerets roller —
   beviser ingenting», med klubbens registrerte kanal som neste steg →
   ops-godkjenning ga myndighet EKSPLISITT + defaults automatisk →
   KYC-GATEN verifisert BEGGE VEIER (ops-admin uten managerrolle fikk
   IKKE Stripe-knappen; managerkontoen fikk den) → sandbox-KYC → konto
   aktiv → Lag 3 godkjent. (c) suspender siste aktive (LOV, ga
   ops-e-post «siste aktive ansvarlige suspendert») → myndigheten
   faktisk borte i managerens egen flate → reaktiver → fjern SISTE
   aktive AVVIST → utsted invitasjon merket «IKKE SENDT (venter på
   web-landingen)» → trekk tilbake. (d) GDPR-sletting av siste manager
   kan aldri nektes → ops-e-post «betalingsansvarlig slettet kontoen
   sin» + gult managerløs-kort. (e) lagforespørsel (Lag 4) mot managerløs
   enhet → trenerkortet sa «Heia er varslet» + ops-fallback-e-post
   «Forespørselen ligger og venter». (f) duplikatsperren ga HELE, lesbare
   stoppteksten i appen.

   **RETTELSE AV FASEPLANEN:** (a)-punktet «verifiser sperren mot en
   klubb uten aktiv konto» er IKKE NÅBAR fra appen — klubbdør-kortet
   («Be om godkjenning») vises først når klubbens Stripe-konto er aktiv
   (SupportSetupScreen, `case 'active'`). Vakten i `approve_team_support`
   er dermed forsvar i dybden, dekket av verify-00062. Ikke et åpent punkt.

   *FIKSET UNDERVEIS — alt rent JS unntatt 00065:*
   1. **Varsel-trykk låste Profil-fanen** (meldt av Brage): nested navigate
      uten `initial: false` gjorde målskjermen til ENESTE rad i fanen →
      ingen vei tilbake, fanetrykk = no-op, kun appdrap hjalp. LØST ved at
      klubbdør-varsler nå åpnes I VARSELSTACKEN som kamp-/kommentarvarsler
      (`InboxStackParamList` fikk SupportSetup + ClubPayments), så «Tilbake»
      går til varsellista. Push-/e-postveien bruker `profilEntry`
      (`src/navigation/profilEntry.ts`), som setter hele fanens state i ÉN
      operasjon. To forkastede forsøk først: `initial: false` alene ga et
      synlig hopp, og global kryssfade på fanene ble avvist av Brage.
      **Push-veien er UVERIFISERT — dev-bygg har ikke push. Test i TestFlight.**
      (E-post-deep-linken til ops ER verifisert på telefon.)
   2. **`errorMessage`-fella — den viktigste av dem.** `supabase.rpc()`
      kaster en PostgrestError, som IKKE er en `Error`-instans, og fem
      steder i betalings-/ops-flatene testet `e instanceof Error` før de
      leste meldingen. HVER håndskreven vaktmelding fra databasen ble
      derfor byttet ut med «Prøv igjen om litt» — et råd som umulig kan
      virke, siden vernene er permanente. Rammet bl.a. siste-aktive-vernet,
      «Klubbens Stripe-konto er ikke aktiv ennå» og duplikat-forsvaret ved
      ops-godkjenning. Ett felles `src/shared/errorMessage.ts` nå.
      (SupportSetup slapp unna fordi den brukte `e?.message` — derfor så
      appen riktig ut noen steder og feil andre.)
   3. **«Støtt laget»-mellomskjermen SLETTET.** Den lå mellom Lagkassa og
      Stripe og gjentok pris, fordeling, mottaker og knappetekst ordrett —
      to like sider, to like knappetrykk. Lagkassa går nå rett på checkout;
      fornyelsesdato, tillitslinje, lagadmin-snarveien, AppState-refetch og
      «Fullfør betalingen» flyttet dit. Den stygge logoen og «Støtt [lag]»-
      overskriften som ble stående ETTER betaling forsvant med skjermen.
   4. **Lagkassa sa «Fornyes 19. sept» om en OPPSAGT avtale** — oppslaget
      hentet aldri `cancel_at`. «Min støtte» på Profil var alltid riktig, så
      appen sa to ting om samme abonnement og PENGESIDEN sa feil. Nå
      «Avsluttes». NB: en oppsagt avtale har status `active` ut perioden —
      statusen alene forteller ikke sannheten.
   5. **Delfeil-varselet ropte ulv.** «Deaktiveringen ble ikke fullført, 1
      støtteavtale trekkes videre» sto der etter en HELT VELLYKKET
      deaktivering, fordi `cancel_at` skrives av webhooken sekunder senere;
      boksen ble stående til pull-to-refresh. **MIGRASJON 00065
      `deaktivering_karenstid` — PUSHET TIL PROD 2026-08-19**: telles først
      når deaktiveringen er eldre enn 5 min.
   6. **Lagkassa sa «ikke satt opp ennå» om et PAUSET lag** — payloaden
      skiller ikke pauset fra aldri-priset (`no_offering` dekker begge). Ny
      tekst «tar ikke imot nye støttespillere akkurat nå» er sann i alle
      tilfeller. ORDENTLIG fiks = ny `reason` fra 00039, ikke gjort.
   7. **Rødt varsel på ferdigbehandlet søknad.** «Klubben har allerede en
      aktiv kobling» er BESLUTNINGSSTØTTE («godkjenning gjenbruker den») og
      sto igjen etter godkjenning, der den beskrev koblingen godkjenningen
      selv nettopp lagde. Vises nå kun mens søknaden er åpen.
   8. **Lagoversikten hadde ingen cache** — egen lokal state + henting ved
      HVERT fokus, så skeletonene kom tilbake hver gang. Nå på B2-cachen
      (`useTeamMembers`, 5 min) + 60 s-regelen ved fokus.
   9. **Flatenavnet skrevet med tre b-er → «Klubbetalinger»** (tre b-er er
      feil norsk; 13 steder i appen). Docs-sveipen er GJORT i B6
      2026-08-19, og Edge Function-kilden er rettet — men IKKE deployet;
      RPC-teksten venter på fremovermigrasjonen før A3.
   10. **«1 medlemmer»** → entall/flertall. **Invitasjonskoden brøt til to
      linjer** (8 tegn × 6 px sperring) → krymper nå; delingsteksten har
      fått koden på EGEN LINJE. **Begrunnelsesarket i ops-flaten** var
      formet som et bunnark, men fadet inn på stedet — glir nå opp.

   *KØ — avgjort at de IKKE bygges nå (Brage informert):*
   * **Varselet som ikke finnes.** SupportSetup lover «Du får varsel her
     når klubben er klar for støtte» — men `stripe-webhook` oppretter
     INGEN notification når kontoen blir aktiv, og ingen trigger gjør det
     heller. Treneren venter på noe som aldri kommer. Backend-oppgave til
     lanserings-QA, sammen med resten av II.9.
   * **Query-cache på disk** (skeletons ved kaldstart). Krever to pakker
     OG en sikkerhetsbeslutning: query-nøklene er ikke merket med bruker
     (feed.ts sier det rett ut — de er avhengige av `queryClient.clear()`
     ved utlogging). På disk holder ikke det; nøkkelen må scopes per bruker.

   *TIL B6 (profilryddingen) — Brages funn under dogfooden:*
   * **Profil viser ingen steder hvilken e-post du er logget inn med.**
     Smertefullt med flere kontoer, og en forelder som har registrert seg
     med feil adresse kan ikke oppdage det.
   * **Man må kunne forlate et lag selv** (VIKTIG, Brages ord). Kjent hull:
     `remove_team_member` (00041) sier eksplisitt at selvfjerning er «en
     annen flyt, med andre konsekvenser» — aldri bygget. Betalingskoblingen
     er den harde: forlater du et lag du STØTTER, kan vi ikke fortsette å
     trekke deg. Vakter: siste voksen kan ikke gå ut, forelder med flere
     barn har flere rader. AVGJORT samtidig: klubb slettes ALDRI av
     brukere; lag slettes ikke, bortsett fra en snever «opprettet ved en
     feil»-luke (ingen andre medlemmer, aldri godkjent, ingen innlegg).

   *TIL NETTSIDE-PROSJEKTET:* del invitasjonen som **https-LENKE**, ikke
   kode. Et delingsark sender ren tekst — en lenke er det eneste som blir
   blå og trykkbar, og den kan sende folk til App Store hvis de mangler
   appen og fylle koden inn selv hvis de har den (`prefillCode` finnes alt).

   **▶️ REKKEFØLGEN FREMOVER — AVTALT MED BRAGE 2026-08-19.** A1, A2 og A3
   er alle ferdige; app-sporet i autoritetsmodellen er lukket.

   1. **B6 profilryddingen — BYGGET 2026-08-19, VENTER PÅ TELEFONRUNDE.**
      Ren JS: ingen nye pakker, ingen native-endringer, ingen migrasjon,
      ingen deploy. Metro-reload holder. Alt i `ProfilScreen.tsx` +
      `src/lib/appVersion.ts` + `src/shared/appVersion.ts`.
      a) ✅ **E-post mellom navnet og rollebadgen** i profil-toppen —
         `session.user.email` lå alt i `useAuth()`, så ingen nytt kall og
         ingen ny query. Én linje, midt-ellipsis (det er DOMENET som
         avslører feil konto; en vanlig ellipsis spiser nettopp halen).
      b) ✅ **«Bli med i et lag» + «Opprett et nytt lag» flyttet** ned
         under lagkortene i «Dine lag». Guarden `userMemberships.length
         > 0` gjelder nå KUN kortene, ikke seksjonen: handlingene er veien
         INN i et lag og skal ikke kunne forsvinne om `hasTeam`-porten i
         AppNavigator endres. (I dag er Profil uansett bare nåbar med
         minst ett lag.)
      c) ✅ **«Innstillinger» delt i tre blokker**, rekkefølge låst av
         Brage: **Konto** (telefon, varslinger) · **Om Heia** (vilkår,
         personvern, versjon) · en blokk UTEN overskrift helt nederst
         (Logg ut, så Slett konto). «Slett konto» er nå siste rad på hele
         siden. Den umerkede avslutningsblokken er bevisst og prøves på
         telefon — mulig designrunde 2 der.
      d) ✅ **Versjonen leses fra bundelen** — «Om Heia» viser
         «Versjon 1.0 (3)» (`MARKETING_VERSION` + `CURRENT_PROJECT_VERSION`
         står urørt i Xcode; Brages beslutning: IKKE bytt til 0.1.x).
         Byggnummeret er med fordi to TestFlight-bygg deler versjon og
         skilles kun på det.
         **HVORDAN:** `src/lib/appVersion.ts` er en ADAPTER mot
         `RNSentry.fetchNativeRelease()` — en metode Sentry-podden alt har
         kompilert inn, som leser `CFBundleShortVersionString` +
         `CFBundleVersion` rett fra `[NSBundle mainBundle]`. Den rører
         ingen Sentry-tilstand og krever verken `Sentry.init` eller
         SENTRY_DSN, så den svarer også når feilrapporteringen er av.
         Modulen hentes med Sentrys eget mønster (TurboModuleRegistry med
         NativeModules-fallback) fordi bridgeless ikke fyller
         `NativeModules` som før.
         **VRAKET:** `expo-constants` — podden EXConstants er også
         kompilert inn, men v55 gir KUN `platform.ios.buildNumber`, ikke
         markedsføringsversjonen, og pakken ligger nøstet under
         `expo/node_modules/` (ville krevd ny toppnivå-avhengighet for
         halve svaret).
         **KONTRAKTEN:** ukjent versjon → raden forsvinner, ALDRI et gjettet
         tall. Hardkodet «v0.1.0» er nettopp feilen som ble rettet.
         Testet i `__tests__/appVersion.test.ts` (ren formatterer).
      e) ✅ **«Klubbetalinger» konsekvent** (tre b-er er feil norsk):
         docs rettet (PAYMENTS.md, AUTORITET-…, denne fila) og de to
         tekstlinjene i `payments-notify/index.ts`. Appen var alt ren.
         Filnavnet `AUTORITET-KLUBBBETALINGER-2026-08.md` står URØRT —
         etablert teknisk sti, referert fra docs, deployet SQL-kommentar,
         Edge Function og to src-kommentarer.
         ⚠️ **UTESTÅENDE, IKKE ET EGET SPOR:** varselteksten inne i den
         deployede RPC-en (`00062_autoritetsmodell.sql:1947`, arvet fra
         `00047:251`) sier fortsatt tre b-er. Migrasjonen skal IKKE
         redigeres. Rettelsen tas i den lille fremovermigrasjonen som
         uansett må lages før A3, sammen med nominee-feltene i
         Ops-payloaden og manager-navnet i statuspayloaden — og
         `payments-notify` deployes i SAMME skive. Deploy + verifisering
         skjer altså samlet der, ikke her.

   1b. **B6 RUNDE 2 — BYGGET 2026-08-19, VENTER PÅ TELEFONRUNDE.**
      Profilheader, passordbytte, avatar og footer. Fortsatt ren JS: ingen
      nye pakker, ingen native-endringer, ingen migrasjon, ingen deploy.
      **ÉN produksjonsendring utenfor koden:** dashboard-bryteren under.

      a) **Statisk profilheader** (`components/ProfileHeader.tsx`).
         Heias faste `heiaDeep`, IKKE lagfargen — låst beslutning:
         lagfargen i TeamHeader er et SCOPE-signal (alt under den er
         lag-scopet), og Profil er den ene hovedflaten som ikke er det
         («Min støtte» går på tvers av lag, «Klubbetalinger» er en juridisk
         enhet, «Heia Ops» er alle klubber). Dessuten står lagbytteren PÅ
         skjermen: en header som skifter farge når du trykker et lagkort
         under den ville sagt feil ting.
         KONSISTENSEN LIGGER I FORMEN: anatomien er TeamHeaders slot for
         slot (avatar der lagmerket er · navn + e-post der lagnavn +
         «Fotball · 18 medlemmer» er · rollebadge der «Sesongen» er), og
         `ARC_*`-konstantene er flyttet til `shared/headerGeometry.ts` og
         DELES nå av begge (TeamHeader er ellers urørt). Høydene matcher
         ved KONSTRUKSJON: lagmerket er 38 + 2×2 = 42, avataren er `md`
         (40) + 1 px ring = 42. Statisk — ingen kollaps, ingen krysstoning,
         ingen scrollstyrt animasjon (appen har ikke reanimated, og RN-
         kjernens Animated kan ikke animere høyde nativt). `light-content`
         med `useIsFocused()`-vakt som TeamHeader. Den gamle lyse
         profil-toppen og stilene dens er slettet.
      b) **`avatarUrl` koblet på.** Din egen profil var det ENE stedet som
         ignorerte ditt eget bilde (FeedCard, TeamMembers og
         NotificationRow viste det). Opplasting er bevisst IKKE bygget —
         det er en egen skive (bildevelger, komprimering, bucket, egress).
         Frem til da vises initialer, som før.
      c) **«Passord og sikkerhet»** under Konto, mellom Telefonnummer og
         Varslinger (`screens/ChangePasswordScreen.tsx`).
         **GRENSEN LIGGER PÅ SERVEREN.** `changePassword` i UserContext
         sender `current_password` MED i `updateUser`, og GoTrue validerer
         det i samme forespørsel. Vi verifiserer det IKKE selv først: en
         `signInWithPassword`-sjekk i appflyten er en SJEKK, ikke en grense
         (kan omgås av alt som ikke er skjermen), og den ville brent
         `sign_in_sign_ups`-kvoten (30 per 5 min per IP) — et helt lag på
         klubb-wifi kunne blitt sperret ute fordi én forelder gjettet feil.
         **«Glemt nåværende passord?»** gjenbruker recovery (6-sifret
         e-postkode) inline. Uten den var skjermen en blindvei:
         `VerifyEmailScreen` bor KUN i OnboardingStack, så en innlogget
         bruker måtte logget UT for å komme videre.
      d) **Norske auth-feil** (`shared/authErrors.ts`, kode først, så
         tekst). AuthScreen gjorde `setError(e.message)` og sendte engelsk
         Supabase-tekst rett ut i en norsk flyt. Nå ruter AuthScreen,
         VerifyEmailScreen og passordskjermen gjennom mapperen. Dette var
         FORUTSETNINGEN for at «Prevent use of leaked passwords» kan skrus
         på — den avviser med engelsk tekst.
      e) **Footeren komprimert** — tok TO runder på telefon.
         `logo-green.png` er 1080×1080 med ordmerket på 715×370 i midten:
         bare 34 % av høyden er merke, resten er tom luft i rasteret. Siden
         `contain` skalerer HELE kvadratet, tvinger det en stor boks rundt
         et lite merke — 100 → 44 gjorde ordmerket uleselig (15 pt høyt),
         80 var fortsatt bare 27 pt. «Større OG mer kompakt» er UMULIG med
         det assetet. Samme felle står dokumentert i WelcomeIntentScreen.
         LØSNING: ny beskåret **`logo-green-wordmark.png` (@1x/@2x/@3x,
         samme konvensjon som `logo-wordmark.png`)**, generert fra
         alfakanalens bbox. Nå 128×66 = 66 pt ordmerke (2,4× større enn
         opprinnelig) i en LAVERE footer. `logo-wordmark.png` kunne ikke
         brukes: hvit/mint for stadionflaten, usynlig på lys footer.
         ⚠️ Nytt asset = Metro må RESTARTES, ikke bare reloades.

      **⚠️ PRODUKSJONSENDRINGEN (Brage, 2026-08-19): «Require current
      password when updating» = PÅ** (Auth → Sign In / Providers → Email).
      Dashboard-only — CLI-en har INGEN config.toml-nøkkel for den (kun
      `minimum_password_length`, `password_requirements`,
      `password_verification_attempt`, `secure_password_change`). Full
      begrunnelse og felle-notatet står i `supabase/config.toml` ved
      `secure_password_change`. Kort:
      · `secure_password_change` ble stående AV med vilje — den er
        REAUTENTISERING, og GoTrue krever bare nonce når sessionen er eldre
        enn 24 t; ulåst-telefon-scenarioet treffer aldri koden.
      · Glemt-passord er UBERØRT — GoTrue unntar recovery eksplisitt
        (`if !session.IsRecovery()`).
      · Ingen eksisterende kode måtte endres: `supabase.auth.updateUser`
        kalles ETT sted i hele appen, i `confirmPasswordReset`.
      · MOTSATT VEI: endrer du `minimum_password_length` eller
        `secure_password_change` i dashboardet, rulles de stille tilbake av
        neste `supabase config push`. Endre dem i fila.

      **VERIFISERT MOT PROD 2026-08-19 — HELE SJEKKLISTA GRØNN.**
      `scripts/verify-password-change.mjs` kjørt av Brage mot ekte GoTrue:
      uten current_password → `400 current_password_required` · feil
      current_password → `400 current_password_invalid` OG gammelt passord
      virker fortsatt · riktig → byttet · nytt passord logger inn · gammelt
      gjør ikke · recovery sender kode (200) · passordet satt tilbake.
      **Grensen håndheves altså av SERVEREN, ikke av appflyten.**
      I tillegg telefonverifisert: profilheaderen · norsk feil ved feil
      passord · bytte · innlogging med nytt passord.
      GJENSTÅR: kodeinntastingen i recovery (telefon), og punkt 7 —
      kjør skriptet PÅ NYTT etter neste `supabase config push` for å
      bekrefte at dashboard-bryteren står.
      FUNN FRA KJØRINGEN: koden for feil passord er
      `current_password_invalid`. Den lå kun dekket av tekst-fallbacken i
      `shared/authErrors.ts` — nå eksplisitt i kodetabellen (koder er
      stabile, engelske meldingstekster er det ikke).

      **VERIFISERING:** `scripts/verify-password-change.mjs` (rent `node`,
      ingen avhengigheter, leser .env) kjører Brages sjekkliste mot ekte
      GoTrue: uten current_password → avvist · feil current_password →
      avvist OG gammelt passord virker fortsatt · riktig → byttet · nytt
      passord logger inn · gammelt gjør ikke · recovery sender kode. Setter
      passordet tilbake til slutt. **KJØR MED TESTKONTO.** Punkt 7 (config
      push lar bryteren stå) = kjør skriptet PÅ NYTT etter neste push.
      Kodeinntasting i recovery + all flate verifiseres på telefon.

   2. **«FORLAT LAG» + FORELDRELØSE LAG — NESTE SAMTALE (Fable).**
      ÉN skive, ikke to. Nærmere et lanseringskrav enn en forbedring.
      ⚠️ **DETTE ER EN BESLUTNINGSSKIVE, IKKE EN BYGGEOPPGAVE.** Migrasjonen
      er den enkle delen; arbeidet er reglene. Skiva rører PENGER (Stripe),
      RLS og UOPPRETTELIG datatap samtidig, og en feil her er STILLE — den
      viser seg først når en forelder ikke får stoppet trekket sitt, eller
      når et lag er borte. Kartlegg og frys beslutningene FØR bygging, slik
      autoritetsmodellen og passordløsningen ble gjort.
      ⚠️ Bryter «ren JS»-serien fra B6: dette KREVER migrasjon. Den nye
      RPC-en kan med fordel legges i SAMME fremovermigrasjon som allerede
      skal lages før A3 (se «Klubbetalinger»-teksten, nominee-feltene og
      manager-navnet over).

      **PROBLEMET, KONKRET.** I dag er eneste vei ut av et lag å slette hele
      kontoen din. Gjør du det som siste medlem, blir laget liggende igjen
      tomt og usynlig (ingen offentlig lagsøking) med bilder som koster
      lagring for alltid — og invitasjonskoden er eneste nøkkel tilbake.

      **KARTLAGTE FAKTA (verifisert i koden 2026-08-19 — ikke gjett om
      disse på nytt):**
      * `remove_team_member` (00041:274) sier eksplisitt
        `Cannot remove yourself`, og `Team admins cannot be removed`.
        Selvfjerning ble ALDRI bygget. Den setter `status='removed'` +
        `left_at`, og sletter RSVP-er på FREMTIDIGE hendelser (historikken
        består). Fjerner ALLE radene til personen i laget.
      * `memberships` (00007:45): status ∈
        `invited|active|inactive|removed`, rolle ∈
        `trener|lagleder|admin|forelder|spiller`, har `left_at`. Én rad per
        barn — `managed_child_id` NOT NULL ⇒ rolle må være `forelder`.
        En forelder med to barn har derfor TO rader i samme lag.
      * `join_team_space` (00015:143) tar `p_role DEFAULT 'forelder'` og
        godtar `trener`/`admin` — **innløseren velger sin egen rolle**. Et
        forlatt lag overtas i praksis av den som har en gammel kode i en
        meldingstråd. Krever `is_activated = true` og
        `deleted_at IS NULL` på team_spaces (soft-delete finnes altså
        allerede).
      * **KONTOSLETTING HARD-SLETTER medlemskapene**:
        `delete_account_data` (00042:112) gjør
        `DELETE FROM public.memberships WHERE user_id = ...` — ikke
        `status='removed'`, fordi «kontosletting er GDPR, ikke moderasjon».
        Innlegg, kommentarer og kampdata BESTÅR og peker på et anonymt
        «Slettet bruker»-spøkelse. Ingenting rydder team_space-en.
        Det er nøyaktig slik foreldreløse lag oppstår i dag.
      * Kontosletting kansellerer Stripe FØRST (Edge Function
        `delete-account`), så DB-en, så auth-brukeren. Rekkefølgen er
        bevisst: klienten skal aldri kunne tømme databasen mens avtalen
        løper.
      * `support_subscriptions` (00037:307) er bundet til
        **`team_space_id`** (NOT NULL) + `user_id`. Status ∈
        `checkout_pending|incomplete|active|past_due|canceled|abandoned`,
        med `cancel_at`/`current_period_end`. NB (fra B6-runden): en
        OPPSAGT avtale har status `active` ut perioden — statusen alene
        forteller ikke sannheten, `cancel_at` må leses.

      **SPØRSMÅLENE SOM MÅ BESVARES (dette er selve jobben):**
      1. Hva skjer med et AKTIVT abonnement når støttespilleren forlater
         laget? Kanselleres det straks, ved periodeslutt, eller nektes
         utmeldingen til brukeren har sagt opp selv? Vi kan ikke fortsette
         å trekke noen for et lag de har forlatt — og vi kan ikke stoppe
         et trekk uten at det er en bevisst, kommunisert handling.
      2. Hvem er «siste voksen», presist? Rollene `trener|lagleder|admin`
         er lagadmin (`is_team_admin`), men en `forelder` er også en
         voksen. Skal vakten være «siste admin» eller «siste voksen»?
      3. Forelder med flere barn: skal utmelding gjelde ett barn eller
         hele forelderen? (Flere rader, jf. over.)
      4. Skal `status='removed'` brukes, som `remove_team_member`, eller
         hard delete? Konsekvens for historikk, «N kommer»-tellere og
         gjeninntreden med samme kode.
      5. Foreldreløse lag: soft-delete team_space (kolonnen finnes),
         invalidere invitasjonskoden, eller varsle ops? Og hva med
         bildene i `feed-media` — slettes de, og av hva?
      6. Ved KONTOSLETTING (kan ALDRI nektes): er du siste medlem og laget
         aldri har hatt støtte eller innhold → slett laget og bildene;
         ellers varsle ops, som ved managerløse enheter. Trenger presis
         definisjon av «innhold» og hvem som utfører oppryddingen.
      7. Bør `join_team_space` slutte å la innløseren velge `trener`/
         `admin`? Det er overtakelsesvektoren, og den er uavhengig av
         resten av skiva — men den rører onboarding, som er LÅST
         (se onboarding-memoryen), så den må avklares eksplisitt.

   2b. **PROFILBILDE (avatar-opplasting) — ✅ BYGGET 2026-08-19.**
      **Kartleggingen under er HISTORIKK og beholdt fordi funnene
      fortsatt stemmer — men beslutningene er tatt og skiva er bygget:
      se START HER øverst i fila.** Ett forbehold: anbefalingen nederst
      om at hvem-valget avgjør bucket-valget viste seg å IKKE holde
      (en forelders profilbilde er ofte et bilde av barnet), og
      begrunnelsen for privat bucket ble en annen — den står øverst.

      Brages beslutning 2026-08-19: egen jobb, ETTER «forlat lag». Ikke et
      lanseringskrav. Krav fra Brage: **«samme cache-løsning osv. som
      resten av appen»** — og det er nettopp der jobben er større enn den
      ser ut.

      **HVA SOM ALLEREDE FINNES:** `profiles.avatar_url` er i basen,
      `updateProfile({avatarUrl})` skriver den (api/profile.ts:72), og SJU
      flater rendrer den — FeedCard, CommentsScreen, NotificationRow,
      TeamMembersScreen, EventDetail-deltakere, ReporterBar, ReporterSheet.
      Alle viser initialer, fordi ingenting kan SETTE feltet.
      `media.ts:147` har alt en 512×512-plukkesti.

      **⚠️ FUNN 1 — `Avatar` ER UTENFOR MEDIEPIPELINEN.**
      `components/Avatar.tsx:66` bruker RNs vanlige
      `<Image source={{uri}}>` — IKKE `MediaImage`. Den har altså verken
      den 150 MB disk-cachen (`Image.configureCache`, MediaImage.tsx:27)
      eller `cacheKey`-trikset som var HELE løsningen i egress-auditen:
      `source={{uri, cacheKey: path}}` gjør at et ferskt signert token
      fortsatt gir cache-TREFF (roterende `?token=` var rotårsak nr. 1).
      Avataren er dessuten det bildet som gjentas OFTEST i appen — én per
      feed-rad, én per kommentar, én per varsel. Å koble på opplasting uten
      å løse dette er en egress-REGRESJON på appens mest repeterte bilde.

      **⚠️ FUNN 2 — DET FINNES TO PROVDE MØNSTRE, OG VALGET ER EN
      PERSONVERNBESLUTNING, ikke en teknisk:**
      * **Klubblogo-mønsteret** (`club-logos`): bucketen er **PUBLIC**,
        filnavnet immutabelt (`logo-{timestamp}.ext`, så bytte gir ny URL),
        `Cache-Control: 31536000` (1 år) — CDN-en gjør jobben, og vanlig
        `<Image>` holder. Begrunnelsen står i teams.ts:230: «uten den
        revalideres hver logo hver time (F3, hovedkilde til cached
        egress)». ENKELT — men en PUBLIC bucket betyr at bildet er synlig
        for alle med URL-en, for alltid. **Det er et klubbmerke. Et
        avatar av en trettenåring er noe annet.**
      * **Feed-media-mønsteret** (`feed-media`): PRIVAT bucket, signerte
        URL-er, `MediaImage` med `cacheKey: path` + 150 MB disk-cache +
        signerte URL-er i AsyncStorage i 24 t (resolver.ts). Personvern-
        riktig og gjenbruker cachen — MEN `resolver.ts:33` er hardkodet til
        `FEED_MEDIA_BUCKET`, så den må gjøres bucket-bevisst, og `Avatar`
        må rutes gjennom `MediaImage`.

      **ANBEFALING (til diskusjon, ikke låst):** feed-media-mønsteret.
      Bildet er et barn eller en forelder, ikke et klubbmerke, og
      «samme cache som resten av appen» er bokstavelig talt dét mønsteret.
      Prisen er resolver-endringen + at `Avatar` må ta `MediaRef` i stedet
      for `uri` på sju kallsteder.

      **⚠️ ÅPEN PRODUKTBESLUTNING FØR BYGGING:** hvem får laste opp? Dette
      er en app for ungdomslag. Bilder av mindreårige, lastet opp av
      mindreårige, uten moderering, er en annen sak enn foreldre-avatarer.
      Teknisk hindring finnes ikke — valget om hvem funksjonen gjelder for
      må tas først, og det avgjør også bucket-spørsmålet over.

   3. **Cache-persistering** — NESTE SKIVE. Brages beslutning 2026-08-19:
      tas FØR nettsiden, og settes ut til Fable. NB: det finnes INGEN egress-jobb
      (se under) — oppdraget er cache alene.
   4. **Fase B (nettsiden)**, som starter med B4-stackbeslutningen.

   **CACHE-PERSISTERING — OPPDRAGSBESKRIVELSE.** Gevinsten er KUN opplevd
   fart ved kaldstart på de varme skjermene; egress er upåvirket (bildene
   ligger allerede på disk, se under). Omfang: `@tanstack/
   react-query-persist-client` + `@tanstack/query-async-storage-persister`
   (begge ren JS — ingen native, ingen pod install, kun Metro-omstart) ·
   `PersistQueryClientProvider` i App.tsx · lagringsnøkkel som inkluderer
   bruker-id + sletting i `clearLocalCaches` (delt telefon: bruker B skal
   aldri kunne lese bruker A sine lagdata fra disk) · `maxAge` ~24 t.
   **FELLA:** feeden er en `useInfiniteQuery` — uten en grense skrives
   ALLE lastede sider til disk og leses inn igjen ved oppstart. Begrens
   til første side. Betalinger/ops er IKKE i query-cachen (P7-avgrensningen
   i keys.ts), så ingen betalingsdata kan havne på disk — det var den
   farligste delen, og den er allerede eliminert.

   **HVA SOM ALLEREDE PERSISTERES (svar på Brages spørsmål 2026-08-19 —
   «lagres ingenting lokalt?»):** jo, den dyre delen. `expo-image` har en
   **150 MB disk-cache nøklet på storage_path, ikke URL**
   (MediaImage.tsx) — den overlever appdrap, og et ferskt signert token
   gir fortsatt cache-TREFF (roterende `?token=` var rotårsak nr. 1 i
   egress-auditen). De signerte URL-ene lagres i tillegg i AsyncStorage i
   24 t (resolver.ts), og opplastingene setter Cache-Control. Det som IKKE
   persisteres er JSON-radene — og det er riktig prioritering: en feed-side
   er noen kB, ett bilde er hundrevis.

   Deretter:
   så **fase B** (web: invitasjonslanding → flagget PÅ → Klubbetalinger
   /ops på web → full nominasjon-av-annen-dogfood). Stange/Nes-testdata
   ryddes FØRST etter fase B-dogfooden (de er motpart i testene).
   NB: `WEB_INVITE_BASE_URL`-secreten er BEVISST ikke satt —
   invitasjons-e-post er strukturelt av til web-landingen finnes.

   Beslutningsfrys
   + komplett faseplan (A1 backend / A2 app / A3 selvnominasjon-dogfood
   / B web + full dogfood, med verify-scripts, exit-kriterier og
   rollback): `docs/AUTORITET-KLUBBBETALINGER-2026-08.md` + PAYMENTS.md
   §«Autoritetsmodellen v2». Nøkkelavgjørelser: avvik ved aksept →
   `awaiting_review` FØR aktiv rolle (B1); global defaults-rad med ren
   kopi-semantikk + `club_support_defaults` re-scopes til enheten (B2);
   token kun i URL-fragment, generert i payments-notify, reminder
   roterer (B3); ingen rutinemessig ops-e-post på managerinvitasjoner
   (B5); profilrydding ETTER A2, før lanserings-QA (B6). Produksjonsklar
   v1 — rå SQL er aldri normal flyt. Kartleggingen bak ligger i
   chatloggen 2026-08-18.
2. **Nettsiden** (heiaapp.no, eget prosjekt) — fase B av autoritetsskiva
   ER nettsidens første betalingsleveranse (invitasjonslanding →
   Klubbetalinger/rolleadmin → Heia Ops på web); starter når A-fasene
   er ferdige, venter IKKE på live-byttet.
3. **Stripe live-bytte som ALLER SISTE steg** når AS-et er klart
   (sjekkliste i payments-memoryen: live-KYC m/ ledetid, live-nøkler +
   nye webhooks, Apple-konto→AS, vilkår m/ orgnr, én ekte E2E-betaling).

**Hele Fase A (alle 7 punkter) er BYGGET og grønn 2026-08-17** på
Brage-branchen, som 8 commits (A0 + A1–A7, hver skipbar uavhengig — se
`git log`). Suiten er grønn (8 filer, 141 tester), lint ren. Innholdet:

- **A0** — netMetrics + skjermattribusjon + regresjonsvakter +
  auditdokumentene (var bygget 7. aug, nå committet).
- **A1** — `src/lib/media/` (P4): MediaRef-kontrakten (UI ser aldri
  leverandør-URL-er), resolver med signert-URL-cache (TTL 24 t,
  AsyncStorage, 6 t-fornyingsmargin, inflight-dedupe, prefiks-purge),
  `primeMediaUrls` = ÉN signeringsbatch per skjermlast, `MediaImage`
  (innebygd lastemåling + onError-fornying 1/min/path) på alle 6
  bildeflater. Ny vakt: `__tests__/mediaResolver.test.ts`.
- **A2** — pickeren resizer til 2048 px/q0.85 (P2-masteren, låst).
- **A3** — `cacheControl` ved upload: 86400 feed-media / 31536000
  club-logos (P1, kan ikke endres i etterkant).
- **A4** — realtime-hygiene: subscribeToMatch SPLITTET (score vs. bilde,
  gatet på payload-type) + debounce i EventDetail; fokus-gating på
  TeamHome/EventDetail/Inbox; INSERT-gate FØR refetch i
  NotificationsContext; kanal-registry (`src/lib/realtimeChannels.ts`).
- **A5** — `auth.getUser()` fjernet fra alle 9 kallsteder (P5):
  `getUserId()`/`getUserIdOrNull()` i `src/lib/api/authUser.ts` for
  skrivene, id som parameter fra context for lesestiene
  (`getProfile(userId)`, `getUserMemberships(userId)`,
  `getTeamFeed(ts, myId)`); AppState-styrt start/stopAutoRefresh i App.tsx.
- **A6** — livssyklus: `clearLocalCaches()` i account.ts kalles fra selve
  `signOut` i UserContext (WelcomeIntent-lekkasjen tett); deletePost
  invaliderer URL-cachen; TeamContext resyncer memberships ved AppState
  active og purger lag-prefikset ved medlemskapstap.
- **A7** — `scripts/backfill-media-variants.ts` (tørrkjøring default,
  `--apply` for alvor; manifest med original→variant er gitignorert).
  SAFEGUARD står: originalobjektene slettes ALDRI av scriptet.

(Den gamle femtrinnslista over håndgrep er UTFØRT per 2026-08-17 —
se statusblokka øverst. Kun merge → TestFlight → exit-avlesning står
igjen. Fase C er fortsatt terskelstyrt — bygg ingenting.)

Dokumentene: `docs/IMPLEMENTATION_HANDOFF.md` (rekkefølge/safeguard),
`docs/EGRESS-MEDIA-ARKITEKTUR-2026-08.md` (P1–P13 + faseplan).

Kortversjon av funnet: 9,5 GB egress/uke med 78 MB lagret skyldes fire
multiplikatorer (ny signert URL per henting = 100 % cache-miss; 12
MP-originaler uten varianter; realtime→full refetch; alt lastes uansett
scroll). Fase A fjerner de tre første; virtualisering (nr. 4) kommer i B2.
Fristen: mulig HTTP 402 fra 5. sept 2026 — Fase A skal være ute på
TestFlight i god tid før det. Arkitekturplanen er **GODKJENT av Brage
2026-08-07** (med én safeguard: eksisterende kameraoriginaler slettes
IKKE — eksplisitt beslutning før launch).

Redigeringsskiva før den er **GODKJENT OG VERIFISERT PÅ TELEFON av Brage
2026-08-07** («det funker på telefon»), og migrasjon `00057` er i prod.
Skiva er lukket.

Åttepunktslista i bolken under er beholdt som REGRESJONSSJEKK — kjør den
hvis noen rører redigering, varslene eller `shared/eventForm.ts` igjen.
Ingen av punktene fanges av `npx jest`.

✅ **Klokkeslettvelgeren** (hjul i et ark, ren JS) ble bygget rett etter og
er også **godkjent på telefon** — runde 2, etter at rutenettet ble avvist
på enhet. Egen bolk lenger nede.

Kalenderen er ferdig og lukket. Ikke rør den uten grunn — og ruller du
den likevel, les kalenderbolken FØRST.

## ✅ KALENDER-SIDEN FERDIG OG GODKJENT PÅ TELEFON 2026-08-07

**Brage har kjørt hele sluttesten (ti punkter, nederst i bolken) på
enhet. Alt grønt. Skiva er lukket.**

Den tok FEM runder, og de fire første ble avvist PÅ TELEFONEN mens
testene var grønne hele veien. Det er verdt å huske: alt i denne bolken
handler om layout og scroll, og ingenting av det fanges av `npx jest`
eller `eslint`. Rører du kalenderen, må du kjøre den.

Avvisningene, i rekkefølge:
1. Egen sticky-arkitektur → innholdet gled over lagheaderen, datotrykk
   ga hopp, uke/måned-bytte flyttet innholdet, scroll og valgt dato
   slåss.
2. For høy topp, og hopp når historikk ble satt inn over agendaen.
3. Datoraden hoppet opp og ned ved trykk på ulike fortidsdatoer.
4. Tomtilstandsblokka skapte høydeendring og scrollhopp.
5. Fortiden var fortsatt skjult og ble satt inn over agendaen på
   forespørsel — selve mekanikken måtte bort, ikke justeres.

⚠️ **Én ting er bevisst ikke slått på:** `animated: false` i `fulfil()`.
Landingen er nå bevist stabil, så den kan byttes til kontrollert
animasjon når noen vil — det er ett ord. Gjør det som en egen, liten
endring, og kjør sluttesten på nytt etterpå.

### ⛔ Fem ting som IKKE skal gjeninnføres

1. **Ingen navigator som absolutt posisjonert søsken med
   onScroll-drevet transform.** Den var årsaken til at innholdet gled
   opp OVER lagheaderen: baren lå inne i skjermens body og translaterte
   seg ut av den. `TeamHeader` er utenfor scrollflaten; alt annet ligger
   i `ScrollView`-en.
   Sticky gjøres nå med RNs egen `stickyHeaderIndices`, og KUN
   navigatoren (måned/år, «I dag», «Måned», ukeraden) er festet.
   ⚠️ Tre ting holder den riktig, og alle tre er lette å ødelegge:
   - Barnelista er låst til NØYAKTIG tre elementer: tittelblokk,
     navigator, og ETT fragment med alt annet. `ScrollView` kjører
     `React.Children.toArray` og mapper indekser mot resultatet — et
     array ville blitt FLATET UT og flyttet indeks 1. Et fragment
     teller som ett barn uansett hva som ligger i det (verifisert mot
     React 19 i repoet).
   - `STICKY_INDICES` ligger på modulnivå. Et nytt array hver render
     river den native scroll-koblingen ned og opp igjen.
   - Det sticky barnet MÅ være en host-`View` med bakgrunnen i sin egen
     `style`. RN flytter `child.props.style` over på sin wrapper og gir
     barnet `{flex: 1}` — en komponent der ville gitt en gjennomsiktig
     bar med agendaen rullende bak.
   Navigatorens høyde OG dens `layoutY` måles med `onLayout` på det sticky
   barnet (RN kaller den manuelt med wrapperens event). Høyden trekkes fra
   i scroll-regnestykket, ellers lander dagen BAK baren.
   ⚠️ **`layoutY` er festeterskelen, og landingen må klemmes til den.**
   En sticky header står helt stille til `scrollY` når `layoutY`, og
   fester seg først da (`ScrollViewStickyHeader.js`, ikke-invertert gren).
   Lander man under terskelen, henger baren `layoutY − scrollY` piksler
   ned — et forskjellig tall for hver landing. Det var derfor datoraden
   hoppet opp og ned når man trykket på ulike datoer i fortiden (Brage
   2026-08-07): en tidligere dato blir agendaens FØRSTE seksjon, og
   landingen havnet da over terskelen. `Math.max(navTop.current, …)` i
   `fulfil()` gir baren nøyaktig én posisjon for alle programmatiske
   landinger. Ikke fjern den klemmen.
5. **Ingen månedsrutenett som bytter radantall.** `monthGrid` gir
   ALLTID 42 celler = seks uker; kantene fylles med nabomånedens dager,
   dempet. Et rutenett som veksler mellom fem og seks rader endrer høyde
   når man blar, og da hopper alt under — både i månedsarket og i
   `DateField`. Derfor har `DateField` nå ÉN målt høyde i stedet for en
   cache per radantall.
2. **Ingen månedsmatrise som settes inn og fjernes over agendaen.** Fem–
   seks rader som kommer og går endrer høyden på alt under, og hvert
   bytte ga et scrollhopp. Måneden er nå et eget ark
   (`calendar/MonthSheet.tsx`) UTENFOR scrollflaten. Chevronene bytter
   bare arkets egen måned; å åpne, bla og lukke kan ikke røre agendaen.
3. **Ingen effekter som ruller.** Det finnes ÉN funksjon,
   `scrollToDay(key, origin)`, med nøyaktig fire innganger: den ene
   posisjoneringen ved åpning, trykk på en dato (ukerad eller månedsark),
   «I dag», og `focusDate` etter opprettelse. Hele filen har ÉTT
   `scrollTo`-kallested, inne i `fulfil()`. En tilstand som endrer seg —
   valgt dato, uke, prikker, rader, lasting, refresh, historikkvinduet —
   fører ALDRI til scrolling.
4. **Ingen `onScroll`, ingen timeout-fallbacks, ingen etterkorrigering.**
   Valgt dato beregnes først når brukeren har SLUPPET
   (`onScrollEndDrag` / `onMomentumScrollEnd`), og den oppdateringen
   kaller aldri `scrollTo` tilbake. `userDriven`-flagget nullstilles før
   hver programmatisk scroll, så en programmatisk scroll aldri kan leses
   som brukerens egen.
   ⚠️ **Toppen av lista er IKKE «ingen dag».** Over den første
   dagsseksjonen ligger overskriften, navigatoren og historikkraden — godt
   over en skjermhøyde. Lot man valget stå der (fordi ingen seksjon
   matchet), ble synkroniseringen enveis i praksis: ukeraden fulgte med
   nedover, men kom ALDRI tilbake når man scrollet helt opp igjen. Det var
   en ekte feil i piloten (Brage 2026-08-07). Toppen tilhører dagen
   agendaen begynner på — `agendaFrom`.

### ✅ Slik måles landingen (det som gjør at ett kall er nok)

Dagsseksjonene er **direkte barn** av `ScrollView`-ens innholdsbeholder.
Ved en bestilt scroll måles seksjonens ytterste wrapper med
`node.measureLayout(innerView, …)` mot `innerViewRef` — nøyaktig samme
koordinatsystem som `scrollTo` bruker. Målingen skjer i en effekt, altså
etter commit, så tallet er ferskt. Ett kall, `animated: false`, ingen
korrigering etterpå.
⚠️ Dette er RNs eget mønster: `ScrollView.js` gjør
`nodeHandle.measureLayout(this._innerView.nativeInstance, …)` for
tastaturscrolling. Ikke bytt til `onLayout`-offsets for SELVE scrollen —
`onLayout` leveres asynkront, og tallet kan være fra før siste layout.
Offset-kartet fra `onLayout` brukes KUN til å finne øverste synlige dag
etter at brukeren har sluppet, der en frame etterslep er ufarlig.

### ✅ Agendaen inneholder BARE dager med hendelser

⛔ Ingen tomme dagsseksjoner, og ingen «Neste hendelse»-knapp (fjernet
2026-08-07 — neste hendelse ligger allerede i agendaen, og blokken skapte
høydeendring og scrollhopp). Uke- og månedsvelgeren viser alle
kalenderdager; prikkene forteller hvilke som har innhold.

Velger man en tom dato: dagen markeres, agendaen står HELT stille, og en
énlinjes status sier «Ingen hendelser tirsdag 4. august».

⚠️ Statusen har **forhåndsreservert høyde** (`styles.statusRow`, 20 pt)
inne i den sticky navigatoren, og er alltid montert. Navigatorens høyde
kan dermed ikke endre seg — kom og gikk den linja, ville festeterskelen,
alle målte posisjoner og scrollposisjonen flyttet seg.

⚠️ Statusen ligger i sin EGEN tilstand (`emptyNotice`), ikke utledet av
`selected`. `selected` endrer seg mens man scroller, og en utledet status
ville dukket opp og forsvunnet på grunn av scrollposisjonen. Den settes
bare av et datotrykk, og tømmes av et nytt datotrykk, «I dag», eller at
brukeren begynner å DRA (gesten, ikke posisjonen).

### ✅ ÉN sammenhengende kronologisk liste (Brage 2026-08-07)

⛔ **Fortiden skjules ALDRI.** Er det fredag, ligger onsdagens trening
allerede montert over dagens seksjon; man scroller bare opp. Oppover er
tidligere, nedover er senere, datotrykk er en snarvei, «I dag» er en
snarvei tilbake.

⛔ **«Se tidligere hendelser»-knappen er fjernet**, og det samme er
`agendaStart` — mekanikken som skjulte fortiden og satte tidligere rader
inn OVER agendaen i etterkant. Den var en hovedkilde til scrollhopp,
fordi innsetting og posisjonering skjedde i samme øyeblikk.

Det som styrer utsnittet nå er ett tall: `historyDays`, som starter på
30. Vinduet **vokser bare bakover** — når brukeren nærmer seg toppen, og
når noen velger en dato eldre enn vinduet (typisk fra månedsarket). Det
krymper ALDRI, heller ikke på «I dag»: å fjerne rader over synlig
innhold flytter posisjonen like mye som å sette dem inn.

`maintainVisibleContentPosition={{minIndexForVisible: 0}}` holder synlig
innhold i ro når vinduet vokser — iOS kompenserer `contentOffset` med
rammeforskyvningen til første synlige barn
(`RCTScrollViewComponentView.mm`).
⚠️ RNs egen advarsel gjelder: IKKE omorganiser innholdet i denne lista.
Innsetting og fjerning i endene er greit, omstokking er det ikke.

**Åpning:** nøyaktig ÉN posisjonering til dagens seksjon, vaktet av
`didOpen`-refen, etter at seksjonene er montert og målt. Har dagen i dag
ingenting på seg, lander vi på den første dagen som kommer. En `focusDate`
setter `didOpen` selv, så de to aldri kappes om den første scrollen.

Kalender er ellers uendret: agenda + ukerad, delt kalenderspråk.

### Det som er LÅST i denne skiva

- ⛔ **Tiden går ÉN vei nedover skjermen.** Det gamle arkivet lå
  reversert etter det kommende, så tiden først gikk framover og så
  plutselig bakover. `splitByTime` er FJERNET. Agendaen begynner på
  `agendaFrom` (i dag som standard) og er alltid stigende. Historikk
  hentes ved å FLYTTE starten bakover — velg en tidligere dato i uke-
  eller månedsvisningen, eller trykk «Se tidligere hendelser».
- ⛔ **Det finnes bare ETT kampobjekt.** Uendret.
  `__tests__/calendarList.test.ts` vokter det fortsatt.
- ⛔ **Ingen egen «Ny turnering»-rad i «+»-arket.** Turnering er
  allerede tredje chip i skjemaet — ett trykk unna gjennom samme flyt.
- ⛔ **Ingen permanent opprettelsesknapp i Kalender.** Den grønne «+» i
  hovednavigasjonen er den eneste. Unntaket er tom kalender, der
  «Opprett første hendelse» hindrer en blindvei.
- Rollefordelingen er uendret: **Sesong** = sportslig oversikt og
  administrasjon, **Kalender** = kronologisk fasit, **Hjem** =
  redaksjonell oversikt, **Varsler** = hva har skjedd.

### Nye filer

**`src/components/calendar/`** — det DELTE kalenderspråket.
- `DayCell.tsx` — én dagcelle med alle tilstandene (valgt, i dag, helg,
  utenfor rekkevidde, prikker, «+N»). `minHeight`, aldri `height`.
- `MonthGrid.tsx` — månedsrutenettet. Brukes av BÅDE `DateField`
  (`variant="card"`, med grenser og fotnote) og Kalender-fanen
  (`variant="plain"`, fortiden synlig, egen VoiceOver-tekst). Ett bygg,
  to bruksmåter — forskjellen er props.
- `WeekStrip.tsx` — mandag–søndag med sveiping.
- `CalendarNav.tsx` — «August 2026 · I dag · Uke | Måned».

**`src/context/CalendarFocusContext.tsx`** — broen fra Kalender til «+».
⚠️ Verdien ligger i en **ref**, ikke i state, og contextverdien er
stabil. Valgt dato endres mens man scroller; lå den i state, ville hele
fanetreet rendret på nytt for hver dagsseksjon som passerte toppen.

**`src/components/useReducedMotion.ts`** — «reduser bevegelse».

### ⚠️ To fallgruver som ble VERIFISERT mot RN-kilden

1. **`stickyHeaderIndices` er ren JS i RN 0.83.** Den flytter barnets
   `style` over på en wrapper (så et komponent-barn blir gjennomsiktig),
   flater ut arrays i `Children.toArray` (så indeksen peker på feil
   element så snart seksjonene er et array), tvinger
   `removeClippedSubviews: false` på Android, skriver posisjonen inn i
   React-state hvert ~15 ms på Fabric, og legger seg SIST i
   VoiceOver-rekkefølgen. Skal sticky inn senere, må navigatoren være ETT
   direkte barn med deterministisk indeks — og de kostnadene må aksepteres
   bevisst.
2. **Offset-kartet tømmes ALDRI.** Fabric sender bare `onLayout` når
   Yoga har flagget ny layout. En oppfriskning som gir nøyaktig samme
   hendelser gir null events — et tømt kart ville stått tomt for alltid.
   Vi sletter bare dager som ikke lenger finnes.

### Andre beslutninger verdt å kjenne

- **`today` er en TILSTAND**, ikke frosset ved mount (som i `DateField`,
  der det er riktig). Kalender er en fane man legger fra seg — den
  regnes om på fokus OG på `AppState: 'active'`, ellers står gårsdagens
  kamp under «I dag».
- **Prikkene bygges av `busyDaysFromRows(allRows)`** — de SAMME radene
  som agendaen, ikke et nytt `getBusyDays`-kall. ⚠️ Mat den med de
  UFILTRERTE radene: gjør du det med agendaens utsnitt, står hver måned
  før agendaens start uten prikker mens cellene fortsatt er trykkbare.
- **Haptikk er DROPPET.** `Vibration.vibrate()` på iOS er
  `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)` — en ~400 ms
  hørbar alarmbrumming, ikke et tikk. Ekte haptikk krever en native
  modul (og dermed `pod install`). Ikke bygg en shim som later som.
- **`presetDate`** (en `dayKey`) er ny i `NewEventParams`: «+» fra
  Kalender åpner skjemaet i KalenderStack på datoen man ser på. Ligger
  den utenfor det som uansett kan lagres, faller den til i dag.

### ✅ SLUTTEST — kjørt og grønn 2026-08-07

Kjør den på nytt hvis du rører layout eller scroll i Kalender. Ingen av
punktene fanges av `npx jest`.

1. Åpne Kalender — ingenting beveger seg over lagheaderen.
2. Scroll langt ned og tilbake — navigatoren står stabilt.
3. Åpne Kalender og scroll OPPOVER — gårsdagen og resten av uka ligger
   der allerede, uten at man har trykket på noe.
4. Trykk på en TIDLIGERE dato — én kontrollert bevegelse, ingen ekstra
   knapp underveis.
5. «I dag» — uke, valgt dato og agenda tilbake til nå, uten tilbakesprett.
   Gjenta tidligere dato → «I dag» flere ganger.
6. Åpne månedsvisningen — agendaen endrer ikke posisjon.
7. Bla gjennom minst seks måneder, inkludert februar — kalenderens høyde
   er helt stabil.
8. Velg en dato i månedsvisningen — arket lukkes og agendaen ruller
   nøyaktig én gang.
9. Lukk månedsvisningen uten valg — agendaen står på nøyaktig samme sted.
10. Pull-to-refresh — ingen header-, navigator- eller offset-hopp.

### Bevisst utelatt i denne skiva

- **Haptikk.** `Vibration.vibrate()` på iOS er
  `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)` — en ~400 ms
  hørbar alarmbrumming, ikke et tikk. Ekte haptikk krever en native
  modul (og dermed `pod install`). Ikke bygg en shim som later som.
- **Å huske valgt visning** (opprinnelig spesifikasjon §5). Den ble
  meningsløs da Måned ble et ARK i stedet for en modus — det finnes ikke
  lenger en visning å huske. Borte med vilje, ikke glemt.

## ✅ REDIGERING AV ARRANGEMENT — FERDIG OG VERIFISERT PÅ TELEFON 2026-08-07

Skiva er levert i sin helhet: `update_event`-RPC, tosidig
`NewEventScreen`, «Avlys kamp» som statusendring, og vakten mot
historiske arrangementer som 00056 lot stå åpen.

**Brage godkjente omfang og kode, og bekreftet deretter på enhet at det
virker. Skiva er LUKKET** — og den gikk i ÉN runde, i motsetning til
kalenderen som tok fem. Forskjellen var trolig at all logikken lå i rene
funksjoner med tester før noe ble tegnet.

Lista lenger nede står igjen som REGRESJONSSJEKK, ikke som en gjenstående
oppgave.

✅ **Migrasjon `00057` er I PROD** (pushet 2026-08-07, bekreftet med
`supabase migration list`).

### Det som ble bygget

**`supabase/migrations/00057_update_event.sql`** — fem ting:
1. `update_event()` — samme vakt som `create_event` (`is_team_admin`,
   SECURITY DEFINER).
2. `set_match_cancelled()` — «Avlys kamp» / «Sett opp igjen».
3. **Vakten mot historikk** i `notify_event_change()`.
4. Turneringens `end_time` som en varslet endring.
5. Tydeligere pushtekst når en kamp avlyses.

**`src/shared/eventForm.ts`** (ny) — ALL skjemalogikken som rene
funksjoner: prefylling, nyttelast, hva som er endret, og om laget
varsles. Ingen React, ingen Supabase. Det er dette som gjør at
opprettelse og redigering kan dele skjerm uten å dele feil.

**`__tests__/eventForm.test.ts`** — 38 tester, alle grønne. De seks
tilfellene Brage krevde har hver sin beskrivelse. Totalt: **125 grønne**.

**`NewEventScreen`** er tosidig på ÉN parameter: `route.params.eventId`.
Samme felter, samme `DateField`, samme regnestykker — bare prefylt og
med `update_event` i den andre enden.

**`EventDetailScreen`** har fått «Rediger» + «Avlys kamp» rett under
hero-kortet, kun for trener/lagleder/admin, og henter seg nå på nytt ved
FOKUS (modalen lukker seg tilbake hit — med mount-effekten sto den igjen
med gammel dato).

### ⛔ Sju ting som er LÅST i denne skiva

1. **Avlysning er en STATUS, aldri en sletting.** Kampen blir stående i
   kalenderen med «Avlyst»-pill. En forelder som husker at det skulle
   være kamp skal FINNE svaret — en slettet kamp ser ut som en kamp man
   har husket feil. `set_match_cancelled` kan bare gå
   `planlagt → avlyst` og tilbake; en kamp som er i gang eller spilt
   avlyses ikke.
2. **Typen kan ikke endres.** Trening ↔ kamp krever at en
   `match_session` opprettes eller fjernes — det er ikke en rettelse.
   Typevelgeren er byttet ut med en nøytral, låst plate i redigering.
   Samme grunn til at en kamp ikke kan flyttes inn i eller ut av en
   turnering herfra.
3. **`update_event` er en FULL ERSTATNING, ikke en patch.** NULL betyr
   «feltet er tomt», ikke «ikke rør det» — det er den eneste tolkningen
   som lar en trener SLETTE et sted eller en beskjed.
   ⚠️ Konsekvensen: de to feltene skjemaet IKKE viser må sendes med, og
   `shared/eventForm.ts` arver dem:
   - **Sluttid** arves som VARIGHET, ikke som tidspunkt. «18:00–19:30»
     flyttet til kl. 17 blir «17:00–18:30». Sendte vi tidspunktet
     uendret, ville sluttiden havnet FØR starten så snart noen flyttet
     dagen, og DB-kravet `end_time > start_time` hadde brutt.
   - **Oppmøtetid** arves som AVSTAND til starten. «Møt opp 30 min før»
     er det avtalen faktisk sier, og avstanden er aldri negativ — så
     `meeting_time <= start_time` kan ikke brytes av en flytting.
   ⛔ Ingen av dem er gjeninnført som FELT. Beslutningen fra 2026-08-06
   står; dette handler kun om å ikke ØDELEGGE data vi ikke viser.

   ⚠️ **Arven er DEFENSIV, ikke et vern om ekte data — og det er verdt å
   vite før noen bruker tid på den.** Brage bekreftet 2026-08-07 at
   testerne aldri opprettet reelle arrangementer gjennom TestFlight
   1.0 (3), og hans egne gamle testhendelser er det ingen grunn til å
   bevare. Med andre ord: det finnes i praksis INGEN legacy-rader med
   `end_time` eller `meeting_time` å miste.
   Koden blir stående — den er skrevet, testet og gjør `update_event`
   trygg *ved konstruksjon* i stedet for ved antakelser om datagrunnlaget
   — men den er BEVISST ikke et punkt i den manuelle sluttesten. Finner du
   den og lurer på hvorfor ingen har verifisert den mot ekte data: det er
   fordi det ikke finnes ekte data. Ikke bygg ut rundt den.
   (Til orientering, hvis det likevel skulle dukke opp gamle rader:
   TestFlight-bygget hadde varighetschips med **1½ t som standardvalg**,
   så alt laget der ville hatt `end_time`. Oppmøtetid fantes derimot bare
   lokalt 2026-08-06, aldri i noe TestFlight-bygg.)
4. **Turneringens `end_time` er en DATO** (siste dag 23:59), og
   `resolveEndTime` behandler den som det. Turneringen faller ALDRI ned
   i «bevar varigheten»-grenen — da ville en helgecup blitt 38 timer
   lang fra ny startdato i stedet for til og med søndag. Egen test.
5. **Ett arrangement som alt har startet varsler ALDRI.** Vakten ligger i
   `notify_event_change()` — det ene stedet BEGGE triggerne fra 00054 går
   gjennom. Grensen er `now()`, ikke «i dag»: en trening som startet kl.
   12 er historikk kl. 16, selv om datoen er dagens.
   ⚠️ Det er den NYE starttiden som avgjør. Flytter man en utsatt kamp
   fra i går til neste tirsdag, VARSLES laget — arrangementet er
   framtidig etter lagringen. Går flyttingen andre veien (et feilskrevet
   årstall som rettes tilbake), er det stille. Begge retningene har test.
6. **Appen og basen regner ut varslingen med SAMME funksjon-par.**
   `eventIsUpcoming()` er SQL-vaktens tvilling, og den brukes både av
   notatet i skjemaet og av bekreftelsen før en avlysning. Skriver du
   `> Date.now()` et nytt sted, har du laget en andre sannhet.
7. **Beskrivelse varsler fortsatt IKKE** (Brage 2026-08-06), og heller
   ikke hjemme/borte — basen ser ikke den endringen, og skjemaet skal
   ikke love et varsel som ikke kommer. Begge har test.

### Sluttest — MÅ kjøres på telefon

Ingen av punktene fanges av `npx jest`. Bruk to enheter (eller en
lagkamerat) på punkt 1, 4 og 6 — poenget ER hva de ANDRE får. Den som
gjør endringen får aldri varsel om sin egen endring (00054).

1. **Endre dato** på en kommende trening → laget får ÉN push, og raden i
   Varsler sier «14.08. kl. 18:00 → 21.08. kl. 18:00».
2. **Endre tidspunkt** → én push, «18:00 → 17:30» (uten dato, siden
   dagen er den samme).
3. **Endre sted** → én push, «Kunstgresset → Grusbanen».
4. **Endre dato OG sted i samme lagring** → fortsatt ÉN push, med begge
   linjene. (Dette er «én lagring = ett varsel», og det er det som
   lettest ryker.)
5. **Rediger en kamp som ble spilt for noen dager siden** — rett stedet,
   lagre. Ingen push, ingen ny rad i Varsler, hos noen. Skjemaet skal ha
   sagt fra på forhånd: «Dette tidspunktet har vært. Laget får ingen
   varsling.»
6. **Avlys en fremtidig kamp** → ÉN tydelig push («16.08. kl. 12:00 —
   kampen spilles ikke»), kampen står igjen i kalenderen med
   «Avlyst»-pill, og «Sett opp igjen» tar den tilbake.
7. **Rediger en turnering** — flytt startdatoen, lagre, åpne den igjen:
   perioden skal fortsatt være hel, og datolinja skal si «22.–23.
   august». Sjekk også at prikkene i kalenderen dekker BEGGE dagene.
8. Rediger noe uten å endre noe som helst → «Lagre endringer» lukker
   modalen uten push (ingen tom rundtur til serveren).

### Kjent, ikke rørt (bevisst)

- **Hjem oppdaterer seg ikke ved fanebytte.** Redigerer man noe fra
  Hjem → hendelsesside → Rediger, står «Neste hendelse»-kortet igjen med
  gamle verdier til man drar ned. Dette er en EKSISTERENDE egenskap
  (`TeamHomeScreen` laster ved mount + feed-realtime, ikke ved fokus) —
  ikke noe redigering innførte. Kalender og hendelsessiden oppdaterer seg
  begge ved fokus. En focus-refetch på Hjem koster fire nettverkskall per
  fanebytte og kan omstokke feeden under fingeren; det er en egen
  vurdering, ikke en snarvei.
- **Sletting av arrangement** finnes fortsatt ikke. `deleted_at` er der,
  RLS tillater det, ingenting bruker det. Avlysning dekker kampen;
  «trening som ikke blir noe av» er ennå ikke besluttet.
- **En avlyst kamp teller fortsatt som «opptatt dag»** i prikkene
  (`getBusyDays` ser ikke på status). Liten, men ekte.

### Åpne spørsmål til Brage

- **Turneringens sluttdato som varsel** er NYTT i 00057 («siste dag er
  endret: 23.08. → 24.08.»). Det var det eneste datofeltet i appen som
  ikke sa fra. Lett å fjerne igjen — én gren i
  `notify_on_event_updated()` — hvis en forlenget cup-helg heller skal
  være stille.
- **Avlysning av en LIVE kamp** er blokkert. En kamp som brytes i
  regnvær har ingen vei ut i dag utenom «Slutt». Egen sak.

## ✅ KLOKKESLETTVELGER — HJUL I ARK, GODKJENT PÅ TELEFON 2026-08-07

Brage 2026-08-07, rett etter at redigering ble godkjent: klokka på «Ny
hendelse» var fortsatt et maskert `HH:MM`-tekstfelt, mens datoraden rett
over hadde fått en foldbar kalender i Nunito og mint. Feltet var ikke
tregt — det var bart.

**Ren JS. Ingen ny pakke, ingen pod install, ingen rebuild — Metro-reload
holder.**

### ⛔ Runde 1 ble avvist PÅ TELEFONEN, og hvorfor

Første forsøk var et utfoldbart RUTENETT under raden, med samme mekanikk
som `DateField`: 24 timeceller i 4×6 og 12 minuttceller i 2×6. Grønne
tester, riktig mekanikk — og feil produkt. Brages dom: «for mye UI for å
velge ett klokkeslett … mer som et kontrollpanel enn Heia».

⚠️ **Lærdommen er verdt mer enn koden:** at `DateField` folder seg ut i
skjemaet betyr ikke at klokka skal gjøre det samme. En måned ER et
rutenett — 42 celler er datoens naturlige form. Et klokkeslett er ETT
tall, og 36 flater for ett tall er en oppgave, ikke et valg. Ikke
gjeninnfør rutenettet «for konsistens».

### Slik er den nå

**`src/components/TimeField.tsx`** — raden i skjemaet. Speiler
`DateField`s sammendragsrad (brikke, flate, radius, chevron), så dato og
klokkeslett leses som ett par. Trykk åpner arket.

**`src/components/TimeSheet.tsx`** — arket: to hjul (00–23 og :00–:55 i
femminutterssteg), mintbånd i midten, dempede naboer, «Avbryt» og
«Ferdig». Eksisterende klokkeslett står valgt ved åpning.

### ⛔ Fem ting som er LÅST her

1. **Hjulene ligger i et ARK, aldri i skjemaet.** Det er HELE grunnen til
   at de kan være hjul: to vertikale scrollflater rett inne i
   `NewEventScreen`s egen `ScrollView` er nøyaktig den nøstede scrollen
   kalenderskiva brukte fem runder på å bli kvitt. I en modal finnes
   ingen ytre scroll å slåss med.
2. **Flyten er NATIVE, ikke JS — ikke «optimaliser» den.**
   `snapToInterval` + `decelerationRate="fast"` er native
   UIScrollView-egenskaper; både utrullingen og snap-målet regnes ut i
   `scrollViewWillEndDragging:` på native side, samme mekanikk som iOS'
   egen picker. Dimmingen drives av `Animated.event` med
   `useNativeDriver: true`, altså på UI-tråden. Det eneste JS-arbeidet er
   ett `onMomentumScrollEnd` per gest. Skriver noen om dette til en
   `onScroll`-drevet JS-animasjon, ryker hele poenget.
   Presisjonen er eksakt: snap hviler alltid på et multiplum av
   `ITEM_HEIGHT`.
3. **`ScrollView`, ikke `FlatList`.** Med 24 og 12 elementer er
   virtualisering ren overhead, og vindusberegningen kan gi tomme celler
   under en rask fling. (Brage ba om «FlatList/snap-hjul»; avviket er
   bevisst og er kun et bytte av beholder, ikke av mønster.)
4. **Verdiene er TRYKKBARE, ikke bare rullbare.** Uten det var hjulet en
   regresjon for VoiceOver: en scrollflate med ren tekst har ingen mål å
   aktivere, så en skjermleserbruker kunne ikke velge noe som helst —
   rutenettet det erstattet hadde ekte knapper. Trykk ruller til verdien
   og velger den. Alle andre får en snarvei på kjøpet.
5. **Startposisjonen settes med `contentOffset`, ikke `scrollTo`.** iOS
   leser den ved opprettelse, så hjulene REMONTERES per åpning (`mountKey`).
   Et `scrollTo` i en effekt måtte ventet på layout, og det er nettopp den
   timingen som gjør slike velgere flakete.

### Det vi IKKE får, og som du vil merke

- **Ingen haptisk tikk.** iOS' egen picker gir ett hakk per verdi. Ekte
  haptikk krever en native modul, og `Vibration.vibrate()` er på iOS en
  ~400 ms hørbar alarmbrumming — ikke et tikk (låst funn). Hjulet er
  stille. Det er den ENESTE målbare forskjellen mot en systemvelger.
  ⚠️ Er dette utslagsgivende på telefonen, er neste steg
  `@react-native-community/datetimepicker` — men da med ny native
  modul, pod install, full rebuild, og et hjul som verken tar Nunito
  eller mint.
- **`allowFontScaling` er AV på hjultallene.** Snap krever fast radhøyde;
  forstørret skrift ville sprengt raden i stedet for å vokse den.
  Verdiene leses uansett opp av VoiceOver. Resten av appen har Dynamic
  Type på — dette er det ene unntaket, og det er bevisst.

### Ryddet bort samtidig

- `maskTime()` i `shared/eventForm.ts` — FJERNET. Den fantes kun for
  tekstfeltet; en maske uten tastatur er bare kode å vedlikeholde.
- `timeInput`-stilen i `NewEventScreen` — FJERNET. Klokkeslettet eier sin
  egen typografi nå.
- Hele «ugyldig klokkeslett»-tilstanden. Arket kan bare sende verdier som
  finnes. `buildSavePayload` validerer fortsatt, som siste skanse.

### 📱 Kjørt og godkjent på telefon 2026-08-07 — behold som regresjonssjekk

Kjør på nytt hvis noen rører hjulet, arket eller `TimeField`. Ingen av
punktene fanges av `npx jest`.

1. «+» → Ny hendelse → trykk klokkeslettraden → arket glir opp med
   **dagens verdi valgt**, ikke 00:00.
2. Dra begge hjulene raskt → skal snappe rent, uten å stoppe mellom to
   verdier og uten tomme rader underveis.
3. Trykk på en verdi to hakk unna → skal rulle dit og velge den.
4. «Avbryt» → klokkeslettet i skjemaet er uendret.
5. «Ferdig» → raden viser den nye tiden, og lagring bruker den.
6. Rediger et eksisterende arrangement → arket åpner på arrangementets
   egen tid.

⛔ **Avrunding av gamle verdier er IKKE et testpunkt.** Et arrangement
lagret med 18:07 fra det gamle tekstfeltet vises som 18:05 i hjulet, og
`snapMinute()` håndterer det — men Brage har bekreftet at slike verdier
ikke er bevaringsverdige (se den samme avklaringen om `end_time` og
`meeting_time` i redigeringsbolken). Koden blir stående som forsvar, ikke
som noe noen skal verifisere.

## ✅ KALENDERVELGER BYGGET 2026-08-06 (ren JS + én migrasjon)

Brages bestilling: «en ekspanderende kalender som når man bestiller
flybillett eller hotell», ved OPPRETTELSE først.

**Beslutning: EGET BYGG, ikke `react-native-calendars`.** Biblioteket
koster sju nye pakker (`lodash`, `recyclerlistview`, `xdate`,
`prop-types`, `memoize-one`, `hoist-non-react-statics`,
`react-native-swipe-gestures`, ~12,3 MB) i et prosjekt som bevisst har
null avhengigheter, det er uverifisert på RN 0.83.1 + React 19.2 + ny
arkitektur, og temaet rekker uansett ikke til fyll+ramme på valgt dag,
prikker i tre typefarger, Nunito på tallene eller `minHeight`-celler —
vi ville skrevet `dayComponent` selv likevel.
⚠️ **Vippepunktet hvis dette skal opp igjen:** skal Kalender-siden få
agendavisning med uendelig scroll gjennom sesongen, er
`recyclerlistview` plutselig verdt prisen. Velgeren låser oss ikke.

**HOVEDGEVINSTEN: `DAYS_AHEAD = 30` er borte.** Den var en PRODUKT-
grense, ikke en visningsgrense — høstens terminliste kunne ikke legges
inn i august. Nå: 30 dager tilbake, 18 måneder fram.

### Nye filer

**`src/shared/calendar.ts`** — all datomatte som rene funksjoner, null
React og null Supabase. Dette ER «datobiblioteket» vi valgte bort.
⚠️ Alt regnes med `Date`-KONSTRUKTØREN (`new Date(år, mnd, dag + n)`),
aldri med `+ 86 400 000` — millisekundmatte bommer med en time to netter
i året. Måneds- og ukedagsnavn er skrevet ut i stedet for hentet fra
`Intl`, så et rutenett ikke kan bli engelsk der ICU mangler.

**`__tests__/calendar.test.ts` + `calendarList.test.ts` — 87 tester,
alle grønne** (`npx jest`). Dekker skuddår, måneder som starter på
mandag/søndag, års- og månedsskifte, BEGGE sommertidsnettene i 2026
(29. mars = 23 t, 25. oktober = 25 t), uke-for-uke-blaing over dem, at
`dateFromDayKey` avviser 31. februar, og at dagcellens VoiceOver-tekst
ikke sier «i dag» eller «valgt» to ganger. Det er prisen for å eie
datomatten selv — feilene er våre.
⚠️ `__tests__/App.test.tsx` feiler på en GAMMEL jest-konfig
(`@react-navigation/native` leveres som ESM og treffes ikke av presetens
`transformIgnorePatterns`). Den har ingenting med kalenderen å gjøre.

**`src/components/DateField.tsx`** — datoraden + kalenderen.
⚠️ **Selve rutenettet flyttet ut 2026-08-07** til
`components/calendar/MonthGrid.tsx`, som deles med Kalender-fanen. Det
som er IGJEN her er skjemaets: sammendragsraden, grensene og
utfoldingen. Høydemålingen under gjelder fortsatt — `rowCount` regnes nå
med `monthWeeks(...).length` i `DateField` selv.
- Sammendragsrad: datoflis (Nunito) + «Lørdag 8. august» + «om 2 uker».
  Er dagen opptatt står det «· Kamp samme dag» — kollisjonen følger
  valget UT av kalenderen.
- Utfoldingen MÅLER høyden sin (`onLayout` + `Animated` på `height`).
  Ingen faste høyder: rutenettet er fem eller seks uker, og mer med
  forstørret skrift.
  ⚠️ **FELLA — kalenderen kom ikke opp i det hele tatt i første forsøk.**
  Måler man innholdet inne i en beholder som ALT har `height: 0` +
  `overflow: 'hidden'`, svarer `onLayout` med 0. Da blir `outputRange`
  `[0, 0]`, og høyden kan aldri bli noe annet enn null — kalenderen
  rendres, men er null piksler høy for alltid. Den må måles for å vises,
  og vises for å måles.
  **Løsningen:** så lenge en høyde er ukjent rendres kalenderen UTEN
  høydebegrensning — lukket som en usynlig forhåndsmåling utenfor flyten
  (`styles.measuring`: `position: absolute`, `opacity: 0`), åpen rett i
  flyten. Høyden caches PER ANTALL UKER, så en 6-ukers måned ikke blir
  klippet av en høyde målt på en 5-ukers.
  Rører du denne beholderen: pass på at det finnes minst én tilstand der
  innholdet er ubegrenset i høyde, ellers er vi tilbake i null.
- **Trykk på en dag lukker kalenderen** — som i en billettbestilling.
  Derfor ingen «Ferdig»-knapp.
- **INGEN hurtigknapper.** «I dag / I morgen / førstkommende lørdag» ble
  bygget og så FJERNET samme dag (Brage): i dag er alt standardvalget, og
  det aller meste legges lenger fram enn i morgen. De løste et problem
  dagstripa hadde, ikke et kalenderen har. Ikke bygg dem inn igjen uten
  at noen ber om det.
- Prikker i typens farge (blå trening, coral kamp, lilla sosialt, gull
  turnering). ⚠️ Turnering bruker `goldInk`, ikke `gold` — en 5 px prikk
  i #FFC53D forsvinner på hvitt.
- ⚠️ **Ingen røde søndager.** Coral er låst til live-status; helgen
  dempes i ukedagsbokstavene i stedet.

### Endret

**`src/lib/api/events.ts` → `getBusyDays()`** — egen mager spørring (to
kolonner, ingen RSVP-opptelling). Turneringer er MED her, i motsetning
til i kalenderlista: en cup-helg er lagets travleste dag.
⚠️ **Kalenderen venter ALDRI på prikkene** (Brages krav). Feiler kallet,
mangler bare prikkene.

**`src/screens/NewEventScreen.tsx`** — feltrekkefølgen følger nå Brages
hurtigflyt: type → motstander/**tittel** → dato → klokkeslett → sted →
beskjed. Tittelen sto nest sist og er flyttet opp.

**Oppmøtetid og sluttid er HELT UTE av skjemaet.** Utviklingen gikk i tre
steg samme dag: varighetschips → progressive «+ Legg til …»-lenker →
fjernet (Brages beslutning). **Datamodellen er URØRT** — `meeting_time`,
`end_time`, RPC-parameterne og påminnelsen i 00055 står som de var.

⛔ **ÅPEN KONSEKVENS — LES DENNE FØR DU BYGGER REDIGERING.** Ingenting i
appen kan lenger SETTE oppmøtetid eller sluttid. Da er 00053+00055 reelt
mørklagt: påminnelsen vil alltid si «kampen starter om én time», aldri
«oppmøte om én time», fordi `meeting_time` alltid er NULL på nye
arrangementer. Feltene hører hjemme i redigeringsskjermen — det er den
som gjenåpner dem.

⚠️ **SYNLIG FØLGE:** hendelser viser nå «18:00» i stedet for
«18:00–19:30» på `EventCard` (kamper viste aldri sluttid, så det treffer
trening og sosialt). `TeamHomeScreen` har fra før en 2-timers fallback
og tåler det.

## ✅ TURNERINGSFLYTEN BYGGET 2026-08-06 (ren JS, INGEN migrasjon)

Brages rollefordeling, som styrer alt under: **Sesong** er den sportslige
oversikten og administrasjonsflaten. **Kalender** er den kronologiske
fasiten. **Samme objekt vises begge steder.**

### ⛔ REGELEN SOM IKKE MÅ BRYTES

**Det finnes bare ETT kampobjekt.** En kamp i en turnering er en HELT
VANLIG kamp med `parent_event_id` — samme kampmotor, live-rapportering,
score, bilder, kommentarer, resultat og statistikk som alle andre.
Det finnes ingen egen «turneringskamp»-type, og kampen skal ALDRI
dupliseres som en separat kalenderhendelse. Samme objekt vises i
Kalender, Hjem, Varsler og Sesong.
`__tests__/calendarList.test.ts` vokter dette eksplisitt.

### Turneringen er ikke lenger filtrert bort fra Kalender

`getTeamEvents` hadde `.neq('type', 'turnering')`. Den er BORTE.
⚠️ Følgen er at turneringer nå dukker opp overalt der `getTeamEvents`
brukes — derfor hopper `pickNextEvents` i `TeamHomeScreen` eksplisitt
over dem. Legger du til et nytt sted som bruker `getTeamEvents`, ta
stilling til turneringscontaineren.

### Ny `src/shared/calendarList.ts` + 19 tester

Ren grupperingslogikk, ingen React og ingen Supabase.
`buildCalendarRows()` gjør turneringen til ÉN RAD PER DAG den dekker, og
henger dagens kamper under den raden. Kampene plukkes ut av den flate
lista — de er tegnet inni turneringen, ikke i tillegg til den.
⚠️ **Ett bevisst unntak:** en turneringskamp med dato UTENFOR
turneringens periode, eller med slettet turnering, faller tilbake til en
vanlig rad. Bedre en løs kamp enn en usynlig kamp. Testet.
`splitByTime()` deler per DAG, så dag 1 kan ligge i arkivet mens dag 2
fortsatt er kommende.

### Ny `src/components/TournamentDayCard.tsx`

Kompakt turneringsheader («HamKam Cup · Dag 1 av 2» + «14.–16. august»)
med dagens kamper under: tidspunkt, motstander, bane og status. Tom dag
viser «Kampoppsettet er ikke klart ennå». Gullflaten (`sun`/`goldInk`)
er samme turneringsspråk som StatusPill. Et trykk på en kamprad åpner
den VANLIGE kampskjermen.

### Start- og sluttdato på turnering

Type «Turnering» gir to datofelt («Starter»/«Slutter»), begge den nye
`DateField`. Sluttdato står som SAMME dag til noen flytter den, så
endagsturneringen er like rask. Ny `minDate`-prop hindrer at slutt kan
ligge før start; flytter du starten forbi slutten, følger slutten med.
⚠️ **`end_time` på en turnering bærer SLUTTDATOEN (siste dag 23:59),
ikke et klokkeslett.** Derfor viser `EventDetailScreen` perioden i
datolinja i stedet for «09:00–23:59». 23:59 er også det som gjør at en
endagsturnering tilfredsstiller DB-kravet `end_time > start_time`
(00019). Ingen migrasjon trengs.

### Landing etter opprettelse

- fra Sesong → tilbake til Sesong (`goBack` alene)
- fra turneringsside → bli stående på turneringen
- ellers → Kalender, **på hendelsens dato**

Kalenderen tar nå `focusDate` (en `dayKey`, ikke ISO — ISO er UTC og
bommer på kvelden) og ruller til raden ved å måle `onLayout`-posisjonen.
Turnering gir i tillegg bekreftelsen «Turneringen er opprettet» med
navn og periode.
`RootTabParamList.KalenderStack` tar nå `NavigatorScreenParams`, og
modalens parametere er samlet i én `NewEventParams` — den var duplisert
i tre stacker.

### Hjem

`pickNextEvents` hopper over turneringscontaineren. Kampen vises med en
liten **turneringsetikett** i stedet (`NextEventHero.tournamentTitle` →
gull StatusPill med cupens navn). Det er det ENESTE stedet en turnering
nevnes på Hjem — aldri et eget turneringskort i tillegg.

### Kamp lagt til fra turneringsdetaljen

`EventDetailScreen` sender nå `parentFrom`/`parentTo` (ISO) videre.
Kampen ÅPNER på turneringens første dag, og havner datoen utenfor
perioden vises «Utenfor HamKam Cup (14.–16. august). Kampen lagres
likevel.»
⚠️ Dette er en BESKJED, ikke en sperre — Brage skrev «normalt», og en
cup kan bli forlenget. En blokkert lagring ville vært verre.

### Prikkene i datovelgeren

`getBusyDays` markerer nå HELE turneringsperioden, ikke bare første dag.

📱 **TELEFONTEST:** (a) opprett turnering over tre dager fra «+» → se
bekreftelsen → land i Kalender på startdatoen → tre rader med «Dag 1/2/3
av 3» og «Kampoppsettet er ikke klart ennå»; (b) åpne turneringen → «Ny
kamp i turneringen» → datoen skal åpne på cupens første dag; (c) legg
inn to kamper samme dag → de skal samles under ÉN header, og IKKE også
ligge løse i lista; (d) sjekk Hjem: kampen med cupnavnet som gull-pill,
ingen eget turneringskort; (e) sett en kampdato utenfor cupen → beskjed,
men lagring skal virke, og kampen skal da stå som en vanlig rad.

**IKKE bygget (Brages «kan», ikke «skal»):** varsling på turneringsnivå
ved publisert kampoppsett/avlysning. Mål og kamphendelser grupperes
fortsatt per enkeltkamp, som før.
**Neste separate skive (besluttet):** native tidsvelger. Det maskerte
klokkeslettfeltet står som det er i denne leveransen.

**Fortiden er åpen 30 dager tilbake.** Skjermen er allerede rollestyrt
(`isTeamAdmin` i CreateSheet + `is_team_admin` i `create_event`), så
«for trener/lagleder» følger av seg selv. Er starttiden passert, står
det under klokkeslettet at laget ikke får varsling, og lagringen ber om
bekreftelse først.

**Migrasjon `00056` (I PROD, verifisert)** — `notify_on_event_created()`
hopper over arrangementer der `start_time < now()`. Ren
`CREATE OR REPLACE`, ingen skjemaendring, bygger på 00033.
⚠️ Grensen er `now()`, ikke «i dag» — en trening som startet 12:00 er
historikk 16:00. Appen bruker samme test, så bekreftelsen ikke lyver.
Påminnelsen (00055) trengte ingen vakt: vinduet er 50–70 min FØR
ankeret, så fortiden kan aldri treffe det. Verifisert.

📱 **TELEFONTEST:** (a) «+» → Ny hendelse → trykk datoraden → bla til
oktober → legg inn en sesongkamp (dette var UMULIG før); (b) sjekk at
prikker dukker opp på dager laget alt har noe, uten at kalenderen
låser seg mens de lastes; (c) velg en dato forrige uke → se linja under
klokkeslettet → lagre → bekreftelsesdialog → sjekk at ANDRE konto IKKE
får varsel; (d) «+ Legg til sluttid» → skriv 00:30 på en 22:00-hendelse
→ «Slutter dagen etter»; (e) forstørret skrift (Innstillinger →
Tilgjengelighet) → rutenettet skal vokse, ikke klippe.

**Neste ledd i Brages opprinnelige bestilling (IKKE bygget):** samme
kalenderspråk som en VALGBAR VISNING på Kalender-siden. `DateField` er
skrevet for skjemaet; en månedsvisning der vil trenge egen komponent,
men `shared/calendar.ts` dekker matten.

**Bindende rammer (uendret):**
- Designretning A v2 er LÅST. Tokens i `src/theme/tokens.ts` er eneste
  fargekilde. `docs/BRAND_UI.md` er FORELDET og villeder.
- Mint (`#02FFAB`) er handlingsfarge, aldri bakgrunn.
- Faste høyder klipper ved forstørret skrift — bruk `minHeight`.
- ALDRI `tsc` og ALDRI pod install/build i bakgrunnen (se minnene
  `feedback_tsc_workflow`, `feedback_dev_environment`).

## ▶️ UI-LØFT FØR PILOT — SKIVE 1 (FØRSTEGANGSLØPET) BYGGET 2026-08-05

**Brages ramme:** TestFlight i dag er venner og familie, IKKE pilot. Appen
er ikke pilotklar. UI må løftes før ekte lag slippes inn. Ikke behandle
TF-testerne som ekte brukere i prioriteringen.

### ✅ Bygget 2026-08-05 (ALT er ren JS + én migrasjon — Metro-reload holder)

**Ny `src/components/BootScreen.tsx`** erstatter `LoadingScreen` i
AppNavigator. Funnet bak den: `LaunchScreen.storyboard` tegner stadion-
flaten med merket, og `WelcomeIntentScreen` tegner samme stadionflate med
lockupen — men imellom lå en KREMFARGET flate med mint spinner. Oppstarten
blinket altså lyst midt i en mørk sekvens. Nå er ikon → launch screen →
BootScreen → WelcomeIntent én sammenhengende flate; lockupen står på
nøyaktig samme mål (260×134) i BootScreen og WelcomeIntent, så den ikke
flytter seg i overgangen. Pust (opacity 1→0,6) i stedet for spinner.

**Spinner-bytte fjernet i tre skjemaer** (`AuthScreen`, `VerifyEmailScreen`,
`JoinTeamCodeScreen`): alle tre ERSTATTET knappen med en `ActivityIndicator`
mens de jobbet — handlingen du nettopp trykket på forsvant, og alt under
hoppet oppover. `Button` har allerede `loading`; nå brukes den. Ekstra
viktig i VerifyEmail: ved suksess blir skjermen stående til RootNavigator
bytter, så en naken spinner var det siste bildet av registreringen.

**Skjelett på lagoppslaget:** «Finn lag» viser nå et skjelett med SAMME
geometri som lagkortet, så laget glir inn i formen som alt står der.

**Tilgjengelighet på de berørte flatene:** `accessibilityRole`/`-Label`/
`-State` på fane-velgeren, «Glemt passordet?», «Send koden på nytt»,
vilkårslenkene, rollevalget (radiogroup/radio) og feilmeldingene
(`role="alert"` + `liveRegion`).

**Brages to tillegg samme dag:**
- **Laglogo i innmeldingskortet** (migrasjon `00050` — I PROD, verifisert).
  `lookup_invite_code()` returnerte aldri logoen, så invitasjonskortet var
  det ENE stedet i appen der lagmerket ikke kunne vises. Nå returnerer den
  `coalesce(ts.logo_url, c.logo_url)`, og kortet bruker `TeamBadge` med den
  vanlige kjeden laglogo → klubblogo → initialer på lagfarge. Bildet ligger
  i den offentlige `club-logos`-bucketen, så en gjest kan laste det.
  Appen tåler å kjøre uten migrasjonen (`?? null` → initialer).
- **Rollevalget brøt over to linjer** («Supporter» på en tredjedels
  skjermbredde). Tre kort side om side → FULLBREDDE-RADER med radioprikk
  og hake. Løser det permanent og tåler forstørret skrift, der 3-kolonners
  kort uansett ville sprukket. ⚠️ Dette er en synlig designendring — hvis
  Brage vil ha den kompakte 3-kolonners tilbake, si fra.

📱 **TELEFONTEST:** (a) tvangslukk appen → åpne → mørk flate hele veien,
ingen kremblink; (b) logg inn → knappen blir stående og laster; (c) ny
konto → kodeskjermen → «Bekreft» laster i knappen; (d) «Bli med i lag» →
skriv kode → skjelettkort → laget med LOGO (test både et lag med logo og
et uten) → rollevalget som tre rader.

### ✅ Skive 2: VARSLER-SKJERMEN (2026-08-05) — ren JS

Brages observasjon: «Varsler er litt for hvit og kjedelig». Diagnosen var
IKKE manglende farge — `NotificationRow` hadde fargesemantikken fra før.
Tre andre ting:

1. **Leste rader var grå tekst på hvitt** (`title` = `textSecondary` til
   raden var ulest). En innboks du har lest gjennom — altså NORMAL-
   tilstanden — ble en side med grå tekst. Tittelen står nå i
   `textPrimary` alltid; ulest skiller seg på VEKT, flate og prikk.
2. **Ulest-flaten var alltid mint**, uansett hva som hadde skjedd. Et mål,
   en trenerbeskjed og en kommentar fikk samme svake vask. Nå bærer de fire
   semantisk sterke kategoriene sin egen farge (`liveSoft` / `sun` /
   `heiaTint` / `remindSoft`), resten blir stående på mint.
   ⚠️ Dette er KONSISTENS, ikke oppfinnelse: `FeedCard` tegner allerede
   trenerbeskjeder på `sun` + `sunBorder` og feiring på `heiaTint`, og
   `MatchEventRow` gjør det samme. Innboksen var den ene flaten som ikke
   snakket språket. Rør du `UNREAD_SURFACE`, sjekk de to andre først.
3. **Tomtilstanden var en beskjed om ingenting.** Nå viser den de tre
   kategoriikonene i sine egne farger + «Her blir det liv» — den lærer bort
   systemet i stedet for å være blank.

Pluss: ulest-prikken i kategoriens blekk (`CATEGORY_INK`), ærlig undertekst
(«Du er oppdatert» når alt er lest — sto før «Alt du har gått glipp av»
uansett), og a11y på radene + «Merk alle som lest».

**IKKE gjort — krever DB-arbeid:** innholdsforhåndsvisning i radene
(stilling på målvarsel, miniatyrbilde på bildepost). `HeiaNotification`
har kun `title`/`body`/`category`; det finnes ingen thumbnail eller score
å vise. Egen skive hvis det ønskes.

### ✅ Skive 3: VARSLER REDESIGNET TIL «LAGETS PULS» (2026-08-05)

Brages brief: Varsler skal være **endringsloggen med følelser**. Rolle-
fordelingen mellom de tre hovedskjermene er nå LÅST:
- **Hjem** = den redaksjonelle oversikten (hva er viktigst nå?)
- **Kalender** = den kronologiske fasiten (når og hvor?)
- **Varsler** = hva har faktisk skjedd/endret seg siden sist?

⚠️ **Varsler skal ALDRI vise et kalenderkort bare fordi en kamp finnes.**
Den skal vise ÅRSAKEN til varselet. Og kampen er ETT objekt som beveger
seg kommende → live → ferdig — den blir aldri flere kort.

**Migrasjon `00051` (I PROD, verifisert):** `notifications.data` bærer nå
kampkontekst (`match_session_id`, `match_event_type`, `minute`, `team_side`,
`home_score`, `away_score`, `opponent`) og aktør (`actor_id`, `actor_name`,
`actor_avatar`). Kun `CREATE OR REPLACE` av `notify_on_feed_post` (basert på
00049), `notify_on_reaction` + `notify_on_comment` (basert på 00026) — ingen
skjemaendring. Gamle varsler mangler feltene og faller pent tilbake.
NB: aktøren er DENORMALISERT fordi `data` er jsonb uten FK — PostgREST kan
ikke joine profiles fra klienten. `title` gjorde allerede det samme (00026).

**Ny `src/components/MatchPulseCard.tsx` — ÉN kamp, tre tilstander:**
`goal` (nyeste ULESTE er vårt mål → utvidet kort, stor mint score, sprett +
feiringsvask på montering), `live` (kompakt stripe, ~1/4 av Hjem-kortet:
LIVE-merke, nåværende minutt, stilling, antall nye), `result` (SEIER! /
UAVGJORT / FULL TID — varmt også ved tap). Har tidslinje (maks 3 hendelser)
når kampen har flere. **Ikke** laglogoer, **ikke** «Følg kampen»-knapp,
**ikke** lagoppstilling — det er Hjems rolle.
⚠️ `liveMinute` sendes SEPARAT: varselet bærer minuttet hendelsen skjedde i,
ikke kampens nåværende minutt. En live-stripe på «28′» mens kampen er på 41
er feil.

**Kamptekstene komponeres i appen fra stillingen** («tar ledelsen» /
«utligner» / «reduserer»), ikke fra den forhåndsbygde strengen i basen.
`stripLeadingGlyph()` fjerner ⚽/⏸/🏁 ved visning — raden har alt et ikon.
⚠️ Selve strengen i `report_match_event` (00020) er UENDRET, fordi den deles
med feeden og push-varselet. Emojien lever videre der. Egen beslutning.

**`NotificationRow` — to ting fra forrige runde er RULLET TILBAKE** etter
Brages retning: (a) kategorifargede RADFLATER er borte — raden er nøytral,
kategorien bæres kun av ikon-chipen; (b) kategorifargede ulest-prikker er
borte — én konsekvent mint markering (prikk + svak mintflate + tyngre
tittel). Pluss: avatar der handlingen kom fra et menneske, og typografisk
hierarki (tittel 15,5/600, ulest 800 — vekt, ikke størrelse, ellers hopper
raden når den markeres som lest; body 13,5; tid 11,5).

**`InboxScreen`:** grupperer på `match.sessionId`, løfter den pågående
kampen ØVERST og ut av bolkene, bolker på **Nå / I dag / Tidligere**,
undertekst «12 nye fra Stange G10». Live-stripa vises også når alle
kamphendelser er lest (syntetisk item fra `getLiveMatch`).

📱 **TEST:** (a) uten live kamp — lista skal være rolig og lesbar;
(b) start en kamp fra simulatoren → live-stripe øverst; (c) rapporter et
mål for oss → utvidet målkort med sprett; (d) rapporter 2–3 hendelser →
de skal bli ÉN kamp med tidslinje, ikke tre rader; (e) kommenter fra den
andre kontoen → avatar i raden (krever at kontoen har profilbilde).

**⛔ IKKE BYGGET — data finnes ikke:** «Kampen starter om én time»,
«Tidspunktet er endret fra 18:00 til 18:30», «Ny bane: Bane 2», «Oppmøte
flyttet», «Kampen er utsatt». `trg_notify_on_event_created` fyrer KUN
`AFTER INSERT` på `events` (00023) — det finnes ingen endringstrigger og
ingen planlagt påminnelse i produktet. Se «SKIVE B» under.
Bonus-funn: «Hendelse» i varseltekster er fallback-tittelen for
hendelsestypen `annet` (`NewEventScreen.tsx:107`), som havner rett i
`notify_on_event_created`-bodyen. «TV» finnes ikke som generert streng —
det er trolig et arrangement noen faktisk har opprettet med det navnet.

### 🐛 KRITISK FEIL FUNNET OG FIKSET 2026-08-06 — grupperingen virket ikke

Brage så at kampvarslene FORTSATT lå som separate rader. Det var en ekte
feil, ikke gamle data: `match_events.type` har **ÅTTE** verdier (CHECK i
00009: `avspark, mål, pause, andre_omgang, slutt, bytte, kort, melding`),
og filteret som gir et varsel kampkontekst listet bare **fire**. «Kampen er
i gang» (`avspark`) og «Andre omgang» (`andre_omgang`) mistet dermed
konteksten og falt ut av grupperingen.

⚠️ **Rør du `MATCH_EVENT_TYPES` i `src/shared/inbox.ts`, må lista speile
CHECK-en i 00009 fullstendig.** Testen under vokter dette.

**Ny arkitektur som følge av fiksen:** innboksens RENE logikk er flyttet ut
av `lib/api/notifications.ts` (som ikke kan lastes uten Supabase-klient) til
**`src/shared/inbox.ts`** — modell, mapping og gruppering som rene
funksjoner. API-modulen re-eksporterer typene, så ingen importer knakk.
Kampens SPRÅK bor i **`src/shared/matchCopy.ts`** (samme tekst i kort og rad).

**`__tests__/inbox.test.ts` — 10 tester, alle grønne** (`npx jest
__tests__/inbox.test.ts`). De kjører den EKTE grupperingen mot rader bygget
nøyaktig slik 00051 skriver dem, gjennom hele forløpet avspark → mål →
pause → andre omgang → mål → slutt. Verifisert at testen FANGER
regresjonen: med den gamle firelista ryker 4 av 10.
NB: `__tests__/App.test.tsx` (RN-malens egen) feiler på transform-config —
den er urørt og feilet fra før.

**Migrasjon `00052` (I PROD):** menneskelig ordlyd på kommentar/👏.
«Brage heiet på «Hei»» → tittel «Brage heiet på innlegget ditt» + body
«Hei» som innholdsutdrag. Nye hjelpefunksjoner `post_kind()` (hva slags
post, uten sitat) og `post_excerpt()` (sitert utdrag, NULL når det ikke
finnes noe å sitere — raden skjuler da linja). Gevinsten treffer også push.
`post_ref()` beholdes, men brukes ikke lenger av de to triggerne.

**Visuell gjennomgang av alle fire tilstander (Nunito inlinet, ekte tokens):**
https://claude.ai/code/artifact/371d8553-6f90-480d-a153-b6270723b212

### 🐛 RUNDE 2 (2026-08-06, Brages telefontest): kortet klappet sammen

Grupperingen VIRKET (skjermbilde bekreftet: ett kort, tidslinje, 7–4), men
Brage så at kortet falt tilbake til den kompakte stripa — og mistet
tidslinja — i det MOTSTANDEREN scoret eller det ble pause.

**Årsak:** «utvidet» var knyttet til `isOurGoal` (vårt mål + ulest). Alt
annet traff `variant = 'live'`, som skjuler tidslinja. Kortet krympet altså
akkurat når det var mest å fortelle.

**Brages regel erstatter min (LÅST):** kortet er **utvidet så lenge noe er
ULEST**, og faller til kompakt stripe når alt er lest. Størrelsen er
frikoblet fra hvem som scoret. `MÅÅÅL!` + sprett + mint-vask er nå TONE, og
gjelder fortsatt kun eget mål — motstanderens mål får samme plass, men
ingen jubel.

Følgeendringer i `MatchPulseCard`:
- Sammendragslinja viser nå ALLTID nyeste hendelse («Oslo utligner»,
  «Pause»), ikke bare «lagnavn stilling lagnavn» når det ikke var vårt mål.
- Tidslinja: 3 → **5** rader, så pause/andre omgang/motstandermål får plass.
- Tomme tidslinjerader filtreres bort (Brage så en rad med bare «4′»).
  ⚠️ ÅRSAKEN TIL DEN TOMME RADEN ER IKKE FUNNET — kun `melding` uten
  beskrivelse kan gi tom tekst i koden, og den skal ikke kunne oppstå via
  `report_match_event`. Vakten skjuler symptomet; spør Brage hva som ble
  rapportert på 4′ hvis det dukker opp igjen.
- Kompakt-stripa brukes nå også for FERDIG kamp som er lest (resultat-
  etikett i stedet for LIVE-merke).
- CTA ved live: «Se kampen ›» — IKKE «Følg kampen», som er Hjems knapp.

Testene utvidet til **15** (`npx jest __tests__/inbox.test.ts`), med egne
tester for motstandermål, pause/andre omgang og «ingen hendelse gir tom
tekst».

**RUNDE 3 — måltekst (Brage 2026-08-06):** «2–1 → 3–1» ga «Ridabu tar
ledelsen». Feil: ledelsen ble ØKT, ikke tatt. Stillingen ETTER målet er
ikke nok — man må vite stillingen FØR. Den finnes ikke i varselet, men er
utledbar: målscoreren hadde nøyaktig ett mål mindre. `goalLine()` i
`shared/matchCopy.ts` regner nå ut `leadBefore`/`leadAfter` sett fra
målscorerens side:
| Etter | Før | Tekst |
|---|---|---|
| ledelse | ledet alt | «X øker ledelsen» |
| ledelse | ledet ikke | «X tar ledelsen» |
| likt | — | «X utligner» |
| bakpå | — | «X reduserer» |
Uten `team_side` (skal ikke skje etter 00020) sier den «Nytt mål» —
å tilskrive feil lag er verre enn å si det nøkternt.

**Fortsatt uavklart / bevisst valg:** kommentarer og 👏 på en kampost er
`new_comment`/`new_reaction` — de blir egne rader, ikke linjer i
kamptidslinja. Kamptidslinja er kampens EGNE hendelser. Brage har spurt om
dette; ikke besluttet.

**Brages ønske notert (egen, senere skive):** stadionspråket fra
MatchPulseCard bør trekkes inn i **kampsiden (`EventDetailScreen`)** når den
skal friskes opp. Ikke bygget.

⏳ **VARSLER ER IKKE ENDELIG GODKJENT.** Brage må kjøre ÉN helt ny kamp på
telefonen (start → mål → ny hendelse → avslutt) og se at det forblir ett
kort hele veien. Kampvarsler fra FØR 00051 mangler kontekst og vises
fortsatt som løse rader — det er tilsiktet, så en ny kamp er riktig test.

### ✅ SKIVE B BYGGET 2026-08-06 — endringsvarsler + oppmøtepåminnelse

Brages spesifikasjon er gjennomført. Tre migrasjoner, alle **I PROD**.

**`00053` — oppmøtetid.** FUNN: feltet fantes ikke. `events` hadde bare
start/end. Ny frivillig kolonne `meeting_time` + CHECK (<= start_time),
`create_event` utvidet med `p_meeting_time` (lagt SIST med DEFAULT NULL, så
TestFlight-bygg som ikke sender feltet virker uendret). Felt lagt i
NewEventScreen med samme maske som klokkeslettet.

**`00054` — endringsvarsler.** Varsler ved: dato, starttid, oppmøtetid,
sted, tittel (trigger på `events`) + motstander, avlysning, gjenåpning
(trigger på `match_sessions`). **Beskrivelse varsler IKKE** (Brages valg).
⚠️ «ÉN LAGRING = ETT VARSEL» var det vanskelige: tid/sted bor i `events`,
motstander/avlysning i `match_sessions` — to triggere. Begge går derfor
gjennom `notify_event_change()`, som SLÅR SAMMEN mot et eksisterende ulest
endringsvarsel for samme arrangement (< 10 min) og lar nyeste verdi vinne
per felt. Endringene ligger som `data.changes = [{field,label,old,new}]`,
så raden kan tegne «17:30 → 17:00». Den som gjorde endringen får ikke
varsel om sin egen endring.

**`00055` — planlagt påminnelse.** `pg_cron` LOT SEG AKTIVERE i migrasjon
(var ikke på fra før). Jobb `heia-event-reminders` kjører `*/10 * * * *`.
Ankeret er `coalesce(meeting_time, start_time)` — ETT anker gjør det
umulig å sende begge, slik Brage krevde. Tekst: «— oppmøte om én time»
når oppmøtetid finnes, ellers «— kampen starter om én time» / «starter om
én time». Vindu 50–70 min før ankeret; idempotent uten skjemaendring ved å
sjekke om et varsel med `data->>'kind' = 'reminder'` alt finnes. Avlyste
kamper minner ikke om oppmøte.

**App-siden:** `NotificationRow` tegner nå endringer som «gammel → ny»
(gammel gjennomstreket og dempet, ny i vekt), med eget klokke-ikon på
solflate så en endring ikke forveksles med et nytt arrangement. Maks to
felt vises, resten telles.

**Live-minuttet TIKKER nå.** Det var regnet ut én gang ved render, så
stripa frøs på minuttet skjermen ble åpnet. Egen `nowTick` oppdaterer hvert
20. sekund — kun mens en kamp faktisk pågår. Hendelseskortet viser
fortsatt hendelsens EGET minutt (`match.minute`), som er riktig.

**Bevegelse:** myk innlasting via `LayoutAnimation` ved OPPDATERING (ikke
førstegangslasting — der ville den bare føltes treg), og kontrollert
overgang når en rad markeres som lest (mintflaten toner ut over 320 ms,
prikken fader). `useNativeDriver: false` er påkrevd — backgroundColor er
JS-drevet.

**LÅST (Brage):** kommentarer og reaksjoner er SOSIALE varsler. De skal
aldri inn i kamptidslinja eller telle i «N nye hendelser». Låst med to
tester — inkludert tilfellet der et sosialt varsel bærer samme `event_id`
som en kamphendelse.

**Tester: 20 grønne** (`npx jest __tests__/inbox.test.ts`).

✅ **LØST 2026-08-07 (var: «BLOKKERER TESTINGEN — appen kan ikke redigere
et arrangement»).** Redigeringsskiva er bygget nøyaktig som den minste
versjonen beskrev: tosidig `NewEventScreen`, `update_event`-RPC med
`is_team_admin`-vakt, og «Avlys kamp» i EventDetail. Se bolken
«REDIGERING AV ARRANGEMENT» øverst. Endringsvarslene fra 00054 kan
dermed endelig testes fra telefonen — 00057 er i prod.

### 📋 STØTTEVARSLER — DOKUMENTERT, IKKE IMPLEMENTERT

Brage 2026-08-06: støttevarsler blokkerer ikke leveransen; vent til
betaling er live. Planlagte typer når den tid kommer (alle som
`data.kind` på kategori `system` eller ny kategori `support`):
- `support_thanks` — «Takk for at du støtter {lag}» ved første trekk
- `support_renewed` — «Månedens støtte til {lag} er registrert»
- `support_milestone` — «{lag} har nå {n} støttespillere» (kun ekte
  milepæler: 10/25/50/100 — ellers blir det mersalg)
- `support_failed` — trekket gikk ikke gjennom (dette er det ENESTE som
  bør pushe aggressivt; resten er varme, ikke krav)
⚠️ Skal brukes SPARSOMT. Kilde: `stripe-webhook` + `support_subscriptions`.

### 📋 SKIVE B (OPPRINNELIG FORSLAG — NÅ GJENNOMFØRT, se over)

For at Varsler skal bli en ekte endringslogg mangler en `AFTER UPDATE`-
trigger på `events` som sammenligner OLD/NEW og skriver varselet med
FORSKJELLEN (`changed_field`, `old_value`, `new_value` i `data`), slik at
raden kan si «Oppmøte flyttet 18:00 → 18:30» i stedet for å gjenta hele
arrangementet. ⚠️ KREVER BRAGES BESLUTNING FØRST, fordi den sender push
til hele laget hver gang en trener retter et arrangement:
1. Hvilke felt utløser varsel? (foreslått: `start_time`, `location`,
   `title`, avlysning — IKKE `description`)
2. Debounce? En trener som retter tre felt etter hverandre bør gi ÉN push,
   ikke tre. (Foreslått: slå sammen mot uleste varsler for samme event,
   samme idiom som `notify_on_reaction` allerede bruker.)
3. «Starter om én time» krever pg_cron eller en scheduled function —
   egen vurdering, ikke samme skive.

### 🔌 PLUGIN-BESLUTNING 2026-08-05: `frontend-design` BRUKES IKKE

Brage spurte om Anthropics `frontend-design`-plugin. Undersøkt grundig
(lastet ned og lest hele SKILL.md fra `anthropics/claude-plugins-public`).
**Konklusjon: nei.** Ikke fordi den er dårlig, men fordi den løser feil
problem for Heia:
- Kjernen er å ETABLERE en distinkt visuell identitet fra bunnen (palett,
  skriftparing, «signature element», «ta en estetisk risiko»). Heia har
  låst retning fra 2026-07-30. Skillen optimaliserer for å være distinkt;
  Heia trenger å være konsistent.
- Den er web-orientert i det konkrete: «for web designs, the hero is a
  thesis», CSS-selektor-spesifisitet, hover-mikrointeraksjoner. Ingenting
  av det finnes i React Native.
- ⚠️ Reell kollisjon: skillen lister «a warm cream background (near
  #F4F1EA)» som AI-default den advarer mot. Heias `background` er
  `#F6F8F0` — et LÅST valg. En økt som laster skillen uten den låste
  konteksten kan argumentere kremen bort.
- Markedsplassen har 278 plugins; eneste RN-relaterte er `expo`, og Heia
  er bare RN 0.83.1 uten Expo (verifisert i package.json). Det finnes
  INGEN design-system-håndhevelse for React Native der.

Skrive-/selvkritikk-delen av skillen er god og plattformuavhengig («hvert
element gjør én jobb», «bruk dristigheten ett sted», «en tom skjerm er en
invitasjon») — den brukes direkte i arbeidet uten å installere noe.

**Det som faktisk sikrer konsistens** (Brages opprinnelige spørsmål):
riktig `BRAND_UI.md` + tokens + delte komponenter + ev. en ESLint-regel mot
rå hex i `src/screens/`. Målt 2026-08-05: **13 rå hex-verdier i skjermer**,
der `#FFF4D6`/`#8A6D1A` er kopiert inn i TRE filer (OpsClaims,
ClubPayments, SupportSetup) — et utokenisert «venter»-par. Foreslått, ikke
godkjent: egen prosjekt-skill i `.claude/skills/` som koder den låste
retningen + RN-spesifikkene, så hver ny økt laster den automatisk.

### Gjenstår på UI-lista (målt i koden 2026-08-05)

| Funn | Tall ved måling | Status |
|---|---|---|
| Trykkbare elementer | 72 | — |
| …med `accessibilityLabel` | 21 | +14 i skive 1 |
| …med `accessibilityRole` | 20 | +16 i skive 1 |
| Rå `ActivityIndicator` | 12 i 6 filer | **kun `MatchPhotoSheet` igjen** |

**1. ✅ Førstegangsløpet — TATT** (se over).

**2. ⚠️ RETTELSE AV MÅLINGEN: «`allowFontScaling` = 0» betyr det MOTSATTE
av det som sto her.** I React Native er `allowFontScaling` default **true**
på `Text`/`TextInput`. Null treff = ingen har skrudd den AV = Dynamic Type
er PÅ i hele appen. Verifisert: ingen `Text.defaultProps`-override finnes.
Påstanden «hos dem ser appen lik ut uansett innstilling» var altså feil.
Den EKTE risikoen er omvendt: teksten vokser, men containere med FAST
høyde klipper den — `Button` (48/56), tab-baren (88), `ListRow` (64),
+-knappen (46), logoen (260×134). Riktig tiltak er derfor `minHeight`
i stedet for `height` + `maxFontSizeMultiplier` på trange etiketter,
IKKE å strø `allowFontScaling` utover koden. Test: Innstillinger →
Tilgjengelighet → Skjerm og tekststørrelse → større tekst.

**3. Tegn-glyfer igjen:** `⚽`, `↔`, `🟨` hardkodet i `MatchPhotoSheet.tsx`
blant Lucide-ikonene — samme fil som den siste rå spinneren. Ta dem samlet.

**4. `docs/BRAND_UI.md` beskriver systemet FØR A v2** — slettet `Chip`,
«Unicode-symboler» som ikonstil, 5-tab med «Meldinger». Den villeder aktivt
hver nye samtale. Billig å fikse, beskytter alt som bygges etterpå.

**5. Haptikk** (mål/Heia/start-slutt) krever native modul → ta den ved neste
rebuild uansett årsak. **6. Mørk modus** er aldri låst skriftlig som «nei i
v1». **7. Delbart invitasjonskort** står som idé, ikke lovet.

⚠️ **Brage har flagget ting muntlig som kanskje ikke står skrevet ned noe
sted.** Spurt 2026-08-05, ikke besvart ennå — spør igjen før dere
prioriterer resten. Ikke anta at listene er komplette.

**Rekkefølgen (skive 1 + 2 er tatt):** ~~førstegangsløpet~~ →
~~Varsler-skjermen~~ → **PROFIL-OMSTRUKTURERINGEN er neste** (analysert og
godkjent i prinsippet 2026-08-05, ikke bygget) → faste høyder/Dynamic Type
+ resten av a11y → BRAND_UI til A v2 → MatchPhotoSheet (siste spinner +
glyfene).

**PROFIL — analysert 2026-08-05, klar til bygging.** Ett kort holder NI
rader fra fire urelaterte kategorier (`ProfilScreen.tsx` linje 543–646):
konto (telefon, varslinger), lag-handlinger (bli med, opprett), farlig
(logg ut, slett konto) og juridisk (vilkår, personvern, om). «Slett konto»
har samme grå ikon og vekt som «Vilkår for bruk». Avtalt retning:
- Undersider i `ProfilStack` (som alt finnes): **«Konto og innstillinger»**
  (telefon, varslinger, logg ut, slett konto) + **«Om Heia»** (vilkår,
  personvern, versjon).
- «Bli med i et lag» / «Opprett et nytt lag» flyttes til *Dine lag* — det
  er lag-handlinger, ikke innstillinger.
- **Logg ut skal bekrefte.** `handleSignOut` (linje 218) kjører i dag rett
  igjennom. Ingen biometrisk/lagret innlogging finnes, så et feiltrykk
  koster e-post + passord på nytt.
- **Slett konto ett nivå ned — men IKKE begravet.** Apple 5.1.1(v) krever
  at den er lett å finne; App Review avviser apper som graver den ned. Ett
  tydelig nivå under «Konto» er vanlig praksis og går fint. ⚠️ Inngangen
  fra `WelcomeIntentScreen` MÅ bestå — det er den lagløse reviewer-kontoen
  som treffer den.

**NB om nettsiden:** heiaapp.no-markedssiden er et EGET prosjekt som er
LÅST til å starte etter Stripe-sporet (se minnet `website_project` og
`docs/HEIAAPP-NO.md`). Den er ikke glemt, men den er heller ikke neste.

## 🎨 LAGHEADEREN BYGGET OM (2026-08-05) — ren JS, ingen rebuild

Headeren på Hjem/Kalender/Varsler er nå én lagfarget toppflate. Alt ligger i
`src/components/TeamHeader.tsx` + `src/shared/teamColors.ts`.

**Fire ting som er verdt å vite før noen rører den igjen:**

1. **Hjem hadde headeren INNE i sin ScrollView** — derfor scrollet den bort.
   Nå er alle tre fanene like: `<View style={screen}>` → `<TeamHeader />` →
   `<ScrollView>`. Headeren kan ikke krympe fordi den ikke er i scrollflaten.
2. **`teamHeaderSurface()` er kontraktsmotoren.** Den returnerer venstre/midt/
   høyre-farge + tekstfarge, og GARANTERER 4.5:1 (WCAG AA) på lagnavnet for
   alle lagfarger — også nye. Gradienten: lagets faktiske farge flat gjennom
   logo/navn (0–18 %), 18 % dypere ved 55 %, og 32 % mørkere + 22 % mot
   `#143126` (Heias teal) ved høyre kant. **Ikke mint i bakgrunnen** — mint er
   handlingsfarge. Kontrasten måles der teksten faktisk står (`TEXT_REACH`),
   ikke ute i kanten bak «Sesongen»-chipen.
   Målt: svakeste navnekontrast 4,60:1. 9 av 12 lagfarger brukes uendret;
   Oransje/Lyseblå/Indigo får en dypere valør, samme fargetone.
   ⚠️ Tekstfargen velges etter **minst avvik fra lagets ekte farge**, ikke
   etter hvem som vinner på råfargen. Endres den regelen, blir mellomtoner
   lysnet til blasse pasteller igjen.
3. **Buene deler geometri med `StadiumSurface`.** Kortenes «banesirkel» har
   sentrum 30 px inn fra høyre / 10 px opp fra bunn, radius 100 og 68, strek
   1,5. Headeren bruker de SAMME absolutte verdiene (se `ARC_*`). Lik radius
   = lik krumning = samme designsystem. Endrer du den ene, endre den andre.
4. **Statuslinja settes av headeren** (`light-content` på mørke lagfarger),
   med `useIsFocused`-vakt så den ikke følger med til skjermer som pushes
   oppå. `App.tsx` har fortsatt `dark-content` som base.

Logoen ligger på ren hvit sirkulær plate (full opacity, ingen tint). Platen
får en hårfin ring KUN når flaten er lys (i praksis Gul), ellers forsvinner
den hvite sirkelen mot bakgrunnen.

Visuell referanse med lagfargevelger + kontrastmåling:
https://claude.ai/code/artifact/43ca53de-21eb-483b-b54b-34947e5165cf

## ✅ TESTFLIGHT 1.0 (3) ER LIVE + REPOET ER FLYTTET UT AV iCLOUD (2026-08-04)

**RELEASE-STATUS (Brages bekreftelse 2026-08-04, erstatter alt lenger
nede i fila):**
- **1.0 (3) er lastet opp og ligger på TestFlight.** Dette er bygget
  med `main.jsbundle` på plass — altså det første TF-bygget som
  inneholder arbeidet fra 08-03/08-04 (supporter, klubbdør,
  push-trykk-navigering, `heia://lagkassa`).
- **1.0 (2) er satt til Expired** i App Store Connect. Kræsj-bygget er
  ute av sirkulasjon; ingen testere kan lenger auto-oppdatere til det.
- Arkivet bak opplastingen: `~/Library/Developer/Xcode/Archives/
  2026-08-04/Heia2 04-08-2026, 02.24.xcarchive` (CFBundleVersion 3,
  main.jsbundle 5 467 112 b — verifisert). Nattens «frosne»
  arkivering fullførte altså likevel kl. 02.24 etter at
  iCloud-nedlastingen ble ferdig.
- ⚠️ Fortsatt gjeldende regel: **sjekk `main.jsbundle` i arkivet før
  HVER Upload** (kommandoen står i 🚨-blokken under). Regelen kom fra
  1.0 (2)-havariet og gjelder uendret.

**FLYTTINGEN ER GJENNOMFØRT OG VERIFISERT 2026-08-04.** Repoet ligger
nå på **`/Users/bragelotheweium/Developer/Heia Prod`** (utenfor
iCloud). Fase 1 (read-only) bekreftet: git root = ny sti, `.git` er
ekte katalog (ikke symlink tilbake), HEAD `5e64ae1`, clean status,
`git fsck --full` exit 0 (kun dangling-objekter),
`origin/Brage` = `f33d8f0` (2 commits ligger fortsatt kun lokalt).
Alle gitignorerte lokalfiler fulgte med **hash-identiske**:
`ios/.xcode.env.local` (Debug-gatingen intakt), `ios/.xcode.env`,
`.claude/settings.local.json`, `.env`, `.env.example`.
**0 dataless-skall** av 45 983 filer, 0 `.icloud`-plassholdere.

**Fase 2 utført samme dag:**
- `pod install` fra ny sti. ⚠️ LÆRDOM: første kjøring fikset IKKE
  `HERMES_CLI_PATH` — CocoaPods cacher hermes-podspec'en globalt i
  `~/Library/Caches/CocoaPods/Pods/Specs/External/hermes-engine/` med
  absolutt sti bakt inn. Måtte slette den cache-entryen (+ `ios/Pods/
  Local Podspecs/hermes-engine.podspec.json`) og kjøre `pod install`
  på nytt. **Husk dette hvis prosjektet flyttes igjen.**
- `.claude/settings.local.json`: 7 regler pekte på gammel sti → byttet
  til `~/Developer`-stien (kun stien endret, ingen andre tillatelser).
- Slettet avledet `node_modules/.generated/.packager.env` (gammel
  PROJECT_ROOT; regenereres av react-native-xcode.sh).
- Slettet foreldet DerivedData `Heia2-hfvqxhnjtfpyrndgtxkazyxnalfr`
  (7,5 GB, WorkspacePath pekte på `Documents/Heia Prod`) →
  **7 GB frigjort, 37 GB ledig**. Xcode lager ny katalog for ny sti
  ved første bygg. Arkivene bor i `~/Library/Developer/Xcode/Archives`
  og ble IKKE rørt.
- Full skann av prosjektet: **0 treff** på gammel sti.

**GJENSTÅR:** (a) ett dev-bygg fra ny sti som endelig verifisering;
(b) gammel mappe `~/Documents/Heia Prod` (624 MB) lever fortsatt —
slett den når dev-bygget er grønt (Cursor må ikke ha filer åpne der);
(c) valgfritt: `~/Documents/Heia-Stripe-Spike/` ligger fortsatt i
iCloud (har .env med sandbox-nøkkel).
Se minnet `icloud_evicted_files_hang`.



_Sist oppdatert: 2026-08-04. **ALLER NYESTE: 🚨 BYGG 1.0 (2) BLE
LASTET OPP ØDELAGT — KRÆSJER VED OPPSTART. Skal EXPIRES i App Store
Connect og erstattes av 1.0 (3):** 04-08-arkivet mangler
`main.jsbundle` fordi `ios/.xcode.env.local` (LOKAL og GITIGNORERT —
usynlig i git-historikken!) satte `SKIP_BUNDLING=1` ubetinget.
Kommentaren i filen OG i denne handoffen («Release/Archive bundler
som før») var FEIL: react-native-xcode.sh sjekker SKIP_BUNDLING
(linje 30) FØR konfigurasjons-casen og hopper over bundlingen i ALLE
konfigurasjoner. Release-appens bundleURL() slår opp main.jsbundle i
egen pakke → nil → «No bundle URL present» i det appen åpnes.
Verifisert ved diff mot 1.0 (1)-arkivet (5,4 MB main.jsbundle +
assets/ der; begge mangler i 04-08-arkivet). Funnet i Opus-økten
2026-08-04 FØR Brage installerte TF-bygget; dev-bygget er upåvirket
(Debug henter fra Metro). **FIKSET:** `.xcode.env.local` setter nå
SKIP_BUNDLING kun i Debug (`case "$CONFIGURATION"` — lokal fil, må
gjenskapes ved ny maskin/kloning), CURRENT_PROJECT_VERSION bumpet
2→3. **✅ BEGGE PUNKTENE ER GJORT 2026-08-04 (se blokka øverst):**
(a) bygg 2 er satt til **Expired** i App Store Connect; (b) 1.0 (3)
er arkivert, verifisert og **lastet opp til TestFlight**.
**Regelen står likevel ved lag — OBLIGATORISK SJEKK før
hver Upload fra nå av:**
`ls "$(ls -dt ~/Library/Developer/Xcode/Archives/*/*.xcarchive | head -1)/Products/Applications/Heia2.app/main.jsbundle"`
→ Upload → legg 1.0 (3) til BEGGE gruppene. **PUSH: ✅ APNS_HOST =
api.push.apple.com er SATT og digest-verifisert 2026-08-04** —
TF-push virker (TestFlight-signering gir produksjonstokens);
dev-bygg-push krever midlertidig sandbox-bytte (én host om gangen).
**🌙 NATTSTATUS 2026-08-04 ~01:40 (iCloud-fella slo til IGJEN under
re-arkiveringen):** disken nede på 13 GB → macOS hadde kastet ut
38 792 av node_modules-filene (kun 63 MB igjen på disk) → bundle-fasen
i 1.0 (3)-arkivet frøs på 2937/2950 (prosessen i live, null CPU —
nøyaktig icloud_evicted_files_hang-mønsteret). Nedlasting tilbake
pågår (~13 filer/s, ferdig ~kl. 02); Brage trykket **«Behold
nedlasting»** på Heia Prod i Finder — men ⚠️ PINNING VISTE SEG Å IKKE
VÆRE PÅLITELIG: attributtet `com.apple.fileprovider.pinned#PX: 1` ble
satt på mappa, og innholdet ble LIKEVEL kastet ut ved neste omstart
(39 531 filer tomme igjen — se blokka øverst). Pinning er altså INGEN
fiks; flytting til `~/Developer` (utenfor iCloud) er den varige
løsningen. caffeinate kjører
5 t så Macen ikke sover fra nedlastingen. MORGENLØPET: (1) sjekk
dataless=0 (`find node_modules -type f -size +0c -exec stat -f "%b" {} + | grep -c '^0'`);
(2) det stående bygget våknet neppe — avbryt (⌘.) og Archive på nytt
(alt lokalt = minutter); (3) main.jsbundle-sjekken (kommandoen over);
(4) Upload 1.0 (3) → BEGGE gruppene; (5) bekreft at bygg 2 er Expired.
SENERE (dagtid): frigjør disk (papirkurv/gamle arkiver — 13 GB er
faresonen) + flytt repoet til ~/Developer (fjerner synkestøyen og
«Reparer rettigheter»-banneret; ~30 min inkl. én pod install, se
icloud_evicted_files_hang).
Fra tidligere samme natt: **🚀 EKSTERN
TESTFLIGHT ER LIVE (Brages beskjed 2026-08-03)** — Beta App Review
godkjente, «Friends and family»-gruppen kjører. MEN: de eksterne står
på bygg **1.0 (1)** med FROSSET JS fra 2026-08-02 — de har IKKE
supporter-rollen, klubbdøren, push-trykk-navigeringen eller noe annet
fra 2026-08-03. Derfor er **1.0 (2) neste trekk** og ALT er nå klart
for det: (a) JS-Linking-restansen er BYGGET (siste JS-restanse fra
native-runden): `heia://lagkassa` i deepLink.ts (openLagkassa +
parkering/flush, HjemStack → Lagkassa — activeTeamSpaceId-drevet,
ingen params) og web-knappen på /betaling peker nå `heia://lagkassa`
(eldre bygg åpner bare appen — skjema-match holder; web-endringen går
live ved neste merge til main); (b) **byggnummer bumpet:
CURRENT_PROJECT_VERSION = 2 i begge configs** — 1.0 (2) er dermed et
rent Archive + Distribute → Upload i Xcode hos Brage (ingen nye pods,
ingen nye entitlements; AppDelegate-trykkfiksen ligger alt på grenen);
(c) i App Store Connect: legg 1.0 (2) til BEGGE gruppene (intern +
ekstern; oppdateringsbygg til eksisterende ekstern gruppe går normalt
uten ny full review). **PUSH:** ✅ APNS_HOST-byttet til produksjon
ble GJORT og digest-verifisert 2026-08-04 (se 🚨-blokken øverst). Fra før: **🚪 KLUBBDØREN ER
BYGGET OG DEPLOYET 2026-08-03 (sen kveld) — migrasjon `00047` +
`00048` + Edge Function `club-support-deactivate` + hele app-flaten
(«Klubbetalinger» på Profil m/snarvei fra Laginnstillinger, «Be om
godkjenning» i SupportSetup, pause/deaktiver med antall + logg,
klubbdør-varsler med inbox-navigasjon). Dermed er ALLE TRE skivene
fra beslutningsrunden 2026-08-03 i prod samme dag: supporter-skiva
(00045), claim-varselet (00044) og klubbdøren (00047/48). Backfill
verifisert i prod (Ridabu-defaults 79/60; Brage betalingsansvarlig),
rettigheter verifisert (anon=false overalt), overview-RPC røyktestet
som Brage. **BRAGES KVITTERING 2026-08-03: «Det funker!»** — klubbdøren er sett
virke på telefonen; resten av testlisten i punkt (2) tas løpende.
BESLUTNING (Brage): TestFlight 1.0 (2) tas IKKE ennå — først skal
mest mulig inn i bygget. **📣 PUSH-SKIVA: KODE-/DB-SIDEN FERDIG OG
DEPLOYET 2026-08-03 (natt):** FUNN først: push fyrte i realiteten
KUN for feed-poster (pg_net-kallet bodde bare i notify_on_feed_post)
— klubbdør/kommentar/reaksjon/hendelse var inbox-only. FIKSET med
migrasjon `00049` (i prod, verifisert): statement-trigger
`trg_push_on_notifications` på notifications-tabellen (transition
table → ETT http-kall per insert-statement) → push-fanout med NY
kontrakt `{notification_ids}`; notify_on_feed_post mistet sitt
pg_net-kall (ellers dobbel push). Dermed pusher ALT som skriver
inbox-rader — nå og i fremtiden; inbox og push er samme
mottakerliste. push-fanout omskrevet + deployet (per-rad utsending,
data-feltet sendes som det står så event_id ligger flatt som før;
døde tokens ryddes). Web-knappen «Åpne Heia-appen» på /betaling er
AKTIVERT (vises kun på iOS-UA; heia:// finnes i bygget fra 1.0 (1))
— GÅR LIVE VED MERGE til main (Vercel bygger fra main).
AppDelegate-videresendingen + token-registrering + `_shared/apns.ts`
var alt klart. **NØKKELEN ER SATT OG PUSH ER E2E-VERIFISERT
2026-08-03 (sen kveld):** .p8 laget (Key ID `8WTTU95VCR`, miljø
Sandbox & Production — LÅST valg hos Apple, riktig), alle 5 secrets
verifisert mot sjekksum i skyen; ekte mål-push levert på Brages
telefon. **BUG FUNNET OG FIKSET SAMME KVELD:** første versjon av nye
push-fanout brukte Promise.all over utsendingene — én rejection
veltet HELE batchen (500 → ingen push til noen, bare
enkeltmottaker-varsler kom frem). Fikset: sekvensiell utsending med
fangst per token + `failures[]` i svaret (pg_net lagrer responsen i
net._http_response → diagnose rett fra SQL). Verifisert: samme
7-varslers kall som ga 500 svarer nå 200/sent:2. Dev-bygg-lærdommer
fra kvelden: (a) `SKIP_BUNDLING=1` i `ios/.xcode.env.local` (lokal,
gitignorert) — dev-bygg på telefon henter JS fra Metro som
simulatoren; ⚠️ PÅSTANDEN «Release/Archive bundler som før» VAR FEIL
og ødela bygg 1.0 (2) — se 🚨-blokken øverst (fikset 2026-08-04:
Debug-gatet); (b) repoet ligger i
iCloud-synket ~/Documents — full disk → iCloud kaster ut filinnhold
→ Metro/bygg fryser med null CPU (dokumentert i minnet
icloud_evicted_files_hang; flytting til ~/Developer er anbefalt,
utsatt). **✅ PR #35 MERGET (verifisert 2026-08-03: merge-commit `2176b73` på
origin/main; heiaapp.no/betaling serverer heia://-knappen — røyktestet
med curl). DERMED er 1.0 (2) et rent Archive + Upload hos Brage.
NB: bytt APNS_HOST til api.push.apple.com når TestFlight-bygget skal
testes.** **🐛 DOGFOOD-FUNN 2026-08-03 (kveld) — «push-trykk navigerer
ikke» + «klubbdør-push uteble»: BEGGE OPPKLART, FIKS KREVER REBUILD:**
(1) TRYKK-BUGEN (gjaldt ALLE push): AppDelegate MANGLET
`didReceive response:`-callbacken — selve trykk-videresendingen til
RNCPushNotificationIOS. Et trykk åpnet bare appen; JS-lytteren
(userInteraction) fyrte aldri. LAGT TIL i AppDelegate.swift. I
tillegg kjente JS-siden kun event_id: ny `openNotificationTarget` i
deepLink.ts speiler nå Varsler-sidens FULLE mapping (klubbdør
`screen` → ClubPayments/SupportSetup i Profil-stacken · event_id →
EventDetail · feed_post_id+team_space_id → Comments), med parkering
til navigatoren er klar; push/index.ts bruker den for både trykk og
kaldstart. **KREVER ÉN REBUILD i Xcode (native endring, ingen nye
pods) — deretter Metro som før.** REBUILD GJORT av Brage samme kveld
(byggefeilen underveis: Swift-bro-navnet er `didReceive(_:)`, ikke
didReceiveNotificationResponse — fikset). OPPFØLGINGSFUNN (Brage):
trykk navigerte KUN ved lukket app — fordi et trykk mens appen
KJØRER leveres på 'localNotification'-JS-kanalen, ikke
'notification' (pod'en poster didReceive som
kLocalNotificationReceived, RNCPushNotificationIOS.m linje 124;
kaldstart går via getInitialNotification/launchOptions og virket
derfor). Lytter lagt til på begge kanaler — REN JS, Metro-reload
holder, ingen ny rebuild. TREDJE FUNN (Brage): push PÅ TVERS AV LAG
(Stange aktivt, Ridabu-målvarsel) åpnet kampen med FEIL lagkontekst
— «plutselig spilte Stange» — fordi EventDetail/Comments/
SupportSetup er 100 % activeTeamSpaceId-drevet og push omgår
inboxens lag-scoping. FIKSET: openNotificationTarget bytter aktivt
lag FØR navigasjonen (ny registerTeamSwitcher fra TeamProvider —
navigationRef-idiomet; medlemskapsvakt: uten medlemskap i mållaget
navigeres det ikke; club_payments bytter ALDRI lag — klubbnivå,
ansvarlig kan stå utenfor laget; membershipsRef fordi barne-effekter
(kaldstart-flush i AppNavigator) løper før foreldre-effekter i
React). Også ren JS. FJERDE FUNN (Brage, samme kveld): kaldstart-
trykk ble SVELGET etter lagbytte-fiksen — getInitialNotification
resolver FØR medlemskaps-fetchen, så vakten svarte «ikke medlem» på
tom liste. Fikset med tre-tilstands-svar ('pending' → målet parkeres
og flushes når fanene monteres / 'not_member' → dropp (RLS = intet å
vise) / 'switched'), + auto-velg-første-lag bruker funksjonell
oppdatering så den aldri overstyrer et lagvalg pushen alt har køet i
samme commit. Alt ren JS — Metro-reload holder; testløpet er:
(a) app helt lukket → trykk målvarsel → riktig kamp MED riktig lag;
(b) app i bakgrunn → samme; (c) stå i Stange, trykk Ridabu-varsel →
lagbytte + riktig kamp; (d) klubbdør-varsel → Klubbetalinger. (2) KLUBBDØR-PUSHEN VAR ALDRI FEIL
— verifisert i prod via net._http_response (Management-API,
CLI-token fra nøkkelringen): 20:36:36 «Lag ber om godkjenning» =
sent:2 (begge managere, APNs aksepterte); 20:37:05 «godkjent» =
tokens:0 fordi mottakeren (Jarle-testkontoen, simulator) IKKE HAR
push-token — simulatoren kan ikke APNs. Request-banneret kom mens
Brage sto inne i appen (forgrunn = flyktig banner øverst).
RE-TEST etter rebuild: telefonen LÅST → be om godkjenning fra
simulatoren → push på låst skjerm → TRYKK skal lande i
Klubbetalinger; kamp-/kommentar-push skal lande i
EventDetail/tråden.** Flyten for NYE klubber er komplett
og forklart for Brage: ingen styrer klubben automatisk — claim-
review i Heia Ops = autorisasjonen, claimanten blir første
betalingsansvarlige (00048), Heia seeder standardtilbudet
(ops-steget), klubben tar KYC, lagene ber om godkjenning. Se
PAYMENTS.md §Åpne beslutninger «KLUBBDØREN» (bygget-status +
ops-runbook).** Fra før: 💳 BETALINGER —
FASE 5 GODKJENT 2026-08-02 («Alt funker fra fase 5», telefontest
bestått, DB-verifisert 8/8) etter tre review-justeringer på
Profil/«Min støtte» + Lagkassa (alltid synlig + trykkbar tom-rad →
Lagkassa + full skeleton-dekning) — ALT GODKJENT og committet
(`46e62c9`, pushet). FASE 4 GODKJENT (E2E
med Apple Pay, pengevei DB-verifisert 7900/1975/5925, webhooks 4/4).**
Brages
beslutninger 2026-08-02 (LÅST — PAYMENTS.md §Pris og split + §Åpne
beslutninger): fordelingen er OFFENTLIG og positiv («79 kr i måneden —
60 kr går direkte til laget», «mer enn 3 av 4 kroner»), mekanikken =
FAST 60 (Ridabu-offering v2; Brages sandbox-abonnement eksplisitt
P16-migrert), hovedtall = det LAGET får (aldri brutto), lagaggregat
synlig for ALLE medlemmer, «Min støtte» på Profil (liste, flerlags-klar),
klubb-admin i Laginnstillinger, domene = **heiaapp.no** (Brage eier).
Bygget: migrasjon `00040` (lagkassa-summer + min-støtte-oversikt +
klubbandel i offering-RPC), Edge Function `stripe-portal` (Customer
Portal = selvbetjeningen), **ny LagkassaScreen** med innganger i
HERO-KARUSELLEN på Hjem + SESONG-siden (bunnkortet på Hjem-feeden er
FJERNET), SupportScreen med 60 kr-språket, «MIN STØTTE» på Profil.
heiaapp.no-bunken (AASA + landingssider + native-sjekkliste) ligger
klar: `docs/HEIAAPP-NO.md` — NB bundle-ID er RN-placeholder og byttes i
native-runden. **V1-HYGIENE DEL 1 (MODERASJON) er GODKJENT 2026-08-02
(«Alt funker fra del 1» — telefontest bestått): slette
innlegg/kommentarer (⋯-meny), rapportere til Heia, fjerne medlem fra
Lagoversikt; migrasjon `00041` i prod. BESLUTNING samme dag (LÅST):
INGEN overvåknings-/gjennomgangsplikt på rapporter — kanalen består
(App Store-krav), men Brage skal kun reagere når et e-postvarsel
kommer; varselet (Resend-nøkkel, ~15 min) er restanse før EKSTERN
TestFlight. **DEL 2 (KONTOSLETTING) er GODKJENT 2026-08-02 (sen
kveld) — «Alt funker her nå!»: Brage slettet en testbruker MED aktivt
abonnement på telefon, og verifiserte selv at abonnementet/kunden var
borte hos Stripe.** Kontosletting (punkt 4, Apple 5.1.1(v)): migrasjon
`00042` i prod (FK profiles→auth.users droppet;
`delete_account_data`-RPC, service-role only), Edge Function
`delete-account` deployet (Stripe-kansellering → anonymisering →
auth-sletting), «Slett konto» på Profil. Modellen: profilen blir
anonymt «Slettet bruker»-spøkelse (finansradene + laginnholdet
består), alt personlig slettes. Vilkår + personvern (punkt 5) ligger
som UTKAST i `web/vilkar/` + `web/personvern/` — 3 TODO-er i
HTML-kommentarene VENTER FORTSATT PÅ BRAGE (juridisk enhet,
aldersgrense, refusjonspolicy); svares før/når hostingen deployes.
**heiaapp.no STEG 1 + 3 ER LIVE 2026-08-02: `heiaapp.no` serveres fra
Vercel (konto hello@heiaapp.no, prosjekt `heia`, Root Directory =
`web`, produksjon fra `main`; www → 308 til apex). GitHub-repoet ble
samme dag OVERFØRT fra yps1lon til **Brag1s7/Heia** (Brages egen
konto — Vercel-appen er installert der; lokal remote er oppdatert).
DNS hos Uniweb: A `@` → `216.198.79.1` + CNAME `www` →
`d21c109e4fde58eb.vercel-dns-017.com` (Vercels nye anbefalte verdier;
navnetjenere/DNSSec/SPF/DMARC urørt). Røyktestet: AASA = 200 +
application/json UTEN redirect, /betaling + /vilkar + /personvern =
200. Retur-URL-ene i `stripe-checkout`/`stripe-onboarding`/
`stripe-portal` går via ny `_shared/web.ts`, og secreten
`WEB_BASE_URL=https://heiaapp.no` ER SATT → alle Stripe-returer
lander nå på den pene `/betaling`-siden (tekstsidene består som
fallback; fjern secreten = tilbake). VILKÅR/PERSONVERN HAR NÅ
OFFENTLIGE URL-ER (App Store-kravet) — men de 3 vilkårs-TODO-ene
venter fortsatt på Brage, og AASA-filens bundle-ID er fortsatt
placeholder (byttes i native-runden). Merket i PR #28 + oppfølgings-
commits. GJENSTÅR I FASE 6: native-runden (bundle-ID FØRST, så
Associated Domains + heia:// + AASA-oppdatering), vilkårs-TODO-ene,
e-postvarselet (Resend), AS/Apple-løpet hos Brage. Dette er
STRIPE-sporet (fase 6), IKKE nettside-prosjektet.**
**🍎 APPLE DEVELOPER: GODKJENT 2026-08-02 (samme døgn som innsendt!) —
Individual, hello@heiaapp.no, kr 779/år auto-fornyelse, Enrollment ID
9XA5DFCLD7. Konvertering til Heia AS senere via Apple Developer
Support (krever D-U-N-S) — Team ID, apper og TestFlight-historikk
overlever; reserveløsning er app transfer.**
**▶️ NATIVE-RUNDEN: ✅ FULLFØRT TIL OG MED OPPLASTING 2026-08-02
(kveld) — bygg 1.0 (1) «Uploaded to Apple» kl. 21:25! Gjenstår kun
TestFlight-minuttene hos Brage (se GJENSTÅR nederst i blokken).
Historikken:
✅ FIL-SIDEN (committet på Brage-grenen): bundle-ID
`no.heiaapp.heia` i project.pbxproj (begge configs), NY
`ios/Heia2/Heia2.entitlements` (applinks:heiaapp.no +
aps-environment=development — push var UMULIG med gratiskontoen,
nå følger den med) koblet via CODE_SIGN_ENTITLEMENTS, `heia://`-
URL-skjema i Info.plist, RCTLinkingManager-videresending (open url +
continue userActivity) i AppDelegate.swift, AASA-filens bundle-del
oppdatert. INGEN pod install nødvendig — null nye pods, bare rebuild.
✅ XCODE-SIDEN GJORT 2026-08-02 (kveld): hello@heiaapp.no lagt til i
Xcode, NYTT team valgt på target Heia2 — **Team ID `D86MWL7V3S`**
(«Brage Lothe Weium», Individual). Bundle-ID + Associated Domains +
Push vises i Signing & Capabilities, Apple Development-sertifikat
utstedt, Xcode skrev D86MWL7V3S inn i pbxproj selv. AASA har nå EKTE
appID `D86MWL7V3S.no.heiaapp.heia` → **PR til main opprettet
2026-08-02** (Brage merger selv; AASA serveres fra Vercel — MERK:
vilkårs-/personvern- og e-postsporet-endringene går live i samme
merge). BESLUTNING (Brage): «Heia2»-navnene internt (target/mappe/
prosjekt) blir STÅENDE til etter TestFlight — ingen bruker ser dem;
kun bundle-ID er permanent, og den er ren.
✅ RESTEN AV LØPET GJENNOMFØRT SAMME KVELD: Register Device gjort;
**PR #32 MERGET** → AASA røyktestet LIVE på heiaapp.no med appID
`D86MWL7V3S.no.heiaapp.heia` (200 + application/json — verifisert
med curl); app-oppføring opprettet i App Store Connect —
**App Store-NAVN (Brages valg): «Heia – Idrettsglede for alle»**
(appens egen tagline fra velkomstskjermen; hjemskjermen viser
fortsatt bare «Heia»), SKU heia-001, norsk primærspråk, Full Access;
`ITSAppUsesNonExemptEncryption=false` lagt i Info.plist (kun HTTPS —
slipper eksport-spørsmålet per bygg); **Archive + Distribute →
App Store Connect → Upload FULLFØRT — bygg 1.0 (1) «Uploaded to
Apple» 2026-08-02 kl. 21:25.** «Upload Symbols Failed» for
hermesvm.framework = KJENT RN/Hermes-kosmetikk (prebuilt uten dSYM →
usymboliserte Hermes-frames i kræsjlogger); ufarlig, backlog.
✅✅ **INSTALLERT PÅ TELEFONEN 2026-08-02 (sen kveld)** — intern
gruppe opprettet, bygg 1.0 (1) installert via TestFlight-appen.
**NATIVE-RUNDEN + FØRSTE TESTFLIGHT ER 100 % I MÅL.** Praktisk å
huske: dev-bygg fra Xcode og TestFlight-bygget deler bundle-ID og
OVERSKRIVER hverandre på telefonen (én app på hjemskjermen; gul
prikk foran navnet = TestFlight-versjonen står der). Simulator er
uendret. Gamle placeholder-appen slettes manuelt.
MERK OM BARENE: V1-hygienelisten er reelt FERDIG → EKSTERN
TestFlight (Ridabu-foreldrene) er ikke lenger blokkert av hygiene —
den krever kun: ekstern gruppe i TestFlight + Apples Beta App Review
av første eksterne bygg (~1 døgn; trenger demo-konto til reviewer) +
Brages GO. Anbefalt først: APNs-push + deep-link-restansene under,
så foreldrenes førsteinntrykk er komplett.
ETTER TESTFLIGHT (nye restanser fra runden): (i) «Åpne Heia-appen»-
knappen på web/betaling kan nå AKTIVERES (heia://-skjemaet finnes i
bygget); (ii) JS-Linking-lytteren (naviger til Lagkassa); (iii) evt.
Heia2→Heia-intern-omdøping (Brages «useriøst»-innvending — besluttet
utsatt til etter TestFlight; kun kosmetisk, ingen bruker ser det);
(iv) APNs-nøkkelen (push-restansen under); (v) SUPPORT-OFFERING FOR
BRAGES NYE LAG: Brage opprettet et nytt lag under Ridabu-klubben i
TestFlight-bygget — klubben er aktiv (konto per KLUBB), men
offering (pris/splitt) opprettes PER LAG og er ops-only
(`create_support_offering`, fase 4-design), så SupportScreen viser
den planlagte fallbacken «Ikke helt klart ennå». IKKE en bug.
BESLUTTET 2026-08-03: INGEN ops-rad lages — laget er E2E-dogfood-
testen av klubbdøren (se ▶️ NESTE SAMTALE-blokken under).
▶️ NESTE SAMTALE (beslutningsrunden 2026-08-03 er TATT — alt under
er LÅST, full beslutningstekst i PAYMENTS.md §Åpne beslutninger
«KLUBBDØREN»): **(1) ✅ SUPPORTER-SKIVA BYGGET OG DEPLOYET
2026-08-03 (venter Brages telefontest):** besteforeldre/tanter/
venner melder seg inn NØYAKTIG som foreldre (invitasjonskode, samme
rettigheter) — eneste forskjell er etiketten 'supporter'. Bygget:
migrasjon `00045` i prod (CHECK-constrainten i memberships +
rollelisten i join_team_space + eksplisitt supporter-gren i
get_team_members-sorteringen), tredje rollekort i JoinTeamCodeScreen
(«Supporter · Heier på laget», ingen barnekobling), ROLE_LABELS +
«Supportere»-seksjon i Lagoversikt. ⋯ (fjerning) virker på
supporter-rader UTEN endring (remove_team_member-vakten og
canRemove-betingelsen er svartelister på trener/lagleder/admin).
TELEFONTEST (Metro-reload): (a) «Bli med i et lag til»/onboarding →
kode → tre rollekort, velg Supporter → innmeldt uten barnesteg;
(b) Lagoversikt viser «Supportere»-seksjon nederst, admin ser ⋯ på
raden; (c) supporteren kan åpne Støtt laget og betale (medlemsgatet
checkout uendret). Dette LUKKER «ikke-medlem-støtte»-flagget:
supportere ER medlemmer — web-checkout trengs ikke.
**(2) ✅ KLUBBDØREN (hovedskiva) BYGGET OG DEPLOYET 2026-08-03 (sen
kveld) — venter telefondogfood.** Tre-porter-modellen som bygget:
migrasjon `00047` — club_payment_managers (rollen; deny-all RLS),
club_support_defaults (79/60 som DATA, deny-by-default),
team_support_approvals (RADER: hvem/når/status/note; partiell unik =
maks én åpen per lag; avslag krever begrunnelse som treneren ser),
team_support_actions (append-only logg for hele døren), klient-
RPC-ene request/approve/reject/pause + get_club_payments_overview +
get_support_activation_status utvidet ('team'-dørtilstand +
'is_payment_manager') + delete_account_data rydder rollen (spøkelser
beholder aldri godkjenningsmakt). Migrasjon `00048`:
approve_club_claim gir nå CLAIMANTEN rollen — fremtidige klubber får
første betalingsansvarlige automatisk fra claim-reviewen (reviewen ER
autorisasjonen). Edge Function `club-support-deactivate`:
cancel_at_period_end per abonnement — DB arkiverer FØRST (nye
checkouts stoppes atomisk), Stripe etterpå, idempotent retry ved
delfeil; webhookene bokfører. Godkjenning kaller
create_support_offering INTERNT (forblir ops-only utenfra);
betalingsansvarlig ser ALDRI pris — forespørselskortet viser kun
lagnavn/årskull/medlemstall/hvem som spør. App: ny
ClubPaymentsScreen («Klubbetalinger» — Profil-seksjon «Klubben»,
kun for managere; kontekstuell snarvei i Laginnstillinger),
SupportSetupScreen har dørkortene (Be om godkjenning / TIL
GODKJENNING / avslag m/begrunnelse + på nytt / pauset/deaktivert /
SAMLER INN + «Du er betalingsansvarlig»-snarvei), SupportScreen-
fallbacken fikk admin-CTA, og klubbdør-varsler navigerer fra inbox
(varsel til ansvarlig er GLOBALT — team_space_id NULL — siden
ansvarlig ikke trenger å være medlem av laget som spør; kategorien
er 'system'). VERIFISERT I PROD: backfill står (Ridabu-defaults
7900/fixed 6000/2405 bps kopiert fra aktiv offering; managere =
hovedkonto + telefonkontoen for Ridabu OG Stange — Stange har aktiv
link fra fase 3-testen og mangler defaults MED VILJE = feilveis-
test), anon=false på alle nye funksjoner (PUBLIC-revoken tatt),
create_support_offering/deactivate_team_support_data fortsatt lukket
for klienter, get_club_payments_overview røyktestet som Brage
(Ridabu: J2019 'none' → klar for dogfood, G10 'collecting' med 4
sandbox-abonnementer). 📱 TELEFONDOGFOOD (dev-bygg fra Xcode,
Metro-reload): (a) Profil → ny seksjon «Klubben» → «Klubbetalinger»
(begge kontoer er betalingsansvarlige); (b) bytt til J2019-laget →
Laginnstillinger → «Støtte fra supportere» → AKTIV-kortet + «Siste
steg: klubbens godkjenning» → **Be om godkjenning** → kortet flipper
til TIL GODKJENNING + varsel i Varsler-fanen; (c) trykk varselet →
Klubbetalinger → J2019 under TIL GODKJENNING (medlemstall + hvem
som spør, ALDRI pris) → **Godkjenn** → SAMLER INN + logg-rad +
varsel tilbake («Laget er godkjent for støtte 💚»); (d) «Støtt
laget» på J2019 viser nå 79/60-priskortet (ARVET fra defaults —
ingen manuell offering!) → full dogfood-checkout med testkort om
ønskelig; (e) pause-testen tas på J2019 (ikke G10): **Pause nye
støttespillere** → dialog med antall → SupportSetup viser «Støtten
er satt på pause» → Be om godkjenning på nytt → godkjenn → ny
offering-versjon arves; (f) **«Deaktiver støtte»** vises kun der det
finnes levende abonnementer — NB: den kansellerer EKTE
G10-sandbox-abonnementer ved periodeslutt, bruk den bevisst;
(g) valgfri feilvei: forespørsel fra et Stange-lag → Godkjenn
stoppes med «Klubben mangler standardtilbud» → Avslå med begrunnelse
→ treneren ser den i SupportSetup. OPPRYDDING etter dogfood:
`DELETE FROM club_payment_managers WHERE user_id = (SELECT id FROM
auth.users WHERE email = 's2212930@bi.no');` (+ ev. Stange-radene).
RESTANSE (egen, senere skive): invitasjonsflyt for flere
betalingsansvarlige — inntil da seeder ops (SQL i PAYMENTS.md).
OPS-RUNBOOK-ENDRING: ved ny klubbgodkjenning MÅ
club_support_defaults seedes (INSERT-malen står i PAYMENTS.md
§KLUBBDØREN) — glemmes den, stopper Godkjenn pent med beskjed.
**(3) ✅ APNs-PUSH KODE-/DB-SIDEN FERDIG
2026-08-03 (natt):** migrasjon `00049` + ny push-fanout deployet —
ALLE inbox-varsler (også klubbdørens) pusher når nøkkelen er satt.
Gjenstår kun Brages .p8 + 5 secrets (PUSH-RESTANSE-blokken under). **(4) ✅ CLAIM-VARSEL MED
AUTORISASJONSBEVIS BYGGET OG DEPLOYET 2026-08-03** (funnet fra
kodegjennomgangen + Brages presisering om at reviewen eksplisitt
skal verifisere søkerens FULLMAKT — «Stripe står for KYC; Heia står
for autorisasjonskontrollen»): migrasjon `00044` i prod (AFTER
INSERT-trigger på club_claims, 00043-idiomet, + ny kolonne
`brreg_snapshot`) + Edge Function `claim-notify` deployet. Den
henter Brønnøysunds ÅPNE registerdata automatisk (enhet + ROLLENE —
styret er offentlig!), matcher søkerens profilnavn mot styret,
flagger navneavvik/feil organisasjonsform/konkurs, viser klubbens
registrerte e-post/telefon som verifiseringskanal, fryser utdraget
på claim-raden og sender alt til hello@heiaapp.no med ferdig
approve-/reject-SQL. Registermatch er BEVIS, aldri fasit — Heia
beslutter fortsatt. API-formene røyktestet mot Ridabu (FLI, hele
styret, leder@ridabufotball.no). **✅ E2E-VERIFISERT 2026-08-03
(Brages Stange-test) — og den avdekket TO nedarvede hull som nå er
FIKSET:** (a) **vault-secretene project_url/service_role_key var
ALDRI seedet** — 00022 la seedingen som manuell SQL-kommentar og
den ble aldri kjørt, så HELE pg_net→Edge Function-idiomet
(push-fanout, report-notify, claim-notify) har vært dødt hele
tiden (triggerne returnerte stille ved tom vault, by design).
(b) **nøkkel-subtilitet:** prosjektet er migrert til Supabases NYE
API-nøkler — Edge-runtimen injiserer `sb_secret_…` («default»
secret key) under navnet SUPABASE_SERVICE_ROLE_KEY, IKKE
dashboardets legacy-JWT. Vaulten er nå seedet med sb_secret-verdien
(matcher runtime-digesten), verifisert: claim-notify svarte 200,
brreg_snapshot={not_found} skrevet (orgnr 111111111 består mod 11
men finnes ikke — perfekt negativtest), e-post akseptert av Resend
→ sjekk hello@heiaapp.no. Stange-claimen er AVSLÅTT med note (ses
på «IKKE GODKJENT»-kortet). Bonus: report-notify er dermed OGSÅ
reparert; push-fanout-triggeren begynner å fyre (APNs-nøkkel
mangler fortsatt — egen restanse). NB «til vurdering» i appen er
DESIGNET tilstand — klubb-claims godkjennes alltid manuelt av Heia
(det er autorisasjonsporten), også etter klubbdøren.
**(5) ✅ «HEIA OPS» BYGGET OG DEPLOYET 2026-08-03 (Brages
beslutning: SQL-editoren er pilot-krykke, ikke arbeidsflyt; egen
WEB-admin-innlogging på heiaapp.no er EKSPLISITT utsatt til
nettside-prosjektet):** migrasjon `00046` i prod — ops_admins
(deny-all RLS; seedet: Brages hovedkonto + telefonkontoen
s2212930@bi.no/«Benjamin Hansen» for dogfood — FUNN: Ridabu-claimets
claimant var testkontoen jarle.weium, aldri seed ops-makt fra
claims), append-only `club_claim_audit`, RPC-ene ops_list/get/
approve/reject/request_info (alle SECURITY DEFINER + is_ops_admin-
gatet, aldri klientskriving; GODKJENNING KREVER tekst om hvordan
autorisasjonen ble verifisert — lagres som review_note + audit),
info-forespørsel = in_review + note søkeren ser i SupportSetupScreen
(«svar til hello@heiaapp.no»). App: OpsClaims/OpsClaimDetail i
Profil-stacken, «Heia internt»-seksjon på Profil (kun ops),
JS-Linking-lytteren er BYGGET (AppNavigator + deepLink.ts) —
e-posten deep-linker heia://ops/claims/<id> (HTML-knapp i Resend).
PLUSS: SupportSetupScreen validerer orgnr mot Brønnøysund FØR
innsending (404 → blokkert med forklaring; slettet/konkurs →
blokkert; registerets navn brukes som autoritativt; nettverksfeil =
fail-open; __DEV__-bygg har eksplisitt «Send likevel (testdata)»).
LÆRDOM fra deploy-verifiseringen: REVOKE FROM anon alene er
utilstrekkelig — anon arver PUBLIC-granten; alle ops-funksjoner er
nå revokert FROM PUBLIC og verifisert i prod (anon=false overalt).
TELEFONTEST (Metro-reload): (a) Profil → «Heia internt» → Heia Ops →
listen viser Ridabu (godkjent) + Stange (avslått); (b) send ny
Stange-søknad med EKTE orgnr → e-post med HTML-knapp «Åpne i Heia
Ops» → trykk → detaljskjermen (kaldstart-varianten: appen lukket
først); (c) godkjenn UTEN tekst → stoppes; skriv verifiseringstekst
→ Godkjenn → status flipper + audit-loggen viser handlingen;
(d) test «Be om mer informasjon» på en åpen søknad → søkerens
SupportSetupScreen viser gul boks. SQL-editoren består som
nødfallback (PAYMENTS.md §Fase 3-runbooken). **BRAGES KVITTERING
2026-08-03: «Jeg får mail og dette ser veldig proft ut! Det funker
bra inne på appen»** — e-postkjeden + ops-flaten er sett virke;
resten av testlisten tas løpende. MERK TESTREGIMET fremover:
TestFlight-bygget 1.0 (1) er frosset JS fra 2026-08-02 — ALT fra
2026-08-03 (supporter, Heia Ops, brreg-validering) testes i
DEV-BYGG fra Xcode (overskriver TF-appen, samme bundle-ID); nytt
TestFlight-bygg **1.0 (2)** (ren Archive + Upload, null nye
pods/entitlements) lastes opp når testlisten er grønn — naturlig å
ta KLUBBDØREN med i samme bygg. Web-ops på heiaapp.no (Brages
ønske): bekreftet mulig by design — all logikk er klient-agnostiske
RPC-er; web-flaten er ren frontend-oppgave i nettside-prosjektet
(notert i website_project-minnet). Markedsføringstonen
(følelser/samhold/støtte) hører til nettside-prosjektet, men
flyt-copyen i appen skal speile den.
PUSH-RESTANSE (kode-/DB-siden FERDIG 2026-08-03 — se 00049-blokken
øverst; GJENSTÅR KUN dette hos Brage):
**(A) Lag nøkkelen (Apple Developer, 2 min):** developer.apple.com →
Certificates, Identifiers & Profiles → **Keys** → «+» → navn f.eks.
«Heia APNs» → huk av **Apple Push Notifications service (APNs)** →
Continue → Register → **Download** (AuthKey_XXXXXXXXXX.p8 — kan KUN
lastes ned én gang, ta vare på den utenfor repoet, f.eks. i
spike-mappen) + noter **Key ID** (10 tegn). Ingen miljøvalg —
samme nøkkel gjelder sandbox OG prod.
**(B) Sett secrets (terminal i repo-mappa; bytt XXXXXXXXXX):**
```
supabase secrets set \
  APNS_KEY="$(cat ~/Downloads/AuthKey_XXXXXXXXXX.p8)" \
  APNS_KEY_ID=XXXXXXXXXX \
  APNS_TEAM_ID=D86MWL7V3S \
  APNS_BUNDLE_ID=no.heiaapp.heia \
  APNS_HOST=api.sandbox.push.apple.com
```
APNS_HOST = sandbox fordi testregimet NÅ er dev-bygg fra Xcode
(aps-environment=development → sandbox-tokens). BYTTES til
`api.push.apple.com` når TestFlight 1.0 (2) skal testes (én host om
gangen — kjent v1-begrensning).
**(C) Test (dev-bygg, én telefon holder):** (i) Profil → sjekk at
varsler er PÅ (token registreres ved innlogging/aktivering);
(ii) legg appen i BAKGRUNNEN (forgrunns-levering er bevisst stille —
feeden er live uansett); (iii) fra simulatoren (Benjamin-kontoen):
pin en beskjed i G10 ELLER rapporter en kamphendelse → push skal
lande på telefonen; trykk på kamp-varselet → EventDetail åpner;
(iv) klubbdør-bonus: «Be om godkjenning» fra J2019 i simulatoren →
telefonen (betalingsansvarlig) får push med klubbdør-varselet.
JS-Linking-utvidelsen (naviger til Lagkassa ved heia://lagkassa) er
✅ BYGGET 2026-08-03 (natt mot 04) — se ALLER NYESTE-blokken øverst.
NB for Claude: native-arbeid = Xcode hos Brage med guiding; ALDRI
pod install/build i bakgrunnen mens appen kjører
(se minnet feedback_dev_environment).**
**VILKÅR + PERSONVERN ER FERDIGE 2026-08-02 (natt) — tre beslutninger
LÅST av Brage: (a) aldersgrense = 13 ÅR (under 13 via foresattes
konto); (b) refusjon = 14 DAGERS ANGRERETT på nytegning + ALLTID
refusjon ved feiltrekk + ingen refusjon av gjennomførte måneder;
(c) BRAGES PERSONNAVN SKAL ALDRI STÅ som behandlingsansvarlig,
avtalepart eller kontaktperson — sidene bruker plassholderne
`[JURIDISK SELSKAPSNAVN]`, `[ORGANISASJONSNUMMER]`,
`[FORRETNINGSADRESSE]` til AS-et er registrert. Supabase-regionen ble
verifisert samtidig (West Europe (London) — Storbritannia,
adekvansbeslutning; RETTET fra eu-central-1: edge-headeren viser bare
edge-noden, `supabase projects list` er sannheten) → nytt
avsnitt «Hvor opplysningene lagres». Funn underveis: appen lenket
INGEN steder til vilkårene — nå er «Vilkår for bruk» + «Personvern»
egne rader på Profil (over «Om Heia»), og registreringsskjermen har
samtykkelinjen «Ved å opprette konto godtar du vilkårene og
personvernerklæringen. Du må være minst 13 år.» med trykkbare lenker
(ny `src/shared/links.ts`). ENESTE GJENSTÅENDE: de tre plassholderne
— MÅ erstattes i BEGGE filer før App Store-innsending.**
**E-POSTSPORET BYGGET OG DEPLOYET 2026-08-02 (natt) — tre ting i én
runde: (a) RAPPORTVARSEL: migrasjon `00043` i prod (trigger
`notify_on_content_report` på content_reports — pg_net + vault-idiomet
fra 00022, gjenbruker `project_url`/`service_role_key`-secretene) +
Edge Function `report-notify` deployet (Bearer-sjekk mot service key
som push-fanout; Resend → hello@heiaapp.no; hopper pent over hvis
RESEND_API_KEY mangler). VENTER KUN på at nøkkelen settes:
`supabase secrets set RESEND_API_KEY=re_…` (Brage har nøkkelen).
Virker UTEN domene-DNS (mottaker = Resend-kontoens egen adresse).
(b) FUNN: appen hadde INGEN «glemt passord»-flyt (permanent utestengt
ved glemt passord) og INGEN e-post ved registrering
(mailer_autoconfirm var på). Brages beslutning: BEKREFTELSESKODE ved
signup. Bygget: `VerifyEmailScreen` (6-sifret OTP — signup-bekreftelse
OG recovery med nytt passord; ingen deep links nødvendig),
«Glemt passordet?»-lenke på AuthScreen, 4 nye context-metoder
(verifyOtp signup/recovery + resend + resetPasswordForEmail).
(c) AUTH-CONFIG versjonert i config.toml og pushet med
`supabase config push`: enable_confirmations=true (BEKREFTET i prod:
mailer_autoconfirm=false), norske OTP-maler i `supabase/templates/`
({{ .Token }}, ikke lenke), otp_length 8→6, max_frequency 1m0s.
✅ SMTP-BYTTET ER FULLFØRT SAMME KVELD — se avsnittet under.
TELEFONTEST (Metro-reload): (1) registrer NY
testadresse → «Sjekk e-posten din»-skjerm → kod inn → rett inn i
appen; (2) «Glemt passordet?» på innlogging (e-post utfylt) →
kodeskjerm + nytt passord → innlogget; (3) etter nøkkelen er satt:
rapporter et innlegg → e-post i hello@heiaapp.no.
DERETTER: native-runden når Apple-kontoen er godkjent (bundle-ID
`no.heiaapp.heia` FØRST).**
**TELEFONTEST BESTÅTT samme kveld («Det funker med både signup og
reset passord!») + BRAGES PRODUKTFUNN FIKSET: innlogget bruker UTEN
lag møtte en skjerm identisk med utlogget-tilstanden — ingen tegn på
innlogging, ingen utlogging, og INGEN vei til kontosletting (ekte
Apple 5.1.1(v)-hull: reviewere tester med fersk, lagløs konto).
Nå viser WelcomeIntent ved session: «Innlogget som {e-post} — nå
mangler bare laget.» over knappene + rolige lenker «Logg ut · Slett
konto» nederst (delt bekreftelsesflyt med Profil via ny
`src/lib/account.ts` — én kilde til dialogtekstene). BESLUTNING
(produktanbefaling akseptert): IKKE mer kontoadministrasjon for
lagløse brukere (e-postbytte o.l.) — laget er produktet.
✅ E-POSTSPORET ER 100 % FERDIG 2026-08-02 (sen kveld): Brage la
heiaapp.no inn i Resend (EU-region, Sending PÅ, Receiving AV — skal
FORBLI av, innboksen bor hos Uniweb), la de 3 DNS-postene (DKIM-TXT +
MX/TXT på `send`) i Uniweb-panelet — Claude verifiserte alle tre mot
autoritativ NS (ns02.no.brand.one.com) FØR «I've added the records».
Domenet ble verifisert, og Brage kjørte
`RESEND_API_KEY=re_… supabase config push` selv («Ferdig nå!»):
[auth.email.smtp] = smtp.resend.com/465 med avsender
«Heia <hello@heiaapp.no>», email_sent 2→100/t. RESEND_API_KEY +
RESEND_FROM står som funksjonssecrets (samme nøkkel overalt) →
rapportvarselet sender også fra hello@heiaapp.no. HELE KJEDEN LIVE:
signup-kode + passord-reset + rapportvarsel, alt fra @heiaapp.no,
ingen dev-grense. Røyktest ved anledning: be om passord-reset — 
e-posten skal komme fra «Heia <hello@heiaapp.no>».** Fase 6-eksterne
ting (AS-stiftelse, Apple-innmelding
som privatperson, regnskapsfører) løper hos Brage i parallell;
native-runden + intern TestFlight tas når Apple-kontoen er klar. NETTSIDEN (markedssiden på heiaapp.no) er
BESLUTTET som EGET PROSJEKT som startes ETTER at stripe-sporet er
ferdig (Brage 2026-08-02) — ikke start nettside-arbeid i
stripe-samtalene; alt vi ble enige om ligger i minnet
(website_project.md).** Se «💳 BETALINGSSPORET» + `docs/PAYMENTS.md`
(sannhetskilden).**
Forrige skive: P9 KALENDEREN — RYTME, IKKE
GRID (design-polish-planen), OMLAGT etter første telefontest:
kalenderkortet er nå en KOMPAKT HERO med Hjem-heroens designspråk
(mint→krem-gradient + banedekor, type-pill, dag + tid i displayfonten,
RSVP-progress) — kamp på mørk stadionflate MED RINGEN (flomlys av),
mint avspark og stillingen som bunnrad. RUNDE 3 samme dag:
hendelsessidens infokort = samme hero-flate (ny delt `HeroSurface`), og
kommende kamp i HJEM-heroen er også stadionmørk med ring.
Månedsseksjoner + dempet arkiv består. ✅ GODKJENT på telefon 2026-07-31
(«Alt dette ser bra ut») — **HELE P1–P9-PLANEN ER I MÅL.** LÅST
samtidig: INGEN visningstoggle i kalenderen i v1 (Brage spurte selv;
listen ER visningen — uke/måned tas opp ved reell tetthet). Se «🗓 P9»
under.** Fra før: P8
HERO-KARUSELL er FERDIG (godkjent 2026-07-31, se
«🎠 P8»); P7 PROFIL-POLISH er FERDIG
(godkjent 2026-07-31); P6 VARSLER-LISTEN er FERDIG (godkjent på telefon
2026-07-31); P5 + P5B KAMPFORLØPET + HENDELSESSIDEN er FERDIG (godkjent
2026-07-31); P4 LAGINNSTILLINGER + KLUBBLOGO er FERDIG (godkjent
2026-07-31; migrasjoner `00034`–`00036` deployet); P3 HEADEREN, P2
MÅL-ØYEBLIKKET og P1 SKELETONS er FERDIG; LAGFARGE er FERDIG;
SESONGFLATEN + TURNERINGER + VÅR/HØST-SESONGER (migrasjoner
`00030`–`00033` deployet, flyt godkjent og pushet).
LÅST underveis: ingen toppscorer/spillerstatistikk før strukturert
spillerstall; sesong = vår/høst-halvår; turnering = enkel kampsamling;
lagfarge = kuratert palett, aldri fri velger; **klubblogo bor på KLUBBEN,
write-once; laglogo = fri override**. **Skive 6 (app-ikon + launch
screen) er FERDIG.** Fortsatt uverifisert: **KAMPRAPPORTEN (skive 5)**.
**Neste: planens backlog eller kandidat 2 (kommentarer + heiing synlig
i kamptidslinja)** — se punkt 5 under. Design skive 1–5 er merget (PR #17),
Fase 4–9 (PR #16)._

Si i den nye chatten: **«Les docs/STATUS-HANDOFF.md og fortsett.»**

---

## 💳 BETALINGSSPORET (aktivt spor — startet 2026-08-01)

**Sannhetskilden er `docs/PAYMENTS.md`** — beslutningsbok, fasetabell, alle
låste invariants og fase 0-funnene. Kortversjonen:

- **Modellen (LÅST + teknisk BEKREFTET i sandbox):** Stripe Connect,
  destination charges + `on_behalf_of`, klubben (juridisk enhet med orgnr)
  er KYC-mottaker, laget er allokering, Heia tar application fee, webhooks
  er eneste sannhetskilde. 79 kr/mnd; splitten (75/25 vs fast 60) er ULÅST
  og ligger som data i `support_offerings` — ALDRI hardkodet.
- **Fase 0 (✅ ferdig + godkjent 2026-08-01):** 16 bevispunkter bevist i
  Stripe-sandbox. Spike-mappen `~/Documents/Heia-Stripe-Spike/` (UTENFOR
  repo, med vilje): RUNBOOK.md, RAPPORT.md, logs/. `.env` der har
  sandbox-nøkkelen — aldri i repo/chat.
- **Fase 1 (✅ DEPLOYET + VERIFISERT 2026-08-01):** migrasjon
  `00037_payments_domain.sql` — 9 tabeller, deny-by-default RLS (kun to
  smale klient-SELECT-er), immutability-triggere (offerings versjonert,
  transaksjoner append-only), `get_payment_account_for_team_space()`
  (gatet på lagmedlemskap + service role), dropp av døde felt
  (`profiles.stripe_customer_id`, `team_spaces.stripe_account_id` —
  kontrollert ubrukt). Pushet med GO fra Brage (uten backup — Brages
  eksplisitte valg; migrasjonen er transaksjonell og tabellene var nye),
  deretter **`verify-00037.sql` i dashboardets SQL-editor: 28/28 PASS**
  (alle invariants, kapabilitetsoppslag i 4 varianter, RLS som simulert
  bruker; full tabell i `docs/PAYMENTS.md`). Scriptet ligger i
  `~/Documents/Heia-Stripe-Spike/` og ruller alltid tilbake.
  Committet som `66e22a1`.
- **Fase 2 (✅ DEPLOYET + SANDBOX-VERIFISERT 2026-08-01):**
  `stripe-webhook` Edge Function (`supabase/functions/stripe-webhook/` +
  `_shared/stripe.ts` — håndrullet, uten npm:stripe, API-versjon pinnet
  `2026-07-29.dahlia`). Idempotent (webhook_events-upsert), rekkefølge-
  agnostisk (hendelsen er trigger, sannheten GET-es fresh fra Stripe),
  rent observerende (aldri pengeflyttende kall). To endepunkter i sandbox
  (platform + connect for account.updated), to signatur-secrets satt som
  Edge Function-secrets + speilet i spike-`.env`. **Verifisert med EKTE
  sandbox-events:** signaturavvisning (400), account.updated ende-til-ende
  (konto-rad → active), duplikatvern (attempts forble 1), skip-spor for
  ukjent konto. Testradene i DB er ryddet. **Bevisst restanse: pengeveien
  (invoice.paid → transaksjonsrad) kjøres live først i fase 4s første
  checkout** — detaljer og fase 4-KONTRAKTEN (metadata på sesjon +
  subscription_data) i PAYMENTS.md §Fase 2. **REVIEW TATT 2026-08-01:
  GODKJENT uten justeringer; pengevei-testen i fase 4 er BESLUTTET.**
- **Fase 3 (✅ FERDIG + GODKJENT 2026-08-01 — E2E-telefontest bestått ×2,
  se seksjonen under):** migrasjon `00038_club_claiming.sql`
  (`submit_club_claim` med mod 11-orgnr-sjekk + én-åpen-claim-index;
  `approve_club_claim`/`reject_club_claim` som service-role-only ops-
  funksjoner — godkjenning skaper enhet+link+konto atomisk og GJENBRUKER
  enhet/konto ved samme orgnr; `get_support_activation_status` for admin-
  skjermen, ikke-admin → NULL). Edge Functions `stripe-onboarding`
  (lat kontoopprettelse med Idempotency-Key = kontorad-id + Account Link i
  klikkøyeblikket) og `stripe-onboarding-return` (offentlig landingsside for
  Stripes redirect — domene er fortsatt fase 4/6). App: nytt kort «Støtte
  fra supportere» i Laginnstillinger → ny `SupportSetupScreen` med hele
  flyten (skjema → til vurdering → avslag/godkjent → «Fortsett hos Stripe» +
  «Del lenken» → AKTIV). `verify-00038.sql` i spike-mappen: **19/19 PASS**
  mot prod-DB (ruller alltid tilbake). Ops-runbook for manuell godkjenning:
  PAYMENTS.md §Fase 3.
- **Fase 4 (✅ FERDIG + GODKJENT 2026-08-02 — E2E med Apple Pay, pengevei
  DB-verifisert):** migrasjon `00039_support_checkout.sql`
  (`create_support_offering` — ops-only versjonering, arkiverer aktiv +
  ny versjon atomisk; `get_support_offering_for_team_space` — pris +
  mottakernavn til LAGMEDLEMMER, splitten lekker aldri, verifisert i
  test 5). Edge Function `stripe-checkout` (medlemsgatet; fase 2-
  KONTRAKTEN: rad før redirect + metadata begge steder; lat product/
  price/kunde-provisjonering med Idempotency-Keys; «prøv igjen»
  gjenbruker pending-raden med betinget sesjonsskriving — aldri dobbel
  tegning; `incomplete` sperrer til Stripe har konkludert) +
  `stripe-checkout-return` (tekstside, GET-røyktestet). Webhook-patch:
  expired-event abandonerer kun radens GJELDENDE sesjon. App:
  SupportScreen omskrevet til ekte data (pris fra RPC, én månedlig plan,
  mottakerens juridiske navn, AppState-refetch fra Safari, «DU STØTTER
  LAGET 💚»-tilstand). **Ridabu G10 har pilot-offering 79 kr/mnd
  (bps 2500 — PLASSHOLDER, fase 6 låser splitten; endring = ny versjon).**
  `verify-00039.sql` i spike-mappen: **11/11 PASS** mot prod-DB.
- **Fase 5 del 1 (🟡 KODET + DEPLOYET + DB-VERIFISERT 8/8 2026-08-02 —
  venter Brages telefontest + review):** migrasjon `00040_lagkassa.sql`
  (klubbandel-avledning + lagkassa-summer + min-støtte-oversikt),
  `stripe-portal`, LagkassaScreen med innganger i hero-karusellen +
  Sesong (bunnkortet fjernet), SupportScreen med 60 kr-språket,
  «MIN STØTTE» på Profil. Fast-60-offering (v2) for Ridabu + eksplisitt
  P16-migrering av Brages abonnement. heiaapp.no-bunken forberedt
  (`docs/HEIAAPP-NO.md`). Detaljer: PAYMENTS.md §Fase 5.
- **Gate-regel (LÅST): hver fase stopper for Brages review før neste.**
  Fase 5 del 2 (heiaapp.no-stegene + delbar lenke) venter på del 1-
  reviewen.
- Fordelingen er nå OFFENTLIG kommunikasjon (låst 2026-08-02): «79 kr i
  måneden — 60 kr går direkte til laget». Alltid kronebeløp fra offering-
  DATA, aldri hardkodet, aldri primært som prosent.

### ▶️ Neste samtale: fase 6

**Fase 5 er LUKKET (godkjent 2026-08-02** — telefontest bestått + review
med to justeringer, se testseksjonen under). Delbar lagkassa-lenke er
omfordelt: web-delen → nettside-prosjektet (etter sporet),
app-/deep-link-delen → native-runden i fase 6. Fase 6 består av
(PAYMENTS.md §Åpne beslutninger + fasetabellen):
1. **Brage-avhengig (eksternt, si fra tidlig):** Heia juridisk enhet —
   **AVGJORT 2026-08-02: AS** (stiftes nå; regnskapsfører velges først
   og svarer på MVA i samme løp) · live-nøkler (aktivere ekte
   Stripe-konto — venter på AS-et).
   **TestFlight-beslutning (2026-08-02): venter IKKE på AS-et** — Apple
   Developer som privatperson nå (99 USD/år, hello@heiaapp.no),
   konverteres til Heia AS (D-U-N-S) før offentlig lansering; apper/
   TestFlight-historikk overlever. Rekkefølgen for TestFlight: native-
   rundens steg 0 FØRST (bundle-ID `no.heiaapp.heia` — permanent per
   app-oppføring ved første opplasting!) → Associated Domains + heia://
   → heiaapp.no steg 1 (AASA med NY bundle-ID) → arkiver + last opp →
   intern TestFlight (ingen review for interne testere).
2. **Kode/ops (Claude):** live webhook-endepunkter + secrets · portal-
   konfig i live · re-onboarding av Ridabu med live-KYC · refund-/
   disputepolicy som tekst · statement descriptor-standard ·
   varslingsflyt ved lagavvikling.
3. ✅ **Vilkår + personvern har OFFENTLIGE URL-er OG ER FERDIGSKREVET**
   (App Store-kravet) — heiaapp.no-hostingen + retur-URL-byttet gikk
   LIVE 2026-08-02 (HEIAAPP-NO.md steg 1+3; `WEB_BASE_URL` er satt),
   og de 3 TODO-ene ble besvart samme natt (13 år · 14 dagers
   angrerett · plassholdere i stedet for personnavn). Gjenstår kun:
   plassholderne når orgnr finnes + privacy nutrition labels ved
   innsendingen.
4. **Native-runden** (Brage kjører): bundle-ID-bytte (placeholder i
   dag!) + Associated Domains + heia://-skjema — kreves uansett før
   TestFlight/App Store.
**NETTSIDEN (markedssiden) er eget prosjekt ETTER sporet** — parkert
med full plan i minnet (website_project.md) + docs/HEIAAPP-NO.md.

### 🧹 V1-HYGIENE (✅ DEL 1 GODKJENT 2026-08-02; ✅ DEL 2 (KONTOSLETTING) GODKJENT 2026-08-02 sen kveld — «Alt funker her nå!»; gjenstår: vilkårs-TODO-ene + e-postvarselet før ekstern TestFlight)

Brages presisering: ikke nye funksjoner, men fullføring — «fjerne
innlegg osv.» + alt App Store krever. Listen, mappet mot Apples
retningslinjer — **punkt 1–3 er BYGGET (migrasjon `00041` deployet)**:
1. ✅ **Slette eget innlegg** + **admin (trener/lagleder) sletter alt i
   laget** — UGC-moderasjon (Apple 1.2). Feed-innlegg OG kommentarer.
   Soft delete via RPC-ene `soft_delete_post`/`soft_delete_comment`
   (deleted_at fantes alt fra 00009, HELE lesestien filtrerte allerede
   på den — vi trengte bare skriveveien). RPC og ikke direkte UPDATE:
   en soft-slettet rad passerer ikke SELECT-policyen, så
   `UPDATE … RETURNING` kunne ikke skilt suksess fra RLS-avslag
   (00036-familien). Postens bilder soft-slettes i samme transaksjon,
   og RPC-en returnerer storage-pathene så klienten fjerner filene
   best-effort. UI: ⋯-meny på alle feed-kort + innleggskortet og hver
   kommentarboble i tråden.
2. ✅ **Rapportere innhold** → ny tabell `content_reports` (RLS PÅ uten
   policies = deny all; kun RPC-en `report_content` skriver, kun
   service role/SQL-editor leser). Rapporten FRYSER innholdet
   (content_snapshot) så saken kan vurderes selv om innlegget slettes
   etterpå. Idempotent (én åpen sak per person per innhold). UI: samme
   ⋯-meny, delt flyt i `src/lib/moderation.ts` (årsak → takk).
3. ✅ **Fjerne medlem fra laget** — RPC `remove_team_member`, admin-
   gatet I DATABASEN: aldri deg selv, aldri trener/lagleder (rollebytte
   først den dagen det trengs). Setter `status='removed'` + left_at
   (skjemaet har ventet på det siden 00007 — unik-indeksen gjelder kun
   'active', så personen kan inviteres inn igjen). Fjerner ALLE
   personens medlemskap (barna følger forelderen) og RSVP-ene deres på
   fremtidige hendelser. Innholdet deres blir stående. UI: ⋯ på
   medlemsrader i Lagoversikt (kun for admin, kun på foreldre/spillere).
   KJENT BEGRENSNING (akseptert v1): en fjernet som husker
   invitasjonskoden kan bli med igjen — kode-rotering er backlog.
4. ✅ **Slette konto I APPEN** (Apple 5.1.1(v) — HARDT krav) — GODKJENT
   2026-08-02 (sen kveld): Brage slettet en abonnert testbruker på
   telefon og bekreftet selv i Stripe at abonnement + kunde var borte
   («Alt funker her nå!»). Modellen
   (spenningen bokføring vs GDPR, flagget i PAYMENTS.md): ANONYMISER,
   IKKE UTRADER — profilraden består som «Slettet bruker»-spøkelse
   (payment-radene peker på den med FK uten cascade, og laginnhold
   består uten navn — samme prinsipp som remove_team_member), alt
   personlig slettes. Migrasjon `00042` (i prod, verifisert via
   Management-API: FK profiles→auth.users DROPPET så profilen
   overlever auth-slettingen; `delete_account_data`-RPC — service-
   role only, idempotent, én transaksjon: hard-delete av medlemskap/
   RSVP-er/barn/husstand/enheter/varsler/reaksjoner + anonymisering).
   Edge Function `delete-account` (deployet, verify_jwt):
   sikkerhetsrekkefølgen er Stripe FØRST (kanseller levende abonnement
   + slett kunden — feiler Stripe reelt, avbrytes alt før noe er rørt;
   4xx tolereres som «allerede borte»), så RPC-en, så auth-brukeren
   SIST (frem til da kan brukeren prøve igjen). Ny `stripeDelete` +
   `StripeApiError` i `_shared/stripe.ts`. UI: «Slett konto»-rad på
   Profil (Innstillinger, mellom Logg ut og Om Heia) → to
   destructive-bekreftelser → lokal signOut. Verifisert i prod-DB:
   ingen FK-er mot auth.users utenfor auth-skjemaet (auth-slettingen
   kan aldri blokkeres av storage e.l.).
5. ✅ **Vilkår + personvern-URL** — LIVE på heiaapp.no/vilkar/ og
   /personvern/, og FERDIGSTILT 2026-08-02 (natt) med Brages tre
   beslutninger: aldersgrense **13 år**, refusjon = **14 dagers
   angrerett + alltid feiltrekk-refusjon + ingen refusjon av
   gjennomførte måneder**, og **ingen personnavn** — juridisk enhet
   står som plassholdere til AS-et finnes. Samtidig lukket to hull:
   Supabase-regionen er verifisert (London/Storbritannia) så
   «Hvor opplysningene lagres» kunne skrives, og APPEN LENKER NÅ TIL
   SIDENE (Profil-rader + samtykkelinje på registrering — den fantes
   ikke før, og vilkårsteksten påstod at man godtok dem).
   ⚠️ **GJENSTÅR:** `[JURIDISK SELSKAPSNAVN]` /
   `[ORGANISASJONSNUMMER]` / `[FORRETNINGSADRESSE]` i BEGGE filer +
   privacy nutrition labels (skjema i App Store Connect) — begge MÅ
   være gjort før App Store-innsending.
✅ Avklart: auth er e-post+passord (Supabase) uten tredjeparts-login →
«Sign in with Apple» (4.8) kreves IKKE. Betalingsmodellen er alt
3.2.2(iv)-kompatibel. Events kan alt avlyses.

**Barene (LÅST):** intern TestFlight (Brage selv) trenger IKKE V1-
hygiene — start så snart native-runden er gjort. Ekstern TestFlight
(Ridabu-foreldrene), nettsiden og App Store-innsending VENTER på
V1-hygienelisten.

**Rapporter — Brages beslutning 2026-08-02 (LÅST): ingen
gjennomgangsplikt.** Brage spurte om han «virkelig må se alt som er
rapportert, ellers dropper vi dette». Svar/beslutning: RUTINEN droppes
— ingen skal sjekke noe dashboard. KANALEN består, av tre grunner som
ikke er forhandlingsbare: (a) Apple 1.2 krever en flaggemekanisme i
UGC-apper — uten den ryker innsendingen; (b) den dekker tilfellet der
TRENEREN er problemet — medlemmer kan ikke slette adminers innhold, så
rapport til Heia er eneste utvei; (c) barnebilder: en forelder som
krever et bilde av sitt barn fjernet MÅ nå noen som kan handle.
Konsekvens: e-postvarsel per rapport (restansen under) er det som gjør
plikten HELT passiv — null arbeid til en e-post lander, og den vil
nesten aldri lande. Inntil varselet er koblet: brukerbasen er Brage +
testkontoer, så det finnes reelt ingenting å overse.

**Hva skjer når noen rapporterer? (bakgrunn):**
Ingen forhåndsmoderering — Apple krever ikke at Heia overvåker innhold,
bare at brukere KAN rapportere og at det ryddes når en rapport kommer
(1.2-forventningen er reaksjon innen ~24 t på rapportert innhold).
Flyten i praksis: (1) det meste løses I LAGET — trener/lagleder kan alt
slette alt selv, uten Heia; (2) en rapport lander som rad i
`content_reports` med frossen kopi av innholdet; (3) volumet vil være
tilnærmet null i lukkede lag (Ridabu + testlag i dag). RESTANSE FØR
EKSTERN TESTFLIGHT (Brage-avhengig, si fra tidlig): e-postvarsel per
rapport til hello@heiaapp.no via Edge Function + database-webhook —
trenger en e-posttjeneste (f.eks. Resend, gratis tier; ~15 min å koble
når nøkkelen finnes). Inntil da er dashboardet sjekken:
```sql
-- Åpne rapporter (kjør i SQL-editoren):
SELECT created_at, entity_type, reason, content_snapshot, team_space_id
FROM content_reports WHERE status = 'open' ORDER BY created_at;
-- Lukk en sak:
UPDATE content_reports SET status = 'resolved', resolved_at = now(),
  resolution_note = '…' WHERE id = '…';
```

### 📱 V1-hygiene del 2 — telefontest (✅ BESTÅTT + GODKJENT 2026-08-02 sen kveld — «Alt funker her nå!»; testbruker MED abonnement slettet, Stripe-siden verifisert av Brage. Punkt 7, vilkårs-TODO-ene, står ÅPENT)

**NB: kontosletting er ekte og kan ikke angres — test med en
testbruker.** Testbrukeren bør gjerne ha: et innlegg, en kommentar,
et RSVP på kommende hendelse, og (valgfritt, beste testen) en aktiv
støtteavtale i sandbox.

1. **Profil → Innstillinger:** ny rad «Slett konto» (søppelikon)
   mellom «Logg ut» og «Om Heia» — rolig stil, ingen rød alarm (Heia-
   språket; dramaet bor i dialogene).
2. Trykk → «Slette kontoen din?» med konsekvensene → «Slett kontoen»
   (rød) → «Helt sikker?» → «Ja, slett kontoen min» (rød). Avbryt-
   veiene skal virke begge steder.
3. Bekreft → underteksten flipper til «Sletter kontoen din …» → appen
   logger ut til innloggingsskjermen. Å logge inn igjen med samme
   e-post/passord skal FEILE (brukeren finnes ikke).
4. **Fra en annen konto i laget:** personen er borte fra Lagoversikt,
   RSVP-en deres på kommende hendelser er borte — men innleggene/
   kommentarene deres står igjen med forfatter **«Slettet bruker»**.
5. **Hadde testbrukeren en støtteavtale:** sjekk i Stripe-dashboardet
   (sandbox) at abonnementet er kansellert og kunden slettet; i appen
   viser Lagkassa én støttespiller mindre når webhookene har bokført
   kanselleringen.
6. **SQL-editoren (valgfri DB-sjekk):** profilraden finnes fortsatt
   med `display_name = 'Slettet bruker'` og `deleted_at` satt;
   `memberships`/`event_rsvps`/`device_tokens` for brukeren er tomme;
   `payment_transactions`-radene består urørt.
7. **Vilkårstekstene:** les utkastene i `web/vilkar/index.html` +
   `web/personvern/index.html` (åpne filene i nettleser lokalt) og
   svar på de 3 TODO-ene i HTML-kommentarene.

### 📱 V1-hygiene del 1 — telefontest (✅ BESTÅTT + GODKJENT 2026-08-02 — «Alt funker fra del 1»)

1. **Feeden:** hvert innlegg har en diskré ⋯ øverst til høyre. På ditt
   eget: «Slett innlegget» (bekreftelse → borte med én gang). På andres
   (bruk en annen bruker/testkonto): «Rapporter til Heia» (årsaksvalg →
   «Takk for beskjeden 💚»).
2. **Som trener/lagleder:** ⋯ på ANDRES innlegg viser BÅDE «Rapporter»
   og «Slett innlegget» — slett et og se at det forsvinner for alle
   (den andre brukerens feed oppdaterer seg via realtime).
3. **Kommentartråden:** ⋯ på innleggskortet øverst OG på hver
   kommentarboble. Slett en egen kommentar (borte + telleren på
   feed-kortet går ned). Sletter du selve innlegget fra tråden, går
   appen tilbake til feeden.
4. **Slett et BILDE-innlegg** (eget): posten forsvinner; bildet skal
   ikke dukke opp igjen noe sted (media er soft-slettet + filen fjernes
   best-effort).
5. **Rapportér noe som en vanlig bruker**, og verifiser i SQL-editoren
   at raden ligger i `content_reports` med content_snapshot. Rapportér
   det SAMME en gang til → fortsatt bare én åpen rad (idempotent).
6. **Lagoversikt (som trener):** foreldre-/spillerrader har ⋯ →
   «Fjerne … fra laget?» (teksten nevner barna når personen har barn i
   laget). Fjern en testbruker: personen forsvinner fra listen, mister
   tilgangen umiddelbart (testbrukerens app faller ut av laget), og
   RSVP-ene deres på KOMMENDE hendelser er borte. Din egen rad og andre
   trenere/lagledere har INGEN ⋯.
7. **Vaktene:** som forelder (ikke-admin) finnes ingen slette-valg på
   andres innhold og ingen ⋯ i Lagoversikt — og databasen ville uansett
   avvist (RPC-vaktene er sannheten, UI-et speiler bare).

### 📱 Fase 5 del 1 — telefontest (✅ BESTÅTT + GODKJENT 2026-08-02 — «Alt funker fra fase 5»)

1. **Hjem:** bunnkortet «Støtt laget» er BORTE. Bla i hero-karusellen →
   💚 LAGKASSA-kortet («60 kr til laget hver måned · 1 støttespiller») —
   trykk → LagkassaScreen.
2. **LagkassaScreen:** hovedtallet er 60 kr/mnd (klubb-perspektiv),
   «59,25 kr samlet inn» (historisk — første betaling var 75/25, frossen
   med vilje), fordelingskortet «79 kr i måneden — 60 kr går direkte til
   laget» + 3-av-4-linjen, og «Du er en av dem 💚» (du støtter alt).
3. **Sesong-siden:** lagkassa-kortet nederst, lyst på stadionmørket.
4. **Støtt laget-siden:** priskortet sier nå «60 kr går direkte til
   laget»; 19-kroners-forklaringen står diskret under CTA-en.
5. **Profil → «MIN STØTTE»:** raden «Ridabu G10 · 79 kr/mnd · 60 kr går
   til laget · Aktiv · fornyes 2. september». Trykk → Stripe Customer
   Portal i Safari (endre kort / se kvittering / ev. test en oppsigelse —
   kanselleringen synker via webhook og raden viser «Avsluttes …» når du
   er tilbake; reaktiver gjerne i portalen etterpå).
6. Som IKKE-supporter (annen bruker): Lagkassa viser CTA «Støtt laget ·
   79 kr/mnd», og Profil viser «Min støtte» med rolig tom-rad
   («Du støtter ingen lag ennå» — review-fiks 2026-08-02, se under).

**Review-funn 1 (Brage 2026-08-02, FIKSET — Metro-reload):** «Min støtte»
skal ALLTID stå på Profil — før fiksen fantes seksjonen kun når fetchen
var ferdig OG ga rader (pop-in etter betaling; usynlig for
ikke-supportere). Nå: seksjonen rendres alltid — skeleton-rad under
første last, «Du støtter ingen lag ennå» uten avtaler (ingen CTA —
«ingen inngang på Profil» står), og en modul-cache gjør at supporterens
rad vises umiddelbart ved remount (nulles ved utlogging).

**Review-spørsmål 2 (Brage): automatisk retur til appen etter betaling?**
Svar gitt: det er heiaapp.no steg 1–3 + native-runden (Universal Links) —
hører til STRIPE-sporets fase 6, ikke nettside-prosjektet. NB: selv da
viser Safari typisk «Åpne i Heia»-knapp/banner fremfor auto-hopp
(forventningen står i HEIAAPP-NO.md) — landingssiden er opplevelsen.

**Review-runde 2 (Brage 2026-08-02): FASE 5 GODKJENT («Alt funker fra
fase 5!») + siste justering FIKSET (Metro-reload):** tom-raden i
«Min støtte» er TRYKKBAR → Lagkassa (chevron + «Se lagkassa og hva
støtten betyr for laget»). Brages premiss: veien til å støtte skal være
enklest mulig å finne. Raden går bevisst til LAGKASSA, ikke rett på
betalingssiden — «hvorfor» før «betal», og Lagkassa eier alle
tilstander (uaktivert klubb osv.). Uten aktivt lag: ren
informasjonsrad. «Ingen inngang på Profil»-beslutningen er dermed
PRESISERT, ikke veltet: aldri salgs-/kampanjekort på Profil — tom-raden
er veiviser. **Verifiser på telefon:** som ikke-supporter, trykk raden
→ LagkassaScreen (Hjem-fanen aktiveres).

**Review-funn 3 (Brage 2026-08-02, FIKSET — Metro-reload): Lagkassa
lastet ikke smooth** ved første besøk (fra Profil-tom-raden): kun heroen
hadde skeleton — fordelingskortet og CTA-knappen var SKJULT under
lasting og poppet inn når svaret kom (dyttet «Hva støtten betyr»
nedover). Nå: full skeleton-dekning (fordelingskort-bones + knappeformet
bone i CTA-en) så sidestrukturen står fra første frame, + modul-cache
per (bruker, lag) — gjenbesøk viser tallene umiddelbart, som «Min
støtte» på Profil. **Verifiser:** trykk tom-raden på Profil → Lagkassa
skal ligge rolig mens den laster (ingen hopp), og andre gangs besøk
skal vise tall med én gang.

### 📱 Fase 4 — telefontest (✅ BESTÅTT + GODKJENT 2026-08-02 — PENGEVEIEN DB-VERIFISERT)

**Brage betalte med privat kort via APPLE PAY i sandbox** (ekte kort
belastes aldri i sandbox — tokenisert test-charge; Apple Pay-funnet
bekreftet: virker uten eget domene). **Claude verifiserte i prod-DB:**
abonnement `active` (periode → 2026-09-02), transaksjonsrad `succeeded`
med frossen splitt **7900/1975/5925** (bps 2500), provider-gebyr 488 øre
fra balance transaction, charge+transfer-id satt. Webhookene: 4/4
`processed`, attempts=1 — og expired-vakten fra samme morgen reddet en
forlatt førstesesjon i første reelle kjøring. **Gjenstår av testlisten:
punkt 1/3/5 bekreftes av Brage (pris-visningen, «DU STØTTER LAGET 💚»-
flippen, avbryt-grenen) → deretter fase 4-review.**

Opprinnelig testliste (Metro-reload holder), på Ridabu G10:
1. Hjem → «Støtt laget»-kortet → skjermen viser **79 kr/mnd** (fra
   offeringen, ikke mockup) + «utbetales til RIDABU IDRETTSLAG».
2. Trykk CTA-en → Safari åpner Stripe Checkout. Betal med testkortet
   `4242 4242 4242 4242` (utløp frem i tid, CVC 123, norsk postnr).
   Sjekk gjerne om **Apple Pay**-knappen vises (funn: skal virke uten
   eget domene på hosted checkout).
3. Suksess-siden er ren tekst («💚 Tusen takk for støtten!») → gå
   tilbake til appen → skjermen skal flippe til «DU STØTTER LAGET 💚»
   (webhooken rekker det som regel før du er tilbake; ellers dra ned).
4. **Pengeveien (fase 2-restansen — si fra når du har betalt, så
   verifiserer Claude i DB):** transaksjonsrad med frossen splitt
   (gross 7900 / fee 1975 / klubb 5925), `provider_fee_minor` fra
   balance transaction, abonnement `active` med periode-slutt.
5. Avbryt-grenen: start en ny checkout fra et annet medlem (eller
   testklubb), trykk tilbake i Safari → cancel-siden → appen viser
   fortsatt tegneflaten, og «prøv igjen» fungerer.

### 📱 Fase 3 — E2E-telefontest ✅ BESTÅTT ×2 + REVIEW GODKJENT 2026-08-01
**Runde 1 (Ridabu IL):** claim fra appen med orgnr `000000000` → reviewen
(Brønnøysunds åpne API) fant at orgnr ikke finnes → godkjent med
registerets verdier via approve-overriden (875661582 / RIDABU IDRETTSLAG)
→ lat sandbox-kontoopprettelse → onboarding → account.updated → **AKTIV**.
Ridabu består som aktivert pilotklubb.
**Runde 2 (Stange Sportsklubb, testklubb):** avslagsgrenen — falskt orgnr →
avslått med begrunnelse («IKKE GODKJENT»-kortet verifisert på telefon) →
ny søknad med ekte orgnr → godkjent → onboarding runde 2 → **AKTIV**.
**Stange-testdataene er RYDDET** (i avhengighetsrekkefølge; webhook_events
består by design).
**Funn i testen (fikset + deployet):** Supabase omskriver text/html fra
`*.supabase.co`-funksjonsdomenet til text/plain + CSP sandbox + nosniff
(anti-phishing; HEAD berøres ikke — curl-røyktest med HEAD lyver!).
Landingssiden er nå ren tekst m/ charset («💚 Heia!»); pen side/ingen side
krever domene → førsteoppgave i fase 4. Brage vil ha «egen UI etter
innsending» — nivåene står i PAYMENTS.md §Fase 3 (in-app-browser krever
native rebuild; betalingen forblir ekstern Safari, låst).

---

## ▶️ NESTE — start her

**1. ✅ Git er ryddet** (2026-07-30 kveld). PR #17 er merget til `main`,
squash-konflikten er løst med `-s ours` (`474e46c`), alt er pushet, og
`Brage..origin/main` = 0. **En ny PR fra `Brage` er konfliktfri nå.** Se
«🔁 Squash-mønsteret» i git-seksjonen for oppskriften neste gang.

**2. ✅ Sesongflaten er KODET og sett på telefon** (produktkandidat 5).
Migrasjonene `00030`+`00031` er deployet. Bruker fant at toppscorerlisten
viste fritekst → **LÅST beslutning: ingen spillerstatistikk før strukturert
spillerstall finnes; toppscorerne er fjernet** (detaljer i seksjonen
«✅ SESONGFLATEN» under). Gjenstår kun: reload og se at flaten står riktig
uten scorer-seksjonen.

**3. ✅ TURNERINGER + VÅR/HØST-SESONGER er KODET og OMLAGT etter første
brukertest** (migrasjoner `00032`+`00033` deployet). Brukeren likte ikke
turneringen som kalenderkort — nå bor turneringene i sesongsidens velger
(«Vår 2026 · Høst 2026 · 🏆 Hamar Cup» + «+ Ny turnering»), kalenderen viser
kampene, og kampskjemaet har et «Turnering»-felt når det finnes turneringer.
Se seksjonen «✅ TURNERINGER + VÅR/HØST-SESONGER» for modellen og testlisten.
**Bruker godkjente flyten 2026-07-30 (natt) → alt er committet og pushet.**

**4. ✅ LAGFARGE er FERDIG** — verifisert på telefon av bruker og committet
2026-07-31. Kuratert palett ved lagopprettelse + «Lagfarge»-rad på Profil
(kun trener/lagleder/admin) + mørke initialer på gult lagmerke.

**5. 🗺 DESIGN-POLISH-PLANEN er i gang: `docs/DESIGN-POLISH-PLAN.md`** —
9 skiver (P1 skeletons → P2 MÅL-øyeblikket → P3 header, deretter P4–P9) +
backlog. Brages valgte rekkefølge. **P1–P9 er FERDIG (alle godkjent på
telefon 2026-07-31) — HELE P-PLANEN ER I MÅL. P9 endte som kompakte
hero-kort etter tre retningsrunder (se «🗓 P9» under), og beslutningen
«ingen visningstoggle i kalenderen i v1» er LÅST. Gjenstår: backloggen
i planen, deretter kandidat 2 (kommentarer + heiing i kamptidslinja).**
LÅST underveis: **klubblogo bor på KLUBBEN** (`clubs.logo_url` finnes alt),
write-once for lagadmin i klubben, aldri overskriving i MVP — detaljer og
begrunnelse i planens P4. Start design-samtaler med: «Les
docs/STATUS-HANDOFF.md og docs/DESIGN-POLISH-PLAN.md, og ta neste åpne
punkt.»

Deretter (etter polish-planen): kandidat 2 (kommentarer + heiing synlig i
kamptidslinja).

**Fortsatt uverifisert (din jobb):** skive 5 (kamprapporten). **Skive 6,
LAGFARGEN og P1–P9 er FERDIG** (bruker-verifisert 2026-07-30/31).

---

## 🗓 P9 — KALENDEREN: RYTME, IKKE GRID (✅ FERDIG — godkjent på telefon 2026-07-31)

Niende og siste P-skive i design-polish-planen. **To retningsrunder
samme dag:** Claude anbefalte «miniatyr av hendelsessiden» (P5B-bånd på
hvite kort) og Brage valgte den i samtalen — men AVVISTE den på telefon:
for store hvite «admin»-flater, og spilte kamper ble dobbelt mørke-tunge
(bånd + stripe). **Brages endelige retning (GJELDER): kompakt
hero-variant** — Hjem-heroens designspråk i kalenderformat (mint/varm
gradient, runde former, svak banegrafikk, type-chip, dato/tid i kortet,
RSVP/progress nederst), kamp mørk/dramatisk, ingen store hvite flater;
skannbar OG umiddelbart samme Heia som Hjem. Ingen migrasjon, ingen
native-deps — ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra
før).

- **`EventCard` er skrevet om til en kompakt hero.** Lys variant
  (trening/sosialt/turnering/annet): SAMME mint→krem-gradient og
  banedekor som NextEventHero (arcs skalert ned), type-pill med prikk +
  dagetikett (heroens dayLabel: «I dag», «I morgen», «Fredag 12. jun») +
  tid i displayfonten (19, heiaDeep), tittel 18, MapPin-rad,
  mint-progress + «N kommer». Datoblokken (SØN/17/JUN) er borte —
  dagetiketten bærer datoen.
- **Kamp = mørk/dramatisk:** `StadiumSurface` med **RINGEN PÅ og flomlys
  AV** (ringen er kampens signatur — Brage OPPHEVET «maks ett sted per
  skjerm»-regelen i runde 3, kommentaren i StadiumSurface.tsx er
  oppdatert; flomlyset er live-kampens dramatikk — kommende/spilt kamp
  skal være «litt svakere»), kamp-pill, mint avsparkstid, sted i
  stadiumDim.
  Standardtittelen «Kamp mot Lyn» strammes til «Mot Lyn» (pillen sier
  alt Kamp); egne titler vises som de er. **Spilt/pågående kamp:
  stillingen som bunnrad I kortet** (label + evt. SEIER-pill + score i
  mint display) — ingen egen stripe-flate lenger, kortet ER mørkt.
  Live: coral «PÅGÅR NÅ» + prikk; `featured` = coral kant.
- **Avlyst kamp:** lys variant med nøytral «Avlyst»-pill — en avlyst
  kamp er ingen kampdag.
- **RSVP-progressen** (mint-fyll + «N kommer») skjules i arkivet, på
  avlyste, og når stillingen har tatt over kortet. RSVPBar-komponenten
  lever videre på hendelsessiden.
- **Fra runde 1 består:** månedsseksjoner i stedet for «Kommende»
  («August»; «Januar 2027» ved annet år), dempede månedsskiller
  (tertiær, ingen mint-strek) i arkivet, `past`-prop (opacity 0.6 +
  skjult oppmøte — kun kalenderen sender den), og `EventCardSkeleton`
  som speiler kortformen (pill + tid, linjer, progress-bone).
- Turneringslisten på hendelsessiden bruker samme kort → kampene der er
  mørke kompakthero-kort.
- **LÅST (Brage spurte selv ved godkjenningen): ingen visningstoggle i
  v1.** Listen er kalenderens ene, gjennomtenkte visning — en toggle
  dobler designflaten, og hero-kortene har ingen god grid-form.
  Uke-/månedsvisning tas opp ved reell tetthet (turneringshelger, flere
  lag) eller når foreldre faktisk spør.

**Runde 3 (samme dag — Brages telefonfunn på hendelsessiden + Hjem):**
- **Hendelsessidens infokort = samme hero-flate:** P5B-aksentbåndet er
  erstattet av ny delt **`HeroSurface`** (components — StadiumSurfaces
  LYSE tvilling: mint→krem-gradient + banedekor, gjenbrukes av
  EventCard) med type-pill, stor tid (24, heiaDeep), dato i fet, tittel,
  sted og beskjed. Avlyst kamp får nøytral «Avlyst»-pill.
  Kampdag-platta, live-modus og kamprapporten er urørt (de er alt på
  stadionspråket — kampdag-platta har hatt ringen hele tiden).
- **Kommende kamp på HJEM-heroen er stadionmørk:** `NextEventHero`
  rendrer kamp på StadiumSurface med ring, flomlys av, mint avspark,
  «Mot X»-tittelregelen og RSVP-progress på mørk track — samme uttrykk
  som kalenderens kampkort («samme hero» — Brages krav). Lys hero for
  alt annet er urørt; P8-karusellen selv er ikke endret.

### Test dette først (Metro-reload)
1. Kalenderen: trening/sosialt/turnering = kompakte gradient-hero-kort
   (pill + dagetikett + stor tid + sted + «N kommer»-progress) — skal
   umiddelbart kjennes som Hjem-heroen, ingen hvite adminflater.
2. En kommende kamp: mørkt stadionkort med RINGEN nede til høyre, mint
   avsparkstid, «Mot X» — og RSVP-progress på mørk track. En kamp med
   egen tittel («Seriefinalen») viser den i stedet. Roligere enn
   live-banneret (ingen flomlys-glød).
3. En spilt kamp: mørkt kort med «SLUTTRESULTAT»-bunnrad + SEIER-pill
   ved seier — ÉN mørk flate, ingen stripe-i-kortet.
4. Live kamp: coral kant + «PÅGÅR NÅ» med prikk; LiveBadge på
   «I dag»-etiketten.
5. Arkivet: kortene er dempet, oppmøtet er skjult, og dempet
   månedsetikett («JULI», «JUNI» …) når måneden bytter. Fremover:
   «I dag / I morgen / Denne uken», så «August», «September» som egne
   seksjoner med mint-strek.
6. Turneringslisten inne på en turnering (hendelsessiden): mørke
   kompakthero-kampkort — sjekk at de ser riktige ut der og IKKE er
   dempet.
7. **(Runde 3)** Hendelsessiden for en trening/sosialt: infokortet er
   hero-flaten (gradient + banedekor + pill + stor tid + dato) — ingen
   hvit adminflate. Beskjeden («Vi øver på pasninger!») står i kortet.
8. **(Runde 3)** Hjem-karusellen: kommende KAMP er mørk med ring og mint
   avspark («Mot Ottestad»); trening-heroen er lys som før. Live-banner
   og kampdag-platta på kampsiden ser ut som før.

---

## 🎠 P8 — HERO-KARUSELL PÅ HJEM (✅ FERDIG — godkjent på telefon 2026-07-31)

Åttende skive i design-polish-planen (Brages forslag: bla bortover på
øverste hendelse). Ingen migrasjon, ingen native-deps — ren JS.
`npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Ny `NextEventCarousel` (components):** horisontal FlatList med
  `pagingEnabled` — sidene er skjermbredde (`useWindowDimensions`) og
  bærer skjermmargen selv, så TeamHome legger karusellen i en wrapper
  UTEN horisontal padding (`carouselSection`, kun paddingTop). Alle
  sidene (maks 4) rendres med én gang (`initialNumToRender`) så
  listehøyden settes av det høyeste kortet og ikke hopper når man blar.
- **Sidene:** de neste inntil 3 hendelsene som `NextEventHero` (urørt)
  + et siste «Åpne kalenderen»-kort: hvit flate, Calendar-ikon i
  heiaTint-sirkel, «Treninger, kamper og alt som skjer». Kortet fyller
  sidehøyden (flex) og navigerer til Kalender-fanen via
  `getParent().navigate('KalenderStack')` — samme idiom som NewEvent.
- **Prikkene under:** aktiv = mint pill (18×6, `colors.heia` — samme
  språk som RSVP-fyllet i heroen), inaktive = dempet mørkgrønn 6 px.
  Aktiv side spores via `onMomentumScrollEnd` (clampet mot sideantall).
- **`pickNextEvent` → `pickNextEvents(events, 3)`** i TeamHomeScreen
  (samme filter som før: avlyst/ferdig hoppes over, uten sluttid = start
  + 2 t); state `nextEvent` → `nextEvents`.
- **Live-kampen beholder hero-prioritet:** karusellen rendres kun i
  hverdagsmodus (ingen `liveMatch`) — og uten kommende hendelser vises
  ingen karusell i det hele tatt (aldri et ensomt kalenderkort).

### Test dette først (Metro-reload)
1. Hjem uten live kamp, med flere kommende hendelser: bla bortover —
   inntil 3 hendelseskort + «Åpne kalenderen»-kortet bakerst; prikkene
   følger med, aktiv prikk er mint pill.
2. Trykk et hendelseskort → hendelsessiden. Trykk kalenderkortet →
   Kalender-fanen.
3. Kun ÉN kommende hendelse → to sider (hendelsen + kalenderkortet).
   Ingen kommende hendelser → ingen hero (som før).
4. Start en kamp → live-banneret tar hero-plassen alene; avslutt →
   karusellen er tilbake.
5. Sidebyttet skal snappe rent (paging), høyden skal ikke hoppe mellom
   sider, og vanlig vertikal scrolling av feeden skal ikke forstyrres.

---

## 👤 P7 — PROFIL-POLISH (✅ FERDIG — godkjent på telefon 2026-07-31)

Sjuende skive i design-polish-planen + Brages ønske samme dag: lagmerkene
under «Dine lag» skal vise LOGOEN når den finnes, ikke bare lagfargen.
Ingen migrasjon, ingen native-deps — ren JS. `npx eslint src`: 0 errors,
2 warnings (begge fra før).

- **Toppen på varm bakgrunnstone:** profilseksjonen (avatar/navn/rolle)
  er ikke lenger et hvitt kort med skygge — den ligger rett på
  `background`, og luften øverst er strammet (paddingTop 2xl→lg, gap
  sm→xs). Forelder-rollepillen fikk hvit flate + subtil kant (den gamle
  background-tonen forsvant mot den nye bakgrunnen).
- **«Dine lag» viser lagmerket:** 12 px-fargeprikken er erstattet av
  `TeamBadge` (36 pt sirkel) per medlemskap — fallback-kjeden lag-logo →
  klubblogo → initialer på lagfarge, samme som headeren/kampsiden.
  **`TeamBadge` fikk `logoUrl`/`color`-props som overstyrer context** —
  den var låst til AKTIVT lag, og Profil-listen viser alle lagene dine.
  Utelatt prop = context-kjeden som før, så alle gamle kallsteder
  (ScoreBoard, LiveMatchBanner, TeamHeader, EventDetail) er urørt.
  Aktiv-haken er nå tegnet `Check` i heiaInk (før tekst-«✓»).
- **To menykort med mint-strek-etiketter** (seksjonsskillet lag ↔
  innstillinger fra planen): «[LAGNAVNET]» (Lagoversikt, Laginnstillinger
  (kun trener), Inviter til laget) og «INNSTILLINGER» (Telefonnummer,
  Bli med i et lag, Opprett et nytt lag, Varslinger, Logg ut, Om Heia).
  Uten aktivt medlemskap rendres lag-kortet ikke.
- **Konsekvent ikonlogikk:** alle rader har tegnet Lucide-ikon
  (textSecondary, 20 pt) i fast 28 px-slot — de tomme streng-slotene og
  🔔-emojien er borte. Fire nye ikoner i icons.tsx-eksporten: `LogOut`,
  `Settings`, `Share2`, `UserPlus`. `ChevronRight` (textTertiary) på alle
  navigasjonsrader — `ListRow`s `right`-prop endelig i bruk;
  handlingsrader (Telefonnummer, Varslinger, Logg ut) har bevisst ingen
  chevron. Laginnstillinger-raden bruker Settings-ikonet — fargeprikken
  der er borte; lag-identiteten bor nå i «Dine lag»-kortene.

### Test dette først (Metro-reload)
1. Profil-fanen: toppen ligger på kremtonen (ikke eget hvitt kort),
   luften øverst er strammere, rollepillen leses fortsatt tydelig.
2. «Dine lag»: laget med logo viser LOGOEN i sirkelen; lag uten logo
   viser initialer på lagfargen. Aktivt lag har mint-flate + hake som før,
   og lagbytte fungerer.
3. To kort under: «[lagnavnet ditt]» og «Innstillinger» med
   mint-strek-etiketter; alle rader har ikon, og navigasjonsradene har
   chevron til høyre.
4. Trykk deg gjennom radene — alle går dit de skal (Lagoversikt,
   Laginnstillinger, Inviter, Bli med, Opprett, Varslinger, Logg ut).
5. Som forelder: ingen «Laginnstillinger»-rad; lag-kortet viser
   Lagoversikt + Inviter.
6. Headeren, kampsiden og live-banneret ser ut som før (TeamBadge-
   endringen er kun nye valgfrie props).

---

## 📬 P6 — VARSLER-LISTEN (✅ FERDIG — godkjent på telefon 2026-07-31)

Sjette skive i design-polish-planen — **scope omskrevet av Brage samme
dag: det gamle P6-punktet om globalt kontrastpass (mørkne
textSecondary/textTertiary) var en misforståelse og er STRØKET.** Dette
er ren Varsler-polish: luft i raden + tidsbolker. Ingen migrasjon, ingen
native-deps. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Tidsbolker i `InboxScreen`:** «I dag / I går / Siste 7 dager /
  Tidligere» med appens mint-strek-etikett (`SectionHeader`) over hvert
  listekort. Radene kommer nyest først fra serveren (`ORDER BY created_at
  DESC`), så `groupByAge` er en enkel run-deling — rekkefølgen består,
  tomme bolker finnes ikke. Fortsatt samme enkle liste — IKKE kort per
  varsel (Brages ord).
- **`NotificationRow` — tydeligere avstand avsender/innhold/tidspunkt:**
  paddingVertical md→lg, gap tittel↔innhold 2→4, gap tittel↔tidspunkt
  sm→md. Ulest-flaten (heiaSoft) + grønn prikk er urørt.
- **Tidsstempelet:** «I går»/«3 d» → ukedag («tir.») for 1–6 dager siden —
  bolk-etiketten sier alt «I går», raden skal ikke gjenta den. Eldre enn
  7 dager: dato («12. jul») som før.
- **Luft-eierskap:** headerens marginBottom er flyttet til
  seksjonsetikettens eget topp-rom; skeleton/feil/tom-tilstandene har
  egen `standalone`-margin i stedet.

### Test dette først (Metro-reload)
1. Varsler-fanen med blandede varsler: bolkene «I dag», «I går» osv. med
   mint-strek-etikett — og bare bolker som faktisk har innhold.
2. Radene: mer luft mellom tittel, innholdstekst og tidspunktet til
   høyre; listen skal fortsatt være én enkel flate, ikke store kort.
3. Et varsel fra i går viser ukedag («ons.») — ikke «I går» dobbelt opp
   mot etiketten.
4. Ulest: heiaSoft-flate + prikk som før; «Merk alle som lest» virker.
5. Tom inbox og feil (flymodus + dra ned): kortet ligger med samme luft
   under headeren som før.

---

## 🎨 P5 + P5B — KAMPFORLØPET + HENDELSESSIDEN (✅ FERDIG — godkjent på telefon 2026-07-31)

Femte skive i design-polish-planen (P5 skannbarhet + P5B hendelsessidens
hero, samme samtale som planlagt). Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **P5 — markørene i kampforløpet (`MatchEventRow`):** ny `markerFor(event)`
  erstatter de statiske ikon/farge-tabellene — markøren avhenger nå av
  `teamSide`, ikke bare type. **Ballen betyr MÅL og ingenting annet:**
  avspark/fortsettelse har Play-pil på dempet `surfaceMuted` (før heiaTint —
  avspark er ikke feiring). **Mål for oss:** mint-sirkel + liten gull-prikk
  med hvit kant (feiring: grønt/gult). **Mål imot** (og mål uten `teamSide`):
  dempet nøytral — aldri coral («ingen TAP-roping»). **Slutt:** stadion-mørk
  markør (`colors.stadium`, Flag i `stadiumText`).
- **P5 — glyfene erstattet:** `bytte` = Lucide `ArrowLeftRight` (tegnet
  versjon av ↔), `kort` = ny egen svg **`BookingCard`** i icons.tsx (FYLT
  gull-rektangel, lett helning, goldInk-kant — Lucide har kun
  stroke-rektangler, og et dommerkort er en fylt flate). `MatchPhotoSheet`
  beholder tekst-glyfene bevisst — der er de del av en ren tekstetikett i
  øyeblikk-velgeren, ikke tidslinje-markører.
- **P5B — info-kortet (trening/sosialt/turnering/annet + avlyst kamp):**
  type-tonet aksentbånd øverst i kortet (infoSoft/remindSoft/sun/
  surfaceMuted — pillenes semantikk) med typeetiketten i båndets ink-farge
  (en pill i softfargen ville druknet i bånd av samme farge), stort
  klokkeslett i displayfonten (Nunito 24) til høyre, dato i fet under.
  Metalisten (Dato/Tid/Sted-label-rader) er borte; sted er en rolig
  MapPin-rad i kortkroppen. `MetaRow`-hjelperen er slettet.
- **P5B — KAMPDAG (kommende kamp med motstander):** mørk mini-platte
  (`StadiumSurface`, cardResting — roligere enn ScoreBoard): «KAMPDAG» +
  dato øverst, lagmerkene (TeamBadge m/ logo + motstander-initialer på
  ScoreBoard-grå) rundt stort avsparkstidspunkt i mint (Nunito 32, UTEN
  glød — gløden er live-scorens signatur), «Avspark»-caption, sted sentrert
  nederst. Standardtittelen («Kamp mot Lyn») vises ikke (platta sier det
  samme); egendefinert tittel vises. Kamp uten motstander → info-kortet med
  kamp-aksent. ReporterBar + «Start kamp» + RSVP under er urørt.
- **Vakten holdt:** live-modus og kamprapporten er ikke rørt.

### Test dette først (Metro-reload)
1. Åpne en spilt kamp (kamprapporten) → kampforløpet: mål for oss har
   mint-sirkel med gull-prikk, mål imot er grå, avspark/2. omgang har
   grå pil (ikke mint), slutt er mørk. Målene skal hoppe ut ved rask
   scrolling — resten skal ligge rolig.
2. Åpne en trening → kort med blått bånd øverst: «TRENING» + stort
   klokkeslett, dato i fet, sted med kartnål under tittelen. Sosialt =
   lilla bånd, turnering = gult.
3. Opprett/åpne en KOMMENDE kamp → mørk kampdag-platte: lagmerket ditt
   (logo!) mot motstander-initialer, stort avsparkstidspunkt i mint,
   sted nederst. «Start kamp»-knappen og RSVP står under som før.
4. Gi en kommende kamp egen tittel (f.eks. «Seriefinalen») → tittelen
   vises på platta; standard «Kamp mot X» vises ikke dobbelt.
5. Live-kamp og kamprapport-toppen (ScoreBoard) skal se HELT ut som før.

---

## 🛠 P4 — LAGINNSTILLINGER + KLUBBLOGO (✅ FERDIG — godkjent på telefon 2026-07-31)

Fjerde skive i design-polish-planen. Én migrasjon (deployet), ingen
native-deps (pickeren var alt inne). `npx eslint src`: 0 errors, 2 warnings
(begge fra før).

- **Modellen (LÅST, se planens P4):** klubblogo bor på KLUBBEN
  (`clubs.logo_url`, dødt felt fra 00002 — nå i bruk), **write-once** for
  lagadmin i klubben, aldri overskriving i MVP. Laglogo
  (`team_spaces.logo_url`) er per-lag-OVERRIDE og endres/fjernes fritt av
  lagadmin. Fallback-kjeden fra P3 (lag → klubb → initialer) lyser nå opp.
- **Migrasjon `00034_club_logo.sql` (✅ deployet):** ny helper
  `is_club_team_admin(club_id)` (lagadmin i ET av klubbens lag — brukes av
  både RPC og storage-policy). **Offentlig** bucket `club-logos` (logo er
  ikke persondata; signerte URL-er utløper og headeren/søket rendres
  konstant). Tre storage-policyer: klubb-INSERT (kun klubbens lagadmins,
  kun mens `logo_url IS NULL` — write-once også på filnivå), lag-INSERT og
  lag-DELETE (`is_team_admin` på første path-segment; en club_id gir false
  der, så ingen kan slette klubblogoer fra klienten). RPC
  `set_club_logo(p_club_id, p_url)`: SECURITY DEFINER (clubs er
  client-read-only, 00016-mønsteret), alle vakter i COALESCE (NULL-fella
  fra 00020), `FOR UPDATE`-lås mot samtidige opplastinger, og URL-en må
  peke inn i klubbens egen mappe i bucketen.
- **To RLS-fikser etter Brages telefonfunn samme kveld («new row violates
  row-level security policy» ved opplasting):**
  - **`00035`:** i klubb-INSERT-policyens EXISTS-subquery ble det
    UKVALIFISERTE `name` bundet til `clubs.name` (nærmeste relasjon i
    subqueryen), ikke `storage.objects.name` — write-once-sjekken
    sammenlignet klubb-id mot `foldername('Hamkam')` = NULL og policyen sa
    alltid nei. **Regel (samme familie som COALESCE-NULL-fella): ytre
    kolonner i policy-subqueries MÅ kvalifiseres (`objects.name`).**
  - **`00036`:** storage-API-et laster opp med `INSERT … RETURNING`, og
    RETURNING krever at raden også passerer en SELECT-policy —
    `club-logos` hadde ingen. **Regel: en bucket det lastes opp til
    trenger alltid SELECT-policy, også når den er offentlig** (public-URL-
    nedlasting går utenom RLS; API-ets insert-returning gjør ikke).
    feed-media virket hele tiden fordi 00018 har SELECT-policy.
  - Begge er verifisert direkte i SQL som Brages bruker (simulert JWT +
    `authenticated`-rolle): både klubb- og lag-path passerer nå med
    RETURNING. Testradene er ryddet. Fiksene er rene DB-endringer — ny
    test i appen krever INGEN reload.
- **Runde 2 av telefonfunn (2026-07-31, KODET — Metro-reload):** Brage
  bekreftet at opplastingen virker («Det funker!») og fant to ting til:
  - **Lagfarge-valg kastet deg til Hjem:** hver lagring på Laginnstillinger
    (farge/navn/logo) kaller `refreshMemberships`, som satte
    `loading=true` i TeamContext → AppNavigator (linje ~410) river ned
    hele navigatoren på loading → remount lander på Hjem-fanen. Fiks:
    **stille refresh** — `loadedForRef` i TeamContext; loading settes kun
    på FØRSTE last per bruker. Bonus: en refresh som feiler beholder nå
    forrige liste i stedet for å nulle den (et nettverksglipp kunne før
    sende en innlogget bruker til onboarding). Samme bug gjaldt gamle
    Lagfarge-raden på Profil — den har alltid hoppet til Hjem.
  - **Logoen manglet på kampsiden:** ScoreBoard og LiveMatchBanner tegnet
    initialer direkte. Ny delt **`TeamBadge`** (components) eier
    fallback-kjeden lag → klubb → initialer på lagfarge; brukes nå i
    ScoreBoard (kampside + kamprapport, 48 pt), LiveMatchBanner (42 pt)
    og TeamHeader (32 pt sirkel — refaktorert til samme komponent).
    På mørk stadionflate får logoen hvit plate (`logoPlate`) så
    transparente PNG-er ikke drukner. Motstander-merket er urørt.
- **`teams.ts`:** `uploadLogo` (nytt filnavn per opplasting — RN-Image
  cacher per URL, så en BYTTET logo må få ny URL), `setClubLogo`,
  `updateTeamLogo` (null = fjern; best-effort sletting av gammel fil),
  `updateTeamName` (display_name; `.select('id')`-vakta), `getClubForTeamSpace`;
  `searchClubs` returnerer nå `logoUrl`.
- **`media.ts`:** `pickLogoImage()` — rett til kamerarullen (ingen
  kamera-spørsmål; en logo ligger lagret) og resize 512 px (headeren skal
  ikke laste et 12 MP-foto).
- **Ny `TeamSettingsScreen`** (ProfilStack): fire kort — lagnavn
  (input + «Lagre navnet» når endret), lagfarge (TeamColorPicker inline,
  trykk = lagre), laglogo (forhåndsvisning i lagfarge-ring + Velg/Bytt +
  Fjern med bekreftelse), klubblogo (read-only med forklaring når den
  finnes; «Legg til klubblogo» når den mangler). Inngang: Profil-raden
  «Laginnstillinger» (fargeprikk-ikonet) — erstatter Lagfarge-raden, og
  `TeamColorSheet` er SLETTET (arket bodde kun der).
- **CreateTeam:** klubb-dropdownen viser `ClubBadge` (logo, initialer som
  fallback) ved hvert treff — dedup-incentivet fra planen.
- **`OnboardingContext.executeCreate`:** oppretter du en NY klubb kommer
  et valgfritt «Legg til klubblogoen?»-alert etter at laget er opprettet
  (ny `src/lib/clubLogo.ts`). Bor i executeCreate, IKKE i skjermen — da
  dekkes både direkteveien og auth-before-commit-resumet. Write-once-racen
  håndteres stille (rakk noen andre å sette logoen, hopper vi over).

### Test dette først (Metro-reload)
1. Profil som trener → «Laginnstillinger». Endre lagnavnet + «Lagre
   navnet» → headeren og Profil viser nytt navn.
2. Trykk en lagfarge-swatch → lagres direkte (ring + hake flytter seg),
   lagmerket skifter farge overalt.
3. «Velg laglogo» → bilde fra kamerarullen → lagmerket i headeren viser
   logoen (alle tre faner). «Bytt» og «Fjern» — fjern faller tilbake til
   klubblogo/initialer.
4. Klubblogo: mangler klubben logo → «Legg til klubblogo» → etterpå viser
   kortet den som read-only («deles av alle lag i klubben»). **NB: satte
   du en test-URL på `clubs.logo_url` i SQL under P3-testen, null den ut
   først** (`update clubs set logo_url = null where id = '…';`).
5. Profil → «Opprett et nytt lag» → søk klubb: treff viser logo-sirkel
   (initialer uten logo). Velg klubben MED logo → laget arver den i
   headeren uten mer oppsett.
6. Opprett et lag med NY klubb → etter opprettelsen: «Legg til
   klubblogoen?»-spørsmål (Senere / Velg bilde).
7. Som forelder: ingen «Laginnstillinger»-rad på Profil.
8. **(Runde 2)** Endre lagfarge/navn/logo på Laginnstillinger → du BLIR
   på siden (ingen hopp til Hjem).
9. **(Runde 2)** Åpne en kamp (og kamprapporten, og live-banneret på
   Hjem): lagmerket viser logoen på hvit plate — ikke initialer — når
   laget/klubben har logo.

---

## 🎽 P3 — HEADEREN SOM MOCKUPEN (✅ FERDIG — godkjent på telefon + committet 2026-07-31)

Tredje skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **`TeamHeader` matcher A v2-mockupen:** logo-SIRKEL (før: rundet firkant)
  + lagnavn + undertekst «Fotball · 18 medlemmer». Lagfarge-stripen under
  navnet er erstattet av underteksten — lagfargen bor nå i ringen rundt
  sirkelen + initial-fyllet. Vises på alle tre fanene (Hjem/Kalender/Varsler);
  Sesongen-chipen er urørt.
- **Logo-sirkelens fallback-kjede** (P4-modellen, kjeden står klar før
  URL-ene finnes): `teamSpace.logoUrl` → `club.logoUrl` → initialer på
  lagfarge (`inkOnTeamColor` — gult krever mørke initialer). `Club`-typen
  fikk `logoUrl`, mappet i `mapEnrichedMembership` (`clubs(*)` var alt med
  i selecten — feltet var bare ikke mappet). Feiler bildelastingen
  (`onError`) faller sirkelen tilbake til initialene; failed-URL-en huskes
  per URL, så et lagbytte prøver på nytt.
- **Medlemstallet bor i TeamContext** (`activeMemberCount`), IKKE i
  headeren — headeren monteres på tre skjermer og skal ikke spørre per
  skjerm. Ny `getTeamMemberCount(teamSpaceId)` i `teams.ts`: head-count på
  `memberships` (`status='active'`, `count: 'exact'`) — samme telling som
  `lookup_invite_code` (medlemskap, ikke unike personer; en forelder med to
  barn teller to). Cachet per lagrom (Map i ref) så lagbytte viser forrige
  tall med én gang; refetches når memberships refetches.
  **RLS-vakt:** teller du et lag du ikke er medlem i, gir RLS et falskt 0 —
  effekten venter derfor til medlemskapet finnes i `userMemberships`.
- **Underteksten er aldri tom:** tall mangler (henting/feil) → «Fotball ·
  G14» (sport + ageGroup). Singular: «1 medlem».
- **Høydevakten holdt:** sirkelen er 40 pt totalt som før (32 + ring),
  navn 18 pt + undertekst 12 pt ≈ 38 pt — headeren er IKKE høyere, neste
  hendelse-kort synes fortsatt uten scrolling.

### Test dette først (Metro-reload)
1. Hjem: sirkel med initialer på lagfargen + lagnavn + «Fotball · N
   medlemmer». Tallet skal stemme med Lagoversikt-tellingen.
2. Kalender + Varsler: samme header (tallet hentes ÉN gang, fra context).
3. Bytt lag (om du har to): underteksten oppdaterer seg — sport/tall følger
   laget, og gammelt lags tall vises aldri på det nye.
4. Headerens høyde: neste hendelse-kortet på Hjem skal fortsatt synes uten
   å scrolle (vakten fra planen).
5. (Logo-bildet kan først testes i P4 når opplasting finnes — men sett
   gjerne en URL manuelt på `team_spaces.logo_url`/`clubs.logo_url` i SQL
   for å se sirkelen med ekte logo.)

---

## ⚽ P2 — MÅL-ØYEBLIKKET (✅ FERDIG — godkjent på telefon + committet 2026-07-31)

Andre skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren RN `Animated` med native driver (reanimated er bevisst IKKE
installert). `npx eslint src`: 0 errors, 2 warnings (begge fra før).

- **Ny `src/components/useGoalMoment.ts`:** hook som oppdager scoreendring
  fra props og driver to Animated-verdier: `scoreScale` (sprett: raskt opp
  til ~1.3, fjærende ned med spring) og `celebrate` (mint-glød over
  stadionflaten: 150 ms opp → kort topp → 800 ms ut). **Mål for oss =
  sprett + glød; mål imot = kun sprett** — informasjon, ikke feiring, og
  aldri coral (låst regel). Prop-diff er poenget: animasjonen fyrer også
  hos foreldre som får ny stilling via realtime-refetch. Prev-ref seedes
  med gjeldende score, så å ÅPNE en pågående kamp animerer ingenting —
  kun endring spretter.
- **`ScoreBoard`:** `Animated.Text` på scoren + feirings-overlay
  (absoluteFill, ligger UNDER innholdet så teksten ikke tones,
  `pointerEvents="none"`). Stretch-punktet tatt: **SEIER-pillen spretter
  inn** (spring, 250 ms delay så skjermbyttet lander først) — både i det
  kampen ender med seier og hver gang kamprapporten åpnes.
- **`LiveMatchBanner`:** samme hook + overlay + animert score. Hooken
  kalles FØR early return (hooks-regelen). Hjem-banneret oppdateres av
  feed-subscriben i TeamHome (hvert mål er en feed-post → debounced
  `loadFeed` → ny `liveMatch`), så foreldre som står på Hjem ser spretten
  uten å gjøre noe.
- **`ReporterActions`:** målknappene er nå `GoalButton` (modulnivå, ikke
  nested — eslint-regelen): gir etter til 0.95 ved press (timing 90 ms),
  fjærer tilbake ved slipp (spring). Scale-transformen bor på en
  `Animated.View`-wrapper med `flex: 1` (Pressable kan ikke selv bære en
  Animated-transform); `goalButton`-stilen mistet derfor `flex: 1`.
- **Banner-demping på kampsiden (Brages telefonfunn 2026-07-31):**
  varselbanneret («⚽ MÅL! …») la seg OPPÅ scoreboardet — dobbelt opp når
  animasjonen skjer rett foran deg. Nå: `NotificationsContext` har
  `watchEvent(eventId)` (ref, ikke state — leses i realtime-callbacken
  uten re-subscribe; slipp-funksjonen nuller kun hvis den fortsatt eier
  registreringen). EventDetail registrerer via `useFocusEffect` KUN mens
  kampen er i gang (`isUnderway`) — og callbacken dropper banneret når
  `category='match_live'` OG `data.event_id` matcher (`data` fra 00023
  bærer alt event_id). Badge/inbox/liveNonce består. FOKUS, ikke mount:
  går du inn i kommentarene når banneret deg igjen; alle andre skjermer
  og andre kategorier (kommentar/heia) er urørt.

### Test dette først (Metro-reload)
1. Start en kamp som trener → trykk «Mål oss»: scoren spretter og flaten
   får et kort mint-glimt. «Mål dem»: kun sprett, ingen feiring.
2. **Det viktige:** forelder på annen enhet står på kampskjermen — eller
   på Hjem med live-banneret — mens treneren scorer. Samme sprett/glød
   skal skje der, via realtime, uten at forelderen gjør noe.
3. Kjenn på målknappene: de skal gi etter under fingeren og fjære tilbake.
4. Avslutt en kamp med seier → SEIER-pillen spretter inn på scoreboardet.
   Åpne kamprapporten senere → den spretter inn igjen.
5. Åpne en kamp som allerede pågår → ingen sprett ved åpning (ro først,
   liv kun ved endring).
6. Banner-dempingen: stå på kampsiden som forelder mens det scores →
   INGEN «⚽ MÅL!»-banner over scoreboardet (bare animasjonen). Gå til
   Hjem eller kommentartråden → banneret kommer som før. Varsler-badgen
   teller opp uansett.

---

## 🦴 P1 — SKELETONS (KODET 2026-07-31, kun Metro-reload)

Første skive i design-polish-planen. Ingen migrasjon, ingen native-deps —
ren JS. `npx eslint src`: 0 errors, 2 warnings (begge fra før:
`no-bitwise` i Avatar, nested component i AppNavigator).

- **Ny `src/components/Skeleton.tsx`:** `Skeleton` (grå/krem blokk med
  svak opacity-puls, RN `Animated` + native driver), `SkeletonCard`
  (hvit kortflate), `FeedCardSkeleton`, `EventCardSkeleton`,
  `ListRowSkeleton`. Én delt modul-`Animated.Value` med refcount-loop:
  alle bones i hele appen puster i takt, og loopen kjører kun mens minst
  én bone er montert.
- **Skjermene som fikk skeleton i stedet for skjermnivå-spinner:**
  TeamHome (3 feedkort), Kalender (etikett + 3 eventkort), Season
  (stadion-KPI-bones i `stadiumEdge` på `StadiumSurface` + kampliste —
  flatebyttet lys/mørk skal ikke blinke inn etter lastingen), Inbox
  (4 rader i listekortet), TeamMembers (lagnavnet vises EKTE — kjent fra
  context — bone kun på tellingen + medlemsrader), EventDetail (speiler
  info-kortet: pill + tittel + metarader), Comments (innleggskort + 2
  replikk-bobler med chat-hjørnet), CreateTeam (3 sport-piller).
- **Bevisst BEHOLDT som spinner:** `Button` (loading-prop) og
  `MatchPhotoSheet` (planens unntak), AppNavigator-bootskjermen (før noe
  UI finnes), Auth (submit-state) og JoinTeamCode (oppslag ETTER
  «Finn lag»-trykk) — de to siste er handlingstilstander, ikke
  skjerm-åpninger.
- **`RefreshControl`-punktet i planen var alt gjort:** alle 5 (TeamHome,
  Kalender, Inbox, Season, TeamMembers) hadde `tintColor={colors.heia}`
  fra telefontest-runden. Verifisert, ingen endring.
- **Copy-polish på tomtilstander** (BRAND_UI-retningslinjene): TeamHome
  «Stille her ennå …», Kalender «Kalenderen er tom» + varmere brødtekst.
  Resten (Inbox, Season «Sesongen starter her», Comments) hadde alt
  personlighet.
- **RN-fallgruve verdt å huske:** `width: undefined` i en SENERE style
  nullstiller IKKE en tidligere `width: '100%'` (RN dropper undefined ved
  flatten). Trengs en flex-styrt bone: legg den i en `{flex: 1}`-wrapper
  (se `skeletonBubbleWrap` i CommentsScreen).

### Test dette først (Metro-reload)
1. Bytt fane til Kalender/Varsler første gang (eller dra ned + slipp på
   tregt nett): grå/krem kort som puster, i samme form som innholdet som
   kommer — ingen spinner, ingen hopp i layout når innholdet lander.
2. Sesongen: mørk stadionflate med pulserende tall-bones — flaten skal
   IKKE blinke hvit→mørk når tallene kommer.
3. Åpne en hendelse og en kommentartråd — skeleton i kort-/bobleform.
4. Tomtilstander: nytt lag uten innhold viser «Stille her ennå …» (Hjem)
   og «Kalenderen er tom» (Kalender).
5. Pulsen: alle blokker på en skjerm dimmer i takt (én delt loop).

**Telefontest-funn 2026-07-30 (kveld), fikset i JS (kun reload — ingen
rebuild):**
- **Onboarding-overganger:** iOS 26 sin nye push/pop-animasjon blinket hvitt i
  hjørnene mot den mørke velkomstskjermen (vinduet bak stacken er hvitt, ingen
  JS-flate når dit). Onboarding-stacken kjører nå `simple_push` +
  `animationMatchesGesture`, og fordi native header ikke blir med i
  egendefinert animasjon («toppen deler seg»), er headeren AV i hele
  onboarding-stacken — skjermene tegner egen tilbakelinje (`BackBar`,
  native metrikk). I Profil-stacken har Bli med/Opprett lag fortsatt native
  header. **Bekreftet fikset på telefon.** NavigationContainer fikk også eget
  tema + `contentStyle` på alle stacker (fjernet hvite kort-blink generelt).
- **Skrivefelt:** tekst rendret feil/utsatt mens man skrev (falt først på
  plass ved blur) — kjent iOS-bug når `TextInput` har `lineHeight` (RN #41240).
  Nytt token `typography.input` (= body uten lineHeight) brukes nå i alle
  skrivefelt (Auth, CreateTeam, NewEvent, Comments, TeamHome-compose).
  **Bekreftet fikset på telefon.**
- **«Løs topp» ved swipe-back i hovedappen** (Hendelse, Kommentarer, Inviter
  m.fl.): iOS 26 animerer UINavigationBar som egen plate i eget tempo —
  fargematch var ikke nok (verifisert på telefon). Endelig løsning = samme som
  onboarding, nå på ALLE stackene via `stackScreenOptions`: native header AV +
  `simple_push`/`animationMatchesGesture`, og skjermene tegner `BackBar`
  (valgfri sentrert tittel). Berørt: EventDetail («Hendelse», alle 4 grener),
  Comments («Kommentarer», + `keyboardVerticalOffset` 100→fjernet siden
  headeren er borte), Invite («Inviter»), Support («Støtt laget»),
  TeamMembers («Lagoversikt»), JoinTeamCode/CreateTeam (alltid BackBar nå,
  `inOnboarding`-sjekken fjernet). Unntak: NewEvent-modalen beholder native
  header + vertikal animasjon (`headerShown: true`, `animation: 'default'`) —
  modaler har ikke problemet. **Bekreftet fikset på telefon.**
- **Kampbilder kom ikke i realtime hos andre:** `subscribeToMatch` lyttet kun
  på `match_events`/`match_sessions`, men bilder er `feed_posts` med
  `event_id` (00028) og rører ingen av dem. Ny tredje lytter på
  `feed_posts` INSERT (filter `event_id`; tabellen er alt i publiseringen via
  00025) + callbacken i EventDetail kaller nå `loadPhotos()` i tillegg til
  `loadEvent()`. Gjelder mens kampen er live (abonnementet lever bare da) —
  som resten av kampoppdateringene. Ingen migrasjon nødvendig. **Bruker
  meldte «det funker nå» 2026-07-30 (samlet bekreftelse for kveldens fikser).**

---

## Hvor vi er

Vi følger en godkjent fase-plan for «Team Activity Loop».
**Fase 0 (invite-loop), Fase 1 (design), hele Fase 2 (ekte feed),
Fase 3A (ekte events — lesing), Fase 3B (opprett hendelse + RSVP) og
Fase 3C (hele live-kamp-loopen) er ferdig og verifisert i simulator.**
**Fase 3D (pause ⇄ andre omgang) er kodet, `00021` er deployet, tsc grønn.**
**Fase 4 (EKTE PUSH): kode + native + backend er ute. `simctl push` viser
varsler i simulator. Gjenstår vault-seed (din service_role_key) + Apple/APNs
for at ekte push skal leve (se «Fase 4 — EKTE PUSH»).**
**Fase 5 (INBOX) er kodet: Varsler-fanen leser `notifications`, har ulest-badge
og deep-link til hendelse/kommentarer. Siste døde hjørne i appen er borte.**

Branch: `Brage` (pushet til `origin/Brage` t.o.m. P9 — commit `b99c2e2`,
hele design-polish-planen P4–P9 committet og pushet 2026-07-31). `npx eslint src` har 6
errors + 5 warnings, alle fra før (ubrukte variabler i `Avatar`/`CommentsScreen`/
`InviteScreen`, `exhaustive-deps` i `UserContext`/`TeamContext`) — ingen nye.

**Tsc-arbeidsmåte (LÅST):** Claude skal IKKE kjøre `tsc` (CLI) selv — heller
ikke i bakgrunn. Det stjeler CPU fra brukerens egne bygg (npm/pod/Xcode/Metro)
og ødelegger dem. Typefeil sjekkes i editoren (VS Code kjører TS-serveren live).
Trengs en CLI-sjekk på en stor endring, spør brukeren først og la brukeren kjøre den.

### Ekte vs. mock akkurat nå
- **Ekte (Supabase):** onboarding, hele feeden (tekst/bilde-poster, 👏 Heia-reaksjon, kommentarer), events/kalender/event-detalj/live-banner, **opprettelse av hendelser + kamper**, **RSVP-svar**, **medlemslisten**, **kampreporter**, **start av kamp**, **kamphendelser + stilling + feed-post**, **realtime på live kamp**, rollesjekk (fra membership).
- **Push:** hele pipelinen er KODET (Fase 4), men lever ikke før du har gjort
  Apple/APNs-siden + rebuild. `SimulatedPush` består som reporterens lokale ekko
  (reporteren er forfatter og får ikke ekte push — den går til alle andre).
- **Inbox (Fase 5):** ekte lesing av `notifications` + ulest-badge + deep-link.
  Radene skrives av `push-fanout`, som først fyrer når vault er seedet — se
  «Fase 5» for test-SQL som fyller inboxen uten seed.
- **All mock-data er borte.** `src/shared/mockData.ts` og `src/data/teamData.ts`
  er slettet — ingenting importerte dem lenger.

---

## Backend (Supabase) — tilstand

Prosjektet er linket (ref `sswncdrbsrfieudkdmhj`, config `Heia_Prod`). Migrasjoner
**00001–00022 er alle deployet** — `db push --dry-run` sier «Remote database is
up to date» (2026-07-29). (00016/00017 var hand-kjørt fra før; reconciliert med
`migration repair` 2026-07-08.) `supabase db push` fungerer
(kjør med sandkasse av — nettverk kreves; `--dry-run` viser ubehandlede).
**Edge Functions:** `push-fanout` er deployet (`supabase functions deploy
push-fanout` fungerer også med sandkasse av — Docker trengs ikke, bare en
warning).

Eksisterende RPC-er: lese — `get_team_feed`, `get_event_with_rsvp`,
`get_team_members`; skrive — `create_team_from_scratch`, `join_team_space`,
`activate_team_space`, `upsert_rsvp`, `create_event`. RLS tillater direkte
member/admin-insert for feed/kommentar/reaksjon/event, så få nye RPC-er trengs.

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
- `rsvp.pending` teller kun eksplisitte `venter`-rader, ikke medlemmer som aldri har svart. `RSVPBar` skjuler seg når totalen er 0.
- `getTeamEvents` henter alle events uten tidsvindu. Fint nå; paginer/filtrer når lag har historikk.

---

## Fase 3B-1 — GJORT (opprett hendelse)

Ingen nye native moduler → **kun Metro-reload, ingen rebuild.**
(Dato/tid er bevisst laget i ren JS, ikke `@react-native-community/datetimepicker`,
nettopp for å slippe rebuild. Bytt hvis det blir for stivt.)

- **Migrasjon `00019_create_event.sql` (deployet):** `create_event()` RPC.
  SECURITY DEFINER omgår RLS, så den sjekker `is_team_admin()` selv. Oppretter
  event + (for `kamp`) `match_session` i status `planlagt` i samme transaksjon,
  slik at en kamp aldri kan mangle session-rad. Returnerer `{event_id, match_session_id}`.
- **`createEvent(input)` i `src/lib/api/events.ts`** — `opponent`/`is_home`
  nulles ut for ikke-kamp.
- **`NewEventScreen`** — type-chips, motstander + hjemme/borte for kamp,
  30-dagers dag-scroller, `HH:MM`-maskert tidsfelt, varighet-chips (1 t / 1½ t /
  2 t / ingen sluttid), sted, tittel (valgfri — faller tilbake på f.eks.
  «Kamp mot Lyn»), beskjed. Etter lagring: lukk modalen + hopp til kalenderen,
  som refetcher ved fokus.
- **`CreateSheet`** — valgarket bak `+`. `tabPress` på `Opprett`-taben
  `preventDefault()`-es, så skjermen aldri rendres.
- **«Del med laget»** sender en ny `composeNonce` til `TeamHome` for hvert
  trykk, som fokuserer compose-boksen (ellers ville andre trykk ikke gjort noe).
- **Rollesprekken lukket:** `UserRole` har nå `lagleder` + `admin`,
  `src/shared/roles.ts` eksporterer `isTeamAdmin(role)` (speiler `is_team_admin()`
  i `00008`), og `TeamContext` eksponerer `activeRole`. `EventDetailScreen`
  bruker den i stedet for mock-oppslaget `getUserRoleInTeam`.

### Test dette først (Metro-reload, ingen rebuild)
1. Trykk `+` som trener → valgarket viser «Del med laget» + «Ny hendelse».
2. Lag en trening → havner i kalenderen på riktig dag/tid.
3. Lag en kamp med motstander → `EventCard` viser motstander; sjekk i SQL at
   `match_sessions`-raden finnes (`status='planlagt'`).
4. Trykk `+` som forelder (eller sett `role='forelder'` i `memberships`) →
   kun «Del med laget». Valgarket skal aldri være tomt.
5. «Del med laget» → compose-boksen får fokus, også når du alt står på Hjem.

## Bugfiks 2026-07-09 — bli med i lag nr. 2

Funnet under testing av 3B-1.

- **Ventende join ble stille forkastet.** Resume-effekten i `OnboardingContext`
  avbrøt tidlig når `hasTeam` var sann. En bruker som var trener i lag A, logget
  ut, tastet koden til lag B og logget inn igjen, fikk `hasTeam=true` i det
  profilen lastet → join-en mot lag B kjørte aldri, uten feilmelding. Guarden er
  fjernet; `runningRef` + `clearPendingAction` hindrer dobbeltkjøring alene.
  `userMemberships.length` er også ute av dep-arrayet (den var det som trigget
  re-kjøringer guarden skulle beskytte mot).
- **`AppNavigator`** viser nå «Setter opp laget…» også når brukeren alt har et
  lag, og `Alert`-er `lastError` i det tilfellet — før forsvant feilen i
  stillhet, siden `WelcomeIntentScreen` (som viser den) ikke er montert da.
- **Legge til lag når man er innlogget.** `JoinTeamCode` + `CreateTeam` er nå
  også registrert i `ProfilStack`, med nye menyvalg «Bli med i et lag» og
  «Opprett et nytt lag». Begge skjermene henter navigasjon via `useNavigation`
  i stedet for skjerm-props, så de kan monteres i to stacker. De kaller
  `navigation.goBack()` selv når `hadTeam` — da bytter ikke `AppNavigator` skjerm.
- **Rolle-etiketter:** `ProfilScreen` viste «Forelder» for lagleder/admin/spiller.
  Nå en `ROLE_LABELS`-tabell, og rolle-badgen bruker `isTeamAdmin()`.
- **Tilbake-knappen:** `JoinTeamCode`/`CreateTeam` tegnet sin egen «‹ Tilbake»
  fordi onboarding-stacken skjuler headeren globalt. Begge bruker nå den vanlige
  stack-headeren (`stackScreenOptions` + `headerShown: true` + tittel) i begge
  stackene, og samme innholdsmarger som `InviteScreen`.
  **Regel: nye skjermer skal bruke stack-headeren, ikke egne tilbake-knapper.**

## Fase 3B-2 — GJORT (RSVP lagres + reporter-opprydding)

Ingen nye migrasjoner, ingen nye native moduler → **kun Metro-reload.**

- **`setRsvp(eventId, status)` i `src/lib/api/events.ts`** — tynn wrapper rundt
  `upsert_rsvp` (fantes fra `00015`). `p_child_id` utelates: v1 lar en forelder
  kun svare for seg selv.
- **`EventDetailScreen`:** knappene kaller `handleRsvp()`. Svaret vises med én
  gang (optimistisk `setMyStatus`), lagres, og så refetches hele eventet — det
  er refetchen som får deg inn i **oppmøtelisten**, som vi ikke kan gjette lokalt.
  Feiler lagringen: rull tilbake til forrige svar + `Alert`. Knappene er
  `disabled` mens lagringen pågår, så dobbelttrykk ikke kan race.
  Trykk på et allerede valgt svar er en no-op (ingen unødig rundtur).
  - **Knappe-variantene** (`comingVariant`/`notComingVariant` i skjermen).
    To bommer på rad her, verdt å huske: (1) begge knappene var `secondary` når
    du svarte «kan ikke» → like rammer, uendret tittel, så det så ut som et
    uregistrert trykk. (2) Å sette den fravalgte til `ghost` var ikke nok —
    `secondary` og `ghost` er **begge gjennomsiktige**, så den valgte knappen
    fikk ingen fargeendring.
    Fasit: den valgte knappen må skifte **flate**, ikke bare ramme.
    `Button` har derfor en ny variant **`selected`** (heiaSoft-fyll + heia-ramme
    + `heiaInk`-tekst) — samme «valgt»-språk som `selectChipSelected` i
    `NewEventScreen`. `primary` = utfører en handling, `selected` = av/på.
    Tilstandene: ubesvart → Kommer `secondary`, Kan ikke `ghost`;
    kommer → `primary` + `ghost`; kan ikke → `ghost` + `selected`.
    Titlene bekrefter også valget («Du kommer!» / «Du kan ikke»).
  - Merk: `loadEvent()` svelger sine egne feil (setter `error`), så `catch`-en i
    `handleRsvp` fyrer **kun** når selve skrivingen feiler. Rollbacken kan derfor
    ikke bli falsk-positiv. Ikke gjør `loadEvent` throwende uten å fikse det.
- **«Ta rollen» fjernet fra `ReporterBar`** (beslutning 3). Propsene `isMember`
  og `onClaimReporter` er borte, og `handleClaimReporter` er slettet.
  I stedet: når reporter mangler ser **admin** en «Velg»-knapp som åpner
  `ReporterSheet`; alle andre ser bare «Ingen kampreporter». Uten dette ble
  tom-tilstanden en blindvei — ingen kunne tildele rollen fra appen.
  (Selve valget lagres fortsatt ikke — se Fase 3C.)

### Test dette først (Metro-reload, ingen rebuild)
1. Åpne en trening → trykk «Kommer». Tallet i `RSVPBar` går opp, og du dukker
   opp i «Kommer»-listen etter refetchen.
2. Trykk «Kan ikke» → du flytter deg mellom listene, totalen er uendret.
3. Trykk «Du kommer!» igjen mens den alt er valgt → ingenting skjer.
4. Skru av nettet → trykk et svar → `Alert` + knappen hopper tilbake.
5. Gå til kalenderen og tilbake → svaret er det samme (det ligger i DB).
   Sjekk gjerne `select * from event_rsvps;` i SQL-editoren.

Filosofi: events = innholdskilde + forutsetning for live kamp. IKKE Spond-tung
RSVP/admin. Heia er «Strava for ungdomslag».

## Fase 3C — KODET, IKKE DEPLOYET/TESTET (live kamp, hele loopen)

**Lærdom som gjorde om på planen:** den opprinnelige 3C var delt opp etter *lag
i koden* (medlemsliste → reporter → start → skriv → vis). Ingen av bitene var
brukbare alene, og planen stoppet ved «skriv til DB» — den bygde aldri veien ut
til foreldrene. Da bruker spurte «hvordan skal foreldre følge med?» fantes ikke
svaret: **null realtime, null push, `SimulatedPush` forlot aldri reporterens
egen telefon.** Skiv etter loopen brukeren opplever, ikke etter lagene i koden.

Loopen nå: opprett kamp → **Start kamp** → reporter trykker MÅL → rad i
`match_events` + oppdatert stilling + **feed-post** → alle andre ser det, live.

### Migrasjon `00020_live_match.sql` (✅ deployet 2026-07-09)
- **`start_match(event_id)`** — setter `live` + `started_at`, og gjør *den som
  starter* til reporter hvis ingen er utpekt. Det er dette som løser
  hønen-og-egget: før måtte du være reporter for å rapportere, men bare admin
  kunne utnevne en reporter, og UI-et for å utnevne fantes bare inne i en kamp
  som allerede var live. Hvem: admin, eller en alt utpekt reporter.
- **`report_match_event(session, type, team_side, description)`** — én rad i
  `match_events` + oppdatert `home_score`/`away_score` + én `feed_post`, i **én
  transaksjon**. `SELECT … FOR UPDATE` på `match_sessions` serialiserer to raske
  trykk, så verken `sequence` (som er `NOT NULL` uten default!) eller stillingen
  kan race. Minuttet regnes ut server-side fra `started_at`.
- **`get_event_with_rsvp`** er `CREATE OR REPLACE`-t med ett nytt felt:
  `match_session.started_at`. Ellers uendret.
- **Realtime:** `match_sessions` + `match_events` lagt i `supabase_realtime`
  (idempotent DO-blokk). Realtime respekterer RLS, og begge har alt en
  «members can view»-SELECT-policy.

### ⚠️ Tre NULL-feller i plpgsql (jeg gikk i alle tre først)
`false OR NULL` er `NULL`, og **`IF NOT NULL THEN` kjører ikke**. Så
`IF NOT (is_team_admin(...) OR ms.reporter_id = auth.uid())` slapp *hvem som
helst* gjennom når `reporter_id` var NULL. Samme for
`NULL NOT IN ('home','away')`. Alle tre er nå pakket i `COALESCE(..., false)`.
**Skriv aldri en rettighetssjekk i plpgsql uten COALESCE rundt et nullbart
felt.**

### App
- **`src/lib/api/members.ts` (ny):** `getTeamMembers` mot `get_team_members`.
  RPC-en gir én rad per *medlemskap*, så en forelder med barn kommer flere
  ganger; vi beholder første rad per bruker (duplikat-id-er ville brutt
  `keyExtractor`). `comments.ts` bruker nå denne i stedet for sin egen kopi.
- **`events.ts`:** `startMatch`, `reportMatchEvent`, `setMatchReporter`,
  `subscribeToMatch`. Sistnevnte **refetcher** ved endring i stedet for å flette
  inn payloaden — kampforløpet må uansett sorteres, og en refetch kan ikke komme
  ut av synk. `HeiaEvent` har nye `matchSessionId` + `startedAt`.
- **`EventDetailScreen`:** «Start kamp» + `ReporterBar` vises nå på en
  **kommende** kamp. `minute={55}` er borte — minuttet regnes fra `startedAt` og
  tikker hvert 30. sek (uten den frøs minuttet mellom mål). «Slutt» spør først.
- **`ReporterBar`:** «Bytt» er **admin-only**. UPDATE-policyen på
  `match_sessions` har ingen `WITH CHECK`, så Postgres gjenbruker `USING` også
  for den nye raden — en reporter som ikke er admin kan derfor ikke peke rollen
  videre (`42501`). Og: nekter RLS via `USING` får du **ingen feil, bare null
  rader**, så `setMatchReporter` gjør `.select('id')` og kaster selv.
- **Fjernet «Kampvarsler / Slå på»-kortet.** Det lovet push og gjorde ingenting.
  Erstattet med «Du følger kampen direkte», som nå er sant.
- **Alle mock-filer slettet** (`src/data/teamData.ts`, `src/shared/mockData.ts`).

### Slik testes det (Metro-reload — realtime trenger INGEN rebuild)
Migrasjonen er alt ute. Ingen seed-SQL lenger — kampen lages og startes i appen.
1. Opprett en kamp med `+` → åpne den. Som trener ser du «Ingen kampreporter»
   + «Velg», og en **«Start kamp»**-knapp.
2. Trykk «Start kamp» uten å velge reporter → du blir reporter selv,
   `ScoreBoard` + `ReporterActions` dukker opp, minuttet står på 0'.
3. Sjekk feeden på Hjem → «⚽ Kampen er i gang: … mot …». Hero-banneret vises.
4. Trykk **Mål oss** → skriv scorer → stillingen går til 1–0, kampforløpet får
   en rad, og feeden får «⚽ MÅL! … 1–0 …».
5. **Det viktige:** logg inn som en forelder på en annen simulator/enhet, stå på
   kampskjermen, og la treneren score. Stillingen skal endre seg **uten** at
   forelderen gjør noe.
6. Trykk «Slutt» → bekreft → kampen blir `ferdig`, skjermen går tilbake til
   vanlig event-modus, feeden får «🏁 Slutt!».
7. Som forelder: ingen «Velg»/«Bytt»/«Start kamp».

### Kampen etterlater seg et spor (samme skive)
Da «Slutt» ble trykket falt `EventDetailScreen` ned i vanlig event-modus, og
**både stillingen og hele kampforløpet forsvant** i samme øyeblikk som de var
ferdige. Rettet:
- **`EventCard`:** en kamp med `score` viser resultatet i stedet for
  `RSVPBar` — «PÅGÅR NÅ» / «PAUSE» / «SLUTTRESULTAT» + stillingen. Hvem som
  «kommer» er uinteressant når kampen er spilt.
- **`EventDetailScreen`:** en `finished` kamp viser `ScoreBoard` + hele
  **kampforløpet**, kronologisk (avspark → slutt), som en historie. RSVP-knappene
  skjules — man melder seg ikke på en kamp som er over.
- **`describeMatchEvent` i `events.ts`:** et mål viser nå «Mål for oss» /
  «Mål for {motstander}», med scorernavnet reporteren skrev som undertekst
  (`player`). Før havnet navnet i `description`, så et mål uten navn ble en helt
  tom rad, og et mål med navn røpet ikke hvilket lag som scoret.
  `MatchEvent` har fått `teamSide`.

### Fortsatt igjen etter dette
- ~~Ekte push~~ → **kodet i Fase 4** (under). Venter på Apple/APNs + rebuild.
- ~~Resume etter pause~~ + ~~`getLiveMatch` i pause~~ → **løst i Fase 3D** (under).
- **`+`-knappens tredje valg** («Start kamp», beslutning 1) er ikke bygget —
  kampen startes fra kampsiden. Ren snarvei, loopen er hel uten.
- ~~`FeedCard` på match-typene~~ → **verifisert (les-review):** `getMarker`
  gir grønn rail + «KAMP»-markør + fet innholdstekst, ingen krasj. Minuttet
  vises ikke i markøren fordi `mapFeedRow` (feed.ts) ikke hydrerer `matchEvent`
  — kosmetisk, `content`-strengen bærer stilling/minutt. Akseptert v1.

### LÅSTE BESLUTNINGER (bruker, 2026-07-09)

1. **`+`-knappen = rollestyrt valgark.** Alle ser «Del med laget» (tekst/bilde).
   Trener/lagleder/admin ser i tillegg «Ny hendelse». Reporter ser «Start kamp»
   når laget har en kamp i dag. Knappen skal aldri være død for en forelder —
   den er appens mest fremhevede knapp, og foreldre er de fleste brukerne.
   ✅ Bygget, bortsett fra «Start kamp»-snarveien i valgarket. Kampen startes fra
   kampsiden (3C); snarveien er ren bekvemmelighet.

4. **Hvem starter kampen (bruker, 2026-07-09):** trener/lagleder/admin, eller en
   reporter treneren har utpekt. **Den som starter blir reporter** hvis ingen er
   satt. Ikke «alle medlemmer» — to personer som rapporterer samme kamp er verre
   enn litt friksjon.
5. **Levering til foreldre (bruker, 2026-07-09):** Supabase Realtime på
   kampskjermen nå. Ekte push er en senere, egen skive.
2. **Kun trener/lagleder/admin kan opprette hendelser** — som RLS allerede sier.
   Ingen migrasjon for rettigheter. ✅ Bygget.
3. **Trener tildeler kampreporter.** «Ta rollen»-knappen i `ReporterBar` skal
   fjernes; reporter velges via `ReporterSheet`.
   ✅ Ferdig (3B-2 + 3C-1). Kun admin kan tildele — RLS tillater ikke annet.

### Idé parkert i 3B-1
`create_event` kunne også lagt en `paaminnelse`-post i feeden («Ny kamp mot Lyn»)
— `feed_posts` har allerede `event_id` og typen. Droppet for å holde skiven smal
og fordi `FeedCard` ikke er testet på den typen. Vurder i 3C sammen med
`match_event` → feed-post.

### Live kamp — slik er flyten tenkt (skjemaet er allerede bygget for den)

Kamp opprettes med `match_session` i status `planlagt` → noen trykker
«Start kamp» (`status='live'`, `started_at`) → `EventDetailScreen` bytter til
live-modus med `ScoreBoard` + `ReporterActions` → hvert trykk skriver en rad i
`match_events`. Kamphendelser legges altså inn **inne på kampen**, ikke fra `+`.

`feed_posts` har allerede `match_event_id` og typene `match_event`,
`match_start`, `match_end`: en kamphendelse skal **også** bli en feed-post (og
senere en push). Det er Strava-øyeblikket — «MÅL! 2–1» mens kampen pågår.
I dag viser `ReporterActions` kun en simulert push og lagrer ingenting.

### Seed-SQL — ikke nødvendig lenger
Både vanlige hendelser og kamper lages i appen, og «Start kamp» setter en kamp
i `live`. Trenger du likevel å nullstille en kamp under testing:

```sql
-- spol en kamp tilbake til «ikke startet»
update public.match_sessions
set status = 'planlagt', started_at = null, finished_at = null,
    home_score = 0, away_score = 0, reporter_id = null
where id = '<SESSION_ID>';

delete from public.match_events where match_session_id = '<SESSION_ID>';
```

---

## Fase 3D — GJORT (pause ⇄ andre omgang)

Kodet 2026-07-26. Én migrasjon (`00021`, deployet), ingen native moduler →
**kun Metro-reload.** Lukket to hull fra 3C-lista.

- **Migrasjon `00021_resume_match.sql` (✅ deployet):** `report_match_event` er
  `CREATE OR REPLACE`-t. Godtar nå også `andre_omgang` (fantes alt i
  `match_events`-CHECK) → setter `status` tilbake til `live` + feed-post
  «▶️ Andre omgang i gang». To overgangs-vakter lagt til: `pause` kun fra
  `live`, `andre_omgang` kun fra `pause` (ellers dobbel pause-rad / falsk
  gjenopptakelse). Alt annet identisk med `00020`.
- **`events.ts`:** `ReportableEventType` fikk `andre_omgang`. `getLiveMatch`
  bruker nå `.in('...status', ['live','pause'])` — banneret overlever pausen.
- **`ReporterActions`:** «Pause»-knappen bytter til «Fortsett» (▶️) når kampen
  er i pause — samme plass i griddet, aldri en død knapp. Ny `isPaused`-prop.
- **`EventDetailScreen`:** `andre_omgang` er et rent av/på-trykk (som pause,
  ingen modal). `isPaused={matchStatus==='halfTime'}` sendes til `ReporterActions`.
  Vennlige feiltekster for de nye vaktene (race/realtime-lag).
- **`LiveBadge` + `LiveMatchBanner`:** banneret vises nå også i `halfTime`.
  `LiveBadge` fikk `paused`-variant: gul «PAUSE» uten puls (stillestående prikk
  = stoppet). `LiveMatchBanner` slapp før alt annet enn `status==='live'`.

### Test dette først (Metro-reload, migrasjon alt ute)
1. Start en kamp → trykk **Pause**. `ScoreBoard` sier PAUSE, feeden får «⏸ Pause»,
   og handlingsknappen har byttet til **Fortsett**.
2. Gå til Hjem → hero-banneret står fortsatt der, nå gult «PAUSE» (før forsvant det).
3. Trykk **Fortsett** → status `live`, feeden får «▶️ Andre omgang i gang»,
   knappen er «Pause» igjen. Forelder på annen enhet ser byttet via realtime.
4. Prøv å pause to ganger raskt / fortsette en kamp som alt spilles → vennlig
   Alert, ingen rar tilstand.

## Fase 4 — EKTE PUSH — kode + native FERDIG, backend IKKE deployet

Kodet 2026-07-26, native rebuild fullført 2026-07-27, **backend deployet
2026-07-29**: `00022` ✅ pushet, Edge Function `push-fanout` ✅ deployet, ny
native modul ✅ installert/bygget/kjører.

### ✅ VERIFISERT 2026-07-29: `simctl push` virker
`./scripts/push-test.sh` sender et varsel med **nøyaktig samme payload-form som
`_shared/apns.ts` bygger** (`aps.alert.title/body`, `sound`, `thread-id`, +
`feed_post_id`/`event_id`/`team_space_id` på toppnivå). Varselet dukket opp på
begge bootede simulatorer. **Det beviser at AppDelegate + pod'en + forgrunns-
visning er riktig koblet.** Presets: `maal|start|pause|slutt|melding`.

### ⛔ HVORFOR EKTE PUSH (fra appen) IKKE VIRKER ENNÅ
Bruker postet i appen og fikk ingenting. **Forventet.** `simctl push` injiserer
varselet lokalt og **hopper over hele kjeden** — den beviser kun visning.
Kjeden med status:

```
feed_posts INSERT                             ✅ skjer
  → trigger notify_on_feed_post               ✅ deployet (00022)
    → vault: project_url + service_role_key   ⛔ IKKE SEEDET → no-op, stille
      → pg_net → push-fanout                  ✅ deployet
        → notifications-rad (in-app-logg)     ⛔ nås aldri
          → device_tokens                     ⛔ TOM (se under)
            → APNs                            ⛔ ingen APNS_KEY/.p8
```

1. **Vault-secretene er den harde stopperen nå.** Uten dem returnerer
   `notify_on_feed_post` `NEW` uten å gjøre noe — med vilje, så posten ikke
   feiler av at push mangler. Seed dem (punkt 11 under) og hele fan-out-
   logikken kan verifiseres via `notifications`-tabellen, **uten APNs**.
2. **Simulator får normalt aldri en ekte APNs-device-token**, så
   `device_tokens` blir stående tom uansett. Ekte push = Apple Developer
   Program ($99/år) + fysisk iPhone. Ikke noe vi kan kode oss rundt.
3. **⚠️ Forfatteren er ekskludert fra mottakerne** (`id !== post.author_id` i
   push-fanout). Tester du med **samme bruker** på to simulatorer, blir
   `recipients: 0` uansett hvor riktig alt annet er. Bruk to ulike kontoer.

### Hva vi faktisk varsler på
Ett hook på `feed_posts` INSERT dekker alt. Alle typer unntatt `system`:

| `feed_posts.type` | Utløses av | Kategori |
|---|---|---|
| `match_start` | «Start kamp» → ⚽ Kampen er i gang | `match_live` |
| `match_event` | MÅL, ⏸ Pause, ▶️ Andre omgang | `match_live` |
| `match_end` | «Slutt» → 🏁 | `match_live` |
| `melding` | tekstpost i feeden | `new_post` |
| `bilde` | bildepost | `new_post` |
| `paaminnelse` / `resultat` | typene finnes, appen lager dem ikke ennå | — |

Mottakere = alle `status='active'` medlemmer i team_space, **minus forfatteren**,
minus de med `notification_preferences.enabled=false` på kategorien (lag-rad
slår global rad). Tittel = lagnavn for kamp, forfatternavn ellers.

### Arkitektur — alt henger på ÉN hook
Hver kamphendelse OG hver feed-post er allerede én rad i `feed_posts` (fra 3C).
Så i stedet for å røre `report_match_event`/`createTextPost` la vi **én trigger
på `feed_posts` INSERT**. Den fyrer et async `pg_net`-kall til Edge Function
`push-fanout`, som regner ut mottakere og sender APNs.

```
report_match_event / createTextPost / createImagePost
        │  (INSERT feed_posts — fantes alt)
        ▼
 trigger notify_on_feed_post ──pg_net (async)──► Edge Function «push-fanout»
        │ (vault: project_url + service_role_key)      │
                                        1. mottakere = aktive lagmedlemmer − forfatter
                                        2. respekter notification_preferences (opt-out)
                                        3. INSERT notifications (in-app-logg)
                                        4. slå opp device_tokens
                                        5. APNs HTTP/2 (JWT ES256 fra .p8)
                                           410/BadDeviceToken → slett token
```
Ett hook = varsel for mål, avspark, pause, andre omgang, slutt, tekst OG bilde.
`system`-poster hoppes over. Async pg_net → `report_match_event` blir ikke tregere.

### Filer som er lagt til / endret
- **`supabase/migrations/00022_push_notifications.sql`** — `device_tokens`-tabell
  (+ RLS «egne tokens»), RPC-ene `register_device_token` (upsert på token, flytter
  eier ved re-login) og `unregister_device_token`, og trigger-funksjonen
  `notify_on_feed_post`. Aktiverer `pg_net` + `supabase_vault` (no-op på hosted).
- **`supabase/functions/push-fanout/index.ts`** — Deno. Selv-autentiserer
  (Bearer === service_role_key, `verify_jwt=false`). Mottakere, opt-out-logikk
  (team-rad slår global), `notifications`-insert, APNs, rydder døde tokens.
- **`supabase/functions/_shared/apns.ts`** — APNs HTTP/2 + provider-JWT ES256
  signert med .p8 (Web Crypto, rå r||s = JOSE-format), token cachet ~50 min.
  `APNS_HOST` defaulter til **sandbox**.
- **`supabase/config.toml`** — `[functions.push-fanout] verify_jwt=false`.
- **App:** `src/lib/api/push.ts` (RPC-wrappere), `src/lib/push/index.ts`
  (permission + token-registrering; **lazy `require` i try/catch** så appen ikke
  krasjer før native er bygget inn; native-kall også try/catch'et for
  half-installed-vinduet), `src/components/PushGate.tsx` (koblet i `App.tsx`),
  avregistrering i `signOut` (UserContext) — kalt FØR session tømmes, ellers er
  `auth.uid()` null.
- **`scripts/push-test.sh`** (ny, 2026-07-29) — `simctl push` til alle bootede
  simulatorer med realistisk payload. `./scripts/push-test.sh maal|start|pause|slutt|melding [UDID]`.
  Bundle-id overstyres med `HEIA_BUNDLE_ID` når den ekte settes (A1 under).
- **Native:** `ios/Heia2/AppDelegate.swift` (APNs-delegatene → `RNCPushNotificationIOS`,
  + forgrunns-visning via `UNUserNotificationCenter`), `ios/Heia2/Heia2-Bridging-Header.h`
  (eksponerer ObjC-pod'en for Swift). `package.json` +
  `@react-native-community/push-notification-ios ^1.11.0`.

### ⚠️ DIN SIDE — gjør dette i ett jafs, så lever pushen
**A. Apple Developer (nettleser):**
1. Sett en **ekte bundle-id** (nå er den default `org.reactjs.native.example.Heia2`).
   Velg f.eks. `no.heia.app` i Xcode → target Heia2 → Signing & Capabilities →
   Bundle Identifier. Bruk SAMME verdi som `APNS_BUNDLE_ID` under.
2. Registrer App ID-en med **Push Notifications**-capability (Certificates,
   Identifiers & Profiles → Identifiers).
3. Lag en **APNs Auth Key (.p8)** (Keys → +, huk av Apple Push Notifications).
   Noter **Key ID** (10 tegn) og **Team ID** (10 tegn). Last ned .p8 (kun én gang!).

**B. Xcode (native) — ✅ FERDIG 2026-07-27, ikke gjør om igjen:**
- ✅ `npm install` + `pod install` → `RNCPushNotificationIOS (1.12.0)` installert.
- ✅ **Bridging header satt** — `SWIFT_OBJC_BRIDGING_HEADER = "Heia2/Heia2-Bridging-Header.h"`
  er skrevet inn i **begge** build-configs i `project.pbxproj` (linje ~280 og ~307).
- ✅ **Build Succeeded** — appen kjører i simulator med push-modulen linket.
- ⬜ **Gjenstår:** «Push Notifications»- + «Background Modes → Remote
  notifications»-capability er **ikke** lagt til (krever Apple-konto for
  signering; ikke nødvendig for `simctl push`-testing).

**C. Supabase (kan kjøres av Claude, sandkasse av — men secrets er dine):**
8. ✅ **GJORT 2026-07-29:** `supabase db push` (deployerte `00022`).
9. ✅ **GJORT 2026-07-29:** `supabase functions deploy push-fanout`.
10. ⬜ `supabase secrets set APNS_KEY_ID=xxxx APNS_TEAM_ID=xxxx APNS_BUNDLE_ID=no.heia.app APNS_HOST=api.sandbox.push.apple.com` og
    `supabase secrets set APNS_KEY="$(cat AuthKey_XXXX.p8)"`.
11. ⬜ **← NESTE STEG, og det eneste som er gratis.** Seed vault (ÉN gang, i
    SQL-editoren — service_role_key fra Project Settings → API). Uten dette gjør
    trigger'en ingenting. Etterpå: post noe i appen som bruker A og kjør
    `select user_id, category, title, body, sent_at from notifications
     order by sent_at desc limit 10;` — én rad per *annet* medlem betyr at hele
    backenden er verifisert, og kun Apple-siden gjenstår.
    ```sql
    select vault.create_secret('https://sswncdrbsrfieudkdmhj.supabase.co', 'project_url');
    select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
    ```

### Endringer i varsel-flyten (gjort 2026-07-26, etter design-diskusjon)
- **Ingen kald permission-dialog ved innlogging.** iOS lar deg spørre **kun én
  gang** — sier brukeren nei der, er døra stengt for godt. `PushGate` kaller nå
  `refreshPushIfGranted()` som registrerer token **stille** hvis brukeren alt
  har sagt ja, og ellers gjør ingenting.
- **Ny 🔔 «Varslinger»-rad på ProfilScreen** er stedet man skrur på varsler.
  Viser status (`PUSH_SUBTITLE`), ber om tillatelse første gang (`enablePush()`),
  og sender ellers brukeren til iOS-Innstillinger (`Linking.openSettings()`).
  Statusen refreshes via `AppState`-lytter når appen kommer i forgrunn.
- `lib/push` eksporterer nå `getPushPermission`, `refreshPushIfGranted`,
  `enablePush`, `stopPush`, `isPushAvailable` (ikke lenger `startPush`).

### ⚠️ Native-lærdommer fra rebuilden (ikke gjenta)
- **`didFailToRegisterForRemoteNotifications` er FJERNET fra `AppDelegate.swift`
  med vilje.** Swift importerer pod'ens `...WithError:`-klassemetode under et
  navn som ikke lot seg bygge («has no member»). De to andre kallene
  (`didRegisterForRemoteNotifications(withDeviceToken:)` og
  `didReceiveRemoteNotification(_:fetchCompletionHandler:)`) er **riktige** og
  bygger. `registrationError`-eventet er ikke-essensielt. Ikke «fiks» dette ved
  å gjette navnet på nytt uten å lese `RNCPushNotificationIOS.h`.
- **fmt-patchen i `Podfile` er gjort idempotent.** Den kræsjet `pod install` med
  `Permission denied @ rb_sysopen - Pods/fmt/include/fmt/base.h` fordi den
  prøvde å skrive lappen på nytt i en read-only fil som alt var patchet. Nå
  hopper den over når lappen finnes (+ `File.chmod(0644)` før skriving).
- **`pod install` tar 20–60 min på denne maskinen** og ser død ut på
  `Configuring the target with the New Architecture` / `react-native config`.
  **Den er som regel bare treg — ikke Ctrl+C.** Avbryter du der, får du en
  villedende `[!] Invalid Podfile file:` på `use_native_modules!` (linje 18) —
  Podfilen er da IKKE ødelagt, det er bare den drepte Ruby-tråden.
- **Maskin-kontensjon er hovedårsaken til all tregheten.** Verstinger, i tur og
  orden funnet: full disk (98 %), `fseventsd` på 91 %, **Systeminnstillinger →
  Lagring stående åpen** (`ApplicationsStorageExtension` 94 %), og Metro/Xcode/
  to simulatorer samtidig. Lukk alt tungt før `pod install`.
- **`ETIMEDOUT: connection timed out, read` fra metro-file-map** etter at
  Mac-en har stått på i flere døgn = fastlåst filsystem-tilstand. Omstart
  fikser det. (Verifisert at det IKKE var iCloud-eviction: 0 dataless-filer.)
- **Prosjektet ligger i iCloud-synkede `~/Documents`.** Det har nå gitt
  filsystem-trøbbel to ganger. Vurder å flytte til `~/Developer/` en dag —
  egen operasjon, krever at Claude restartes i ny mappe.

### ⚠️ Fallgruve å huske (kostet ellers timer)
**APNs-token er miljøspesifikt.** Debug-build fra Xcode bruker **sandbox**
(`api.sandbox.push.apple.com`); TestFlight/App Store bruker prod
(`api.push.apple.com`). Feil `APNS_HOST` → `BadDeviceToken`. Default er sandbox.

### Slik testes det (etter A–C, to enheter/simulatorer)
1. Logg inn → godta varsel-dialogen. Sjekk i SQL at `device_tokens` fikk en rad.
2. Enhet 2 (forelder) med appen i **bakgrunn**. Enhet 1 (trener) scorer et mål.
3. Forelderen skal få en APNs-banner «⚽ MÅL! …» selv med appen lukket.
4. Åpen app: banneret vises i forgrunn (UNUserNotificationCenter), og feeden
   oppdateres uansett via realtime.
5. `select * from notifications;` skal ha én rad per mottaker (in-app-loggen).
6. Simulator uten push-støtte gir `registrationError` → stille no-op, ingen krasj.

### Kjente v1-begrensninger (akseptert)
- Ingen retry/kø på APNs-feil utover 410-opprydding (pg_net fire-and-forget).
- Ingen deep-link ved trykk ennå — `data.feed_post_id/event_id` sendes med for
  det, men appen navigerer ikke på tap i v1.
- Android: `device_tokens.platform` finnes, men FCM-utsending er ikke bygget.
- `notification_preferences` har ingen UI ennå (default = på; opt-out finnes i DB).

---

## Fase 5 — GJORT (Inbox / Varsler-fanen)

Kodet 2026-07-29. **Ingen migrasjon, ingen native modul → kun Metro-reload.**
Alt backend fantes fra før: `notifications` (00011) + RLS (00014:310–318,
SELECT + UPDATE på egne rader). Ingen ny RPC.

- **`src/lib/api/notifications.ts` (ny):** `getNotifications(teamSpaceId)`,
  `getUnreadCount(teamSpaceId)`, `markAsRead(ids)`, `markAllAsRead(teamSpaceId)`.
  Direkte select — RLS avgrenser til egne rader av seg selv.
  Team-filteret er `.or('team_space_id.eq.X,team_space_id.is.null')`: uten
  null-grenen ville en global `system`-melding aldri dukket opp.
  `markAsRead` har `.is('read_at', null)` så et nytt trykk på en lest rad ikke
  flytter tidspunktet.
- **`src/context/NotificationsContext.tsx` (ny):** ulest-telleren må deles av
  **to** steder — badgen i tab-baren og InboxScreen, som senker den i det du
  leser en rad. Uten delt tilstand ble badgen stående til neste omstart.
  `markRead` senker telleren optimistisk og refetcher etterpå.
  **`getUnreadCount` svelger feil med vilje — en badge skal aldri velte appen.**
  Refresh skjer ved fanebytte (`screenListeners={{focus}}` på `Tab.Navigator`)
  og når appen kommer i forgrunn (`AppState`). **`notifications` ligger IKKE i
  `supabase_realtime`-publiseringen**, så det finnes ingen push-oppdatering av
  telleren — legg den til der hvis badgen skal tikke live.
- **`NotificationRow.tsx` (ny):** emoji per `category`, ulest = heiaSoft-flate +
  grønn prikk + fet tittel, lest = hvit flate + dempet tittel.
- **`InboxScreen`** skrevet om: pull-to-refresh + `useFocusEffect` (samme
  mønster som `KalenderScreen`), «Merk alle som lest» i headeren når det finnes
  uleste (uten den kunne badgen bli stående for alltid), tom-tilstand.
- **Egen `InboxStack`** (`InboxList` + `EventDetail` + `Comments`).
  Tab-en het `Inbox`, heter nå `InboxStack` med label **«Varsler»**.
  Grunn: et trykk på et varsel skal åpne hendelsen/tråden **uten** å kaste deg
  over i Hjem-fanen — tilbake-knappen fører til inboxen. Samme gjenbruk av
  `EventDetailScreen`/`CommentsScreen` på tvers av stacker som Kalender gjør.
- **Deep-link-regelen:** `data.event_id` → `EventDetail` (kamphendelser har den,
  fordi `report_match_event` stempler `event_id` på feed-posten), ellers
  `data.feed_post_id` → `Comments`. Uten mål markerer trykket bare som lest.
  Dette er deep-link-en push mangler i v1 — gjenbrukes den dagen APNs lever.

### ⚠️ Inboxen er tom uten data — og `simctl push` fyller den IKKE

`./scripts/push-test.sh` injiserer varselet lokalt i simulatoren og **rører
aldri databasen**. Fikk du bannere men tom Varsler-fane: det er forventet, ikke
en bug. Radene må komme fra én av disse to:

1. **Vault-seeden** (Fase 4, punkt 11) — den permanente fiksen. Etterpå skriver
   `push-fanout` ekte rader hver gang noen poster. Krever **ingen** Apple-konto.
   **Men:** forfatteren ekskluderes, så poster du med din egen bruker får DU
   ingen rad. Test med to kontoer, ellers ser inboxen fortsatt tom ut.
2. **Test-SQL** (raskest): lager varsler **til deg selv** av de siste
   feed-postene i lagene dine — uten forfatter-ekskludering, nettopp fordi
   én-konto-testing ellers gir null rader. Deep-link-ene virker (ekte
   `feed_post_id`/`event_id`). Bytt ut e-posten med testkontoens:

```sql
with me as (select id from auth.users where email = '<DIN E-POST>')
insert into public.notifications
  (user_id, team_space_id, category, title, body, data,
   source_entity_type, source_entity_id, sent_at)
select me.id, p.team_space_id,
       case when p.type in ('match_start','match_event','match_end') then 'match_live'
            when p.type = 'paaminnelse' then 'event_reminder'
            else 'new_post' end,
       coalesce(pr.display_name, 'Heia'),
       coalesce(nullif(p.content, ''), 'Ny aktivitet i laget'),
       jsonb_build_object('feed_post_id', p.id, 'event_id', p.event_id,
                          'team_space_id', p.team_space_id, 'type', p.type),
       'feed_post', p.id, now()
from me
join public.memberships m on m.user_id = me.id and m.status = 'active'
join lateral (select * from public.feed_posts fp
              where fp.team_space_id = m.team_space_id
              order by fp.created_at desc limit 8) p on true
left join public.profiles pr on pr.id = p.author_id;
```

Feilsøking, i denne rekkefølgen:
```sql
select count(*) from public.notifications;              -- 0 = ingen data, ikke UI-feil
select user_id, team_space_id, category, title, read_at -- ser radene riktige ut?
from public.notifications order by created_at desc limit 10;
```
Er `count` > 0 men fanen fortsatt tom: sjekk at `user_id` er den innloggede
brukeren og at `team_space_id` er det **aktive** laget (skjermen filtrerer på
aktivt lag + globale rader).

### Test dette (Metro-reload, ingen rebuild)
1. Kjør test-SQL-en (eller vault-seeden) → ✉-fanen får en rød badge med tallet.
2. Åpne Varsler → uleste har grønn flate + prikk, leste er hvite og dempet.
3. Trykk et kampvarsel → hendelsen åpnes, raden blir lest, badgen går ned med 1.
   Tilbake-knappen fører til inboxen, ikke til Hjem.
4. Trykk et vanlig innlegg → kommentartråden åpnes.
5. «Merk alle som lest» → badgen forsvinner umiddelbart, alle radene blir hvite.
6. Dra ned for å refreshe. Bytt fane frem og tilbake → badgen holder seg riktig.

## Fase 5B — GJORT (inboxen fyller seg selv + kun ekte varsler)

Migrasjon **`00023_inbox_direct_write.sql` ✅ deployet 2026-07-29**,
`push-fanout` ✅ redeployet. Rettet to feil fra 00022:

### 1. Hele inboxen hang på vault — den gjør den ikke lenger
`notify_on_feed_post` skrev **ingen** rader selv; den fyrte bare et pg_net-kall
til Edge-funksjonen, som skrev dem. Uten `project_url` + `service_role_key` i
vault returnerte den `NEW` og gjorde ingenting — så inboxen var tom for alltid,
uansett hvor mye man postet. **Nå INSERT-er trigger'en `notifications` selv, i
samme transaksjon som posten.** Ingen secrets, ingen Edge Function, ingen Apple
trengs for at Varsler-fanen skal virke. pg_net-kallet står igjen, men gjør nå
**kun** APNs, og kun hvis vault faktisk er seedet.

**Regel å huske: in-app-funksjonalitet skal aldri gå veien om en Edge Function
som krever secrets. Legg den i databasen.**

### 2. Varsler var en kopi av Hjem
Alt i feeden ble et varsel. Nå varsles det kun på det som *er* et varsel:

| Utløser | Kategori | Finnes i feeden? |
|---|---|---|
| Mål, avspark, pause, andre omgang, slutt | `match_live` | ja — men dette er «du gikk glipp av det»-øyeblikket |
| **Kommentar på DITT innlegg** (ny trigger på `comments`) | `new_comment` | **nei — adressert til én person** |
| **Ny hendelse i kalenderen** (ny trigger på `events`) | `event_reminder` | **nei — `create_event` lager ingen feed-post** |
| Vanlig melding / bilde i feeden | — | **varsles IKKE lenger. Det ER feeden.** |

Vil du ha vanlige innlegg tilbake i inboxen: legg `WHEN 'melding' THEN 'new_post'`
tilbake i `CASE`-en i `notify_on_feed_post`. Det er én linje.

### 3. `push-fanout` regner ikke lenger ut mottakere
Den leser `notifications`-radene trigger'en alt har skrevet
(`source_entity_type='feed_post'`) og sender APNs til dem. Ellers ville vi fått
**doble rader** i det vault ble seedet. Én mottakerliste = inbox og push kan
ikke komme ut av synk. pg_net sender først etter commit, så radene finnes.

### `inbox_enabled(user, team, category)`
Ny SQL-hjelper: lag-rad i `notification_preferences` slår global rad, ingen rad
= på. `COALESCE(..., true)` er ikke pynt — uten den blir «ingen rad» NULL, og
`WHERE NULL` filtrerer bort **alle** mottakerne (samme NULL-felle som i 00020).

### ⚠️ Alle varsler ekskluderer den som utløste dem
Reporteren får ikke sitt eget mål, treneren ikke sin egen hendelse, og du får
ikke varsel om din egen kommentar. **Med ÉN konto ser inboxen derfor fortsatt
tom ut, uansett hvor riktig alt er.** Slik testes det ordentlig:

1. Sim 2: logg inn som en **annen** bruker, bli med i laget med invitasjonskoden.
2. Sim 1 (trener): opprett en trening → **sim 2 får «Ny trening …» med én gang.**
3. Sim 2: kommenter på et av sim 1s innlegg → **sim 1 får «… kommenterte
   innlegget ditt».**
4. Sim 1: start kamp og trykk MÅL → **sim 2 får «⚽ MÅL! …».**

Alt dette virker **uten vault, uten APNs og uten Apple-konto.**

## Fase 5C — GJORT (👏-varsel + «Varsle hele laget»)

Migrasjon **`00024_reaction_and_broadcast.sql` ✅ deployet 2026-07-29**.
Ingen native modul → **kun Metro-reload.**

### 1. 👏 «Heia» varsler forfatteren — aggregert
Kudos-varselet er motoren i innholdsløkka: du poster, noen heier, du får
beskjed, du poster igjen. Uten det er det ingen belønning for å dele.
- Ny kategori **`new_reaction`**. CHECK-ene i 00011 er inline på kolonnen med
  autogenerert navn, så migrasjonen finner dem via `pg_constraint` i stedet for
  å gjette navnet — **treffer man feil navn blir den gamle CHECK-en stående og
  hver eneste reaksjon feiler.**
- **Aggregering:** finnes det alt en ULEST reaksjonsrad for samme innlegg,
  oppdateres den («Kari og 3 andre heiet på innlegget ditt») i stedet for å lage
  en ny. `created_at` bumpes så den går øverst. Er raden lest lages en ny.
  Uten dette ville ti som heier gitt ti rader — akkurat støyen 00023 ryddet bort.
- Un-heia (DELETE) fjerner ikke varselet. Akseptert v1.

### 2. «Varsle hele laget» — trenerens kringkasting
Etter 00023 varsler ikke vanlige innlegg. Men noen ganger *er* innlegget
viktig, og da sier avsenderen det selv:
- Avkrysning i compose-boksen på TeamHome, **kun synlig for trener/lagleder**.
  Setter `is_pinned` → varsel i kategorien `admin_message`.
- `is_pinned` fantes fra 00009, og `get_team_feed` sorterer alt
  `ORDER BY fp.is_pinned DESC` — så posten går øverst uten ny kode.
- **`FeedCard` viser «📌 VIKTIG» + rail på pinnede poster.** Uten det trykker
  treneren «varsle alle» og feeden ser helt lik ut — funksjonen ble usynlig.
  `FeedItem.isPinned` + `mapFeedRow` hydrerer feltet (RPC-en returnerte det alt).
- Tittelen i varselet er **forfatterens navn** for `admin_message` (det er
  treneren som snakker), men **lagnavnet** for kamp (det er laget som spiller).

### ⚠️ Pinning er låst i DATABASEN, ikke bare i UI-et
INSERT-policyen på `feed_posts` sjekker kun medlemskap, så uten vakt kunne
hvilken som helst forelder satt `is_pinned` via API-et og varslet hele laget.
Ny BEFORE INSERT/UPDATE-trigger `enforce_pin_is_admin` kaster
«Kun trener eller lagleder kan varsle hele laget».
`COALESCE(is_team_admin(...), false)` — uten den er `IF NOT NULL` usant og
vakten slipper alle gjennom (NULL-fellen fra 00020 igjen).

### Test dette (Metro-reload, migrasjon alt ute)
1. Sim 2 heier 👏 på et innlegg fra sim 1 → **sim 1 får «… heiet på innlegget
   ditt»**. La en tredje bruker heie også → samme rad blir «og 1 annen …».
2. Les varselet, la noen heie igjen → **ny** rad (den forrige er sett).
3. Som trener: skriv et innlegg, huk av **🔔 Varsle hele laget** → posten får
   «📌 VIKTIG» og ligger øverst, og alle andre får et varsel.
4. Som forelder: avkrysningen finnes ikke. (Prøver man via API-et: exception.)

## Fase 5D — GJORT (live overalt + løsne festet post)

Migrasjon **`00025_realtime_feed.sql` ✅ deployet 2026-07-29**. Ingen native
modul → **kun Metro-reload.** To hull funnet av bruker under testing.

### 1. Bare kampen var live
`00020` la KUN `match_sessions` + `match_events` i `supabase_realtime`. Alt
annet krevde pull-to-refresh: sto du på Hjem mens noen postet eller heiet,
skjedde ingenting. Nå er `feed_posts`, `reactions`, `comments` **og**
`notifications` med i publiseringen.
- **`subscribeToFeed(teamSpaceId, onChange)`** i `feed.ts`. `feed_posts`
  filtreres på `team_space_id`; `reactions`/`comments` **har ikke** den
  kolonnen, så de abonneres ufiltrert — trygt, fordi realtime respekterer RLS
  og du kun mottar rader du uansett kunne lest.
- **Debounce på 400 ms i `TeamHomeScreen`.** Én burst med 👏 fra flere
  foreldre skal bli ÉN refetch, ikke ti. `loadFeed` setter ikke `loading`,
  så oppdateringen skjer uten at spinneren blinker.
- **Refetch, ikke flett inn payloaden** — samme valg som `subscribeToMatch`:
  feeden må uansett sorteres (pinnet øverst) og signerte bilde-URL-er hentes
  på nytt.
- **Live ulest-badge:** kanalen bor i `NotificationsContext` og teller opp
  `liveNonce`. `InboxScreen` bruker den som dependency og laster lista på
  nytt — **én kanal dekker både badgen og skjermen**. Ikke lag en kanal til
  i InboxScreen.

### 2. Festede poster kunne aldri fjernes
«Varsle hele laget» festet posten øverst for alltid — det fantes ingen vei ut.
- **`unpinPost(postId)`** i `feed.ts`. RLS hadde alt det som trengtes:
  «Authors can update own posts» + **«Admins can moderate posts»** (00014:194),
  så trener/lagleder kan løsne også andres. `enforce_pin_is_admin` (00024)
  vokter kun veien INN i festet tilstand, så å sette `false` er alltid lov.
  `.select('id')` + egen kastet feil, fordi RLS-avslag gir null rader uten error.
- **Selve «📌 VIKTIG»-markøren er knappen** (med `✕`), kun for trener/lagleder.
  Den står nettopp der man lurer på «hvorfor ligger denne øverst?».
- Bekreftelsesdialog, fordi **det finnes ingen «fest igjen»-knapp** på en
  eksisterende post — vil du feste noe på nytt må det postes på nytt.
  Naturlig neste utvidelse: `setPinned(id, true/false)` + auto-utløp etter
  f.eks. 7 dager, så gamle beskjeder rydder seg selv.

### Test dette (Metro-reload, migrasjon alt ute)
1. To simulatorer på Hjem. Sim 2 poster → **innlegget dukker opp hos sim 1
   uten pull-to-refresh.** Samme med 👏 (telleren beveger seg) og kommentarer.
2. Sim 2 heier på sim 1s innlegg → **badgen på Varsler tikker opp live**, og
   står du på Varsler-fanen dukker raden opp av seg selv.
3. Som trener: trykk «📌 VIKTIG ✕» på en festet post → bekreft → merket og
   toppplasseringen forsvinner, hos begge, live.
4. Som forelder: markøren er ikke trykkbar.

## Fase 5E — GJORT (varselet sier hva det gjelder)

Migrasjon **`00026_notification_context.sql` ✅ deployet 2026-07-29**.
Ingen native modul → **kun Metro-reload.** Funnet av bruker under testing.

### Problemet
«Kari heiet på innlegget ditt» sa ikke HVILKET innlegg — og trykket førte til
kommentarskjermen, som for en **reaksjon** typisk er helt tom. Altså: et varsel
uten kontekst som leder til en blindvei. Rettet i begge ender.

### 1. Varselet bærer nå et utdrag av posten
- Ny SQL-hjelper **`post_ref(content, type)`**: siterer og forkorter teksten
  (`«Husk drakter i morgen»`, 60 tegn + `…`). En bildepost uten tekst har
  ingenting å sitere og omtales som `bildet ditt`.
- `notify_on_reaction` → «heiet på «Husk drakter»» / «og 3 andre heiet på …».
- `notify_on_comment` → «kommenterte på «Husk drakter»: Ja, jeg tar med ekstra».
  Kommentaren kortes til 60 tegn (var 80) fordi referansen tar plass.
- **Raden er nå selvforklarende uten å trykke** — det er den viktigste halvdelen.

### 2. Innlegget vises øverst i tråden
- **`getFeedPost(teamSpaceId, postId)`** i `comments.ts`. Direkte select
  (RLS «Members can view feed»), forfatter via `getMemberMap` som resten av
  fila — **profiles-RLS gir ikke lagkameraters navn direkte.**
- **`media_attachments` er polymorf** (`entity_type`/`entity_id`, ingen FK til
  feed_posts), så PostgREST kan ikke embedde den fra `feed_posts`. Bildet
  hentes i et eget kall + signert URL. Ikke prøv å løse det med `select(...)`.
- `CommentsScreen` laster post + kommentarer parallelt. Posten er
  `.catch(() => null)` — feiler den skal tråden fortsatt vises.
- Ryddet samtidig de to gamle `catch (e)`-lint-feilene i fila.

### Test dette
1. Sim 2 heier på et innlegg fra sim 1 → varselet sier **hvilket** innlegg.
2. Trykk på det → innlegget står øverst, med bilde hvis det er en bildepost,
   over (den kanskje tomme) kommentartråden.
3. Samme for et kommentarvarsel.

## ⏸ Fase 4 (push) er PARKERT — ikke en åpen oppgave
Kode + native + backend er ferdig og deployet; `simctl push` verifisert. Det
som gjenstår er **kun** Apple Developer ($99/år) + fysisk iPhone. Uten
vault-secrets ligger trigger'en trygt i dvale (no-op by design) — ingenting
i appen ryker. Plukk den opp den dagen Apple-kontoen finnes.
Bruker-beslutning 2026-07-29: **ikke bruk mer tid på push nå.** Dette samsvarer
med den låste 3C-beslutningen (realtime nå, ekte push som egen skive senere).

---

## ✅ Fase 6 — Lagoversikt (FERDIG 2026-07-30)

Laget er ikke lenger usynlig: **Profil → Lagoversikt** viser hvem som er med,
gruppert per rolle, og gir trenere en måte å nå én forelder på.

**Hva som ble bygget**
- `supabase/migrations/00027_team_roster.sql` — `get_team_members()` gjenskapt
  (DROP + CREATE, fordi returtypen endret seg) med en ny `phone`-kolonne.
  **To grenser håndheves i SQL-en, ikke i UI-et:** du ser alltid ditt eget
  nummer; lagadmin (`is_team_admin`) ser andre voksnes nummer; **spillerkontoer
  — barna — eksponerer aldri nummeret sitt til noen.** Deployet.
- `src/lib/api/members.ts` — `TeamMember` utvidet med `status`, `joinedAt`,
  `childNames[]` og `phone`. Duplikatradene slås nå *sammen* i stedet for at
  den andre forkastes, så en forelder med to barn blir «Forelder til A og B».
  Endringen er additiv — `EventDetailScreen` og `comments.ts` er urørt.
- `src/screens/TeamMembersScreen.tsx` — seksjoner (trenere/lagledere,
  foreldre, spillere), «deg»-merke, «Invitert»-chip for dem som ikke har åpnet
  appen ennå, pull-to-refresh, og «Inviter til laget» nederst.
  Trykk på en rad med nummer → Ring / Send melding via `Linking`.
- `src/shared/roles.ts` — `ROLE_LABELS` flyttet hit fra `ProfilScreen` og deles
  nå av begge skjermene.
- Registrert i `ProfilStack` (`AppNavigator`, `ProfilStackParamList`), med
  inngang som ListRow i `ProfilScreen`.

**Blokkeren som dukket opp underveis (og ble løst):** `profiles.phone` fantes,
men *ingenting i appen skrev noen gang til den* — `updateProfile` godtok bare
`displayName`/`avatarUrl`. Telefonkolonnen ville altså vært tom for alle.
Derfor: `updateProfile` tar nå `phone` (`null` = fjern nummeret),
`AuthContext` har fått `refreshProfile()`, og Profil har raden
«Telefonnummer» som lagrer via `Alert.prompt`. **`Alert.prompt` er
iOS-only** — raden er derfor `Platform.OS === 'ios'`-gated, og Android trenger
en egen liten flate den dagen det blir aktuelt.

### Test dette
1. Profil → **Telefonnummer** → skriv inn ditt nummer → lagre.
2. Profil → **Lagoversikt**: se seksjonene. Som trener skal 📞 stå på voksne
   som har lagt inn nummer — aldri på spillere. Som forelder skal du ikke se
   andres numre i det hele tatt.
3. Inviter noen uten at de logger inn → de står med «Invitert».

### 🚫 Direktemeldinger — bevisst IKKE bygget (bruker enig 2026-07-29)
DM mellom voksne og barn i en ungdomsidrettsapp er et sikkerhetsproblem, ikke
en funksjon: norske klubber har retningslinjer mot lukket én-til-én-kontakt
mellom voksne og andres barn. Bygges det senere skal det være **voksen-til-
voksen** (trener ↔ forelder), aldri mot spillerkontoer. DM utløser dessuten
strengere krav fra Apple (guideline 1.2: blokkering + rapportering blir
obligatorisk). Behovet bak spørsmålet løses av telefonnummer i lagoversikten.

## ✅ Fase 7 — Kamera + kampbilder (KODET 2026-07-30, ikke verifisert i sim)

**⚠️ KREVER REBUILD** — `Info.plist` har fått `NSCameraUsageDescription`.
Uten den *avslutter iOS appen* i det kameraet åpnes (den spør ikke, og avslår
ikke). Metro-reload er ikke nok. Ingen ny pod — `react-native-image-picker`
var allerede installert, og `launchCamera` ligger i samme pakke.

**Hva som ble bygget**
- `src/lib/media.ts` — `pickTeamImage({preferCamera})` spør «Ta bilde / Velg fra
  kamerarullen» og returnerer bildet klart for opplasting. Den viser sine egne
  feilmeldinger, så kallstedet sjekker bare for `null`. `preferCamera` snur
  rekkefølgen: kamera først i kamp, kamerarull først i hjem-feeden.
- `src/lib/api/feed.ts` — opplastingen er trukket ut som `uploadTeamImage()`,
  så RN-fella (base64 → ArrayBuffer, ALDRI fil-URI i `.upload()`) bor ett sted.
  `createImagePost` tar nå valgfri `eventId` + `matchEventId`.
  Ny `getMatchPhotos(eventId)` med signerte URL-er.
- `supabase/migrations/00028_match_photos.sql` — `get_match_photos(evt_id)`.
  **Deployet.** Egen RPC fordi `media_attachments (entity_type, entity_id)` er
  en generisk peker og IKKE en fremmednøkkel — PostgREST kan ikke joine over
  den, så et nested select fra klienten er umulig.
- `MatchPhotoSheet` — forhåndsvisning + valgfri tekst + valget «Generelt
  kampbilde» eller ett bestemt øyeblikk fra kampforløpet (nyeste øverst).
- `MatchTimeline` — **bildene bor i kampforløpet, ikke i en egen seksjon**
  (bruker-beslutning 2026-07-30). Et bilde knyttet til en hendelse henger på
  hendelsen; et generelt kampbilde er sitt eget innslag på minuttet det ble
  lagt ut. Minuttet regnes ut med SAMME formel som serveren bruker i
  `report_match_event`, så bilder og hendelser deler minuttskala. Deler de
  minutt, kommer hendelsen først — bildet er som regel av det som nettopp
  skjedde. `newestFirst` i live, forfra i rapporten (som før).
- `MatchPhotoRail` + `MatchPhotoGallery` — kompakt thumbnail-rad **kun på
  ferdigspilt kamp**, som åpner fullskjerm galleri med sveiping. Under kampen
  skal ingenting konkurrere med stillingen; etterpå er bildene det man kommer
  tilbake for. Bildene blir uansett stående i forløpet.
- `ReporterActions` — «📷 Legg ut bilde» i full bredde under handlingsknappene.
  Egen `onPhoto`-prop, IKKE en ny `ReporterActionType`: et bilde er ikke en
  kamphendelse og går aldri gjennom `report_match_event`.
- `TeamHomeScreen` bruker samme velger — publiseringsflyten er uendret.

**Låst beslutning (bruker, 2026-07-30):** vanlige innlegg fra hjem-feeden får
**IKKE** automatisk kobling til en pågående kamp. Kampkobling skjer kun via
reporterens bildeknapp inne på kampen. Ett bilde per innlegg, tekst valgfri.

### ⚠️ Kamera kan IKKE testes i simulator
iOS-simulatoren har ingen kameramaskinvare og svarer alltid `camera_unavailable`
— det er ikke noe som kan konfigureres bort. `pickTeamImage` gir da en ærlig
melding («velg fra kamerarullen i stedet») i stedet for å sende brukeren til
Innstillinger for et problem som ikke er en tillatelse. **Alt annet er testbart**
via kamerarullen, som simulatoren har bilder i fra før.

Kamera trenger ingen egen innstilling i appen: iOS lager Innstillinger → Heia
automatisk så snart appen har spurt én gang. Varslingsraden i `ProfilScreen` er
unntaket (ingen naturlig spørreøyeblikk + token-registrering), ikke regelen.

### Test dette (etter rebuild)
1. Hjem → skriv innlegg → bildeknapp → **begge** valg skal dukke opp.
2. Start en kamp, registrer et mål, trykk «📷 Legg ut bilde» → velg fra
   kamerarullen → velg målet i lista → bildet vises **under målet** i
   kampforløpet, ikke i en egen seksjon øverst.
3. Samme, men «Generelt kampbilde» → eget 📷-innslag i forløpet på det
   minuttet det ble lagt ut.
4. Avslutt kampen → kompakt «Kampbilder»-rad øverst, trykk → galleri med
   sveiping. Bildene skal fortsatt ligge i forløpet.
5. Bildet skal også ligge i hjem-feeden som en vanlig bildepost.

**Ikke verifisert:** `tsc` er ikke kjørt (låst regel — se under), og ingenting
er sett i simulator ennå.

---

## ✅ Fase 8 — Feed → kamp-navigasjon (KODET 2026-07-30, ikke verifisert)

Ren TS/TSX. **Ingen migrasjon, ingen rebuild** — men den kom sammen med Fase 7,
så du trenger uansett rebuilden derfra.

Kampen er hovedobjektet: feeden viser høydepunktene, kampsiden samler hele
historien. Derfor åpner alt som hører til en kamp kampsiden.

- `FeedCard` — ny `onPress` (hele kortet) + `onExpandImage` (lite ⤢-ikon oppå
  bildet). `onPress` settes KUN på poster som fører et sted; en vanlig melding
  skal ikke se trykkbar ut. Heia/Kommenter/løsne/forstørr er egne `Pressable`-er
  inni kortet — den innerste tar trykket i RN, så de utløser aldri navigasjon.
- `TeamHomeScreen` — `openableMatchId(item)` avgjør målet. **NB på navnet:**
  den returnerer en `event_id`, ikke en `match_event_id`. Kodebasen har begge,
  og de er lette å blande.
- Fullskjermbilde gjenbruker `MatchPhotoGallery` med ett element.

**Navigerer:** `match_start`, `match_event`, `match_end`, `resultat`, og
`bilde` **med** `event_id` (kampbilder) → `EventDetail` med eksisterende
`eventId`. **Navigerer ikke:** vanlige meldinger, påminnelser, og bilder uten
kampkobling.

**Bevisst utsatt (bruker-beslutning 2026-07-30):** ingen rulling til eller
fremheving av en konkret kamphendelse. Derfor ingen `focusMatchEventId`,
ingen layout-register, ingen endring i `MatchTimeline`. Bygges hvis behovet
faktisk viser seg.

**~~Kjent, urørt~~ → LØST i skive 5 (00029):** `get_team_feed` returnerte
`match_event_id`, men ikke minuttet/stillingen, så kampchipen sto uten tall.
RPC-en returnerer nå `match_minute`/`match_status`/`match_home`/`match_away`.
(`FeedItem.matchEvent` er fortsatt `undefined` — `FeedItem.match` erstatter
behovet, og ingen leser `matchEvent` lenger.)

---

## ✅ Fase 9 — Push → riktig kamp (KODET 2026-07-30, ikke verifisert)

Ren TS. Ingen migrasjon, ingen rebuild, ingen ny pakke. **Kan testes UTEN
Apple Developer** — `simctl push` er allerede verifisert, og et trykk på
varselet i simulatoren utløser nøyaktig samme handlere som ekte push.

Push, hjem-feed og kampside peker nå på samme sted: `EventDetail` med `event_id`.

- `src/navigation/deepLink.ts` (ny) — `navigationRef` +  `openEvent(eventId)` +
  `flushPendingDeepLink()`. Push-lytteren bor utenfor React-treet og har ingen
  `useNavigation`; den trenger en referanse som virker fra en callback som kan
  fyre når som helst. Målet **parkeres** hvis navigatoren ikke er klar, eller
  hvis onboarding står fremme (da finnes ikke `HjemStack`).
- `AppNavigator` — `ref={navigationRef}` + `onReady={flushPendingDeepLink}`,
  og et nytt forsøk når `MainTabs` monteres (første øyeblikk et mål faktisk
  kan åpnes etter innlogging).
- `lib/push/index.ts` — `notification`-lytteren sjekker nå `userInteraction`
  (TRYKK, ikke levering) og åpner kampen. Ny `consumeInitialNotification()`
  for kaldstart, kalt fra `PushGate` når det finnes en innlogget bruker.

**Verifisert mot koden, ikke gjettet:** `sendApns` sprer `payload.data` på
TOPPNIVÅ i APNs-JSON-en (`_shared/apns.ts:125`), og biblioteket legger alle
nøkler utenom `aps` i `_data`. Derfor ligger `event_id` FLATT i `getData()` —
ikke nøstet under `data`. Hadde den vært nøstet, ville navigasjonen aldri
fyrt, helt stille. `userInteraction` settes til tallet `1` av native-siden
(`RCTConvert+Notification.m:299`).

**Ikke bygget (bruker-beslutning 2026-07-30):** ingen `match_event_id`, ingen
rulling til eller fremheving av en konkret hendelse. Kun push → riktig kamp.

### Test dette
1. `xcrun simctl push <device> <bundleId>` med en payload som har `event_id`
   på toppnivå ved siden av `aps`.
2. Trykk varselet med appen **åpen**, i **bakgrunnen**, og **helt lukket** —
   alle tre skal ende på samme EventDetail.
3. Lukket app + utlogget bruker: målet skal parkeres og åpne seg først når
   fanene er montert etter innlogging.

---

## 🐞 Rettelser 2026-07-30 (KODET, ikke verifisert)

**Kalenderen åpnet på fortiden.** `getTeamEvents` henter ALT stigende på
starttid uten tidsfilter, så «Tidligere» lå øverst og nye hendelser havnet
nederst, bak hele historikken. `KalenderScreen` har fått `orderForCalendar()`:
kommende først, fortid nederst og **snudd** (forrige lørdags kamp før den fra
september). Fortiden slettes IKKE — gamle kamper bærer nå kamprapport og
bilder. Sorteringen bruker samme midnatt-grense som `getSectionLabel`; med
`now` ville en kamp kl. 09:00 blitt sortert som fortid, men merket «I dag»,
og seksjonen ville dukket opp to steder.

**Kampvarselet gikk til feil person, og forsvant på et halvsekund.**
`SimulatedPush` var reporterens lokale ekko fra `submitAction` — den som
trykket fikk beskjed om det hun selv nettopp gjorde, mens foreldrene ikke
fikk noe. To feil, to fikser:

*1. Banneret rakk knapt å vises.* `SimulatedPush` hadde `onHide` i
dependency-lista, og `onHide` sendes inn som en pil-funksjon rett i JSX-en —
altså ny identitet hver render. Hver re-render (refetch, tikkende kampklokke)
startet animasjonen på nytt, og `.start(cb)` kaller callbacken **også når
animasjonen avbrytes** → `onHide()` → borte. Nå ligger `onHide` i en ref, og
callbacken sjekker `finished`.

*2. Banneret bor nå over fanene, ikke på kampsiden.* Ny `NotificationBanner`
rendres én gang i `MainTabs` og mates av `notifications`-kanalen som allerede
fantes i `NotificationsContext`. **Dette er et bedre feste enn kampskjermen:**
triggeren i 00023 skriver rader til alle aktive lagmedlemmer UNNTATT
forfatteren, og radene har ferdig `title`/`body`. Mottakerlisten er altså
avgjort i SQL — klienten har ingen «er dette til meg?»-logikk å ta feil av,
og teksten er den samme som ekte push vil sende.
Kanalen lytter på `'*'`, så banneret filtrerer på `eventType === 'INSERT'`
(en UPDATE er «markert som lest»).

Ryddet bort i samme slengen: `InsertedMatchEvent` og
`describeInsertedMatchEvent` i `events.ts` (fra første, dårligere forsøk),
og `SimulatedPush`-bruken i `EventDetailScreen`. `subscribeToMatch` er
tilbake til `onChange: () => void`.

---

## 🧹 Teknisk gjeld — Jest kjører ikke (oppdaget 2026-07-30)

`npx jest` **feiler før én eneste test kjører** (`Tests: 0 total`), og har
gjort det lenge — dette er ikke noe dagens arbeid innførte.

```
node_modules/@react-navigation/native/lib/module/index.js:3
export { createStaticNavigation } from "./createStaticNavigation.js";
SyntaxError: Unexpected token 'export'
```

`@react-navigation/native` distribueres som ESM, og `transformIgnorePatterns`
i Jest-oppsettet transformerer den ikke. Kjeden er
`__tests__/App.test.tsx` → `App.tsx` → `AppNavigator.tsx` → `@react-navigation`,
altså har testen vært ødelagt siden navigasjonen kom inn. Ingen merket det,
fordi suiten aldri kjøres.

Fiks: legg `@react-navigation` (og trolig flere RN-pakker) i
`transformIgnorePatterns` i Jest-konfigurasjonen. Merk at kjøringen tok
**451 sekunder** — regn med at det trengs mer enn én runde.

Egen liten skive. Ikke gjør den sammen med produktarbeid.

**Kjent støy som IKKE er et problem:** Xcode viser ~500 «Issues», men alle
kommer fra `node_modules/` og `ios/Pods/` — ingen fra `src/` eller
`ios/Heia2/`. Under target `Heia2` står det bare to, og begge er iboende i
React Native (duplikat `-lc++` fra CocoaPods, og bundle-scriptet som ikke kan
deklarere outputs). `inhibit_all_warnings!` i Podfile ville skjult
bibliotekstøyen — **bevisst IKKE gjort** (bruker, 2026-07-30). Merk også at
Xcodes issue-panel kun oppdateres når Xcode selv bygger; bygger du fra
terminalen med `npm run ios` blir lista stående gammel.

---

## 📦 Git-status (2026-07-30)

Fase 4–9 er merget til `main` (PR #16). **Designarbeidet skive 1–5 er merget
i PR #17.** Dagens ikon-skive (6) + telefonrettelsene er committet og pushet
på `Brage`, og `origin/main` er merget inn (`474e46c`), så `Brage` er igjen et
rent supersett og en ny PR er konfliktfri. Sen kveld kom i tillegg
telefonfiks-commiten (`ed5d897`) og deretter én samlet commit med
sesongflaten + turneringer/vår-høst (00030–00033) — begge pushet.

### 🔁 Squash-mønsteret — løs det på 30 sekunder, ikke for hånd
GitHub squash-merger PR-en, så `main` får ÉN commit mens `Brage` beholder sine
egne. Git ser da to historikker som rører samme linjer, og du får konflikter
selv om arbeidet er identisk. **Skjedd i #14, #15, #16 og #17.**

**Ikke løs konfliktene manuelt.** Squash-commiten er nesten alltid en kopi av
`Brage` slik den var ved et tidligere punkt. Bevis det, så forsvinner jobben:

```bash
git fetch origin
# 1) Finn commiten Brage sto på da PR-en ble laget (forrige merge-commit).
# 2) BEVISET: er main byte for byte identisk med den?
git diff --quiet <den-commiten> origin/main && echo "Brage er et supersett"
# 3) Behold Brages tre, men registrer main som forelder:
git merge -s ours origin/main
# 4) Verifiser at ingenting gikk tapt — hashen skal være uendret:
git rev-parse HEAD^{tree}
```

⚠️ **`-s ours` forkaster main-siden fullstendig.** Den er kun trygg ETTER at
steg 2 slår til. Gjør den ikke det, har noen endret noe direkte på `main`, og
da må det faktisk inspiseres.

Er filtrehashen lik før og etter, er treet **bevist uendret** — da trengs
ingen tsc/lint-runde på merge-en (se tsc-regelen øverst).

## 🎨 DESIGN — «A v2 · Stadium Pop Hybrid» (LÅST 2026-07-30)

Prosess: 3 HTML-konsepter (artifact) → bruker valgte A → A v2-iterasjon →
**låst**. Artifacts (designintensjon, IKKE piksel-spesifikasjon):
- Konsepter A/B/C: https://claude.ai/code/artifact/51dd852d-7ac7-4b98-b756-f97797538505
- A v2 (den låste): https://claude.ai/code/artifact/cefe92dd-a148-4202-a9b9-71bf8cd28431

**Låste identitetsgrep:** varm mintkrem-hverdag (#F6F8F0); #02FFAB = Heia/
handling/energi; **kampen bor ALLTID på mørk stadionflate** (fra fullt
scoreboard ned til liten score-chip — dette er signaturen); banesirkelmotiv
subtilt, maks ett sted per skjerm; coral = KUN live-status; grønt/gult = mål/
feiring (aldri coral på mål); lagfarge kontrollert (ring/stripe/«oss»-side);
store tabulære 800-tall. Regler: aldri mint tekst på lyst; gradient-disiplin;
ingen «TAP»-roping (SEIER-pill finnes, tap-pill finnes ikke); glød KUN på
live-score, hovedhandling og enkelte Heia-øyeblikk.

### ✅ Skive 1 — hjem (KODET 2026-07-30, IKKE optisk verifisert)
Ren TS/TSX — **kun Metro-reload.** ESLint: 0 nye feil.
- `theme/tokens.ts` — v2-palett (alle gamle tokennavn beholdt + nye:
  heiaDeep/heiaTint/sun/stadium/live/info/remind/gold …), typografi
  (heading1 30/800, scoreLarge/scoreSmall/displayTime m/ tabular-nums),
  grønntonede restriktive skygger + `shadows.glow` (rasjonert).
- Nye: `StatusPill` (semantiske pills, m/ onPress+suffix for «Viktig ✕»),
  `ScoreChip` (mørk kamp-chip), `NextEventHero` (vanlig hero; hele kortet
  åpner EventDetail — bevisst ingen inline-RSVP).
- Endret: `Button` (radius 16, primær = mintfyll + heiaDeep-tekst + glød kun
  aktiv), `Card`, `SectionHeader` (mint-strek + caps), `LiveBadge` (solid
  coral/gul), `TeamHeader` (lagmerke m/ ring + stripe, bg=background),
  `LiveMatchBanner` (stadion-hero: mørk flate, flomlys/banesirkel som
  View-sirkler, glødende mint-score m/ textShadow, minutt fra startedAt),
  `FeedCard` (rail FJERNET; sun-flate for pinned, ScoreChip på kamp-poster,
  reaksjons-pills), `TeamHomeScreen` (hero-prioritet live>neste hendelse via
  `pickNextEvent` på eksisterende `getTeamEvents`; composer m/ avatar+felt+
  kamerachip; Publiser/varsle-rad vises først når noe skal publiseres),
  `AppNavigator` (aktiv fane = mint-pille + mørk tekst — fikser kontrastfeil
  der aktiv farge var #02FFAB på hvitt; +-knapp squircle m/ glød; badge i
  coral).
- **~~Kjente hull~~ — begge lukket senere samme dag:** feed-kampchipen uten
  stilling ble løst i skive 5 (`00029`); tekstglyf-ikonene i skive 4.

### ✅ Optisk review gjennomført 2026-07-30 (alle 4 tilstander sett)
Bruker viste skjermbilder; funn og fikser samme dag:
- **Tab-bar-glyfene ble klippet til strimler** — ikon-slotten i bottom-tabs
  er ~30 px bred; pillens `paddingHorizontal` spiste hele bredden. Fiks:
  `tabBarIconStyle` (64×32) + fast pillebredde (56×30). Verifisert OK.
- **Flomlys-/kremsirklene var for harde** (synlige skivekanter — Views har
  ingen blur). Gjort større + svakere; ekte radial-glød kommer med
  gradient-modulen i rebuilden.
- **Ferdigspilt kamp sto som «neste hendelse»** når avsparket lå frem i tid
  (test-case: kamp spilt før planlagt start). `pickNextEvent` hopper nå over
  `finished` i tillegg til `cancelled`.
- **Slutt-poster i feeden** fikk chip «Slutt» (dempet) i stedet for «KAMP»
  (coral). Coral = kun pågående.
Stadion-hero, sun-kort, bildepost, composer og seksjonsheadere satt som
tegnet. Brukeren åpnet ny samtale med «fortsett» → tolket som OK, skive 2
startet.

### ✅ Skive 2 — kalender, varsler og kampdetalj (KODET + optisk OK 2026-07-30)
Ren TS/TSX — **kun Metro-reload.** `npx eslint src`: **0 errors**, 4 warnings
(alle fra før). tsc ikke kjørt (låst regel — sjekk i editoren).

- **`ScoreBoard` skrevet om til stadionflate** — det låste signaturgrepet
  («kampen bor ALLTID på mørk flate») gjaldt fra fullt scoreboard og ned, men
  ScoreBoard var fortsatt et hvitt kort. Nå: samme motiv som `LiveMatchBanner`
  (flomlys-/banesirkel-Views, lagmerke med ring + «oss»-stripe i lagfarge,
  48 pt tabulær mint-score). **Glød KUN når kampen pågår** (live/pause);
  ferdig = rolig flate med «Slutt»-pill + **SEIER-pill ved seier** (home >
  away — home/away er alltid oss/dem, se Fase 3A). Ingen tap-pill (låst
  regel). Props uendret; henter lagfarge selv via `useActiveTeam`, akkurat
  som `LiveMatchBanner`.
- **`EventCard`:** `Chip` → `StatusPill` (samme type→pill-språk som
  `NextEventHero`); resultatfeltet er nå en **mørk stadionstripe** (coral
  label kun live, gul i pause, dempet «Sluttresultat» + SEIER-pill);
  `featured` (live) = tynn coral kant i stedet for mint-rail (coral eier
  live-status); kortflate på Card-språket (radius.xl + borderSubtle);
  datotall 800 tabulær.
- **`KalenderScreen`:** seksjonsetikettene fikk mint-streken (samme uttrykk
  som `SectionHeader`, men beholdt plassen til `LiveBadge` ved «I dag»);
  tomkort på Card-språket.
- **`RSVPBar`:** mint fylling på mørkgrønn-tonet track — samme språk som
  oppmøtestripa i `NextEventHero`. «Kan ikke» roper ikke lenger i rødt
  (fravær er informasjon, ikke en feil); «kan ikke»-segmentet er dempet grått.
- **`ReporterActions`:** «Mål oss» = mintfyll + heiaDeep-tekst + **glød**
  (reporterens hovedhandling — ett av de rasjonerte glød-stedene; mål feires
  i grønt, aldri coral). «Mål dem» = nøytral hvit flate. Radius-harmonisert.
- **`ReporterBar`:** «Velg» følger knapperegelen (heiaDeep på mint — var
  svart-på-mint); borderSubtle + radius.lg.
- **`MatchEventRow` + `MatchTimeline`:** mål/avspark/fortsettelse på
  heiaTint-sirkler (grønt = feiring), kort på sun, resten dempet — myke
  flater bak emoji i stedet for solide sirkler. Minutter 800 tabulær.
- **`NotificationRow`:** semantisk ikonflate per kategori (match_live=
  liveSoft, new_comment=infoSoft, event_reminder=remindSoft (lilla =
  påminnelse), admin_message=sun, new_reaction=heiaTint, ellers dempet);
  ulest tittel 700.
- **`InboxScreen`:** liste + tomkort på Card-språket.
- **`EventDetailScreen`:** `Chip` → `StatusPill` i infokortet — eneste
  endring; all logikk urørt.
- **`Chip.tsx` SLETTET** (+ ut av `components/index.ts`) — ingen brukere
  igjen etter EventCard/EventDetail.

### Test dette (Metro-reload — optisk review, samme øvelse som skive 1)
1. **Kalender:** pill per type på kortene; mint-strek på seksjonsetikettene.
   Live kamp = coral kant + mørk stripe «PÅGÅR NÅ» med mint-score; pause =
   gul label; ferdig = «SLUTTRESULTAT» + grønn «Seier»-pill når vi vant —
   og INGEN pill når vi tapte.
2. **Kampdetalj live:** mørkt scoreboard med lagmerker, glødende mint-score
   og minutt-pill; som reporter er «Mål oss» mint med glød, «Mål dem» hvit.
3. **Kampdetalj pause:** gul «PAUSE»-badge, stillestående, «Pause — kampen
   fortsetter» under.
4. **Ferdig kamp:** samme mørke flate uten glød, «Slutt»- (+ evt. «Seier»-)
   pill; kampforløpet har mint-sirkler på mål.
5. **Varsler:** fargede ikonsirkler per kategori (coral kamp, blå kommentar,
   lilla påminnelse, gul trenerbeskjed, mint 👏); ulest = grønn flate + prikk
   som før.
6. **Oppmøtestripa** (kalenderkort + hendelse): mint fylling, ingen rød.

### ✅ Skive 3 — resten av flatene (KODET + optisk OK 2026-07-30)
Ren TS/TSX — **kun Metro-reload.** `npx eslint src`: 0 errors, 4 warnings
(samme fire som før). Nå snakker HELE appen A v2 — ingen skjerm står igjen
på det gamle uttrykket.

**Regelbrudd som ble funnet og lukket (mint-tekst/svart-på-mint):**
- `SimulatedPush` (varselbanneret): mint appLabel på hvitt + mint venstre-rail
  → mint-strek + heiaInk, kortflate med borderSubtle (railene er døde i A v2).
- `ReporterSheet`: ✓-haken var `colors.heia` på hvitt → heiaInk.
- `CreateTeamScreen`: «+ Opprett klubb» var heiaPressed på hvitt → heiaInk.
- `SupportScreen`: ✓-fordeler i mint på lyst → heiaInk; «80% til laget» og
  «Spar 33%» hadde svart tekst på mintfyll → heiaDeep.
- `InviteCodeCard`/`ReporterBar`/`AuthScreen`-tab/`WelcomeIntent`: svart tekst
  på mintfylte knapper → heiaDeep (+ glød på Del-knappen og velkomst-CTA-en).
- Verifisert med grep: alle gjenværende `color: colors.heia` er på mørk
  stadionflate (ScoreChip/ScoreBoard/EventCard-stripe/LiveMatchBanner) — riktig.

**Øvrig samkjøring:**
- **`WelcomeIntentScreen` bor nå på stadionflaten** (`colors.stadium`, var
  `textPrimary`-svart) — appens første møte bærer kamp-signaturen.
- **`CreateSheet`:** semantiske ikonsirkler (mint «Del med laget», blå «Ny
  hendelse») — samme språk som varselradene.
- **`ProfilScreen`:** lagvelgeren følger «valgt skifter FLATE»-regelen
  (heiaSoft + mint-ramme, var kun ramme); menyen er et avrundet kort med
  marger (var kant-til-kant); «Dine lag» har mint-strek.
- **`TeamMembersScreen`:** mint-strek på seksjonene, kort på Card-språket.
- **`NewEventScreen`:** feltetiketter i A v2-caps, klokkeslett 20 pt tabulær
  800, valgt chip-tekst 700.
- **`JoinTeamCodeScreen`:** kodefeltet 800 m/ letterSpacing 4, kort/rollekort
  på Card-språket, «Din rolle»-etikett i A v2-caps.
- **`AuthScreen`:** feltetiketter i A v2-caps.
- **`CommentsScreen`/`ListRow`/`ReporterModal`/`MatchPhotoSheet`:** radius-
  og borderSubtle-samkjøring, navn/titler 600–700.
- InviteScreen trengte ingenting (arver fra `InviteCodeCard`).

**Tillegg (bruker-funn under review av skive 3): kommentartråden**
1. **Kommentarbobler.** Kommentarene fløt rett på kremflaten uten avgrensning.
   Nå: hvit boble per kommentar (chat-hjørne oppe til venstre mot avataren),
   navn/tid inne i boblen.
2. **👏 Heia på innlegget inne i tråden.** Man sto PÅ innlegget uten å kunne
   se eller gi applaus — brudd på innholdsløkka. `getFeedPost` (comments.ts)
   hydrerer nå `heiaCount` + `iReacted` (én ekstra reactions-select + lokal
   session i samme `Promise.all`), og `CommentsScreen` har samme reaksjons-
   pill som `FeedCard` med optimistisk toggle + rollback og busy-ref mot
   dobbelttrykk (`toggleReaction` er retningsstyrt — to raske trykk ville
   ellers gitt dobbel insert).

### Test dette (Metro-reload — optisk review av skive 3)
1. Logg ut → velkomstskjermen er mørk stadion med mint CTA (grønn tekst på
   mint, ikke svart). Auth: aktiv fane har mørkegrønn tekst på mint.
2. `+` → valgarket har fargede ikonsirkler.
3. Profil → aktivt lag har mint flate + ramme; menyen er et avrundet kort.
4. Lagoversikt → mint-strek på «Trenere og lagledere» osv.
5. Ny hendelse → CAPS-etiketter, stort tabulært klokkeslett.
6. Under kamp: la et varsel komme → banneret har mint-strek + «HEIA» i
   mørkegrønt, ingen mint-rail.
7. Støtt laget → «80% til laget» i mørkegrønn på mint, hakene i mørkegrønt.
8. Kommentartråd → kommentarene ligger i hvite bobler; innlegget øverst har
   👏-pill med teller. Trykk → teller opp og pillen blir mint; trykk igjen →
   av. Heia i tråden skal også synes i feeden etterpå (samme data).

### ✅ Skive 4 — den samlede «native rebuilden» (KODET 2026-07-30, IKKE optisk verifisert)

Viste seg å være mye mindre native enn fryktet: **react-native-svg 15.15.3 lå
allerede i Podfile.lock** (bygget inn fra før). Dermed:
- **lucide-react-native ^1.28.0** er ren JS oppå svg → kun `npm install`,
  ingen pod install.
- **react-native-linear-gradient er BEVISST IKKE installert.** Artifactens
  flomlys er *radiale* gløder, og linear-gradient kan ikke radial — svg kan.
  Alle gradienter tegnes med react-native-svg. Ikke installer linear-gradient
  senere «for ordens skyld».
- **Eneste native endring: bundlede fonter** (Nunito-Bold/-ExtraBold i
  `assets/fonts/`, linket med `npx react-native-asset` → `UIAppFonts` i
  Info.plist + Resources i pbxproj + android/assets). Krevde bare en vanlig
  `npm run ios`-rebuild — **ingen pod install, ingen 20–60 min**.

**Font (A v2 «tall med autoritet»):**
- Artifacten bruker `ui-rounded` (SF Rounded) — finnes ikke i RN, og Apple-
  lisensen gjør bundling av SF utrygt. **Nunito ExtraBold** (OFL) er
  erstatteren. KUN store tall (score, minutter, klokkeslett, datotall, pris) —
  aldri brødtekst/titler/CAPS-etiketter.
- `fonts.display`/`fonts.displayBold` i `theme/tokens.ts`. Strengen
  «Nunito-ExtraBold» er både PostScript-navnet (iOS) og filnavnet (Android).
- **Sett ALDRI fontWeight sammen med displayfonten** — fila ER vekten; en
  fontWeight får iOS til å lete etter vekter familien ikke har.
- **Sifrene i Nunito er like brede** (verifisert i hmtx-tabellen), så
  `tabular-nums` trengs ikke — klokka tikker uten hopp.
- ⚠️ **TTF-ene fra google-webfonts-helper hadde ØDELAGTE navnetabeller**
  («NunitoExtraLight-Bold»). Fikset med fontTools (name-tabell + usWeightClass
  + fsSelection omskrevet) før kopiering til `assets/fonts/`. Gjenta prosessen
  hvis flere vekter skal inn — ikke bruk zip-filene rått.

**Gradienter — ny delt komponent `StadiumSurface.tsx`:**
- base linear 165° `#0B1912→#143126` + radial amber-flomlys (18%, −20%) +
  radial mint-glød (85%, −10%), pluss banesirkel-ringene. Props: `flood`,
  `arc`, `bordered` (av for chips/striper).
- Brukes av: `LiveMatchBanner`, `ScoreBoard` (erstattet de identiske
  sirkel-View-blokkene), `ScoreChip`, `EventCard`-resultatstripa,
  `WelcomeIntentScreen` (fullskjerm, radius 0).
- `NextEventHero` fikk sin egen mint→krem-linear (140°, `#DFFBEA→#F4F9E6→
  #FAF4DC`) inline — den er hverdag, ikke stadion.
- Gradient-id-er i svg er trygt gjenbrukbare per `<Svg>`-rot (egen scope).

**Ikoner — `src/components/icons.tsx` (eneste lucide-importsted):**
- Re-eksporterer Lucide (stroke 2) + egen **`Ball`** (fotball finnes ikke i
  Lucide — tegnet fra artifactens path med react-native-svg).
- Byttet: tab bar (House/Calendar/Plus/Bell/User — pillen og squirclen
  består), composer-kamerachip, CreateSheet-sirklene, FeedCards kommentar-
  pill + forstørr-knapp (Maximize2), NotificationRow-kategoriene (Ball/
  MessageCircle/Calendar/Megaphone/Check/Info, blekket i flatens ink-farge),
  ReporterActions (alle seks + kamera), MatchEventRow/MatchTimeline-sirklene,
  hakene i ReporterSheet/MatchPhotoSheet/SupportScreen/TeamHome-avkrysningen
  (Check), lukkekrysset i MatchPhotoGallery (X), chevron+MapPin i
  NextEventHero, MapPin+Clock på EventCard-meta.
- **👏 består som emoji overalt** — det er merkevare-gesten, Lucide har ingen
  applaus. `bytte`/`kort` i kampforløpet beholder tegn-glyfene (lages ikke av
  appen ennå). JoinTeamCode-kodefeltet beholder systemfont (kode er ikke et
  display-tall). StatusPill-suffikset «✕» består som tegn (piksel-lite).

`npx eslint src`: **0 errors, 4 warnings (samme fire som før).** tsc ikke
kjørt (låst regel — sjekk i editoren).

### Test dette (optisk review av skive 4 — KREVER rebuilden fra i dag)
Rebuild + fontlinking ble gjort i samtalen 2026-07-30 (npm install +
`npx react-native-asset` + `npm run ios`). Ser talltypografien tynn/vanlig ut
er det den GAMLE binæren som kjører — bygg på nytt før du bedømmer noe.
1. **Tab bar:** strek-ikoner (hus/kalender/bjelle/person), aktiv fane = mint
   pille med mørkegrønt ikon, «+» = mint squircle med mørkegrønt pluss + glød.
2. **Hjem:** hero har ekte mint→krem-gradient med kremdrag nede til høyre;
   composer-kameraet er strek-ikon på mintchip; kommentar-pillen har boble-
   ikon; 👏-pillen er uendret.
3. **Live kamp (hero + scoreboard):** flomlysene er nå myke radiale gløder
   (amber oppe-venstre, mint oppe-høyre) — INGEN synlige sirkelkanter; scoren
   er rund og tung (Nunito). Minutt-pillen likeså.
4. **Kalender:** datotallene på kortene er runde 800; resultatstripa på
   kampkort har gradient.
5. **Varsler:** kategorisirkler med strek-ikoner — fotball (coral), boble
   (blå), kalender (lilla), megafon (gul), 👏 (mint).
6. **Kampforløp:** mål = fotball på mintsirkel, foto = kamera, minuttene runde.
7. **Reporter:** «Mål oss» = fotball-ikon i mørkegrønt på mint m/ glød;
   Pause/Fortsett/Slutt/Kommentar/kamera = strek-ikoner.
8. **Ny hendelse:** klokkeslettet i rund 800.
9. **Logg ut:** velkomstskjermen er gradient-stadion i fullskjerm med
   banesirkel nede til høyre.
10. **Støtt laget:** prisene runde, fordels-hakene er strek-ikoner.

### ✅ Skive 5 — KAMPRAPPORTEN (KODET 2026-07-30, ikke optisk verifisert)

Bruker: «dette er det viktigste i hele appen». Tre grep, én migrasjon.

#### 1. Migrasjon `00029_feed_match_context.sql` (✅ deployet)
`get_team_feed` returnerte `match_event_id`, men aldri minuttet eller
stillingen — derfor sto kampchipen i feeden tom for tall siden Fase 8.
RPC-en joiner nå `match_events` (minutt for posten) og `match_sessions`
(status + stilling for kampen) og returnerer fire nye kolonner:
`match_minute`, `match_status`, `match_home`, `match_away`.
- `match_sessions.event_id` er **UNIQUE** (00009), så joinen er 1:1 — ingen
  radmultiplisering. LEFT JOIN, så poster uten kamp er upåvirket.
- Returtypen endret seg → **DROP + CREATE** (samme mønster som 00027).
  Originalen i 00015 hadde ingen eksplisitte GRANTs, så ingen å gjenskape.

#### 2. Kampchipen i feeden er statusdrevet, ikke posttype-drevet
`FeedItem.match {minute, status, home, away}` + mapping i `feed.ts`
(`MATCH_STATUS_MAP` er nå eksportert fra `events.ts` — én sannhet for
norsk DB-status → appens union). `FeedCard.Marker`:

| Post | Chip |
|---|---|
| `match_end` | «Slutt 4–5» |
| `match_event` (mål/pause/…) | «12′», coral **kun mens kampen faktisk pågår** |
| `match_start` mens live/pause | «Live 2–1» / «Pause 2–1» — lagets levende resultatkort |
| `match_start` etterpå | «Kamp» **uten** stilling |

To bevisste valg: (a) en gammel målpost skal ikke rope coral «live» for
alltid — derfor styrer `match.status`, ikke posttypen. (b) avsparkposten får
IKKE sluttresultatet, fordi teksten sier «Kampen er i gang» og tallet ville
motsagt sin egen post.

#### 3. Kampforløpet har løpende stilling
`MatchTimeline` teller mål-radene i serverens rekkefølge (`ORDER BY
sequence`) og stempler hver målrad med stillingen ETTER øyeblikket; slutt-
raden får sluttresultatet. `MatchEventRow` viser den som en mørk `ScoreChip`
skjøvet til høyremargen — tallkolonnen leses vertikalt nedover forløpet.
- Regnes **klientside**, ikke i DB: `match_events` lagrer ikke stillingen per
  hendelse, og å legge den til ville krevd backfill av gamle kamper.
- Mål uten `teamSide` teller ikke (skal ikke skje etter 00020) — bedre å
  mangle et tall enn å vise feil stilling.
- `ScoreChip.label` er nå **valgfri** (ren stilling-chip uten etikett).

#### 4. En spilt kamp åpner med resultatet
`EventDetailScreen` åpnet med et administrativt infokort (Dato/Tid/Sted), og
scoreboardet lå under. På en spilt kamp ER resultatet historien. Ny
`showReport`-gren: **ScoreBoard først**, så tittel, så «hvor og når» som én
dempet linje (`Torsdag 30. juli · 18:00 · Kunstgresset`), så bilder, så
forløp. Infokortet består uendret for trening/sosialt/kommende kamp.
Oppmøtelisten på en spilt kamp: «Ikke svart» og «Kan ikke» skjules (ren støy
i etterkant), og «Kommer» heter **«Påmeldt»** — fortid, ikke fremtid.
**NB på ærligheten:** listen sier hvem som meldte seg på, ikke hvem som
faktisk møtte. Ikke omdøp den til «Var med» uten ekte oppmøteregistrering.

`npx eslint src`: **0 errors, 4 warnings** (samme fire). tsc ikke kjørt.

### Test dette (Metro-reload — migrasjonen er alt ute)
1. **Feed etter en spilt kamp:** «🏁 Slutt!»-posten har chip **«Slutt 4–5»**;
   målpostene har minutt-chip i dempet grå (ikke coral); avsparkposten har
   «Kamp» uten tall.
2. **Under en live kamp:** avsparkposten viser «Live 2–1» og oppdaterer seg
   via realtime; målpostene har coral minutt.
3. **Åpne en ferdig kamp:** scoreboardet møter deg **først**, tittel og
   «dato · tid · sted» under, deretter Kampbilder og Kampforløp.
4. **Kampforløpet:** hver målrad har en mørk stilling-chip til høyre
   (1–0, 1–1, 2–1 …) og slutt-raden sluttresultatet. Pause/kommentar-rader
   har ingen chip.
5. **Oppmøte på spilt kamp:** kun «Påmeldt (N)», ingen «Ikke svart».
6. **Trening/kommende kamp:** uendret — infokort med Dato/Tid/Sted øverst.

### ✅ Skive 6 — APP-IKON + LAUNCH SCREEN (FERDIG — bruker: «perfekt gjennomført», 2026-07-30)

**⚠️ KREVER REBUILD.** Ikoner og storyboard bakes inn i binæren — Metro-reload
viser ingenting. Ingen ny pakke, ingen pod install, ingen pbxproj-endring
(`Images.xcassets` er en `folder.assetcatalog`-referanse, så nye imagesets
trengs ikke registreres).

**Produksjonsspesifikasjon (siden er oppdatert fra valg til fasit):**
https://claude.ai/code/artifact/143f2aaf-c2b4-48cd-b86c-0ecb01ef7cf5

#### 🔒 LÅST BESLUTNING (bruker, 2026-07-30): variant **C — figur med glød**
Begrunnelse fra bruker: virker best i liten størrelse, tydeligst egenart,
matcher stadionmodus og mint-energien. **Ordmerket skal IKKE brukes som
app-ikon** — variant D er derfor fjernet fra scriptet, ikke bare fravalgt.
Brukerens tre justeringer er innarbeidet: helt solid flate, større figur,
dempet glød.

#### Merkevarekilden — figurmerket, ikke ordmerket
`Heia logoer/` har fem varianter av **samme lockup** («Heia» + jubelfigur) i
ulike fargeversjoner. Det finnes **ikke** noe isolert figurmerke. Figuren er
trukket ut på farge (den er mint `#02FFAB`, ordmerket hvitt/mørkt) fra
`Logo_1.pdf` rasterisert i 3000 px med `sips`, og ligger nå som
**`assets/brand/heia-figur.png`** (680×1025, transparent).

**Hvorfor figuren og ikke «Heia»:** ikonet leses i 60 pt på hjemmeskjermen,
ikke i 1024 px. Ordmerket blir uleselig grøt der. Kandidat D på siden viser
det — den er med nettopp så valget kan tas på syn, ikke på påstand.

**Gledelig funn:** minten i logofilene er nøyaktig `#02FFAB` — samme verdi som
A v2 låste. Merkevaren og designsystemet var allerede samstemte.

#### To ekte feil i det gamle ikonet (ikke smak)
1. **`Icon-1024.png` hadde alfakanal.** App Store Connect **avviser**
   markedsføringsikoner med gjennomsiktighet — dette ville stoppet en
   innsending uansett design. Alt genereres nå som RGB.
2. **Koksgrå flate.** Ikonet var den eneste flaten i hele appen som ikke
   fulgte «kampen bor alltid på mørk stadionflate».

#### `scripts/build-app-icon.py` (ny) — ikonet er DERIVERT, ikke tegnet
```
python3 scripts/build-app-icon.py                # C, standard
python3 scripts/build-app-icon.py --variant A|B  # de to andre som ble vurdert
python3 scripts/build-app-icon.py --android      # tar med mipmap-ene
python3 scripts/build-app-icon.py --preview /tmp/x.png
```
Stadionflaten er **portert 1:1 fra `StadiumSurface.tsx`** (linear 165°
`#0B1912→#143126` stop .78, radial amber cx 18 %, radial mint cx 85 %,
banesirkelringene). Endrer `theme/tokens.ts` seg, kan ikonet følge etter uten
at noen åpner Photoshop.

**Hver ikonstørrelse tegnes for seg** (`build_icon(variant, px)`), ikke skalert
ned fra én 1024-master — gløden må ha egne tall per størrelse
(`_glow_profile`). Intern oppløsning holdes alltid over ~1024 px, så hårfine
detaljer ikke forsvinner i supersamplingen på et 40 px-ikon. Merkehøyden er
`MARK_HEIGHT_FRAC = 0.68`.

Byggingen **kaster** hvis flaten ikke er 100 % dekkende, i stedet for å kaste
alfakanalen i stillhet. App Store-kravet er dermed håndhevet i koden.

#### ⚠️ FIRE alfa-feller i PIL — alle kostet en runde
Disse gjelder all bildegenerering i Python, ikke bare dette ikonet:

1. **`ImageDraw.ellipse(outline=MINT+(33,), width=17)`** tegner hvert av de 17
   pikslene i strekbredden som sitt eget alfa-kompositt. 0.13 lagt oppå seg
   selv 17 ganger ≈ 0.90 — den «subtile» banesirkelen lyste som en neonring.
   Tegn strøket **solid på et eget lag** og komposit ÉN gang med riktig alfa.
2. **`GaussianBlur` på et RGBA-lag blurrer også FARGEN.** Utenfor figuren er
   fargen gjennomsiktig svart, så gløden falmet mot svart og **dempet flaten
   sin egen glød** i stedet for å løfte den — den døde innen 15 px uansett hvor
   høyt tall man skrev. Blur **kun alfakanalen** (`Image.new("L", …)`), og la
   fargen stå solid.
3. **Gjentatt kompositt av samme lag ganger ikke opp lineært.** `0.3` tre
   ganger blir ≈ `0.66`. Da er tallet i koden ikke tallet på skjermen, og
   uttrykket blir umulig å styre.
4. **Et bredt blur sprer alfaen tynt, så toppverdien synker med spredningen.**
   Uten normalisering betyr `strength` noe helt ulikt for et stramt og et bredt
   lag. Normaliser etter blur — da ER `strength` den faktiske toppdekningen.

**Glødet er derfor to lag med ulik spredning:** en stram bloom tett på figuren
(`bloom`) og en bred, svak ambient rundt (`ambient`). Det er *kontrasten*
mellom spredningene som gjør at lyset føles fysisk. Ett jevnt blur-lag er
nettopp det som leser som gaming.

**Målt fasit (1024 px):** grønnkanalen løftes ~30 nivåer rett ved figurkanten,
~18 ved 15 px, ~8 ved 40 px, borte ved 150 px. Vil du justere, endre
`_glow_profile` og mål på nytt — ikke gjett på tallene.

#### Launch screen — stadionflaten, ingen tekst
Malen fra React Native sto urørt: hvit flate, «Heia2» i systemfont, «Powered
by React Native». Nå: stadiongradienten i fullskjerm med figurmerket sentrert
og banesirkelen nede til høyre — **samme flate som `WelcomeIntentScreen` fikk
i skive 3**, så oppstarten og appens første skjerm er ett og samme bilde.

- **Storyboards kan ikke tegne gradient.** Flaten ligger derfor som et bilde
  (`LaunchBackground.imageset`, 1170×2532) og strekkes med `scaleAspectFill`.
  Trygt fordi den er en glatt overgang uten detaljer som kan forvrenges.
  Bakgrunnen er festet til view-kantene, **ikke** safe area.
- `LaunchMark.imageset` i @1x/@2x/@3x, der **@1x ER punktstørrelsen**
  (132×199 pt) — så merket trenger ingen størrelseconstraint, bare sentrering.
- **Ingen tekst med vilje.** iOS viser allerede «Heia» under ikonet man
  trykket på; en splash med logo + navn er en webkonvensjon, ikke en iOS-en.
- `colors.stadium` er satt som view-bakgrunn også, synlig et blunk før bildet
  dekodes.

#### Verifisert uten å bygge appen
Storyboarden er håndskrevet XML, så den er sjekket med Apples egne verktøy:
- `xcrun ibtool --compile` → **0 feil, 0 advarsler, 0 notices.**
- `xcrun actool --compile` på hele `Images.xcassets` → **`Assets.car` bygget
  rent**, alle tre imagesets validerte.
- Alle 8 ikon-PNG-er bekreftet `RGB` (ingen alfa).

Dette er billig og fanger nettopp det en håndskrevet storyboard pleier å ryke
på. **Gjenta det hvis storyboarden røres igjen** — alternativet er å oppdage
feilen i en 10-minutters Xcode-build.

#### Test dette (etter rebuild)
1. **Hjemmeskjermen:** mint jubelfigur på mørk grønn flate. Skal være tydelig
   gjenkjennelig ved siden av andre apper — ikke en grå rute med småtekst.
2. **Oppstart:** mørk stadionflate med merket sentrert. Ingen hvit flash,
   ingen «Powered by React Native».
3. **Innstillinger → Heia:** ikonet i 29 pt skal fortsatt leses.
4. **Varsler:** ikonet i 20 pt — figuren skal fortsatt kjennes igjen som en
   person, ikke bli en grønn flekk. (Kontrollert i generert kontaktark ned til
   40 px; den tynne hevede armen er det som ryker først.)

#### 🐞 To funn fra første ekte telefontest (rettet 2026-07-30)
Begge oppdaget av bruker på skjermbilder fra iPhone — ikke av simulatoren.

1. **Grå boks midt på velkomstskjermen.** `WelcomeIntentScreen` brukte
   `logo-dark.png`, som har **koksgrå bakgrunn bakt inn i rasteret**. På
   stadionflaten ble det en hard grå firkant. `logo-icon.png` er
   gjennomsiktig, men har så mye tom luft rundt merket at `resizeMode="contain"`
   krympet det til en tredjedel av boksen. Løsning: ny **`logo-wordmark.png`**
   (+@2x/@3x) — lockupen beskåret til sitt eget sideforhold (1983×1025 ≈
   1.935), generert fra `Logo_3.pdf`. Stilen bruker nå ekte proporsjoner
   (260×134) i stedet for en kvadratisk boks.
   ⚠️ **`logo-dark.png` skal aldri brukes på en mørk flate** — den er laget
   for lyse flater og bærer sin egen bakgrunn. Den er nå ubrukt.
2. **Håndtegnet tilbake-knapp på Auth.** `AuthScreen` tegnet sin egen
   «‹ Tilbake» — siste brudd på regelen fra 2026-07-09 («nye skjermer skal
   bruke stack-headeren, ikke egne tilbake-knapper»). Auth er nå registrert
   med `authOptions` (`headerShown: true`, **tom tittel**): skjermen bytter
   selv mellom «Velkommen tilbake» og «Opprett konto» som overskrift, så en
   fast headertittel ville duplisert eller motsagt den. `navigation` er ute av
   propsene, og `header`/`backButton`/`backText`-stilene er slettet.

`npx eslint src`: **0 errors, 4 warnings** (samme fire som før).

**Ikke gjort (bevisst):**
- **Android-mipmapene** står på RN-malen. Ett flagg unna (`--android`), men
  Android bygges ikke i dag, så diffen holdes ærlig.
- **iOS 18 mørk/tonet ikonvariant.** Krever det nyere single-size
  `Contents.json`-formatet; dagens eksplisitte størrelsesformat bygger
  uendret. Egen liten skive hvis det blir aktuelt.

---

## ✅ SESONGFLATEN — produktkandidat 5 (KODET 2026-07-30 sen kveld, delvis sett på telefon)

«Hittil i sesongen: 9 kamper, 35 mål» — den første flaten som viser at appen
samler opp noe over tid. Én lese-RPC + én skjerm, som planlagt.
**Kun Metro-reload** — migrasjonene er deployet, ingen native endring.

**Bruker så flaten på telefon samme kveld:** hero-en (KPI-rad + dempet
uavgjort/tap-linje) og inngangen sto riktig. Funnet som ble rettet med én
gang: toppscorerlisten viste fritekst fra mål-dialogen («1-0, latterlig bra
mål», «Fuuuuuukkk») — feltet var aldri et navnefelt. Det utløste beslutningen
under.

#### 🔒 LÅST BESLUTNING (bruker, 2026-07-30): INGEN toppscorer/spillerstatistikk
**Ingen spillerstatistikk før laget har en strukturert spillerstall, og
målscorere skal ikke registreres som fritekst.** Toppscorerlisten er fjernet
fra RPC, API og skjerm (`00031`). I tillegg til datakvaliteten: en rangering
av barna i foreldrenes app er verdimessig feil for ungdomsidrett — samme etos
som «ingen TAP-roping». Scorernavn-idéen kan gjenoppstå den dagen en
spillerstall finnes — ikke foreslå fritekst-varianten igjen.

#### Migrasjoner `00030` + `00031` + `00032` (✅ alle deployet)
`get_season_stats(space_id, p_year, p_half)` → jsonb med totaler
(`played/wins/draws/losses/goals_for/goals_against`), `matches[]` (nyeste
først, med `tournament`-navn), `seasons[]` (velgerlisten) og
`season_year/half/label`. Historikk: 00030 første versjon (med toppscorere),
00031 fjernet toppscorerne, 00032 innførte vår/høst + turneringer (se egen
seksjon under). Valg som er verdt å kjenne:
- **Kun kamper med status `ferdig` teller.** En live kamp flytter ikke
  tallene før «Slutt».
- **Sesong = halvår: vår (jan–jun) / høst (jul–des)** — bruker-beslutning
  2026-07-30, se turneringsseksjonen. Grensen leses i servertid/UTC.
- `COALESCE(is_team_member(...), false)`-vakt (NULL-fellen fra 00020).

#### App
- **`src/lib/api/stats.ts` (ny):** `getSeasonStats(teamSpaceId)` + typene
  `SeasonStats`/`SeasonMatch`. Eksportert fra `lib/api`.
- **`src/screens/SeasonScreen.tsx` (ny):** formen er bevisst IKKE et diagram —
  en KPI-rad med store tall og én liste:
  - **Stadion-hero:** Kamper / Seiere / Mål i Nunito-mint på `StadiumSurface`
    (kampdata bor på mørk flate — låst signatur), med dempet linje
    «2 uavgjort · 2 tap · 12–9 i målforskjell» under. Uavgjort/tap er
    informasjon, ikke en feil — ingen «TAP»-roping (låst regel).
  - **Kampene:** ferdigspilte kamper, nyeste først — «mot Lyn · 12. juli ·
    Hjemme» + Seier-pill (kun ved seier) + mørk `ScoreChip`. **Raden åpner
    EventDetail — altså kamprapporten fra skive 5.** Flatene forsterker
    hverandre: sesongen er indeksen, rapporten er historien.
  - Tom-tilstand («Sesongen starter her …») når ingen kamper er spilt.
    Lasting/feil/pull-to-refresh/`useFocusEffect` — samme mønster som
    KalenderScreen.
- **Inngang: `TeamHeader` fikk valgfri `onSeasonPress`** → «Sesongen»-chip til
  høyre (mørk stadion-chip med mint trofé). **Kun Hjem sender prop-en** —
  Kalender/Varsler bruker samme header uten chip, og har heller ikke
  `Season`-skjermen i stacken sin. Registrert i HomeStack + `Season: undefined`
  i `HomeStackParamList`.

`npx eslint src`: **0 errors, 4 warnings (samme fire som før).** tsc ikke
kjørt (låst regel — sjekk i editoren).

### Test dette (Metro-reload — migrasjonene er alt ute)
1. Hjem → «Sesongen»-chipen står til høyre i lagheaderen → trykk: skjermen
   åpner med store tall for kamper/seiere/mål og dempet uavgjort/tap-linje.
   ✅ Sett på telefon 2026-07-30 — sjekk kun at toppscorer-seksjonen nå er
   borte etter reload.
2. Tallene skal stemme med kampene laget faktisk har spilt i år (kun
   ferdigspilte; en live kamp teller ikke før «Slutt»).
3. Kampene: nyeste først, Seier-pill kun når vi vant, ingen pill ved tap.
   Trykk en rad → kamprapporten (scoreboard først, forløp, bilder).
4. Avslutt en live kamp → gå til sesongen → dra ned for å refreshe →
   kampen står i listen og tallene har flyttet seg.
5. Lag uten spilte kamper (nytt lag): tom-tilstanden, ingen krasj.

### Kjente v1-begrensninger (akseptert)
- Halvårsgrensen leses i servertid (UTC) — en kamp rett rundt nyttår/1. juli
  sent på kvelden kan teoretisk havne i feil halvår. Uinteressant i praksis.
- Ingen inngang fra Kalender/Profil — kun Hjem-headeren. Legg `Season` inn i
  flere stacker hvis behovet viser seg.

**Drive-by-fiks i samme commit:** `ReporterModal` og `MatchPhotoSheet` sto
igjen med `typography.body` i skrivefeltene sine — samme RN #41240-bug
(lineHeight i TextInput) som kveldens telefonfunn rettet i alle andre felt.
Begge bruker nå `typography.input`.

---

## ✅ TURNERINGER + VÅR/HØST-SESONGER (KODET 2026-07-30 natt, omlagt etter brukertest)

Bruker-beslutning samme kveld: «Jeg vil ha støtte for turneringer — en enkel
samling av kamper innenfor den aktive sesongen, ikke et avansert
cupadministrasjonssystem» + «Kan sikkert skille mellom vår og høstsesong?
Dette blir jo som egne turneringer på en måte.» Flere idretter, enklest
mulig, ingen forvirring.

**⚠️ Flyten ble LAGT OM etter brukertest av første versjon** (00032-flyten
med turneringen som kalenderkort + «Ny kamp» kun fra turneringssiden falt
ikke i smak): «på sesongsiden kan man switche mellom sesonger/turneringer —
kanskje det er inne der man legger til en ny turnering? Ved vanlig
kampopprettelse kan man velge turnering HVIS det finnes en, ellers blir det
en vanlig kamp i sesongen.» Det er dét som nå er bygget (00033).

#### Modellen (den mentale: sesong og turnering er begge «samlinger av kamper»)
- **Sesong = halvår.** Vår (jan–jun) / høst (jul–des). Sport-nøytralt uten
  noe oppsett: fotball teller kalenderåret som vår + høst, hallidrettenes
  26/27-sesong ER en høstdel + en vårdel. (`seasons`-tabellen fra 00002 står
  fortsatt urørt/ubrukt.)
- **Turneringer BOR PÅ SESONGSIDEN, ikke i kalenderen.** Velgeren øverst
  sidestiller halvår og turneringer («Vår 2026 · Høst 2026 · 🏆 Hamar Cup»),
  og «+ Ny turnering» er siste chip i velgeren (kun trener). En valgt
  turnering er sin egen visning: egne tall + egen kampliste.
- **Kalenderen viser KAMPENE** — vanlige kampkort, det er dem foreldrene
  møter opp på. Turnerings-containeren er filtrert bort fra kalenderen.
- **Kampskjemaet har et «Turnering»-felt** (chips: «Ingen» + navn) som kun
  vises når laget har aktuelle turneringer (siste 60 dager + kommende).
  «Ingen» = vanlig seriekamp. Turnering-typen er FJERNET fra «Hva
  skjer?»-chipsene — turneringer opprettes ett sted (sesongsiden).
- **I databasen er modellen uendret fra 00032:** turnering = event av type
  `turnering`, kamper peker med `parent_event_id`. Hele kamp-løypa (live,
  rapport, bilder, feed, push) er urørt og vet ingenting om turneringer.

#### Migrasjoner `00032` + `00033` (✅ begge deployet)
- **00032:** `events.parent_event_id` (FK → events, **ON DELETE SET NULL** —
  kampene overlever hvis turneringen slettes) + partial index.
  `create_event` **DROP + CREATE** (ny param `p_parent_event_id` = ny
  signatur; OR REPLACE ville skapt en tvetydig overload). Vakter: forelder
  må være `turnering` i samme lagrom, kun `kamp` kan legges i den, ett nivå.
- **00033:** `get_season_stats` **DROP + CREATE** igjen:
  `(space_id, p_year, p_half, p_tournament)`. Med `p_tournament` viser den
  ÉN turnering (samme svarform, `season_label` = navnet); ellers
  halvårsvinduet. Returnerer alltid `seasons[]` (halvår med spilte kamper +
  inneværende) og `tournaments[]` (alle, nyeste først — også uten kamper, så
  en nyopprettet kan velges). Kun `ferdig`-kamper teller i begge modi.
- **00033 også:** `notify_on_event_created` hopper over rader med
  `parent_event_id` — fire kamper lagt inn i en cup skal ikke gi fire «Ny
  hendelse»-varsler (turneringen varslet da den ble opprettet).

#### App
- `EVENT_TYPE_MAP`: `turnering` er egen type (var `annet`). Ny verdi i
  `EventType`-unionen — alle tre `typePill`-tabellene (EventCard,
  NextEventHero, EventDetail) + `StatusPill` fikk `turnering` (myk gul
  `sun`/`goldInk` — solid gull er fortsatt reservert VIKTIG).
- **`getTeamEvents` filtrerer bort `type='turnering'`** (containeren), men
  turneringsKAMPENE vises i kalenderen som vanlige kamper. Ny lett
  `getTournaments(teamSpaceId)` (siste 60 dager + kommende) til
  kampskjemaets velger; `getTournamentMatches` består (turneringssiden).
- **`NewEventScreen` har tre innganger:** fri (+-knappen; typevelger UTEN
  turnering), «Ny kamp» fra turneringsside (`parentEventId` → låst til kamp,
  gul «Kamp i {navn}»-banner), og «+ Ny turnering» fra sesongsiden
  (`presetType: 'turnering'` → låst, knappen heter «Opprett turnering», og
  man returneres til sesongsiden — ikke kalenderen). Fri kampopprettelse
  viser «Turnering»-feltet (chips «Ingen» + navn) kun når det finnes
  aktuelle turneringer.
- **`SeasonScreen`:** velgeren = halvår-chips + turnerings-chips (med trofé)
  + «+ Ny turnering» (kun trener). Turneringsvisning: trofé + navn som
  hero-etikett, egne tall, kampliste uten mellomtitler. Halvårsvisning har
  turneringsnavn som gule mellomtitler i listen. Valgt chip markeres
  umiddelbart (lokal state) mens serversvaret laster.
- **`EventDetailScreen`s turneringsside består** (kampliste + «Ny kamp i
  turneringen» for admin) — den nås via «Ny turnering»-varselet i inboxen.
  `NewEvent`-modalen er registrert i alle tre stackene (delte
  `newEventOptions`) så den flyten virker overalt. (Netto én lint-warning
  mindre; 3 igjen.)

### Test dette (Metro-reload — migrasjonene er alt ute)
1. **Sesongen → «+ Ny turnering»** (siste chip i velgeren, kun som trener)
   → skjema med gul «Turnering»-banner, «Opprett turnering» → tilbake på
   sesongsiden, og 🏆-chipen for turneringen står i velgeren.
2. Turneringen skal **IKKE** ligge i kalenderen.
3. `+` → Ny hendelse → **Kamp** → «Turnering»-feltet viser «Ingen» +
   turneringsnavnet. Velg turneringen → lagre → kampen ligger i kalenderen
   som et vanlig kampkort.
4. Lag en kamp til med «Ingen» → vanlig seriekamp.
5. Spill turneringskampen (start → mål → slutt — helt vanlig kampside).
   Sesongsiden: kampen står under gul «HAMAR CUP»-mellomtittel i
   halvårsvisningen, og 🏆-chipen viser turneringens egne tall + kampliste.
6. Kun ETT «Ny hendelse»-varsel (for turneringen) — turneringskamper varsles
   ikke enkeltvis.
7. Som forelder: ingen «+ Ny turnering»-chip, ingen «Turnering»-felt-endring
   ellers; alt annet ser likt ut.

### Kjente v1-begrensninger (akseptert)
- Ingen redigering/flytting av en kamp inn/ut av en turnering i etterkant.
- Turneringsvisningen viser kun SPILTE kamper (kjøreplanen bor i
  kalenderen) — før første kamp er spilt viser den 0-er + forklaring.
- Kampkortet i kalenderen røper ikke hvilken turnering kampen hører til —
  det bor på sesongsiden.
- `mote`-typen mapper fortsatt til `annet` (uendret).

---

## ✅ LAGFARGE (FERDIG — verifisert på telefon og committet 2026-07-31)

Bruker-funn: fargevalg fantes ikke i appen — CreateTeam sendte aldri farge,
så ALLE lag fikk RPC-defaulten `#6366F1` (indigo, 00016). Nå: fargevalg ved
opprettelse + innstilling på Profil. **Kun Metro-reload — INGEN migrasjon.**
Skrivingen dekkes av «Admins can update team space»-policyen som alt lå i
00014.

#### 🔒 Kuratert palett, ikke fri fargevelger (bruker godkjente 2026-07-30)
A v2-regelen er «lagfarge kontrollert»: fri velger lar en trener plukke
hvitt/krem (usynlig på flatene) eller mint (kolliderer med #02FFAB =
Heia/handling — live-scoren blir tvetydig). 12 farger i
`src/shared/teamColors.ts` dekker i praksis norske klubbdrakter. Indigo er
MED i paletten slik at eksisterende lag viser «valgt» når velgeren åpnes.

- **`src/shared/teamColors.ts` (ny):** `TEAM_COLORS` (12, med norske navn
  til accessibilityLabel) + `inkOnTeamColor(hex)` — YIQ-luminans → mørke
  initialer på gult (Glimt/LSK-gult tåler ikke hvit tekst), hvite ellers.
- **`TeamColorPicker.tsx` (ny):** swatch-grid, valgt = ring i fargen + hake.
  **`TeamColorSheet.tsx` (ny):** valgark på ReporterSheet-mønsteret —
  trykk på swatch = lagre og lukk.
- **`updateTeamColor` (teams.ts):** direkte UPDATE på `team_spaces` med
  `.select('id')`-vakt — RLS-nekt via USING gir ellers null rader og INGEN
  feil (setMatchReporter-lærdommen). Kaster norsk melding for ikke-admin.
- **ProfilScreen:** «Lagfarge»-rad (kun trener/lagleder/admin), lagfarget
  prikk som ikon → sheet → `refreshMemberships()`. Fargen leses via context
  overalt, så lagmerket, scoreboardet, «oss»-stripa og laglisten skifter
  uten reload.
- **CreateTeamScreen:** «Lagfarge»-feltgruppe med forhåndsvalgt TILFELDIG
  palettfarge (sprer fargene mellom lag, null ny friksjon — alltid utfylt).
  Payload sender `color`; auth-before-commit (pendingAction) bærer den også.
- **Gul-fiksen:** TeamHeader/ScoreBoard/LiveMatchBanner hadde hardkodet
  hvite initialer på lagfargen. Alle tre bruker nå `inkOnTeamColor` på
  «oss»-merket. Motstandermerket er urørt (nøytral mørk flate).

### Test dette (Metro-reload)
1. Profil som trener → «Lagfarge»-rad med dagens farge som prikk → trykk →
   ark med 12 farger, dagens har ring + hake.
2. Velg ny farge → arket lukkes, lagmerket i headeren + prikken i «Dine
   lag» skifter uten reload. Sjekk scoreboardet på en kamp også.
3. Velg GULT → initialene på lagmerket blir mørke, ikke hvite.
4. Som forelder: ingen «Lagfarge»-rad på Profil.
5. Opprett nytt lag → «Lagfarge» står forhåndsvalgt; bytt farge → laget
   får fargen (sjekk lagmerket etterpå).
6. `npx eslint src`: 0 errors, 3 warnings (alle fra før).

---

## 📱 Test på fysisk iPhone (etablert 2026-07-30)

Første gang appen kjørte på ekte enhet (iPhone 15). Tre ting kostet tid og er
verdt å kunne.

### ⚠️ `DEVELOPMENT_TEAM = Q5A6QMRZ4A` er BRUKERENS PERSONLIGE Apple-ID
Lagt inn av Xcode da bruker logget på for å teste på egen telefon.
**Den skal IKKE brukes ved publisering** — bytt til firmakontoen når den
finnes. Team-ID er ingen hemmelighet (den ligger i hver publiserte app), så
den er committet med vilje: alternativet var en permanent endret
`project.pbxproj`, og dette repoet har allerede nok merge-støy fra
squash-mønsteret. Xcode normaliserte samtidig hele fila (omsortering +
tomme `inputPaths`/`outputPaths` på CocoaPods-fasene) — ufarlig.

### «Bygget lyktes, men appen finnes ikke på telefonen»
Bygget lå ferdig signert i `Debug-iphoneos/Heia2.app`, men
`xcrun devicectl device info apps` viste **`Apps installed:` tomt**.
Installasjonssteget hadde aldri kjørt — typisk **⌘B (Build)** i stedet for
**⌘R (Run)**. Diagnose og fiks uten å bygge på nytt:

```bash
xcrun devicectl list devices                       # finn UDID-en
xcrun devicectl device info apps --device <UDID>   # er den installert i det hele tatt?
xcrun devicectl device install app --device <UDID> \
  ~/Library/Developer/Xcode/DerivedData/Heia2-*/Build/Products/Debug-iphoneos/Heia2.app
xcrun devicectl device process launch --device <UDID> org.reactjs.native.example.Heia2
```

**Appen heter «Heia» på hjemskjermen, ikke «Heia2»** — `CFBundleDisplayName`
i `Info.plist` overstyrer `PRODUCT_NAME`. Lett å lete etter feil navn.

### Profilen må godkjennes PÅ telefonen
`process launch` feilet med «its profile has not been explicitly trusted by
the user». Med personlig Apple-ID må man selv gjøre:
**Innstillinger → Generelt → VPN og enhetsadministrering → Utviklerapp →
Apple-ID-en → «Stol på»**. Kan ikke gjøres fra Mac-en.

⚠️ **Gratis provisioning gir 7 dagers sertifikat.** Appen slutter å starte
etter en uke og må installeres på nytt. Ikke en feil.

### ⛔ Fri provisioning låser fortsatt opp push
Personlig Apple-ID gir **ikke** APNs-entitlement. Fase 4 er derfor fremdeles
parkert på nøyaktig samme sted: ekte push krever **betalt** Apple Developer
Program. At det nå finnes et DEVELOPMENT_TEAM endrer ingenting der.

### iOS cacher app-ikoner hardt
Etter en rebuild med nytt ikon kan hjemskjermen bli stående på det gamle.
Slett appen og installer på nytt — det er den pålitelige veien.

---

## 🎯 SENERE — produktkandidater

**Visjonen (bruker, 2026-07-30):** hver kamp skal bli et automatisk *kampminne*
— før kamp (bane, oppvarming), under (mål, bilder, reaksjoner kronologisk),
etter (resultat, galleri, forløp), og senere en delbar «Kampen på 30 sekunder».
Anbefalt rekkefølge, med begrunnelse:

1. ~~**Alle medlemmer kan legge bilder på kampen**~~ — **AVVIST av bruker
   2026-07-30** («nei, alle skal ikke legge bilder på kampen»). Ikke foreslå
   den på nytt uten at bruker tar den opp selv. Backend-en ligger der uansett
   (`createImagePost` tar `eventId` fra hvem som helst, RLS krever bare
   lagmedlemskap), så kampbilder er fortsatt reporterens jobb — som i dag.
2. **Kommentarer + heiing synlig i kamptidslinja** — «var der»-følelsen ligger
   i de andres stemmer. De finnes i dag, men bor på feed-poster og er usynlige
   på kampsiden.
3. **Før kamp-innhold** — nesten gratis når 1 finnes: samme knapp, bare ikke
   låst til live-grenen.
4. **«Kampen på 30 sekunder»** — SIST. Kvaliteten er en direkte funksjon av
   hvor mye innhold kampen samlet; bygges den før 1–3 oppsummerer den fire
   måltidspunkter og ingenting annet.
   ⚠️ **Avklar før den bygges:** en *delbar* oppsummering bryter med at bildene
   ligger i privat bucket med signerte URL-er nettopp fordi de er av barn.
   Norske klubber har samtykkeregler for billedbruk. Deling til foreldregruppa
   er noe helt annet enn en offentlig lenke — lettere å designe riktig nå enn
   å trekke tilbake senere.

Andre kandidater:
5. ~~**Sesong/statistikk-flate**~~ — ✅ **BYGGET 2026-07-30** (se seksjonen
   «✅ SESONGFLATEN» over). Venter kun på optisk review.
6. **Varslingsinnstillinger-UI** — `notification_preferences` + `inbox_enabled()`
   (00023) finnes i DB, men har ingen skjerm. Påbygg på 🔔-raden i `ProfilScreen`.
7. **`+`-knappens «Start kamp»-snarvei** (låst beslutning 1, siste rest).
8. **Rydd `NSLocationWhenInUseUsageDescription`** — står med tom streng i
   Info.plist og posisjon brukes ingen steder. Tomme begrunnelser er en kjent
   grunn til avslag i App Store-review.
9. ~~**Sport + årsklasse i TeamHeader**~~ — ✅ **DEKKET AV P3 2026-07-31**
   (undertekst «Fotball · N medlemmer», fallback «Fotball · G14»).

### 🎨 Designgjeld (kartlagt 2026-07-30 — ikke påbegynt)
- **BRAND_UI.md beskriver FØR-A v2-systemet** (gamle fargeverdier, slettet
  `Chip`, «Unicode-symboler» som ikonstil, 5-tab med «Meldinger»). Alt låst
  A v2-språk bor kun i denne fila. Skriv den om FØR noen bygger på den.
- **13 rå `ActivityIndicator`-lastetilstander** — «default spinners» er
  eksplisitt anti-mønster i BRAND_UI. Skeleton/tomkort på Card-språket.
- **Null bevegelse i appen** (kun LiveBadge-puls + SimulatedPush). Størst
  effekt per innsats: MÅL-øyeblikket (scoren teller opp / feiring).
- **Ingen haptikk** på mål/Heia/start-slutt — krever native modul → rebuild.
- **Tilgjengelighet:** 7 accessibilityLabels i hele appen; fast px-typografi
  (ingen Dynamic Type). Målgruppa er foreldre 40+.
- **`bytte`/`kort`** i MatchEventRow/MatchPhotoSheet er fortsatt tegn-glyfer
  (↔/🟨) blant Lucide-ikonene — appen lager dem ikke ennå, men de VISES om
  data finnes.
- **Mørk modus: lås bevisst «nei i v1»** — mørk flate BETYR kamp i A v2; en
  systemvid mørk modus ville spist signaturen.

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
- **Claude KAN kjøre `supabase db push`** — men bash-sandkassen blokkerer nettverk, så kommandoen henger uten output. Kjør den med sandkassen av. DB-passordet ligger i macOS-nøkkelringen fra `supabase link`, så den spør ikke.
  `supabase migration list` krever derimot en **access token** (`supabase login`), som ikke er satt — den feiler uansett. Bruk `db push --dry-run` for å se hva som er ubehandlet.
- **Ny native modul krever full rebuild** (`pod install` + Xcode/`run-ios`), ikke bare Metro-reload.
- **RN 0.83 har ikke Clipboard i core.** Kopiering krever native modul; ellers `<Text selectable>`.
- **Ikke referer en native modul som ikke er bygget inn** — krasjer ved import.
- **RN-bildeupload:** base64 → ArrayBuffer (`base64-arraybuffer` `decode`), IKKE fil-URI direkte i supabase-js `.upload()`.
- **ESLint-serveren i editoren er treg** og viser av og til stale «problems» rett etter merge/rebuild — de forsvinner når den kjører gjennom. tsc er sannhetskilden.
- Miljø: Node v24, RN 0.83.1, Metro 0.83.3, ingen watchman, ingen node-version-manager.
