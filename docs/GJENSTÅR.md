# Hva som gjenstår i Heia

_Samlet 2026-09-11 fra `docs/STATUS-HANDOFF.md` (13 830 linjer), de ni andre
plandokumentene, koden og minnene. Tallene og de tekniske påstandene er
sjekket mot repoet, prod-databasen og Supabase samme dag._

**Slik brukes fila:** dette er arbeidslista. `STATUS-HANDOFF.md` er
historikken. Når et punkt lukkes, stryk det her og skriv hvorfor i handoffen.
**Brage** foran et punkt betyr at det krever noe utenfor koden: Apple,
Stripe, Brønnøysund, Google, en telefon eller en beslutning. Resten er
kodearbeid.

---

## Der vi står — hva som FAKTISK kjører

_Målt 2026-09-11 kl. 20. Et punkt er ikke i drift fordi koden er pushet.
Hvert lag deployes for seg._

| Lag | I drift nå | Nyere lokalt |
|---|---|---|
| **Nettsiden** heiaapp.no | `main` = `318305e` (17:47) | `Brage` er **4 commits foran**. Ingen av kveldens nettsidefikser er live — verifisert: AASA serverer fortsatt `/stott*` og `/betaling*`, `robots.txt` gir 404, og bare Vercels egen HSTS står. |
| **Edge Functions** | `stripe-checkout` **v10 (19. aug)** · `push-fanout` **v13 (3. aug)** · `claim-notify` v8 (11. sep) | **Dobbeltbetalingsfiksen er IKKE deployet.** Koden er committet, funksjonen er ikke. Krever `supabase functions deploy`. |
| **Databasen** | migrasjoner t.o.m. **`00082`** | `00083` og `00084` er skrevet med bevisfiler, **ikke kjørt**. |
| **Secrets** | `WEB_INVITE_BASE_URL` satt 11. sep kveld | Eneste ting fra i kveld som ER i drift. |
| **runtime_config** | `broadcast` på feed, match og notif · `poll = 0` · `min_build = 0` | — |
| **TestFlight** | **1.0 (4), lastet opp 18. august** | Se under. Dette er det største avviket. |

### Det installerte bygget er eldre enn nesten alt

Bygg 1.0 (4) er fra **18. august**. Alt dette kom etterpå og finnes derfor
**ikke** på noen telefon i dag:

- **26. aug** `8adca43` sesjonskontekst og runtime-config (S2)
- **30. aug** `b053cce` cold start (S7) · `e4c4b6d` Broadcast-backend (S3a)
- **1. sep** `df8f0d8` Broadcast i kamp (S3b) · `20d54ef` feed, varsler og kampknapp (S3c)
- **2.–10. sep** hele designsporet, feedkortet, kampskjermen runde 2, sesongsiden
- **11. sep** `0e43741` delelinken til heiaapp.no

**To konsekvenser som må styre rekkefølgen:**

1. **Punkt 31 (fjerne `postgres_changes`-publikasjonen) vil BRYTE alle
   installerte bygg.** 1.0 (4) har ingen Broadcast-klient og leser ikke
   `runtime_config` i det hele tatt — den bruker `postgres_changes` som
   hardkodet oppførsel. Publikasjonen kan først tømmes når et bygg med
   Broadcast er ute og gammel-andelen er ~0. `min_build` (finnes i
   `runtime_config`, konsumeres ikke ennå) er verktøyet for å måle det.
2. **Ytelsesfiksene 88 og 89 kan ikke måles før 1.0 (5).** De ligger i kode
   som ingen telefon kjører.

**Kritisk sti til lansering:** Heia AS → D-U-N-S → Apple-konvertering og
Stripe live-kontroll → live-nøkler → App Store.

**Harde sperrer mot App Store:** punkt 4 (juridiske plassholdere) og
punkt 27 (personvernetiketter). Ingen andre.

---

## Prioritert arbeidsrekkefølge (fire skiver)

Avtalt med Brage 2026-09-11. Backend-arbeidet tas i ny samtale.
Avhengighetene er reelle — skivene kan ikke byttes om fritt.

| Skive | Innhold | Avhenger av | Punkter |
|---|---|---|---|
| **1** | Miljøer og databaseautorisasjon | ingenting — start her | ~~108~~, ~~109~~, 113, 97, 111, 98, 30 |
| **2** | Betaling og varsler tåler avbrudd | skive 1 (testmiljø å bevise i) | 87, 96, 107, 22 |
| **3** | Oppstart, nettverk og caching | skive 1 (CI som fanger regresjon) | 99, 40, 104, 88, 89, 100, 103, 102, 101 |
| **4** | Hele reisen på telefon og nett | skive 1–3 må være i drift | 5–7, 73, 49, 43–45, 94, 105, 106 |

### Beslutninger som ER tatt (ikke relitigér)

- **Punkt 99, kaldstart:** appen skal kunne åpne så snart brukerkonteksten
  er etablert, uten å vente på livekamp-oppslaget. Kampstatus lastes i
  bakgrunnen. Ukjent eller feilet oppslag betyr **ikke** «ingen kamp», og et
  sent svar skal ikke flytte brukeren. Dyplenker til kamp og gjenopptakelse
  av reporterflyten må fortsatt lande riktig.
- **Punkt 97, dørene:** katalogdrevet oppslag av signaturer er riktig
  retning. Men funksjonsutvalget og rettighetene må dokumenteres per
  funksjon — se korreksjonen under.
- **Punkt 107, deaktivering:** må tåle avbrudd og kunne fortsette, og det
  må gjøres **før** ekte betalinger åpnes, uavhengig av lagstørrelse.
- **Produkt- og designretningen er godkjent og skal beholdes.** Ingen av
  skivene endrer utseende eller oppførsel som er telefongodkjent.

### Arbeidsmåte (avtalt)

- Én avgrenset skive om gangen: kartlegg kallere og dataveier, implementer
  sammenhengende, kjør målrettede tester, gjør en egen kritisk gjennomgang.
- Produksjonsendringer forberedes **fullt ut** med testbevis og en konkret
  utrullings- og tilbakeføringsplan, og legges fram for godkjenning før de
  kjøres. Jeg ble blokkert av auto-mode-klassifisereren på å skrive DDL mot
  prod — regn med at Brage kjører selve pushen.
- Arbeidsgren `Brage` → push → Vercel-preview → Brage merger selv. `gh` er
  ikke innlogget; PR opprettes av Brage fra compare-lenken.
- Nye funn utenfor skiven føres her på lista, ikke fikses underveis.
- Telefonkontroll samles i korte, konkrete testløp når den er nødvendig.
- Avslutt hver skive med: hva endret seg, hvilke tester gikk, hva er i
  drift, hva trenger Brages telefon eller godkjenning, og neste steg.

### To korreksjoner fra kontrollen mot prod

**Punkt 22 var feil og er strøket.** Splitten ER låst. Prod viser
`fee_model = fixed_club_amount`, `club_fixed_minor = 6000` og
`amount_minor = 7900` på alle aktive tilbud. `fee_bps = 2405` er ikke en
25 %-plassholder, men den avledede prosenten som gir nøyaktig 19 kr av 79.
Dokumentene som sier «bps 2500 plassholder» er utdaterte. **60 kr fast til
klubben gjelder.** Ikke endre betalingsmodellen.

**Punkt 111 løses IKKE av 00084 — GPT har rett.** `inbox_enabled(p_user,
p_team, p_category)` har ingen `auth.uid()`-sjekk overhodet. Å stenge
`anon` smalner den bare fra «hvem som helst på internett» til «hvilken som
helst innlogget Heia-bruker», som fortsatt kan slå opp andres
varselinnstillinger. Dette avdekker en svakhet i migrasjonen slik den står:
den gir `authenticated` til ALLE 25 uniformt. Det er riktig for
bruker-RPC-er, men galt for **interne hjelpere** som `inbox_enabled`,
`is_team_member`, `is_team_admin` og `is_club_team_admin` — de kalles fra
triggere og policyer som kjører som eier, og mønsteret i repoet sier at
slike skal revokes fra alle tre roller.

⚠️ **Må avklares empirisk før 00084 kjøres:** trenger en funksjon som
brukes i et RLS-uttrykk EXECUTE for rollen som kjører spørringen? Hvis ja,
kan ikke `is_team_member` revokes fra `authenticated`, og da må skillet
mellom bruker-RPC og intern hjelper settes for hånd. Test i en transaksjon
som rulles tilbake: revoke, kjør en `select` mot en RLS-beskyttet tabell
som `authenticated`, se om den feiler, rull tilbake.

---

## A. Heia AS og det juridiske

1. **Brage — registrere Heia AS.** Regnskapsfører velges først og svarer på
   MVA-spørsmålene i samme løp. AS framfor ENK er en låst beslutning.
2. **Brage — D-U-N-S-nummer.** Kreves for å konvertere Apple-kontoen.
3. **Brage — konvertere Apple Developer-kontoen** fra privatperson til Heia
   AS. Apper, bygg, TestFlight-historikk og navnereservasjon overlever; kun
   selgernavnet bytter. Må skje før offentlig lansering.
4. **Selskapsopplysningene inn i produktet.** Foretaksnavn, organisasjonsnummer
   og adresse står som plassholdere fire steder: `web/src/config.ts` (`LEGAL`,
   alle tre `null`), `web/src/pages/vilkar.astro`, `web/src/pages/personvern.astro`
   og bunnteksten på nettsiden. Selve jobben er én liten PR når tallet finnes.

## B. Neste TestFlight-bygg

5. **Bumpe byggnummeret til 5.** `CURRENT_PROJECT_VERSION` står på `3` i
   `ios/Heia2.xcodeproj/project.pbxproj`, mens bygg 1.0 (4) allerede er lastet
   opp. App Store Connect avviser lik eller lavere verdi.
6. **Brage — arkivere og laste opp.** Obligatorisk før opplasting: sjekk at
   `main.jsbundle` faktisk ligger i det nyeste `.xcarchive`. Bygg 1.0 (2) ble
   lastet opp ødelagt fordi steget ble hoppet over.
7. **Hva bygget bringer:** hele designsporet siden midten av august
   (dagslysgrunn, glassflater, tab-bar, kommentarark, masthead, feedkort,
   kampskjermen runde 2, sesongsiden, hendelsessiden) og delelinken
   `https://heiaapp.no/lag?kode=`. Ingenting av det er kjørt i et ekte bygg.
8. **Haptikk** (mål, Heia, start og slutt) krever en native modul og tas ved
   neste rebuild uansett årsak.
9. **Intern omdøping «Heia2» → «Heia»** i target, mappe og prosjekt. Bevisst
   utsatt, rent kosmetisk.
10. **Hermes-symboler.** «Upload Symbols Failed» gir usymboliserte frames i
    kræsjloggene.

## C. Telefontester som venter (Brage)

Disse er bygget og bevist på server- eller RPC-nivå, men knappene og tekstene
er aldri sett på en telefon.

11. **Pre-TestFlight-lista fra «Forlat lag»:** forlate lag med barn · levende
    støtteavtale-tekst og «Administrer støtte» · siste trener blokkeres,
    rollemeny og overdragelse · trenerforespørsel med godkjenn og avslå ·
    «Gjenåpne laget» · kommentar fra utmeldt forfatter beholder navnet.
12. **Hele B6-runden** (profilrydding 1 og 2), bygget 2026-08-19. Husk å
    restarte Metro, det kom et nytt asset.
13. **Kodeinntastingen i passordgjenoppretting** (sekssifret e-postkode inline).
14. **Push-trykk på rollevarsel.** Kan bare testes i TestFlight, dev-bygg har
    ikke push. Push-veien til klubbdør-varsler er uverifisert.
15. **«1 ny hendelse»-pillen** under en ekte livekamp. Simulatoren har ingen.
16. **Stor tekst og 16–6-stillinger** på kampskjermen. Bare sjekket i canvas.
17. **Kjør `scripts/verify-password-change.mjs` på nytt** etter neste
    `supabase config push`, for å bekrefte at dashbord-bryteren «Require
    current password when updating» fortsatt står.

## D. Betaling: fra testmodus til ekte penger

18. **Brage — Stripe live-KYC på AS-et.** Har ledetid, start tidlig.
19. **Live-nøkler og nye webhook-registreringer.** Webhooks må registreres på
    nytt i live-modus, testmodus-registreringene følger ikke med. Portalen må
    også konfigureres i live.
20. **Brage — Ridabu gjennom KYC på nytt.** Dagens konto er sandbox.
21. **Én ekte betaling som røyktest**, med verifisering av pengeveien i
    databasen.
22. ~~**Splitten er ikke låst.**~~ **STRØKET 2026-09-11** — kontrollert mot
    prod: alle aktive tilbud har `fee_model = fixed_club_amount`,
    `club_fixed_minor = 6000`, `amount_minor = 7900`. `fee_bps = 2405` er den
    avledede prosenten som gir 19 kr av 79, ikke en plassholder. 60 kr fast
    til klubben gjelder.
23. **Brage og regnskapsfører — fire avklaringer:** MVA på Heia-andelen,
    disputepolicy som tekst, standard for statement descriptor, og
    varslingsflyt når et lag avvikles.
24. **`statement_descriptor` settes bevisst ikke** i `stripe-onboarding` i
    dag. Venter på beslutningen over.
25. **Støttevarslene er dokumentert, ikke bygget:** `support_thanks`,
    `support_renewed`, `support_milestone`, `support_failed`. Vent til
    betaling er live.

## E. App Store-innsending

26. **Innsendingsmaterialet finnes ikke** noe sted i repoet: skjermbilder i
    alle påkrevde størrelser, appbeskrivelse, nøkkelord, kategori og
    aldersgrense. Bør bli en egen sjekkliste.
27. **Brage — personvernetiketter** («privacy nutrition labels») fylles ut i
    App Store Connect. Hard blokker.
28. **URL-ene er klare** og skal bare fylles inn: `heiaapp.no/hjelp` som
    Support URL, `/personvern` som Privacy Policy URL, forsiden som Marketing
    URL.
29. **App Store-lenkene tilbake i nettsiden** når appen er publisert.
    `TESTFLIGHT_URL`, `APP_STORE_URL` og `APP_STORE_ID` i `web/src/config.ts`
    er tomme, og styrer både hovedknappen og Smart App Banner. Så lenge de er
    tomme faller knappen tilbake til kontakt-e-post, som er designet slik.

## F. Teknisk før lansering

30. **Dørene på tre skrive-RPC-er.** `start_match`, `report_match_event` og
    `soft_delete_post` svarer `P0001` og ikke `42501`, altså stopper de på en
    intern sjekk framfor på rollen. Bevisst utsatt fordi en feil her betyr at
    mål ikke kan rapporteres midt i en kamp. Krever egen skive med egen
    telefonkontroll. Lesestien er riktig lukket.
31. **S4 — tømme `postgres_changes`-publikasjonen.** ⚠️ **BLOKKERT av det
    installerte bygget.** 1.0 (4) er fra 18. august og har ingen
    Broadcast-klient — den leser ikke engang `runtime_config`. Tømmes
    publikasjonen nå, mister alle installerte bygg sanntid. Først etter at
    et bygg med Broadcast er ute og gammel-andelen er målt til ~0.
32. **S5 — indekser med planbevis.** Ikke startet.
33. **S6 — mediavalidering i storage** (D5). Skal være på plass før offentlig
    lansering.
34. **S8 — lasttest.** Ikke startet.
35. **Brage — egress-avlesningen er forfalt.** Planen var å lese −80 % i
    Usage → Bandwidth cirka to uker etter 2026-08-18. Det er nå over tre uker.
    Ren avlesning, ikke arbeid.
36. **Brage — baselinemålingene mangler.** Tabellen i
    `docs/audit-observability.md` står tom, elleve målinger og spørsmålene
    Q1 til Q7. Det var forutsetningen for å bevise egress-effekten.
37. **Brage — beslutning om gamle kameraoriginaler** før lansering.
    Manifestet ligger klart, og originalene slettes aldri uten at du sier ja.
38. **Brage — Supabase Pro** ved offentlig lansering.
39. **Oppryddingsjobb for media** som er soft-slettet, og for foreldreløse
    filer. Kommentaren i migrasjon 00010 lover en jobb som ikke finnes.
    Feed-sletting og klubblogo er best-effort mot storage i dag.
40. **Supabase-klienten har ingen fetch-timeout.** Fjorten QUIC-timeouts på
    null byte og 180 til 360 sekunder er observert.
41. **Brage — Sentry-lesetilgang for meg.** Bevisst utsatt til første ekte
    feil, krever et User Auth Token.

## G. Hull i produktet

Funksjoner som er lovet i grensesnittet, eller som mangler en vei ut.

42. **Varselet som aldri kommer.** «Støtt laget»-oppsettet lover «Du får varsel
    her når klubben er klar», men `stripe-webhook` oppretter ingen
    notifikasjon når kontoen blir aktiv. Verifisert i koden i dag. Treneren
    venter på noe som aldri skjer.
43. **«Legg ned laget» og ops-verktøyene for dormante lag er ikke bygget.**
    Tre dokumenterte blindveier ender alle her: trener i et lag med bare
    spillerkontoer, tidligere trener som nå er forelder, og trenerforespørsel
    i et låst lag. Ops-fallbacken er i dag rå SQL med service-rollen.
44. **En livekamp kan ikke avlyses.** En kamp som brytes i regnvær har ingen
    vei ut annet enn «Slutt».
45. **Gammel kamp uten sluttsignal** («Kampen er ikke avsluttet i Heia») er
    ikke bygget.
46. **Heia på motstandermål** krever et produktvedtak og en databaseendring.
    Er bevisst ikke omgått i grensesnittet.
47. **Lagkassa skiller ikke pauset fra aldri-priset.** Teksten «tar ikke imot
    nye støttespillere» dekker begge. Ordentlig fiks er en ny `reason` fra
    migrasjon 00039.
48. **Medlemstall teller rader, ikke personer.**
49. **Invitasjonskoden roterer ikke.** En som er fjernet fra laget og husker
    koden kan bli med igjen.
50. **Stilling og minutt mangler i kampchipen i feeden** til `get_team_feed`
    også hydrerer `matchEvent`.
51. **Flere samtidige livekamper** er utsatt. `getLiveMatch` gir én.
52. **Målscorer eksponeres bevisst ikke** i korrigeringen. RPC-parameteren
    finnes, klienten sender alltid `null`.
53. **`author_role` blir NULL** på historiske innlegg mens forfatteren er ute.
    Kosmetisk.
54. **`delete_account_data` nuller ikke `avatar_color`.** Akseptert, tas hvis
    funksjonen uansett endres.
55. **Innholdsforhåndsvisning i varselradene** (stilling på målvarsel,
    miniatyr på bildepost) krever databasearbeid.
56. **Brage — «Kampen på 30 sekunder»** har en åpen personvernavklaring om
    barnebilder og samtykke.

## H. Design og materiale

De tre store skivene (kampskjermen runde 2, sesongsiden og hendelsessiden) er
telefongodkjent og committet i `72be9c0`. Dette står igjen.

57. **«Øyeblikkene» er ikke bygget.** Pulsen ble tatt ut av kampskjermen i
    runde 2 og skulle erstattes av en stripe med grupperte, trykkbare
    markører. Den finnes ikke i koden. Dette er den største delen av den
    godkjente kampretningen som mangler.
58. **Kontrast.** `textTertiary` måler 2,7:1 mot hvitt og 2,1:1 mot opalen.
    Etikettkontrasten midt på grunnen er et kjent svakt punkt på alle skjermer.
    Begge er tilgjengelighet, ikke smak, og hører til token-skiva.
59. **Dynamic Type.** Faste høyder på knapp, tab-bar, listerad, pluss-knapp og
    logo bør ha `minHeight` og `maxFontSizeMultiplier`, ikke `allowFontScaling`.
60. **Måned-inndeling av kamplista** på sesongsiden. Anbefalt, ikke bygget.
61. **Hendelsessiden mangler innhold for kamp:** nedtelling til avspark,
    «Sist mot X», heiarop. Materialet er på plass, innholdet ikke.
62. **`SkeletonCard` er fortsatt en hvit plate** på dagslysgrunnen.
63. **`MatchPhotoSheet`** har appens siste rå `ActivityIndicator` og bruker
    tegn-glyfer blant Lucide-ikonene.
64. **Komponeringslinjas Android-fallback** er ikke telefontestet, og
    «Varsle hele laget»-raden er fortsatt solid flate.
65. **Brage — Stadium Light.** En mulig lysere palett for kampverdenen, skal
    tas som én samlet runde etter alle skivene.
66. **Brage — navn i oppmøtestripa.** Man ser ikke lenger hvem som ikke kan
    eller ikke har svart. Skal det tilbake bak et trykk?
67. **Brage — beslutning: ingen mørk modus i v1**, og den skrives inn.

## I. Ryddeskiver

Brage har bedt om at disse holdes ute av designskivene og tas samlet.

68. **Kampsiden.** `MatchAttendance` har null referanser igjen. `MatchPulse`,
    `ArenaSurface` og `MatchTimeline` er delvis ubrukt etter runde 2. Krever
    gjennomgang, ikke blind sletting, siden den lyse grenen bruker noe.
69. **Sølv, perle og arena.** `SILVER*`, `SilverOptics`, `PEARL_*` i
    `LiquidGlassSurface`, `HeiaPearlView` i native, og rundt 790 kB bilder som
    fortsatt bundles.
70. **Femten A/B-brytere** står igjen i koden. Hver av dem har en død
    `false`-gren som først kan fjernes når materialet er endelig avgjort. Den
    valgte polariteten i dagslysgrunnen skal samtidig promoteres til tokens.
71. **Gjeld etter skive 10.** `CalendarFocusContext` har skriver uten leser.
    `CreateSheet` og `ScoreBoard` har fortsatt noen referanser og må sjekkes
    før de fjernes.
72. **Inline hex utenfor tokens** i `EventCard`, `Avatar` og flere.

## J. Nettsiden

73. **Invitasjonsreisen er HALVVEIS på.** `WEB_INVITE_BASE_URL` ble satt
    2026-09-11 kveld, så ops-utstedte invitasjoner sender nå ekte e-post med
    lenke til `heiaapp.no/invitasjon#token`. Det som gjenstår er appsiden:
    `WEB_INVITE_LANDING_LIVE = true` i `src/shared/flags.ts` (står `false`)
    og et nytt TestFlight-bygg, siden flagget ikke endrer installerte bygg.
    Til da er «En annen i klubben» og «Inviter ny betalingsansvarlig» skjult
    i appen, mens web-veien virker.
74. **Brage — analytics er ikke installert og ikke besluttet.** Plausible er
    anbefalt fordi den er cookiefri og dermed slipper samtykkebanner etter
    ekomloven. Må nevnes i personvernerklæringen hvis den tas i bruk.
75. **Ingen e-postfangst.** Hovedknappen er en `mailto` i dag. Planen foreslo
    en `waitlist`-tabell med insert-only for å slippe en ny databehandler.
    Verken tabell eller skjema finnes.
76. **Brage — Safari-flaten nederst** ved scroll oppover er fortsatt ikke
    bekreftet på din telefon etter siste fiks. Ni runder er brukt. Ikke rør
    det uten et nytt telefonbilde som bevis.
77. **Dialogene på `/klubb` og `/ops` er aldri klikket mot prod.** Handlingene
    er testet gjennom nøyaktig de kallene knappene gjør, men ikke gjennom
    knappene. Stripe Account Link er aldri opprettet i test.
78. **Brage — full dogfood på web:** invitasjon, aksept med e-postmatch,
    avvik til `awaiting_review`, ops-bekreftelse, og KYC startet fra web.
    Deretter ryddes Stange- og dogfood-restene.
79. **`stripe-onboarding-return` er fortsatt ren tekst.** HTML-versjonen
    ventet på at Heia fikk eget domene. Domenet finnes nå.

## K. Android

Eget spor, ikke startet.

80. **`applicationId` er fortsatt plassholderen `com.heia2`** i
    `android/app/build.gradle`. Låses permanent ved første Play-opplasting,
    på samme måte som bundle-ID på iOS.
81. **`assetlinks.json` mangler** i `web/public/.well-known/`. Krever
    fingeravtrykket fra Play App Signing.
82. **Brage — Play-konto på AS-et.** En personlig konto krever tolv testere i
    fjorten dager. FCM må settes opp for push.

## L. Dokumentasjon

83. **`docs/BRAND_UI.md` er foreldet og villeder aktivt.** Den beskriver en
    lys grå bakgrunn, gamle hendelsesfarger og ingen glass eller opal, og
    leses av hver nye samtale. Skrives om etter at materialet er endelig.
84. **`docs/HEIAAPP-NO.md` og `docs/NETTSIDE-PLAN-2026-09.md` har foreldede
    punkter:** AASA-plassholderen og «`/lag` gir 404» er begge løst.

## M. Maskin

85. **Brage — gammel mappe `~/Documents/Heia Prod`** på 624 MB skulle slettes
    da dev-bygg fra ny sti var grønt. Det har det vært mange ganger siden.
86. **Brage — `~/Documents/Heia-Stripe-Spike/`** ligger fortsatt i iCloud med
    en `.env` som inneholder sandbox-nøkkelen.

---

## N. Gjennomgangen 2026-09-11 kveld

Tre parallelle gjennomganger før produksjonssetting: nettsideplanen mot
prod, caching/egress/ytelse, og dataflyt/sikkerhet. Alt her er verifisert
mot koden og mot prod-databasen, ikke lest ut av plandokumentene.

### Rettet samme kveld (committet og pushet som `b36030b`)

87. **Dobbel betaling var mulig.** `stripe-checkout` laget Checkout-sesjonen
    uten idempotensnøkkel, i motsetning til de tre andre Stripe-kallene i
    samme funksjon. To parallelle kall ga to betalbare sesjoner og kunne
    ende i to abonnementer, der det andre aldri kunne knyttes til raden.
88. **Bildene lå kun på disk.** `cachePolicy="disk"` betyr i expo-image
    KUN disk, så hver resirkulerte listecelle dekodet et 2048 px bilde på
    nytt. Dette er den mest sannsynlige forklaringen på at appen føltes treg.
89. **Disk-snapshotet ble skrevet rundt én gang i sekundet** under bruk,
    utløst av cache-hendelser som ikke bar ny data.
90. **Lenkefila fanget `/stott*` og `/betaling*`** som appen ikke kan
    håndtere. En delt lenke til Støtt laget åpnet appen på Hjem.
91. **Utlogging fra en markedsside tilbakekalte ikke sesjonen.**
92. **Nettsiden hadde ingen sikkerhetsheadere.** Klikkjacking mot
    «Deaktiver støtte» var mulig.
93. **Klubber uten lag kunne ikke sette opp utbetaling**, selv om backend
    støtter det.
94. **`push-fanout` kuttet stille på 500 mottakere.** Taket står, men er
    nå synlig i loggen.
95. **Småting:** `?flow=toString` traff Object.prototype på
    betalingssiden; `robots.txt` og sitemap manglet.

### Må pushes til prod av Brage

96. **Migrasjon 00083** — varselet SupportSetup lover når klubben blir
    klar, finnes ikke i dag. Trigger på overgangen til aktiv konto.
    Bevisfil: `scripts/verify-00083.sql`.
97. **Migrasjon 00084** — **25 SECURITY DEFINER-RPC-er kan kalles av
    `anon`**, målt i prod. Handoffen sa tre. Alle har en fungerende
    selvvakt i dag, så det er ikke et åpent hull, men selvvakten er den
    eneste vakten: én omskriving som flytter `auth.uid()`-sjekken, og
    hvem som helst kan kalle funksjonen med anon-nøkkelen fra nettsidens
    bundle. Migrasjonen er katalogdrevet, så ingen signatur kan bli feil.
    Den pinner også `search_path` på de to betalingsfunksjonene og på
    `is_team_member`/`is_team_admin`. Bevisfil: `scripts/verify-00084.sql`,
    allerede kjørt mot prod som utgangspunkt.

### Nye punkter, ikke rettet

98. **85 funksjoner mangler `search_path` helt.** 00084 tar de fire
    viktigste. Resten er en egen skive.
99. **Kaldstart venter 1,5 sekunder på nett.** Bootfrøet leverer profil og
    medlemskap fra disk, men navigatoren står på oppstartsskjermen til
    livekamp-svaret lander eller tidsgrensen slår inn. Hele gevinsten fra
    cold start-arbeidet spises opp her.
100. **Feeden koster en ekstra seriell rundtur** fordi «har jeg reagert»
     ligger utenfor feed-spørringen. Det er 150 til 300 millisekunder lagt
     til hver eneste feed-åpning på mobilnett.
101. **Kalenderen er ikke virtualisert**, og henter 30 måneder. Et lag med
     to treninger i uka monterer rundt 150 kort ved hvert besøk.
102. **Toppen av skjermen er ikke memoisert.** Hvert tastetrykk i «Del noe
     med laget» tegner hero-karusellen på nytt. To kontekster øverst i
     treet lager ny verdi ved hver token-fornyelse.
103. **Feeden signerer miniatyrbilder den aldri bruker**, og
     idrettslista hentes ved hver kaldstart for en skjerm de fleste aldri
     åpner. Begge er gratis å fjerne.
104. **Testen som vokter oppstartsbudsjettet er blind.** Den påstår seks
     kall; det reelle tallet er sju til ni, fordi den mocker bort nettopp
     de kallene den skulle telle.
105. **Hvert innlegg er O(antall medlemmer) i tre ledd**, og ett av dem
     kjører synkront i transaksjonen til den som poster. Ved 25 medlemmer
     er det usynlig. Ved 300 henger «Del»-knappen.
106. **`get_team_members` og `get_team_authors` er upaginerte**, i
     motsetning til feeden som er riktig paginert.
107. **«Deaktiver støtte» kan ikke fullføre for store lag.** Offeringen
     arkiveres først, så kanselleres abonnementene serielt uten
     fremdriftsmerking. Et lag som ikke rekker gjennom på ett forsøk,
     rekker aldri gjennom.
108. ~~**Nettsiden har ingen miljøseparasjon.**~~ **LUKKET i kode
     2026-09-11, VENTER PÅ VERCEL-VARIABLER.** `web/src/lib/env.ts` har
     ingen reserveverdi lenger: `PUBLIC_HEIA_ENV` (`production`/`test`/
     `local`), `PUBLIC_SUPABASE_URL` og `PUBLIC_SUPABASE_ANON_KEY` må
     settes, ellers stopper byggingen med en forklarende feil. Et
     miljømerke nede til høyre viser datamiljø og prosjektreferanse på
     alle verter unntatt heiaapp.no. Bevis: `scripts/verify-web-env.mjs`.
     **Gjenstår før merge:** Brage setter de tre variablene i Vercel for
     både Production og Preview — se utrullingsplanen i STATUS-HANDOFF.
109. ~~**CI bygger ikke nettsiden.**~~ **LUKKET 2026-09-11 for nettsidens
     del.** `.github/workflows/ci.yml` har en `web`-jobb: `astro check`
     (typer og `.astro`-diagnostikk, 0 feil), en negativ test som krever
     at bygging uten miljø STOPPER, bygging med eksplisitt testmiljø, og
     `scripts/verify-web-env.mjs`. **Gjenstår:** de databasenære
     bevisfilene (`scripts/verify-*.sql`, `verify-web-flows.mjs` m.fl.)
     kjøres fortsatt for hånd — de trenger et testmiljø, se punkt 113.
110. **Invitasjonskoden bruker 30 av 31 tegn** i alfabetet, og bygger på
     en vanlig tilfeldighetsgenerator, ikke en kryptografisk.
111. **`inbox_enabled` svarer på spørsmål om andre brukere** uten å sjekke
     hvem som spør. **Lukkes IKKE av 00084** — å stenge `anon` smalner bare
     til «hvilken som helst innlogget bruker». Funksjonen har ingen
     `auth.uid()`-sjekk i det hele tatt. Se korreksjonen øverst.

### Nytt fra skive 1 (2026-09-11 kveld)

113. **Det finnes ikke noe testmiljø å bevise i.** Forutsetningen for å
     kjøre 00084 og de andre databasekontrollene trygt. To veier:
     **(a)** `supabase start` lokalt — CLI-en ligger på maskina (v2.75.0),
     men **ingen container-motor er installert** (verken Docker Desktop,
     OrbStack, Colima eller Podman), så den er blokkert på en
     installasjon. **(b)** Et eget Supabase-prosjekt som testmiljø —
     koster penger og krever Brages konto. Nettsiden er nå klar for
     begge: `PUBLIC_HEIA_ENV=local` godtar `http://127.0.0.1:54321`,
     `test` krever https.
114. **Astro 5.18.2 har en åpen sårbarhetskjede** — ti rådgivninger, én
     kritisk (XSS i `define:vars`, som Base.astro bruker), pluss `sharp`
     og `esbuild`. `npm audit fix` krever Astro 7, altså en versjonssprang
     med brytende endringer. Ikke utnyttbart her i dag: verdiene som går
     gjennom `define:vars` er byggetidskonstanter, ikke brukerinndata.
     Egen liten skive, ikke en sperre.
115. **Appen har ingen miljømerking.** `src/lib/supabase.ts` leser
     `Config.SUPABASE_URL!` fra `.env` uten validering eller miljønavn.
     Et TestFlight-bygg pekt på et testprosjekt ville sett helt likt ut
     som produksjon. Bør få samme eksplisitte miljøvalg som nettsiden når
     punkt 113 er løst — ellers er «test på telefonen» ikke etterprøvbart.

### Avkreftet

112. **Bøttegrensene er allerede på plass.** Gjennomgangen meldte at
     `feed-media` manglet størrelses- og filtypegrense, basert på
     migrasjonsfila. Prod har 10 MB og fire bildetyper. Migrasjonsfila er
     bare ikke oppdatert. Lærdom: sjekk alltid mot prod, ikke mot filene.

## Skivene i detalj

Definert av Brage 2026-09-11. Hver skive er avgrenset og leveres for seg.

### Skive 1 — Kontroll på miljøene og databaseautorisasjonen

**Start her.** Begynn med statusavklaringen øverst i denne fila, så:

1. ~~**Punkt 108–109 først.**~~ **GJORT 2026-09-11** (kode og CI; venter
   på Vercel-variabler før merge). Reserveverdien er borte, miljøvalget er
   eksplisitt, nettsiden typesjekkes og bygges i CI, og bevisfila
   `scripts/verify-web-env.mjs` kjøres automatisk. **Selve testmiljøet er
   IKKE på plass** — det ble skilt ut som punkt 113 fordi det er blokkert
   på en installasjon eller et kjøp, ikke på kode. Steg 2 kan forberedes,
   men ikke bevises, før 113 er løst.
2. **Deretter 00084** (punkt 97, 111 og de sentrale `search_path`-endringene).
   Dokumentér per funksjon: hva som endres, hvilke kallere som trenger
   tilgang, og hvilke unntak som er tilsiktet. Ta stilling til hvordan nye
   funksjoner skal unngå samme utilsiktede tilgang senere — en test eller
   en lint som feiler når en ny SECURITY DEFINER-funksjon er anon-åpen.
3. **Bevis begge veier.** Ikke bare at uvedkommende avvises, men at
   legitime handlinger fungerer: trener- og reporterroller, opprette
   hendelse, starte kamp, rapportere og korrigere mål, medlemsadministrasjon,
   og tilgang på tvers av lag.
4. **Migrasjonen rører funksjoner som brukes i RLS og sanntid.** Test
   berørte lese- og sanntidsflyter, og kompatibilitet med bygg 1.0 (4).
5. **Punkt 111 særskilt** — se korreksjonen øverst. Å stenge `anon` er ikke
   nok.
6. **Punkt 98 planlegges i grupper**, ikke som én stor migrasjon.
   Punkt 31 røres ikke (se avhengigheten der).

### Skive 2 — Betaling og varsler tåler avbrudd

- **Punkt 87:** verifiser idempotensfiksen med parallelle forespørsler,
  avbrutte svar og lovlige nye forsøk etter utløp. Kontroller samsvar
  mellom abonnementer hos Stripe og radene våre. **Merk at fiksen ikke er
  deployet** — `stripe-checkout` står på v10 fra 19. august.
- **Punkt 96 (00083):** riktig mottakergruppe, gjentatte webhook-kall skal
  ikke gi dublett, og feil i varslingen skal ikke velte betalingsstatusen.
  Triggeren har en exception-fanger for nettopp dette; bevis at den virker.
- **Punkt 107 er flyttet opp.** Deaktivering må tåle avbrudd og kunne
  fortsette med uferdige kanselleringer. Det skal være tydelig når
  deaktivering pågår, og «fullført» skal bety at kanselleringene er
  bekreftet. Før ekte betalinger åpnes, uavhengig av lagstørrelse.
- **Punkt 22 er avklart** og krever ikke arbeid. Se korreksjonen øverst.

### Skive 3 — Oppstart, nettverk og caching

- **Punkt 99** etter den avklarte retningen øverst. Lokal cache knyttes til
  riktig bruker og lag; serveren kontrollerer fortsatt handlingstillatelser.
- **Punkt 40 samtidig.** Nettverksfeil skal gi en forståelig vei videre. Ved
  skrivehandlinger må vi tåle at serveren fullførte selv om klienten ikke
  fikk svar, slik at nye forsøk ikke gir doble mål, innlegg eller betalinger.
- **Punkt 104 først av målepunktene** — vakten må virke før den brukes.
- **Mål 88 og 89 i et ekte bygg.** De kan ikke måles før 1.0 (5).
- **Deretter 100 og 103** (unødvendige kall), så **102 og 101** etter hva
  målingene faktisk viser. Bevar godkjent utseende og oppførsel.

### Skive 4 — Hele reisen på telefon og nett

- Klargjør 1.0 (5) med riktige flagg og de ferdige endringene (punkt 5–7, 73).
- Kort gjennomkjøring: invitasjon, innlogging, roller, klubboppsett, støtte,
  kamp, utlogging — app og nett.
- **Punkt 49:** avklar hva fjerning fra et lag skal bety når personen
  fortsatt kjenner koden.
- **Punkt 43–45:** pek ut hvilke blindveier som må løses før pilotlagene
  bruker Heia selvstendig.
- **Punkt 94, 105, 106:** prioriter etter realistiske lastmålinger. Hundre
  medlemmer er ikke en bevist grense. Logget bortfall av varsler er
  fortsatt bortfall.

---

## Anbefalt rekkefølge

Erstattet av skiveplanen over. Rekkefølgen er: **skive 1 → 2 → 3 → 4**, med
AS-sporet (punkt 1–3) startet parallelt fra dag én fordi det har lengst
ledetid og blokkerer alt kommersielt.

Ryddeskivene i seksjon I og designrestansene i seksjon H blokkerer
ingenting. De tas når Brage vil, og «Øyeblikkene» (punkt 57) er den som
betyr mest for opplevelsen.
