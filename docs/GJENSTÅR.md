# Hva som gjenstår i Heia

_Samlet 2026-09-11 fra `docs/STATUS-HANDOFF.md` (13 830 linjer), de ni andre
plandokumentene, koden og minnene. Tallene og de tekniske påstandene er
sjekket mot repoet, prod-databasen og Supabase samme dag._

**Slik brukes fila:** dette er arbeidslista. `STATUS-HANDOFF.md` er
historikken. Når et punkt lukkes, stryk det her og skriv hvorfor i handoffen.

**Fire tilstander, og de er ikke det samme.** Et punkt kan være
**lokalt ferdig** (koden finnes i treet), **CI-verifisert** (en grønn
kjøring har sett den), **i drift** (deployet — databasen, Edge Functions
og nettsiden deployes hver for seg) og **telefonverifisert** (sett på en
ekte telefon). Skriv alltid hvilken. Et punkt er ikke i drift fordi koden
er pushet.
**Brage** foran et punkt betyr at det krever noe utenfor koden: Apple,
Stripe, Brønnøysund, Google, en telefon eller en beslutning. Resten er
kodearbeid.

---

## Der vi står — hva som FAKTISK kjører

_Oppdatert 2026-09-11 natt. Et punkt er ikke i drift fordi koden er pushet.
Hvert lag deployes for seg._

_Kontrollert mot prod 2026-09-12 kveld (`supabase_migrations.schema_migrations`
og `supabase functions list`) — ikke skrevet av hukommelsen._

| Lag | I drift nå | Nyere lokalt |
|---|---|---|
| **Databasen** | migrasjoner t.o.m. **`00085`** (00079–00085 sammenhengende) | **`00086`** er skrevet og tørrkjørt, **ikke kjørt** — venter grønn CI + klarsignal |
| **Edge Functions** | `stripe-checkout` **v11** og `club-support-deactivate` **v6** (begge deployet i skive 2) · `push-fanout` **v13 (3. aug)** · øvrige i synk | **én udeployet**: `push-fanout` — punkt 117 |
| **Nettsiden** heiaapp.no | `main` = `c8791e5` (PR #57 merget) | `Brage` er 4 commits foran (skive 3) — PR #58 |
| **CI** | grønn på `main` etter #57 | PR #58 kjører. Lokalt: `jest` **1279**, `eslint` 0. CI fyrer bare på PR — se punkt 121 |
| **Secrets** | `WEB_BASE_URL` og `WEB_INVITE_BASE_URL` satt | — |
| **runtime_config** | `broadcast` på feed, match og notif · `poll = 0` · `min_build = 0` | — |
| **TestFlight** | **1.0 (4), lastet opp 18. august** | Se under. Dette er det største avviket. |

_(Tabellen over er oppdatert 2026-09-11 natt. Den opprinnelige, fra kl. 20,
står under for sporbarhet.)_

| Lag | I drift kl. 20 | Nyere lokalt |
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
| **1** | Miljøer og databaseautorisasjon | ingenting — start her | ~~108~~, ~~109~~, ~~97~~, ~~111~~, ~~30~~ · igjen: 98, 113 |
| **2** | Betaling og varsler tåler avbrudd | skive 1 (testmiljø å bevise i) | ~~87~~, ~~96~~, ~~107~~, ~~22~~ — **FERDIG 2026-09-12** |
| **3** | Oppstart, nettverk og caching | skive 1 (CI som fanger regresjon) | ~~104~~, ~~99~~, ~~103~~, ~~40 (klient)~~ · igjen: 100 (migrasjon, venter godkjenning), 88, 89, 102, 101 |
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

✅ **AVKLART EMPIRISK 2026-09-11, svaret var JA.** En funksjon som brukes i
et RLS-uttrykk trenger EXECUTE for rollen som kjører spørringen. Målt i en
transaksjon som ble rullet tilbake: etter `revoke ... from authenticated` på
`is_team_member` feilet `select count(*) from feed_posts` for en innlogget
bruker med 42501, der den før ga 296 rader. `is_team_member`, `is_team_admin`
og `is_club_team_admin` kan derfor IKKE behandles som interne hjelpere — de
er gruppe B i 00084 og beholder `authenticated`. Korreksjonen over hadde rett
i at uniform tildeling var feil, men galt i hvilke funksjoner det gjaldt:
`inbox_enabled` og `notify_event_change` er interne, vaktene er det ikke.

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

30. ~~**Dørene på tre skrive-RPC-er.**~~ **LUKKET 2026-09-11 av 00084.**
    `start_match`, `report_match_event` og `soft_delete_post` svarte `P0001`
    (intern sjekk) i stedet for `42501` (rollen). Alle tre svarer nå `42501`
    for `anon`, målt i prod etter migrasjonen. De legitime veiene ble testet
    i samme runde: trener oppretter hendelse, starter kamp, rapporterer mål
    og svarer på oppmøte — alt grønt.
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
40. ~~**Supabase-klienten har ingen fetch-timeout.**~~ **KLIENTDELEN LUKKET
    2026-09-12 (38b87b2).** `trackedFetch` avbryter nå på 20 s (Edge
    Functions 60 s) og viderefører kallerens eget `signal` urørt.
    Nettverksfeil oversettes ett sted (`shared/errorMessage`), og en
    SKRIVING som ikke fikk svar påstår aldri at den feilet —
    `uncertainWriteMessage` sier «Vi vet ikke om målet ble lagret». Bevis:
    7 nye tester i `netMetrics.test.ts`.
    **IGJEN (krever migrasjon, ikke startet):** ekte idempotens på skriving
    — `client_request_id` på `match_events` og `feed_posts`, så et nytt
    forsøk etter et tidsavbrudd ikke kan gi to mål eller to innlegg.
    Betalinger er allerede dekket av punkt 87.
41. **Brage — Sentry-lesetilgang for meg.** Bevisst utsatt til første ekte
    feil, krever et User Auth Token.

## G. Hull i produktet

Funksjoner som er lovet i grensesnittet, eller som mangler en vei ut.

42. ~~**Varselet som aldri kommer.**~~ **LØST AV PUNKT 96 (migrasjon 00083),
    kjørt i prod 2026-09-11.** Punktet ble skrevet før 00083 og er siden
    blitt stående i motstrid med 96 — de beskriver det samme varselet.
    Løsningen ble en TRIGGER på `club_payment_accounts`, ikke en endring i
    `stripe-webhook`, og derfor stemmer den opprinnelige kodeobservasjonen
    fortsatt: webhooken oppretter ingen notifikasjon. Triggeren gjør det.
    Kontrollert i prod 2026-09-12: `trg_notify_club_payment_active` →
    `notify_on_club_payment_active` står på `club_payment_accounts`.
    Bevisføringen (riktige mottakere, ingen dubletter, ingen varsler
    bakover i tid) står i punkt 96.
    **Gjenstår, og det er noe annet:** selve trykket på varselet er ikke
    telefontestet — se punkt 14.
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

87. ~~**Dobbel betaling var mulig.**~~ **DEPLOYET 2026-09-12** —
    `supabase functions deploy stripe-checkout` kjørt (v10 → ny versjon;
    diffen mot v10 var nøyaktig de to gjennomgåtte filene pluss
    lint-annotasjonene `stripe:ingen-nokkel`, kontrollert linje for linje
    før deploy). Historikk: Checkout-sesjonen ble laget uten
    idempotensnøkkel, i motsetning til de tre andre Stripe-kallene i
    samme funksjon; to parallelle kall ga to betalbare sesjoner og kunne
    ende i to abonnementer. Gjenstår kun røyktesten mot Stripe testmodus
    (hører til punkt 21). Gjennomgangen 2026-09-11 natt fant ingen feil
    i fiksen:
    * *Parallelle førstegangskall:* begge leser samme rad uten sesjons-id →
      samme nøkkel `heia-cosess-<rad>-first` → Stripe kollapser til ÉN sesjon.
    * *Lovlig nytt forsøk etter utløp:* raden bærer nå `sess_A` → nøkkelen
      blir `…-sess_A` → ny, betalbar sesjon. Riktig.
    * *Parametrene er identiske mellom parallelle kall*, som Stripe krever
      for at nøkkelen skal kollapse i stedet for å feile: `landingUrl()` er
      deterministisk (ingen tidsstempel eller nonce), og produkt, pris og
      kunde lages alle med sine egne nøkler (`heia-offprod-`,
      `heia-offprice-`, `heia-cust-`), så id-ene er de samme i begge kall.
    * *Databasen holder:* `idx_support_subscriptions_one_live` (unik på
      bruker + lag mens avtalen lever) står i prod.
    * *Ingen skade har skjedd:* 14 avtalerader, **0** par med flere levende
      avtaler, **0** aktive rader uten Stripe-abonnements-id, **0**
      foreldreløse `checkout_pending`.

    **Deployen omfatter nøyaktig to filer** (+21/−3 mot v10):
    idempotensnøkkelen, og `_shared/web.ts` som fikk et valgfritt
    `source`-argument — `stripe-checkout` sender det ikke, så URL-ene er
    byte-identiske. `WEB_BASE_URL` er allerede satt, og secrets når
    kjørende funksjoner uten redeploy, så landingssidene endrer seg ikke.

    **Kommando:** `supabase functions deploy stripe-checkout`
    **Tilbakeføring:** `git checkout e2007241 -- supabase/functions/stripe-checkout`
    og deploy på nytt. Ingen databaseendring, ingen migrasjon.

    **Ikke testet:** et ekte parallelt kall mot Stripe testmodus. Det
    krever `STRIPE_SECRET_KEY`, som bare finnes som digest lokalt.
    Anbefales som første steg i punkt 21 (én ekte betaling som røyktest).

    **Vakt mot tilbakefall:** `scripts/lint-stripe-idempotens.mjs` i CI —
    hvert `stripePost` må ha nøkkel eller en skreven grunn
    (`// stripe:ingen-nokkel — …`). De fem lovlige unntakene er nå
    dokumentert i koden: to `/expire`-kall og én abonnementskansellering
    er idempotente av natur, mens account-link og portalsesjon SKAL gi en
    fersk lenke hver gang. Negativt testet: fjernes nøkkelen, feiler den.
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

96. ~~**Migrasjon 00083**~~ **KJØRT I PROD 2026-09-11 natt.** Den var
    IKKE med da 00084 ble kjørt — det ble kontrollert tre veier (funksjon,
    trigger og migrasjonsregister alle tomme), og 00083 ble så kjørt for
    seg. Databasen står nå på en sammenhengende rekke 00079–00084.
    Trigger og funksjon er på plass, `search_path` er pinnet, `anon` er
    revoked. Kontrakten er bevist i en transaksjon som ble rullet tilbake:
    overgangen `onboarding_started → active` ga 2 varsler til nøyaktig de
    2 unike aktive trenerne, null dubletter per person, null foreldre
    eller supportere i mottakergruppa, riktig `screen: support_setup`,
    **0 nye varsler** ved to gjentatte `active`-oppdateringer (gjentatt
    webhook), og — med varselinnsettingen sabotert med vilje —
    **betalingsstatusen overlevde** (`status=active`, unntaksfangeren
    virker). Ingen varsler er sendt bakover i tid: triggeren fyrer bare på
    framtidige overganger, og de tre kontoene som alt er `active` rører
    den ikke.
97. ~~**Migrasjon 00084**~~ **KJØRT I PROD 2026-09-11.** 25 SECURITY
    DEFINER-RPC-er kunne kalles av `anon`; nå kan bare `lookup_invite_code`
    det (gruppe D, bevisst — onboarding slår opp koden før innlogging).
    Migrasjonen er katalogdrevet, så ingen signatur kan bli feil, og den
    deler i **tre grupper** i stedet for én:
    **A** 19 bruker-RPC-er → `authenticated`, revoke PUBLIC + anon.
    **B** 3 vakter i RLS-uttrykk (`is_team_member`, `is_team_admin`,
    `is_club_team_admin`) → BEHOLDER `authenticated`.
    **C** 3 interne hjelpere (`inbox_enabled`, `notify_event_change`,
    `get_payment_account_for_team_space`) → revoke også fra `authenticated`.
    `search_path` er pinnet på de fire viktigste. Bevis:
    `scripts/verify-00084.sql` 12/12 grønt, pluss 18 ekstra kontroller i
    transaksjoner som ble rullet tilbake. Tilbakeføring:
    `scripts/rollback-00084.sql`, generert fra den målte tilstanden FØR.

    ⚠️ **Den empiriske avklaringen er gjort, og svaret var JA.** En funksjon
    brukt i et RLS-uttrykk trenger EXECUTE for rollen som kjører spørringen.
    Målt: etter `revoke ... from authenticated` på `is_team_member` feilet en
    vanlig `select count(*) from feed_posts` for en innlogget bruker med
    42501, der den før ga 296 rader. Derfor gruppe B. Hadde 00084 blitt kjørt
    slik den først var skrevet — eller med den «rett» korreksjonen om å
    revoke interne hjelpere fra alle roller — ville feed, kamp, kalender og
    realtime-join falt samtidig.

### Nye punkter, ikke rettet

98. **83 funksjoner mangler `search_path` helt** (var 85; 00084 tok de fire
    viktigste). Måletallet står i `scripts/verify-00084.sql` rad B1.

    **RISIKOSORTERT 2026-09-11 natt — ingen av dem er konkret utsatt i dag,
    så resten kan vente.** Angrepet er ikke «mangler sti» i seg selv.
    `pg_temp` søkes implisitt FØRST for **relasjoner** (tabeller, views,
    typer) når den ikke står eksplisitt i stien — men aldri for funksjoner.
    En angriper må altså kunne (a) lage et objekt som skygger for et navn,
    og (b) få en SECURITY DEFINER-funksjon til å slå opp det navnet
    **ukvalifisert**. Målt i prod:
    * **0 av 83** refererer til en public-tabell uten `public.`-prefiks.
      Kodebasen kvalifiserer konsekvent. Detektoren ble kontrollert mot
      konstruerte strenger begge veier før tallet ble trodd.
    * **0 av 12** `%rowtype`-referanser er ukvalifiserte.
    * `authenticated` og `anon` kan **ikke** lage skjemaer
      (`has_database_privilege … CREATE` = false) og **ikke** lage objekter
      i `public`. Eneste navnerom de rår over er `pg_temp`, som bare
      skygger relasjoner og typer — og alle er kvalifiserte.
    * De 12 trigger-funksjonene i lista er fortsatt kallbare av PUBLIC,
      men PostgREST eksponerer ikke funksjoner som returnerer `trigger`,
      og et direkte kall utenfor triggerkontekst feiler uansett.

    Konklusjonen er at dette er dybdeforsvar, ikke et åpent hull.
    **Gjennomgangen står fortsatt på lista** og bør tas i grupper når
    det passer — for da er neste funksjon som glemmer `public.`-prefikset
    ikke lenger et problem.
99. ~~**Kaldstart venter 1,5 sekunder på nett.**~~ **LUKKET 2026-09-12
    (38b87b2).** Porten (`bootReady`) er fjernet fra `AppNavigator`, og med
    den `BOOT_MAX_MS`. Påstanden den skulle hindre er fortsatt borte der
    den hører hjemme: `matchButton.ts` har `unknown` (ingen ord, ingen
    glød, samme mørke flate som hvile) og `shouldNudge` sier nei til sprett
    på det første svaret. Et sent svar bytter etikett — `handleMatchPress`
    er det eneste som flytter brukeren, og det krever et trykk. Dyplenker
    og reporterflyten går gjennom `flushPendingDeepLink` som før, nå
    tidligere. Bevis: `bootHttpBudget.test.tsx` §punkt 99 (verifisert at
    den feiler hvis porten settes tilbake).
100. **Feeden koster en ekstra seriell rundtur** fordi «har jeg reagert»
     ligger utenfor feed-spørringen. Det er 150 til 300 millisekunder lagt
     til hver eneste feed-åpning på mobilnett. **Målt og bekreftet
     2026-09-12:** `GET /rest/v1/reactions` står i alle tre scenariene i
     `bootHttpBudget.test.tsx`, og den går ETTER at feeden er hentet — den
     kan ikke parallelliseres, for den trenger post-id-ene.

     **GODKJENT OG BYGGET — MIGRASJONEN VENTER PÅ KLARSIGNAL.** Kolonnen
     heter `my_reactions`, ikke `i_reacted`, og det er et bevisst valg:
     mønsteret finnes
     allerede i huset: `get_match_feed` (00071) returnerer `my_reactions` i
     samme rad, og kommentaren i `api/feed.ts` peker eksplisitt på at det er
     «derfor "har jeg heiet" ikke koster en ekstra spørring slik feeden
     gjør». Feeden skal gjøre det samme.

     - **Endringen:** `get_team_feed` får en kolonne `i_reacted boolean`.
       Returtypen endres, så funksjonen må DROPPES og gjenskapes — og da må
       GRANT/REVOKE gjentas for den nye signaturen (se
       `docs/`-notatet om RPC-dører: GRANT stenger ingenting, `pg_temp`
       sist, verify FØR push).
     - **Klienten tåler begge:** `getTeamFeed` bruker `i_reacted` når
       kolonnen finnes, og faller ellers tilbake til dagens ekstra
       spørring. Bygg 1.0 (4), som står på telefonene i dag, leser JSON og
       bryr seg ikke om en ekstra nøkkel — den fortsetter som før.
     - **Rekkefølge:** migrasjonen først (bakoverkompatibel alene),
       klientendringen i 1.0 (5).
     - **Tilbakeføring:** `git checkout <sha> -- supabase/migrations` +
       gjenskap forrige definisjon; klienten faller da tilbake av seg selv.
     - **Gevinst:** −1 seriell rundtur på HVER feed-åpning, ikke bare ved
       oppstart. Kaldstart 6 → 5 kall, gjentatt kaldstart 4 → 3.
101. **Kalenderen er ikke virtualisert**, og henter 30 måneder. Et lag med
     to treninger i uka monterer rundt 150 kort ved hvert besøk.
102. **Toppen av skjermen er ikke memoisert.** Hvert tastetrykk i «Del noe
     med laget» tegner hero-karusellen på nytt. To kontekster øverst i
     treet lager ny verdi ved hver token-fornyelse.
103. ~~**Feeden signerer miniatyrbilder den aldri bruker**, og
     idrettslista hentes ved hver kaldstart.~~ **LUKKET 2026-09-12
     (38b87b2).** Feeden varmer kun `display` — både `FeedCard` og
     `CommentThread` ber eksplisitt om den varianten, og kampflatene varmer
     sine egne i `getMatchPhotos`. Idrettslista ligger nå på disk mellom
     øktene (`primeSportsFromDisk`, aldri nett); kravet fra 2026-09-04 om
     at pillene står fra første render er uendret.
     Funnet på kjøpet: badgen tok et eget HEAD-kall ved frø-boot fordi
     regelen sto i mount-effekten og ikke der HTTP-et sendes. Flyttet til
     `refreshUnread`, som gjelder mount, fokus OG lagbytte.
104. ~~**Testen som vokter oppstartsbudsjettet er blind.**~~ **LUKKET
     2026-09-12 (38b87b2).** `bootHttpBudget.test.tsx` teller på
     `global.fetch` med hele apptreet montert — ingen api- eller
     query-modul er mocket, kun transporten, auth-sesjonen og
     realtime-kanalen (websocket, ikke HTTP). Tre scenarier er låst som
     EKSAKTE lister, ikke som tall, så et nytt kall i boot krever en
     bevisst beslutning:

     | Scenario | Før skive 3 | Etter |
     |---|---|---|
     | Kaldstart, tom disk | 7 | **6** |
     | Gjentatt kaldstart (frø + snapshot) | 6 | **4** |
     | Kontekst-RPC feiler | «7–9» (feil) | **12**, målt |

     Anslaget «sju til ni» var altså for LAVT i feilstien: når 00079-kallet
     ryker, slår hele fallback-viften inn samtidig (profil, medlemskap,
     `getLiveMatch`, lagkassa, unread-HEAD, medlemstall-HEAD).
     `bootBudget.test.tsx` beholder rollen sin — den vokter orkestreringen
     (ingen duplikate enkeltkall mens konteksten er i flukt) — og den
     falske ≤6-påstanden er strøket fra fila.
105. **Hvert innlegg er O(antall medlemmer) i tre ledd**, og ett av dem
     kjører synkront i transaksjonen til den som poster. Ved 25 medlemmer
     er det usynlig. Ved 300 henger «Del»-knappen.
106. **`get_team_members` og `get_team_authors` er upaginerte**, i
     motsetning til feeden som er riktig paginert.
107. ~~**«Deaktiver støtte» kan ikke fullføre for store lag.**~~
     **LUKKET 2026-09-12 av 00085 (kjørt i prod, verify 7/7 grønn).**
     Rotfeilen: `deactivate_team_support_data` returnerte ALLE levende
     abonnementer hver gang, så et nytt forsøk gjorde hele jobben om
     igjen — et lag som ikke rakk gjennom på ett forsøk, rakk det aldri.
     Nå filtrerer RPC-en på `cancel_at IS NULL` (webhookens bokføring er
     fasit for «ferdig»): hvert forsøk tar KUN resten, et avbrutt forsøk
     fortsetter der det slapp, og fremdriften bor der sannheten bor —
     ingen ny tilstandstabell. Bevist i prod i rullet-tilbake-transaksjon:
     kall 2 etter simulert webhook ga 1 → 0. Kontrollkjøringen FØR push
     beviste også prod-feilen (1 → 1). Edge-funksjonen
     `club-support-deactivate` er deployet med `remaining` i svaret og
     ærligere feilmelding; skjermteksten sier nå «ikke fullført ennå» og
     lover fortsettelse, ikke omkamp. Dørene målt før push og beholdt:
     service-role-only, search_path pinnet med pg_temp sist.
108. ~~**Nettsiden har ingen miljøseparasjon.**~~ **LUKKET 2026-09-11 natt
     — variablene er satt i Vercel, og previewen bygger grønt.** `web/src/lib/env.ts` har
     ingen reserveverdi lenger: `PUBLIC_HEIA_ENV` (`production`/`test`/
     `local`), `PUBLIC_SUPABASE_URL` og `PUBLIC_SUPABASE_ANON_KEY` må
     settes, ellers stopper byggingen med en forklarende feil. Et
     miljømerke nede til høyre viser datamiljø og prosjektreferanse på
     alle verter unntatt heiaapp.no. Bevis: `scripts/verify-web-env.mjs`.
     **Variablene er på plass:** `PUBLIC_HEIA_ENV=production`,
     `PUBLIC_SUPABASE_URL` og `PUBLIC_SUPABASE_ANON_KEY`, alle for både
     Production og Preview, alle av typen **Config** (Vercel krevde et
     eksplisitt valg for `PUBLIC_`-prefikset: anon-nøkkelen SKAL nå
     nettleseren, så «secret» ville brutt byggingen — Astro eksponerer bare
     `PUBLIC_`-variabler til klienten). Verdiene er verifisert identiske med
     `web/.env` ved å hente dem ned igjen.

     **Beviset for at vakten virker, kom fra Vercel selv.** De to previewene
     før variablene feilet med `[heia/web] PUBLIC_HEIA_ENV mangler`, og
     Vercel var grønn på commiten før — altså kan ingen forhåndsvisning
     lenger bygge stille mot produksjon. Byggeloggen på den grønne previewen
     inneholder dessuten advarselen fra `astro.config.mjs`: «Sett
     PUBLIC_HEIA_ENV=test for Preview når et testprosjekt finnes». Den
     skrives bare når Vercel melder «preview» OG miljøet er `production`.
109. ~~**CI bygger ikke nettsiden.**~~ **LUKKET 2026-09-11 for nettsidens
     del.** `.github/workflows/ci.yml` har en `web`-jobb: `astro check`
     (typer og `.astro`-diagnostikk, 0 feil), en negativ test som krever
     at bygging uten miljø STOPPER, bygging med eksplisitt testmiljø, og
     `scripts/verify-web-env.mjs`. **Gjenstår:** de databasenære
     bevisfilene (`scripts/verify-*.sql`, `verify-web-flows.mjs` m.fl.)
     kjøres fortsatt for hånd — de trenger et testmiljø, se punkt 113.
110. **Invitasjonskoden bruker 30 av 31 tegn** i alfabetet, og bygger på
     en vanlig tilfeldighetsgenerator, ikke en kryptografisk.
111. ~~**`inbox_enabled` svarer på spørsmål om andre brukere.**~~
     **LUKKET 2026-09-11.** Løsningen ble ikke en `auth.uid()`-vakt — den
     ville vært feil medisin, for funksjonen kalles av triggere på vegne av
     andre brukere enn den som utløste dem, og en slik vakt ville slått ut
     varslingen. Riktig fiks var å ta EXECUTE fra alle tre klientroller
     (gruppe C i 00084). Målt etter kjøring: en innlogget bruker som slår opp
     en annens varselinnstilling får 42501. At varslingen fortsatt virker er
     bevist med en A/B i en transaksjon som ble rullet tilbake: et festet
     innlegg i et lag med tre andre medlemmer ga +3 varselrader både med og
     uten revoke.

### Nytt fra skive 1 (2026-09-11 kveld)

113. **Det finnes ikke noe testmiljø.** **Nedprioritert av Brage
     2026-09-11:** alle 21 lag og 18 brukere i prod er hans egne testdata,
     det er ingen eksterne pilotbrukere, og eksisterende prosjekt brukes
     videre. Ingen nytt prosjekt ble opprettet. Punktet står fordi det
     kommer tilbake i det øyeblikket ekte pilotlag tas inn — da kan ikke
     databasekontroller lenger kjøres mot samme base. Veiene når den tid
     kommer: **(a)** `supabase start` lokalt — CLI-en ligger på maskina
     (v2.75.0), men **ingen container-motor er installert** (verken Docker
     Desktop, OrbStack, Colima eller Podman). **(b)** Et eget
     Supabase-prosjekt. Nettsiden er allerede klar for begge:
     `PUBLIC_HEIA_ENV=local` godtar `http://127.0.0.1:54321`, `test`
     krever https.

     Arbeidsmåten som erstattet et testmiljø i denne runden, og som bør
     gjenbrukes: kjør migrasjonen og handlingene i en transaksjon som
     RULLES TILBAKE, og mål begge retninger inne i den. Det avdekket
     RLS-svaret som ville tatt ned feeden, og det etterlot null spor.
114. **Astro 5.18.2 har ti åpne rådgivninger — ingen av dem er nåbare i
     Heias oppsett.** Gjennomgått konkret 2026-09-11 natt.

     | GHSA | Alvor | Fikset i | Krever | Heia |
     |---|---|---|---|---|
     | `GHSA-26w7-cxv4-gfx2` | kritisk | 7.2.8 | `astro:assets`-bildeoptimalisering med AVIF | ingen `<Image>`, `<Picture>` eller `getImage` — bildene ligger statisk i `public/` |
     | `GHSA-2pvr-wf23-7pc7` | høy | 6.4.6 | SSR som henter en prerendret feilside | `output: 'static'`, ingen adapter, ingen egen 404/500 |
     | `GHSA-8hv8-536x-4wqp` | høy | 6.3.3 | dynamisk slot-navn | ingen `slot={…}` |
     | `GHSA-j687-52p2-xcff` | moderat | 6.1.6 | angriperstyrt streng i `define:vars` | ett kall, med fem byggetidskonstanter |
     | `GHSA-jrpj-wcv7-9fh9` | moderat | 6.4.6 | spread-props med styrte attributtNAVN | ingen `{...}`-spread i noen `.astro` |
     | `GHSA-f48w-9m4c-m7f5` | moderat | 7.0.6 | samme, i `renderHTMLElement` | samme |
     | `GHSA-4g3v-8h47-v7g6` | moderat | 7.0.10 | View Transitions | ikke i bruk |
     | `GHSA-7pw4-f3q4-r2p2` | lav | 7.0.4 | `transition:*`-direktiver | ikke i bruk (CSS-`transition` er noe annet) |
     | `GHSA-376h-93r7-7g6f` | moderat | 7.2.4 | `base` satt i konfigurasjonen | `base` er ikke satt |
     | `GHSA-xr5h-phrj-8vxv` | lav | 6.1.10 | server islands (`server:defer`) | ikke i bruk |

     Pluss to transitive: `GHSA-g7r4-m6w7-qqqr` (esbuild, kun
     dev-serveren på Windows) og `GHSA-f88m-g3jw-g9cj` +
     `GHSA-rgj7-g3m4-5g8c` (sharp/libvips/libheif, `sharp` 0.34.5 →
     trenger 0.35.4). `sharp` er en valgfri avhengighet som bare kjøres av
     bildeoptimaliseringen — som vi ikke bruker.

     **Minste oppgradering som retter alt: `astro@7.2.8`** — ikke 7.3.2,
     som `npm audit fix --force` foreslår. Den er drevet av den ene
     kritiske (AVIF, fikset i 7.2.8); alle de andre er fikset tidligere.
     `astro@7.2.8` trekker `esbuild ^0.28.0`, som løser esbuild-funnet.
     **`@astrojs/react` trenger ikke endres** — siste er 6.0.5, som vi
     allerede har, og den har ingen `astro`-peer. Det gjør spranget mindre
     enn «to hovedversjoner» høres ut som.
     **Én forutsetning:** `astro@7.2.8` krever **Node ≥ 22.12.0**. CI
     kjører Node 22, maskina kjører 24 — men Vercels Node-versjon må
     bekreftes før oppgraderingen.

     Ikke hastverk, men bør tas før lansering, siden «ikke nåbar i dag»
     avhenger av at vi aldri tar i bruk bildeoptimalisering, View
     Transitions eller `base`.

115. **Appen har ingen miljømerking.** `src/lib/supabase.ts` leser
     `Config.SUPABASE_URL!` fra `.env` uten validering eller miljønavn.
     Et TestFlight-bygg pekt på et testprosjekt ville sett helt likt ut
     som produksjon. Bør få samme eksplisitte miljøvalg som nettsiden når
     punkt 113 er løst — ellers er «test på telefonen» ikke etterprøvbart.

116. ~~**CI er RØD på `main`.**~~ **RETTET 2026-09-11 natt — `tsc` gir nå
     0 feil (var 31).** GitHub viste 10; annotasjonene er kappet på ti, og
     det reelle tallet var **31 i 10 filer**: LiquidGlassSurface (10),
     EventDetailScreen (7), deepLink (3), media (3), LagkassaScreen (2),
     AppNavigator (2), og én hver i JoinTeamCode, netMetrics, MatchViews og
     TimeSheet. Alt er rettet på typenivå, uten funksjonell endring.

     To av dem skjulte ekte feil, og oppførselen er BEHOLDT slik den er på
     telefonen — feilen er ført videre som punkt 118 og 119 i stedet for å
     bli rettet i forbifarten:
     * `NativeGlass` ble lest i sin egen temporale dødsone. Verdien ble
       tilfeldigvis riktig (`undefined !== null` er true, og på iOS 26 er
       riktig svar også true). Deklarasjonen er flyttet opp; samme verdi.
     * `FEED_FROST.top`/`.bottom` ble lest av JSX-en uten å finnes. Under
       Paper utelates udefinerte props, så de native standardene gjaldt —
       nå står de samme tallene (0,24 / 0,09) i tokenet.
     * `styles.divider` fantes ikke, men elementet er ikke dødt: `column`
       har `gap`, så det tomme viewet legger på ett mellomrom. Lagt til som
       tom stil, så tegningen er uendret og navnet finnes.

     Samtidig: eslint hadde én feil (`KalenderScreen`) som CI aldri rakk å
     vise, fordi `tsc` døde først. `refetch` er stabil i TanStack Query,
     hele `eventsQuery` er det ikke — avhengigheten er med vilje snevrere,
     nå med skreven begrunnelse. `.eslintignore` utelater `web/dist`, som
     er git-ignorert og ikke finnes i CI, men lokalt ga 142 «feil» i
     minifisert kode.

     **Verifisert lokalt:** `tsc` 0 feil, `jest` 1258 bestått / 2 hoppet
     (tallet den gangen; suiten er 1279 etter skive 3)
     over, `eslint` 0 feil. **Ikke telefonverifisert** — ingen av
     endringene endrer noe som tegnes.
117. **Én Edge Function har ferdig kode som ikke er i drift.**
     ~~`stripe-checkout`~~ (deployet 2026-09-12, punkt 87) —
     `push-fanout` står fortsatt på **v13 (3. aug)**: 500-taket skal
     logges i stedet for å kutte stille (punkt 94). Alle andre
     funksjoner er i synk med koden (club-support-deactivate deployet
     2026-09-12 sammen med 00085).

118. **Ventetilstanden på «Bli med i lag» har ingen opplesning.**
     `JoinTeamCodeScreen` sendte `accessible`, `accessibilityRole="progressbar"`
     og `accessibilityLabel="Søker etter laget"` til `LiquidGlassSurface`,
     men `GlassSurface` plukker ut de propene den kjenner og slipper resten
     — de nådde aldri et view. Propene er fjernet så koden sier sant.
     Fiksen er å la `LiquidGlassSurface` ta imot og videreføre a11y-props.
     Liten jobb, men den ENDRER hva VoiceOver sier, så den hører til en
     runde der det kan telefonsjekkes.
119. **Reporterens selvvalgte avatarfarge slår ikke gjennom på
     kampskjermen.** `MatchViews` sendte `color={author?.color}`; feltet på
     `User` heter `avatarColor`. Propen var alltid `undefined`, så avataren
     har hele tiden brukt navne-hashen. Propen er fjernet (samme tegning);
     å bytte til `avatarColor` ville endret farger på en telefongodkjent
     skjerm, så det tas som en egen liten runde. Se [[avatar_upload_slice]].
120. **Hårlinjene EventDetailScreen lover finnes ikke.** Kommentaren i fila
     sier «skillene er hårlinjer», men `styles.divider` var aldri definert
     — skillet er i dag bare et ekstra `gap`. Tom stil står nå der navnet
     skal fylles. Rent designarbeid.
121. **CI kjører ikke på pushen til `Brage`.** Arbeidsflyten fyrer bare på
     `pull_request` og `push` til `main`, så en grønn eller rød CI finnes
     ikke før PR-en er åpnet. Det er ikke feil, men det betyr at ingen av
     de nye stegene (`astro check`, `web`-jobben, de to lintene) har vært
     kjørt av GitHub ennå — bare lokalt, steg for steg i arbeidsflytens
     egen rekkefølge. Vurder å legge `Brage` til i `push`-triggeren, så
     grenen får dom uten at det må åpnes PR.

122. ~~**Én test tidsavbryter på CI: `feedRefetch` «payload-først (B3)».**~~
     **LUKKET 2026-09-12.** Årsaken var IKKE retry-hypotesen (motbevist:
     null fake timers utestående under hengingen, og et 120 s-spark på
     fake-klokka løsnet ingenting) — den var **Node-versjonen**: runneren
     kjører Node 22, Macen 24. Med CI-ens eksakte Node (22.23.2) lokalt
     reproduserte hengingen deterministisk; på 24 finnes den ikke. Målt
     helt inn: Reacts asynkrone `act` planlegger fortsettelsen sin med
     `setImmediate`, og med jests standard-faking (som faker ALT, også
     immediates) kjørte den planlagte fortsettelsen aldri på Node 22 —
     `await act(...)` hang for alltid. Fiksen i `feedRefetch.test.tsx`:
     `jest.useFakeTimers({doNotFake: ['setImmediate', 'clearImmediate']})`
     — testene trenger bare setTimeout-familien (debounce/notify/retry).
     Bevis: kontroll hang 2/2, fiksen grønn 5/5 + 3/3 på Node 22.23.2;
     hele suiten 1258/1258 på både Node 22 (`--maxWorkers=3`, CI-form) og
     Node 24. **Lærdom:** «grønt lokalt» må også bety SAMME Node-dur som
     runneren — hent `node-v22.x-darwin-arm64` og kjør jest med den i
     PATH før en CI-heng jages i blinde.

     **Lærdom verdt å ta med (fra før):** CI hadde vært rød sammenhengende
     siden 19. august uten at noen visste det, fordi `tsc` stoppet før
     jest. «Grønt lokalt» beviste ingenting: arbeidstreet hadde
     `@types/node` og `.astro/` som en ren `npm ci` ikke har. Verifiser
     slike steg i en ren klone.
123. **`A worker process has failed to exit gracefully` står igjen.** Den
     fantes før dette arbeidet, opptrer i begge halvdeler av testlista hver
     for seg, forsvinner helt når suiten kjøres serielt, og jest avslutter
     uansett med 0. Den blokkerer ingenting, men den er et symptom på at
     noe fortsatt ikke ryddes. (Var antatt beslektet med punkt 122 — det
     stemte ikke: 122 var Node 22 + fakede immediates i `act`, se punktet.)
     Målt 2026-09-12: én enkelt suite in-band holder prosessen i live i
     **~6 minutter** etter grønt resultat — TanStacks gc-timere (5 min)
     pluss øvrige håndtak. Det er dette som gjorde `--runInBand` fatal i
     CI, og det er ryddesaken som gjenstår her.

     ⚠️ **Ikke prøv `--runInBand` som fiks.** Det ble prøvd: serielt finnes
     ingen arbeider jest kan tvangsavslutte, så ett gjenværende håndtak
     låser hele prosessen til jobben treffer `timeout-minutes: 15`. Fire
     kjøringer hang slik.

### Avkreftet

112. **Bøttegrensene er allerede på plass.** Gjennomgangen meldte at
     `feed-media` manglet størrelses- og filtypegrense, basert på
     migrasjonsfila. Prod har 10 MB og fire bildetyper. Migrasjonsfila er
     bare ikke oppdatert. Lærdom: sjekk alltid mot prod, ikke mot filene.

## Skivene i detalj

Definert av Brage 2026-09-11. Hver skive er avgrenset og leveres for seg.

### Skive 1 — Kontroll på miljøene og databaseautorisasjonen

**STATUS 2026-09-11 natt: steg 1 og 2 er ferdige.** Punkt 108, 109, 97, 111
og 30 er lukket. Igjen i skiva: punkt 98 (`search_path` på resten, i
grupper) og punkt 113 (testmiljø — Brage bestemte at eksisterende prosjekt
brukes videre, siden alle 21 lag og 18 brukere er hans egne testdata; kravet
om et separat miljø blokkerer derfor ikke).

**Start her.** Begynn med statusavklaringen øverst i denne fila, så:

1. ~~**Punkt 108–109 først.**~~ **GJORT 2026-09-11** (kode og CI; venter
   på Vercel-variabler før merge). Reserveverdien er borte, miljøvalget er
   eksplisitt, nettsiden typesjekkes og bygges i CI, og bevisfila
   `scripts/verify-web-env.mjs` kjøres automatisk. Testmiljøet ble skilt ut
   som punkt 113; Brage avgjorde samme kveld at eksisterende prosjekt brukes
   videre, så det blokkerte ikke steg 2.
2. ~~**Deretter 00084.**~~ **GJORT og KJØRT I PROD 2026-09-11.** Gruppene,
   kallerne og de tilsiktede unntakene står dokumentert i migrasjonens
   hode. Vakten mot gjentakelse ble to ting: `scripts/lint-security-definer.mjs`
   i CI (leser migrasjonsfilene, krever REVOKE eller et bevisst
   `-- lint:anon-ok`-merke; negativt testet) og rad A1 i
   `scripts/verify-00084.sql` (leser databasen, som er sannheten).
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

**Status 2026-09-12: 104, 99, 103 og klientdelen av 40 er LUKKET (38b87b2).**

- ~~Punkt 104~~ — vakten virker nå, og den måler. Se punktet for tallene.
- ~~Punkt 99~~ — 1,5 s borte fra hver kaldstart. **Trenger telefondom:**
  pillen i tab-baren står tom (`unknown`) i det sekundet kampsvaret er
  underveis, der den før lå bak oppstartsflaten. Det er den avklarte
  retningen, men det er også den ENESTE synlige endringen i skiva.
- ~~Punkt 103~~ — idrettslista fra disk, ingen thumb-signering i feeden.
- ~~Punkt 40, klientdelen~~ — tidsgrense + ærlige feilmeldinger.
- **Punkt 40, resten:** ekte idempotens på skriving krever en migrasjon.
  Ikke startet — se punktet.
- ~~Punkt 100~~ — **koden er ferdig og CI-grønn (PR #58); MIGRASJONEN ER
  IKKE KJØRT.** Tørrkjørt mot prod, 19/19 grønt, og prod bevist urørt
  etterpå. Se punktet for kjøre- og tilbakeføringskommandoene.
- **Mål 88 og 89 i et ekte bygg.** De kan ikke måles før 1.0 (5).
- **Så 102 og 101** etter hva målingene faktisk viser. Bevar godkjent
  utseende og oppførsel.

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
