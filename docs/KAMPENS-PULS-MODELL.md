> # ⚠️ FORENKLET 2026-08-21 — LES DETTE FØRST
>
> **Brage, etter telefontesten:** «pulsen er blitt en parallell
> hendelsesnavigator og dupliserer kamphistorien.»
>
> **BEREGNINGSMODELLEN I DETTE DOKUMENTET GJELDER FORTSATT, ORDRETT.** Ekte
> tidsakse i sekunder, hele bredden fra avspark til slutt/NÅ, våre mål opp og
> mål imot ned, høyere aktivitet ved tette rapporteringer, flatere linje i
> rolige perioder, HEIA som glød, faser som tier når datagrunnlaget ikke
> bærer dem — alt står.
>
> **DET SOM ER FJERNET ER MARKØR- OG NAVIGASJONSLAGET:**
> · Ball/Camera/MessageCircle-ikoner på kurven
> · stablede ikonmarkører, ×N-merker og kommentarbobler
> · valgt-hendelse-panelet, ‹ 3/11 ›-stepperen og «Vis i historien»
> · individuelle trykkflater — **pulsen er ikke trykkbar i det hele tatt**
> · `accessibilityRole="adjustable"` med sveip mellom øyeblikkene
>
> **NÅ:** én sammenhengende kurve. Node bare på MÅL (vår: litt større mint
> over linja; motstanderens: dempet skifer under). Oppdateringer og bilder
> FORMER kurven, men får ingen node. HEIA/kommentarer er varme uten badges —
> halo tegnes kun der noen faktisk har svart. Pause er én kort krittstrek
> som krysser kurven. Maks to faseetiketter. **Ett** VoiceOver-stopp med
> **én** samlet setning, uten rolle og uten blaing.
>
> Kamphistorien rett under er detaljvisningen. Pulsen skal ikke konkurrere
> med den. Avsnittene under om markørikoner, valgpanel og justerbar
> tilgjengelighet er derfor HISTORIKK — de forklarer hvorfor modellen ser ut
> som den gjør, ikke hva flaten viser.

# Kampens puls — datamapping og visuell modell

**Status: ✅ TELEFONGODKJENT AV BRAGE 2026-08-21 — «Det er godkjent nå så vi
kan gå videre.»** 468 tester grønt, lint uendret.

**Denne fila er KONTRAKTEN for pulsen.** Skiva tok fire runder, og runde 2
var teknisk grønn og ble avvist likevel. Rør ikke `MatchPulse` eller
`shared/matchPulse` uten å lese hele dokumentet — og kjør designriggen
(`__tests__/pulseModel.harness.test.ts`) og SE på flaten før du leverer.

⚠️ **X-AKSEN ER SEKUNDER, IKKE MINUTTER — og det er den viktigste rettelsen
i hele skiva.** Se `## 1. Tidsaksen`. Se `### ⏳ SKIVE 5 RUNDE 3` i
`docs/STATUS-HANDOFF.md` for sjekklista.

**Brages beslutninger, alle innarbeidet:** oppdateringer og bilder over
midtlinja (underlinja RESERVERT for mål imot) · 5-minutters kvantisering
godkjent, med mild opacity-overgang og direkte bytte ved Reduce Motion ·
rulling i denne skiva, men som SYNLIG «Vis i historien»-handling, ikke en
skjult gest · hele pulsen som ÉN justerbar tilgjengelighetsenhet ·
grunnlinjebølgen fjernet.

Skrevet 2026-08-21 etter at skive 5 runde 2 var teknisk grønn, men ble
produktmessig avvist: *«ikke en tilfeldig bølge basert på antall
hendelser»*.

Modellen er tegnet og sett i riggen (`__tests__/pulseModel.harness.test.ts`)
gjennom åtte scenarier før den ble skrevet ned. Riggen fant ni feil i
modellen underveis; de er rettet, og reglene de tvang fram står her.

---

## 0. Hva som beholdes fra det som står i dag

`MatchPulse.tsx` er ikke søppel — grunnmuren er riktig og skal stå:

- måling med `onLayout` og geometri i PUNKTER (ingen prosent i svg — 3.1)
- **to-trinns memo**: strukturell signatur på referansene, form på signaturen
- `nowMinute` som PROP, aldri `Date.now()`
- kurven skjult for skjermleser, overskrift og minutt lest
- `useReducedMotion` koblet fra første linje
- `matchPulseClock` i `matchCopy` som ÉN kilde til «NÅ 40′ / PAUSE / SLUTT»

Det som byttes ut er **hva kurven uttrykker**: geometri-modulen og et nytt
markørlag.

---

## 1. Tidsaksen — ekte kamptid i SEKUNDER

```
x(sekund) = pad + (sekund / span) · bredde
```

### ⚠️ Rettelsen fra telefonen: minutter er for grovt

Brages testkamp varte **under ett minutt**, med hendelser rapportert flere
sekunder fra hverandre. Første modell brukte avrundet `minute` og hadde et
gulv på fem minutter i `span` — resultatet var at ALT lå i «0′» og hele
pulsen kollapset til venstre kant.

**Nå: `t = 0` er AVSPARK, `t = span` er SLUTT, og alt regnes i sekunder.**
En ferdig kamp bruker derfor **alltid hele bredden**.

| Fase | `span` |
|---|---|
| Ferdig | sekundene fra avspark til `slutt` (fallback: siste hendelse) |
| Live / pause | sekundene fra avspark til NÅ |

**Ingen kvantisering.** Klokka har minuttoppløsning, så høyre kant i en live
kamp flytter seg hvert minutt og kurven strekkes litt. Hendelsenes
innbyrdes forhold er uendret — det er dét som gjør aksen til ekte tid — og
overgangen er en 220 ms opacity-fade (Reduce Motion bytter direkte).

### Hvor sekundene kommer fra

`get_event_with_rsvp` (00020:289-303) returnerer bare `minute`. Men **den
kanoniske feed-posten skrives i SAMME TRANSAKSJON som hendelsen**
(`report_match_event` 00021:150-153, `start_match` 00020:83), så
`created_at` derfra ER hendelsens tidspunkt på millisekundet. `get_match_feed`
(00071) returnerer det allerede, og `buildMatchEngagement` bærer det nå
videre.

Modellen leter i tre kilder, i rekkefølge:

1. `event.createdAt` — finnes i typen, mappes ikke fra RPC-en i dag.
   **Den dagen `created_at` kommer ut av `get_event_with_rsvp`, blir pulsen
   bedre uten at én linje endres.** Det er den anbefalte lille migrasjonen.
2. Den kanoniske feed-postens `created_at` — kilden i dag.
3. Det avrundede minuttet — siste utvei, og nettopp det som kollapset.

### Gruppering

⚠️ **ALDRI på minutt.** To hendelser ni sekunder fra hverandre viser begge
«1′», men ligger 50 pt fra hverandre i en kort kamp — de skal være to
markører. Grupperingen skjer i to helt ulike nivåer:

1. **Markører (22 pt):** to som i praksis dekker hverandre blir ÉN med `×N`.
   Terskelen er MINDRE enn markøren (30 pt) med vilje — de får overlappe
   litt, og males i rang (bilde nederst, oppdatering over, mål øverst), så
   en 60-minutters kamp med ti hendelser fortsatt viser hvilken type hver
   av dem var.
2. **Trykkflater (44 pt):** legges ut sekvensielt og er ikke-overlappende
   ved konstruksjon. Det som ikke får sin egen flate havner i den forrige,
   og stepperen i panelet blar mellom øyeblikkene.

## 2. Midtlinja gir retning

En vannrett krittlinje på 20 % deler båndet. **Over = oss. Under = dem.**
Overhalvdelen er 30 pt, underhalvdelen 20, med 12 pt luft i hver ende.

| Kilde | Retning | Amplitude | Svai | Markør |
|---|---|---|---|---|
| `mål`, `teamSide=home` | **opp** | 1.0 | smal, skarp (5/9 pt) | `Ball` på mint |
| `mål`, `teamSide=away` | **ned** | 1.0 av underhalvdelen | smal, skarp | `Ball` på skifer |
| `melding` (reporter) | opp | 0.30 | rundere (7/12) | `MessageCircle` på gull |
| bilde (frittstående) | opp | 0.26 | bredest, mykest (10/16) | `Camera` på krem |
| `avspark`/`pause`/`andre_omgang`/`slutt` | — | **0** | — | 1 pt krittstrek |

- **Underhalvdelen er lavere enn overhalvdelen** (20 mot 30 pt). Heia feirer
  oss; motstanderens mål er informasjon, ikke like stort. Men søkket er
  ekte — en kamp tapt 0–3 skal se ut som det.
- **Aldri coral.** Coral betyr LIVE og ingenting annet (låst fargesemantikk).
- ⚠️ **PAUSE ER ÉN LITEN MARKØR PÅ EN SAMMENHENGENDE LINJE.** Den var en
  fullhøy strek som delte kurven i to; nå er den en 14 pt chip PÅ midtlinja.
  Den deler ingenting, nullstiller ingen tid og lager ikke tomrom. Avspark
  og slutt er linjas to ender og trenger ingen markør; `andre_omgang` ligger
  på samme tidspunkt som pausen og ville bare doblet den.
- **Amplituden har et mykt tak:** `1 − e^(−sum·1.05)`. Ett mål ≈ 0.65 av
  halvbåndet, to ≈ 0.88, fem ≈ 1.0. Ti mål i samme minutt sprenger ikke
  båndet, men er tydelig større enn ett.

**✅ LÅST AV BRAGE:** oppdateringer og bilder ligger OVER midtlinja (det er
vår reporter og våre bilder), og **underlinja er RESERVERT for mål imot**.
Nøytrale hendelser har lav amplitude og tydelig gull-/kremikon, så de aldri
kan forveksles med våre mål — voktet av en test.

---

## 3. Hendelsestype skal kunne leses

Markørene bruker **appens egne ikoner** — `Ball` fra `icons.tsx`,
`MessageCircle` og `Camera` fra samme Lucide-sett som `EventNode`. Ingen nye
ikoner, ingen prototype-parallell.

**⚠️ Konsekvens for arkitekturen:** Lucide-ikoner rendrer sin egen `<Svg>`,
og svg i svg er ikke pålitelig i RN. **Markørene blir derfor absolutt
posisjonerte `Pressable`-views oppå lerretet**, ikke svg-elementer. Det er
uansett nødvendig: de skal kunne trykkes, og trenger `hitSlop` til 44 pt.
Kurven, midtlinja, halo og rytmestrekene blir i svg.

### Valg

Ett trykk **velger** markøren og viser en kompakt forklaring under båndet:

```
20′ · Mål — Jarle · 3–1
2 heier · 1 kommentar
```

Ved en klynge: `35′ · Mål — Jarle · 3–1 · ×2`.
Forklaringslinja erstatter faselinja så lenge noe er valgt — ingen ny høyde.

**✅ RULLINGEN ER EN SYNLIG HANDLING, IKKE EN SKJULT GEST (Brage).** Panelet
har «Vis i historien ›», og den ruller til raden. Ingen interaksjon
brukeren må gjette seg til.

Plumbingen: `MatchTimeline` fikk `onRowLayout` — **radene MÅLER seg selv**
i stedet for at noen regner ut høyden deres (en målrad med bilde er tre
ganger så høy som en uten; det var nettopp antakelsen som brakk i 3.1). De
to kampflatene eier `ScrollView`-refen og forløpets egen y. Reduce Motion
hopper i stedet for å rulle.

---

## 4. Pulsen reagerer på mengden aktivitet

Kurven tegnes som et **bånd med varierende halvbredde**, ikke en strek med
fast tykkelse:

```
halvbredde(x) = 0.75 + 2.0 · tetthet(x)      // tetthet: 0–1
```

- **Tett aktivitet:** større amplitude (summeres), tykkere lys, tettere
  rytme, lokal glød.
- **Lang stillhet:** kurven ligger på midtlinja, båndet er på sitt tynneste,
  og strekningen er **proporsjonalt lang** fordi x er ekte tid.

### To avledede faser, maks

```
MEST LIV · 34′–41′        ROLIG · 18′–31′
```

- **MEST LIV**: glidende vindu på `max(4, span/6)` minutter med flest
  hendelser. Vises kun hvis vinduet har **≥ 3 hendelser** OG minst
  **2× kampens snitt-tetthet**.
- **ROLIG**: lengste hull mellom to hendelser. Vises kun hvis hullet er
  **≥ max(8 min, 25 % av span)**.
- **De to skal aldri overlappe i tid.** Gjør de det, BESKJÆRES den rolige
  perioden til delen som ligger utenfor — den skal ikke forsvinne helt.
  Se avvik 3.
- Færre enn 3 hendelser → ingen MEST LIV. Færre enn 2 → ingen faser.
- **Aldri «press» eller «dominans».** Vi kjenner bare RAPPORTERTE hendelser,
  og fraværet av en rapport er ikke fraværet av spill.

---

## 5. HEIA og kommentarer er respons

De lager **aldri** et punkt på tidsaksen, og de rører **aldri** kurvens
form:

| Respons | Uttrykk |
|---|---|
| HEIA-antall | radialgradient-halo rundt markøren, radius `6 + min(11, n·0.28)` |
| Kommentarer | liten boble med antall, festet på markøren |
| Du har heiet | markøren får en lys, tydelig ring |

Reporterens egne **oppdateringer** er derimot kamphendelser og får sitt eget
punkt i tiden — de kommer fra `report_match_event`, ikke fra publikum.

HEIA-summene leses fra `buildMatchEngagement` (skive 4), ikke hentet på nytt.

---

## 6. Live-respons

- En ny hendelse vekker **bare sitt eget område**: svaien vokser ut fra
  midtlinja, markøren tennes. Resten av kurven står stille — og det er
  garantert av at `span` er kvantisert, så en ny hendelse i minutt 31 ikke
  flytter noe som helst når domenet allerede er `[0, 35]`.
- `useReducedMotion` → mild fade/skalering i stedet for vekst.
- **Minutt-tickeren regenererer ikke kurven.** `nowMinute` er ikke med i
  hendelsesgeometrien; NÅ-markøren er et eget lag.

---

## 7. Kompleksitet og høyde

| | I dag | Forslag |
|---|---|---|
| Etikettrad | 17 | 17 |
| Bånd | 54 | 34 opp + 24 ned + 2×17 luft = **92** |
| Fase-/valglinje | — | 15 |
| Luft | 21 | 18 |
| **Totalt** | **~92 pt** | **~124 pt** |

Luften over og under båndet er ikke pynt: uten den klippes markørene på de
høyeste toppene. Det var en av feilene riggen fant.

---

## Akseptansetester — hva som skal bevises

| # | Krav | Fixture / vakt |
|---|---|---|
| 1 | Ingen hendelser → helt rolig puls | tom kamp: kurven ligger på midtlinja hele veien, 0 markører |
| 2 | Ett mål i 20′ → én topp på riktig sted | 40′-kamp: markørens x er 50 % ± 1 % av bredden |
| 3 | Mål for/mot → motsatt retning | y for `home` < midtlinje < y for `away` |
| 4 | Lang periode uten hendelser → lang flat strek | avstanden mellom to markører er proporsjonal med minuttdifferansen |
| 5 | Flere hendelser tett → samlet intens periode | amplitude og båndbredde er større enn for én enkelt hendelse |
| 6 | Oppdatering, bilde og mål har ulike markører | markørtype per kilde, og de er appens ikoner |
| 7 | HEIA/kommentarer forsterker uten å flytte | kurven er tegn for tegn lik med og uten heier; halo vokser |
| 8 | Sletting flytter/fjerner riktig puls | id borte ⇒ markør borte, øvrige x uendret |
| 9 | Samme minutt gir stabil gruppering | samme inndata i ny arrayrekkefølge ⇒ samme klynger |
| 10 | Minutt-tick regenererer ikke kurven | tick fra 31′ til 32′ ⇒ identiske path-strenger |
| 11 | VoiceOver leser valgt hendelse og sammendraget | valgpanelet og faselinja er lesbare; kurven er skjult |

I tillegg beholdes 5.1-vaktene: **x er strengt økende**, og **fem hendelser
i samme minutt kollapser ikke**.

---

## Tre steder byggingen avvek fra planen — og hvorfor

**0. Høyden er nå ~179 pt (Brage ba om ca. 170).** Markørene er 30 pt,
båndet 94 pt (38 opp / 26 ned + 15 pt luft i hver ende), og valgpanelet
48 pt fordi stepperen er to ekte 30 pt knapper med 8 pt hitSlop = 46 pt
treffflate. Panelets høyde er FAST, så et valg aldri dytter kampforløpet
nedover.

**1. (historikk) Høyden var ~139 pt, ikke 124.** Tabellen over la sammen feil: 17 + 92 +
15 + 18 er 142, ikke 124. Båndet er strammet (30 opp / 20 ned, 12 pt luft =
74 pt) og valgpanelet er 30 pt med FAST høyde uansett tilstand, så et trykk
aldri dytter kampforløpet nedover. Sluttsummen er 139.

**2. Trykkgruppene er FULLHØYDE, ikke to rader.** «To stablede markører må
også ha tydelig separate treffområder» lar seg ikke oppfylle i et 74 pt
bånd: to 44 pt mål stablet krever 88 pt bånd, altså ~155 pt totalt, og to
37 pt mål er nøyaktig den upålitelige treffingen kravet skal hindre. En
gruppe dekker derfor hele båndhøyden (≥44 × 74 pt) og begge sider — og et
mål for oss og et mål imot i samme minutt deler flate, med stepperen
mellom seg. Det er samme mekanisme kravet selv foreskriver for hendelser
som ikke kan få hver sin flate. **Vil Brage ha ekte to-rads berøring,
koster det ~155 pt totalt.**

**3. ROLIG beskjæres i stedet for å forsvinne.** Da fasene ble bygget viste
det seg at «MEST LIV 0′–10′» og «ROLIG 6′–48′» kolliderte i en helt vanlig
kamp, og regelen «de skal aldri overlappe» slettet den rolige perioden helt
— altså skjulte den nettopp det Brage ba om at skulle finnes. Nå beskjæres
den til «ROLIG 10′–48′», som er sant, og terskelen sjekkes på nytt etterpå.

---

## Åpne spørsmål til Brage — BESVART

1. ✅ **Over midtlinja.** Underlinja er reservert for mål imot. Nøytrale
   hendelser har lav amplitude (0.30 / 0.26 mot målets 1.0) og tydelig
   gull-/kremikon — voktet av en test som krever at de ligger under 45 %
   av målets høyde.
2. ✅ **Kvantisert til 5 minutter.** Reposisjoneringen får en 220 ms
   opacity-overgang; Reduce Motion bytter direkte.
3. **~92 → ~124 pt.** Innenfor «litt høyere»?
4. ✅ **I denne skiva, som SYNLIG handling.** Første trykk velger; panelet
   viser «Vis i historien ›» som ruller til raden. `MatchTimeline` fikk
   `onRowLayout` (radene MÅLER seg selv — 3.1-regelen), og de to
   kampflatene eier `ScrollView`-refen. Reduce Motion hopper.
5. ✅ **ÉN justerbar enhet.** `accessibilityRole="adjustable"` på hele
   seksjonen: labelen oppsummerer kampen og periodene, sveip opp/ned blar,
   `accessibilityValue` leser minutt, type, aktør, stilling, HEIA og
   kommentarer, og aktivering viser hendelsen i historien. Markørene er
   IKKE egne stopp — voktet av en test som krever null `button`-roller
   inne i pulsen.
6. ✅ **Fjernet.** En kamp uten rapporterte hendelser er nå en rett, dempet
   strek på midtlinja — og det betyr noe konkret.
