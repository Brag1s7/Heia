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

## Der vi står

| | |
|---|---|
| Nettsiden | Live i prod, PR #55 merget 2026-09-11 17:47 |
| Appen | TestFlight **1.0 (4)** fra 2026-08-18, hos interne + venner og familie |
| Backend | Migrasjoner t.o.m. `00082` og alle 13 Edge Functions deployet |
| Prod-bruk | 21 lag · 18 brukere · 821 innlegg · 114 hendelser · 5 aktive støtteavtaler |
| CI | Kjører `tsc`, `jest` og lint på 92 testfiler |

**Kritisk sti:** Heia AS → D-U-N-S → Apple-konvertering og Stripe live-KYC →
live-nøkler → App Store-innsending. Alt annet kan gjøres parallelt i testmodus.

**De eneste harde blokkerne mot App Store** er punkt 4 (juridiske
plassholdere) og punkt 27 (personvernetiketter). Resten er kvalitet, ikke
sperrer.

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
22. **Splitten er ikke låst.** Ridabu-offeringen har `bps 2500` som
    plassholder. Fase 6 låser den, og en endring krever ny versjon.
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
31. **S4 — tømme `postgres_changes`-publikasjonen.** Hele flåten kjører
    Broadcast, men den gamle publikasjonen står igjen som dual-run.
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

73. **Invitasjonsreisen er ikke slått på.** Rekkefølgen: Brage prøver
    `/invitasjon` selv → `supabase secrets set WEB_INVITE_BASE_URL=https://heiaapp.no/invitasjon`
    → `WEB_INVITE_LANDING_LIVE = true` i `src/shared/flags.ts` (står `false`)
    → nytt TestFlight-bygg, siden flagget ikke endrer installerte bygg. Så
    lenge det står av, er «En annen i klubben» og «Inviter ny
    betalingsansvarlig» skjult, og ops-flaten viser «IKKE SENDT».
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

## Anbefalt rekkefølge

1. **TestFlight 1.0 (5)** (punkt 5 til 7). Gir hele designsporet på telefonen,
   låser opp invitasjonsreisen, og gjør telefontestene i seksjon C mulige.
2. **Start AS-sporet** (punkt 1 til 3) parallelt. Lengst ledetid, blokkerer alt
   kommersielt.
3. **Telefontestene i seksjon C** mens bygget er ferskt.
4. **Hullene i seksjon G** som er ekte feil, særlig punkt 42 og 43.
5. **Pre-launch-pakka** (punkt 30 til 34) mens AS-et modnes.
6. **App Store-materialet** (punkt 26) og **selskapsopplysningene** (punkt 4)
   rett før innsending.

Ryddeskivene i seksjon I og designrestansene i seksjon H blokkerer ingenting.
De tas når du vil, og «Øyeblikkene» er den som betyr mest for opplevelsen.
