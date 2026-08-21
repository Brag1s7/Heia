# HEIA VISUAL SYSTEM — HANDOFF · START HER

**Status 2026-08-22 (kveld):** Fase 2 (design-artifacts) PÅGÅR. **Ingen visuell retning er godkjent.** «Lysstein» (dagens samtale) er **FORKASTET** — se §13, som også inneholder den nye metodebeslutningen. Fase 3, brand kit, BRAND_UI-omskriving og implementering er **ikke startet**. Produksjonskoden er urørt gjennom hele designsporet.

**Neste samtale starter i §13.** Alle referansebildene må legges ved på nytt (de er ikke i repoet).

Dette dokumentet er den eneste inngangen til neste samtale. Les det i sin helhet før noe tegnes. `docs/STATUS-HANDOFF.md` er fortsatt produktets tekniske handoff og er ikke oppdatert for designsporet — dette dokumentet gjelder foran den for alt visuelt.

---

## 1. Den opprinnelige briefen og ambisjonen

Heia er en sosial app for barne- og ungdomsidrett: følge laget, dele øyeblikk, kjenne idrettsgleden sammen («Strava for ungdomslag», ikke Spond). Uttrykket skal formidle idrettsglede, fellesskap, forventning, energi, farger, lek, stolthet, nærhet til laget og spenningen ved å følge noe sammen — premium og gjennomarbeidet, med varme, personlighet og bevegelse.

Ambisjonen, ordrett fra Brage: **«Heia skal kunne stå ved siden av de beste sports-, community- og sosiale appkonseptene på Dribbble og føles like gjennomarbeidet – men samtidig være et ekte, brukbart produkt og umiskjennelig Heia.»** Førsteinntrykket skal være «WOW. Hva er denne appen?». Ikke «ryddig». Ikke «dagens app litt penere».

Rollen: Heias ledende brand-, produkt-, motion- og interaksjonsdesigner + design engineer. Ta standpunkt, ikke gi menyer. Vis kvaliteten i selve designet — ikke i forklaringer.

## 2. Nordstjernen — «Én Heia-verden, ulik puls» (LÅST)

- Samme farge-DNA, geometri (banebuene), kritt-språk, lys, rytme og semantikk gjennom hele appen. Intensiteten («pulsen») tilpasses situasjonen.
- `#02FFAB` skal **eie mesteparten av verdenen** — gjennom mint, aqua, krem, lysbasseng og tonal dybde. Ikke én flat neonfarge, men en komponert, levende verden.
- **Presisering (eksplisitt): Dominant `#02FFAB` står fast.** De mislykkede artifactutførelsene er IKKE bevis for at Heia-grønt bør reduseres til én aksent per skjerm. Hierarkiet skal løses med **materialer, luminans, mørkt blekk, lokal lyssetting, transparens og komposisjon** — ikke ved å reversere merkevarehypotesen. En neste agent som «løser» kontrast ved å gjøre verdenen nøytral, har misforstått oppgaven.
- Mørkegrønt Heia-blekk (`#06291E`/`#0E4A35`-familien) gir kontrast og autoritet. Krem og lyse mintflater gir lesero — **aldri sterile, kritthvite standardkort**.
- Coral = LIVE og kampstatus. Gull = varme, viktige øyeblikk, milepæler. Begge står fast.
- Lagfarge = lokalt lys rundt lagidentiteten, aldri tilfeldig bakgrunn.
- Kampen kan være mer oppslukende og intens; resten av appen forblir lys. **Ingen mørk modus.** Den frosne mørke kampfasiten (docs/prototypes/kampskjerm/index.html) står til en lys kandidat slår den på telefonen.
- Flater skal føles komponert og materialbaserte, ikke som bokser oppå en gradient. Alle detaljer tilhører ett system — ingen tilfeldig pynt.
- **Pulsskala P0–P4** (skjemaer → Profil/Varsler → Kalender/Sesongen → Hjem → Kamp) styrer VISUELL ENERGI: metning, lys-spenn, atmosfærelag, eventuelt bevegelse. **Informasjonstetthet er IKKE en pulsdimensjon.**
- **Bevegelse er en åpen hypotese:** statisk grunn vs. nesten umerkelig, langsom atmosfærisk bevegelse (P3/P4) skal kunne sammenlignes. Reduced Motion = helt statisk. Ytelse/batteri er krav. Ingen evighetsanimasjon eller pynt.

## 3. Låste produkt- og teknikkregler

**Produktkontrakten (åpnes IKKE på nytt):**
- Skjermenes struktur, funksjonenes plassering, innholdets rekkefølge, navigasjonen, hvor knappene ligger, hvilke handlinger som finnes, kampflyten, kalenderflyten, feedens oppbygning, produktspråket og de reelle dataene beholdes. Makrolayouten er fasit.
- De faktiske telefonskjermbildene og KalenderScreen/TeamHomeScreen/EventDetailScreen/InboxScreen/ProfilScreen er sannheten for struktur og funksjon.
- **Presisering (eksplisitt): Produktkontrakten låser FUNKSJON og STRUKTUR, ikke visuell utforming.** Eksistensen, funksjonen, innholdet, navigasjonsrollen og hovedplasseringen til knapper, kort og handlinger skal beholdes. Men komponentenes **visuelle form er fullt åpen**: silhuett, materiale, lagdeling, radius, kant, høylys, skygge, farge, typografi, ikonbehandling, spacing og motion kan og skal redesignes. Neste agent skal nettopp skape et nytt surface-/material-/komponentspråk — «behold layouten» betyr aldri «behold kortet slik det ser ut».
- Det som redesignes fullstendig: fargebruk, bakgrunner, kortenes materialer og geometri, chips/badges, alle knappetyper, inputs/komponist/kommentarfelt, headere, tab-bar, ark og rapporteringsdock, typografisk behandling, intern spacing, borders/lys/dybde/skygger, tilstands- og overgangsanimasjoner. Små optiske justeringer inne i komponentene er tillatt.

**Semantikk (fra `src/theme/tokens.ts`, låst 2026-07-30, med presiseringer):**
- Coral `#FF5A5F` = KUN LIVE. Gull `#FFC53D` = reporterens stemme, pause, milepæler, SEIER. Mint = oss/score/HEIA/energi. Skifer `#46525C` = motstander. Mål feires i grønt/gull — aldri coral.
- Lilla (påminnelse/sosialt) og blå (info/trening) er systemfremmede og **under utforsking** — alternativer må virke i Heia-verdenen og holde semantisk forskjell mellom hendelsestyper. Velges visuelt med kontrastkontroll.
- `#02FFAB` er aldri tekst på lys flate (fill-only); blekk på neonen er `#06291E`. Lagfarge via `teamHeaderSurface()`/`swellCap`/`floodCap` i `src/shared/teamColors.ts` — algoritmen er låst, 12 kuraterte farger.

**Typografi:** Nunito er bundlet (kun ExtraBold/Bold). Regelen i koden: display for store tall. **Nunito ExtraBold i store overskrifter og utvalgte displayøyeblikk prøves** side om side med systemfont; brødtekst/mikrotekst forblir systemfont. Må tåle Dynamic Type, ikke bli barnslig/klumpete. Sett aldri `fontWeight` sammen med Nunito-filene.

**Teknikk:** React Native 0.83, iOS + Android, bare RN (expo-unimoduler finnes: expo-image/expo-file-system), `react-native-svg` 15.15 (all gradient er SVG — ingen linear-gradient-pakke), core `Animated` med native driver (**reanimated er bevisst ikke installert**), `useReducedMotion` finnes (14 konsumenter). Ingen nye pakker/native avhengigheter uten begrunnet gevinst/kostnad. RN-oversettbarhet er et krav, men **skal ikke brukes som begrunnelse for å forenkle bort art directionen** — først bevises riktig design, så finnes produksjonsoversettelsen. Bevist teknikk: `src/components/match/MatchGround.tsx` (7 stablede SVG-lag med PHASE-tabell) er DNA-et for enhver ny grunnflate.

**Arbeidsregler (gitt av Brage, gjelder):**
- Ingen produksjonskode, ingen repoendringer, ingen commit uten eksplisitt beskjed.
- Ingen lange forsvarstaler, ingen selvgodkjenning («denne står jeg inne for»). Vis kvaliteten.
- Hent og les faktiske kilder (artifact-HTML via WebFetch) før noe tegnes — aldri bygg fra prosa eller hukommelse.
- Én ekte skjerm om gangen, 393 pt, render i 100 %, sammenlign side om side med referansene, minst tre reelle interne designrunder før noe vises.
- Telefonen avgjør. Autoritetsregelen fra STATUS-HANDOFF gjelder: prototype = intensjon/hierarki/rytme; Heias system = komponenter/ikoner/typografi/språk; native = interaksjon; telefonen = sluttresultatet.
- Pulsens kurveuttrykk er parkert av Brage — rekoloreres kun, ingen ny puls-design uten at han ber om det.

## 4. Referansesettet — og nøyaktig hva hver referanse tilfører

Ingen referanse er en mal. Målet er en mer original og helhetlig Heia enn noen av dem. Alle skal syntetiseres.

| Referanse | Hva Brage responderer på | Hva den skal tilføre Heia |
|---|---|---|
| **Levende flater på neon** (claude.ai-artifact f44cbc40, «runde 3», Bold-modus) | `#02FFAB` som selve verdenen; komponerte fargesoner; lysretning øvre høyre; lokale lysbasseng; kromatisk jade-skygge; korn; kantmørkning; kremflater som står i lyset; banebuer integrert i verden og kort | Kvalitetsbaseline for **grunnflate, lyssetting, fargesoner, atmosfære, kortmateriale og detaljnivå**. Meshen (7 radialer + diagonal), `--elev`/`--rim`-systemet, blekket `#06291E`, ring-maskene. Ikke fasit for layout/hjelpetekst. |
| **Visible Progress** (grønn fasting-app) | Sterke mintgradienter mot svært lyse flater; stort mørkt blekk; mye luft; lekenhet; premium gjennom enkelhet og kontrast; gradient inne i avgrensede elementer | Ink-typografi i displaystørrelse, luft, lekne runde former, **gradient brukt inne i komponenter** (ringer, knapper), ikke bare som tapet. |
| **Green Healer** | Én fargeverden som blir atmosfærisk og gjenkjennelig over mange skjermer; mykt lys; tonal dybde; bakgrunnen som aktiv merkevare | Atmosfære, dis, myk tonal dybde, **ett sammenhengende univers** gjennom alle skjermene. |
| **Det oransje sportsdesignet** | Gradienthåndverk; sportsenergi; lys, dybde, bilder og mettede fargefelt i samspill; visuelt mot | **Håndverket, ikke paletten**: fargefelt-selvtillit, fotografi integrert i feltet (sort→farge-dybde), store tall, pill-nav med tydelig aktiv tilstand. |
| **Haaland-referansen** (teal/grønn) | Sportslig atmosfære gjennom tydelige lag; store visuelle øyeblikk; rolige innholdsflater; bakgrunn som skaper en verden rundt funksjonen | Lagdeling, glass-lyse paneler på atmosfærisk grunn, **verden rundt funksjonen**, store øyeblikk som hierarki. |
| **Den grønne Kalender-referansen** (render fra Levende flater) | Nærmest hypotesen for hverdagens grunnflate: levende overganger Heia-grønn → mint → aqua → lysere partier; kremflater for lesero | Hverdagens grunn; «kampen er den lyseste flaten, skiller seg ut ved lys, ikke mørke». |
| **Goalify** (Behance, «Football Live Score») — NY | Nivået av helhet og håndverk: ulike materialroller uten tap av slektskap; **nested surfaces og lagvis dybde; presise konturer, indre høylys, subtile kanter; transparens og tonal variasjon; bilder integrert i produktspråket; komponentformer tegnet for produktet; restriktiv bruk av sterk farge; typografi/ikoner/whitespace som premium; hele produktet som ETT konsept** | **Kvalitetsmål for materialhåndverk, lagdeling og helhet** — ikke et argument for å kopiere paletten, holde `#02FFAB` tilbake eller gjøre Heia til en glass-app. Ikke fargene, glasset, layouten eller fotballproduktet. Dette er sjekklisten neste runde måles mot. |
| **Heias faktiske telefonskjermbilder** (Hjem, Kalender, Kampen live, Varsler, Profil — 2026-08-21) | Produktets reelle struktur, innhold, navigasjon og funksjonelle sannhet | **Produktfasiten.** Alt innhold er ekte: HAM-KAM G14 · Fotball · 4 medlemmer; Jarle Weium (Trener); Mot Ottestad 22:00 Briskeby; Kamp mot Lyn 4–1; Mot Bolle 16–6; Natalia (Forelder) med Ridabu G10/Stange G10; Varsler-badge 15; KAMP-knappen med «Sesongen»-etikett. |

Referansebildene ligger i samtalen de ble gitt i — be Brage legge dem ved på nytt i neste samtale (de er ikke lagret i repoet).

## 5. Lenker til alle fase 2-artifacts

| Artifact | Lenke | Status |
|---|---|---|
| Levende flater på neon (referanse-lab, runde 3) | https://claude.ai/code/artifact/f44cbc40-8c7e-41e1-a1f7-3ad621ec7a36 | Referanse. Kilden kan hentes med WebFetch (138 KB) — gjør det før tegning. |
| Levende flater (kampskjerm-prototype, mørk fasit) | https://claude.ai/code/artifact/d8592f04-c731-4994-9b24-f0296910412c · repo: `docs/prototypes/kampskjerm/index.html` | Frossen fasit for mørk kampverden. |
| Heia-verden-laben | https://claude.ai/code/artifact/9708ea89-4fff-4add-a7e1-f1161b9dd057 | Beholdes som **teknisk kontrollverktøy** (pulsnivåer, 12 lagfarger gjennom `teamHeaderSurface`, live kontrastmåling, mørk/lys kamptvilling). Ikke visuell fasit. |
| En dag i Heia | https://claude.ai/code/artifact/a22eadf5-ea3e-4dde-a0cb-eaf35f2383ee | **AVVIST.** |
| Den første flaten (Kalender, runde 4) | https://claude.ai/code/artifact/6a202afd-60a6-4c24-b97f-f83b26bf46cd | **Avvist som endelig retning.** Grunnflaten var nærmere. |
| Heia Kritt (retning 1, hele appen) | https://claude.ai/code/artifact/4b5c5d22-c19b-4e7c-a65d-6e5216c47aa8 | **Ikke godkjent.** Navigerbar, demo-pill øverst; hash: `#kal`, `#kamp-rep`, `#kamp-dyp`, `#kal-shny` … |
| Heia Flomlys (retning 2, hele appen) | https://claude.ai/code/artifact/80cbccb1-86c8-4310-962b-95439bb66dc7 | **Ikke godkjent.** Samme DOM som Kritt, annet stilark. |
| Heia Lysstein (Hjem, live, runde 4 → 5) | https://claude.ai/code/artifact/8708c090-0ff6-45c7-adde-7267fd8c2c3f | **FORKASTET** (§13). Runde 4 fikk 6,5/10; runde 5 ble glossy spill-UI. Beholdes kun som eksempel på hva som IKKE skal gjøres. |

Merk: de lokale HTML-kildene til artifactene lå i en sesjonsmappe som ikke overlever. Artifactene er de kanoniske kopiene; kilden hentes med WebFetch på lenken.

## 6. Hva som ble avvist i første artifactrunde, og hvorfor

«En dag i Heia» ble avvist fordi den var «en glatt grønn bakgrunn, generiske kremfargede rektangler, grove ikoner (emoji/unicode i UI-krom), svak typografi og nesten ingen synlig art direction» — nøyaktig det briefen forbød: en sterk farge malt flatt bak generiske kort. Diagnosen (bekreftet av Brage):
1. Lyssystemet ble bygget fra **prosa**, ikke fra den faktiske Levende flater-kilden.
2. Verifiseringen var QA (renderer det, passerer kontrasten), ikke designkritikk mot referansene.
3. Bredde drepte håndverk: 13 rammer + A/B + lab i én pass.
4. Presentert som visuelt bevis, men holdt wireframe-nivå.

Korrigeringen som ble avtalt: faktisk kilde som baseline, én skjerm, kritikk mot hele referansesettet i 100 %, minst tre interne runder, ekte SVG-ikoner, Nunito riktig, kromatiske skygger.

## 7. Hva «Heia Kritt» og «Heia Flomlys» forbedret

- Grunnflaten: synlige, komponerte fargesoner (sol → lime → Heia → gress → aqua → teal), lysretning, banemarkering/glødringer, kantmørkning, korn, mer atmosfære.
- Ekte SVG-ikoner (Lucide-geometri), Nunito i display og store titler, ink-typografi rett på feltet.
- Komplette, navigerbare flater med ekte innhold: Hjem (live-inngang, komponist, VIKTIG, måløyeblikk med foto, resultatpost), Kalender («+ Ny», ukevelger, fortid/i dag/trening/kommende), Kampen (scoreboard, puls rekolorert, kampforløp med foto, sticky resultat, HEIA!/RAPPORTER/LUKK, reporterdock, lys/dyp verden), Varsler, Profil, ark (Ny hendelse, Kommentarer, Korriger stillingen, Rapporteringsvalg).
- To genuint forskjellige systemer på identisk DOM: Kritt (sparket hjørne, dobbel krittstrek, markørplugg-chips, avsparkmerke ⊙, linje-tab-bar, Stadium Light-kamp) og Flomlys (store radier, borderløse lysbrønner med gulv-glød, glødeprikk-chips, lysstripe, svevende glass-dock, kveldskamp i smaragd).
- Fotografiet ble abstrahert (klippestriper, bokeh-tribune, flomlys-bloom, ball i fart) etter at strekfigurer ble forkastet som clipart.

## 8. Hvorfor ingen av dem er godkjent

Brages vurdering: begge føles fortsatt som **eksisterende standardkomponenter med en tematisk effekt lagt oppå** —
- generiske avrundede kremkort; standard pills og chips; like radier og overflater overalt; enkel drop-shadow/glød; svært rene, glatte digitale fargefelt;
- banestreker/lys brukt som **dekor**, uten at komponentenes egentlige form og materiale blir særpreget;
- for lite nyansering mellom informasjon, sosialt innhold, kamp, bilder og handlinger.
- «Krittstreker alene er ikke et komplett produktkonsept. Glød alene er ikke et materialsystem.»

Fables egen diagnose (erkjent): ett overflatenivå i stedet for nestede lag; hierarkiet ble forsøkt løst med farge i stedet for med materialer, luminans, blekk, lokal lyssetting og transparens (konklusjonen er ikke mindre `#02FFAB`, men bedre materialer); de fotoløse flatene fikk ikke et materialspråk som bar dem alene; bredde-feilen gjentatt; for mild selvkritikk (godtok «sammenhengende» som «premium»).

## 9. Kjernediagnosen nå

**Bakgrunnen er nærmere. Surface-, material- og komponentspråket er hovedproblemet.** Neste arbeid handler om farge, materialer, overflater, chips, kort, knapper, bilder, typografi, ikoner, lys og detaljering — innenfor den låste makrolayouten.

**Presisering (eksplisitt): Fotografi er et løft, ikke en forutsetning.** Foto skal integreres premium når ekte kamp- eller lagbilder finnes (feed, måløyeblikk, kampforløp). Men Kalender, Varsler, Profil, skjemaer og tomme tilstander **må være visuelt sterke uten fotografi**. Fravær av bilder kan aldri brukes som forklaring på generiske komponenter eller lav premiumfølelse — materialspråket må bære flaten alene.

Goalify-sjekklisten (målestokk for **materialhåndverk, lagdeling og helhet** — ikke for palett, ikke for å holde Heia-fargen tilbake, ikke for å gjøre Heia til en glass-app):
- ulike materialroller (informasjon / sosialt / kamp / bilde / handling) uten tap av slektskap
- nested surfaces og lagvis dybde — kort i kort, glass over foto
- presise konturer, indre høylys, subtile kanter, hairlines
- transparens og tonal variasjon inne i komponenten
- bilder integrert i produktspråket
- komponentformer som føles tegnet for Heia (score-kapsel, tid-chip, HEIA-knapp, tab-bar)
- restriktiv, bevisst bruk av **aksentfargene** (coral, gull, lagfarge) — reservert for det som skal trekke blikket. Gjelder aksentene, ikke `#02FFAB`-verdenen, som står.
- typografi, ikoner og whitespace som skaper premiumfølelse
- hele produktet som ett konsept, ikke et UI-kit over en gradient

## 10. Produktkontrakten gjelder fortsatt

Ekte layout, knapper, funksjoner, innhold, navigasjon og plasseringer beholdes. Ingenting flyttes, fjernes eller finnes opp. (Ett tidligere avvik ble foreslått — lagheaderen som lys i verdenen i stedet for farget plate — det er ikke avgjort; headere er på redesign-listen, men strukturen står.)

## 11. Neste oppgave i ny samtale

1. **Ingen ny appomfattende prototype.** Ingen panel-lab, ingen miniatyrer.
2. **Først: undersøk og design Heias originale material- og komponentspråk.** Hva ER en Heia-flate, en Heia-chip, en Heia-knapp, et Heia-bilde, en Heia-tab-bar — tegnet for produktet, med lag, kanter, høylys, tonal variasjon og materialroller. Syntetiser alle referansene; kopier ingen.
3. **Én ekte skjerm om gangen, i full 393 pt-størrelse**, på den faktiske strukturen og det ekte innholdet. Start der komponentbredden er størst (Hjem eller Kampen), eller der Brage peker.
4. Kort, chips, knapper, input, bilder og navigasjon må nå **Goalify-/Dribbble-nivå i håndverk uten å kopiere**.
5. Arbeidsform: hent kilder (WebFetch av Levende flater på neon + de to retningene) før tegning; minst tre interne runder; render i 100 % og sammenlign side om side med referansene; vis kun kandidaten som holder; stopp for telefonkontroll. **Telefonen avgjør.**
6. Kapring-rigg som virker: headless Chrome håndhever **minimum 500 px vindusbredde** — render med `--window-size=500,852 --force-device-scale-factor=2` og beskjær til `(107,0,893,1704)`; legg `#flat`-hash i fila for å fjerne presentasjonsramme. Ikke stol på `@media(max-width:430px)` i headless.

## 12. Eksplisitt status

- **Fase 2 pågår.** Ingen visuell retning er godkjent.
- Fase 3 (brand kit, omskrevet BRAND_UI.md, designsystem-oppdatering, implementeringsrekkefølge) er **ikke startet**.
- Ingen produksjonskode eller `STATUS-HANDOFF.md` er endret i designsporet. Dette dokumentet er det eneste som committes fra designsporet.
- Åpen gjeld som hører til designsporet (fra STATUS-HANDOFF): pulsens uttrykk (parkert av Brage), Stadium Light-palettbeslutningen (erstattet av nordstjernen), BRAND_UI.md er utdatert (pre-A v2) og må skrives om i fase 3.

---

## 13. Lysstein — forkastet 2026-08-22, og den nye metoden

### Hva som skjedde
Samtalen 2026-08-22 startet med en referanseaudit og tre foreslåtte materialsystemer (A «Trykk»/papir, B «Drakt»/stoff, C «Lysstein»/kantbelyste frostede plater). Brage valgte C med fire korreksjoner (integrert identitets-header, mørk røykplate som liveinngang, midlertidig Higgsfield-foto, egen varselrød på badget, ingen fokusring på HEIA!). Én Hjem-skjerm (393 pt, live) ble bygget kode-først i HTML/CSS og rendret med headless Chrome. **Runde 4 fikk 6,5/10** («standard avrundede kort med Lysstein-effekter oppå»). **Runde 5**, som skulle la materialet *forme* komponentene, ble tydelig verre: glossy mobilspill-/Candy Crush-komposisjon.

### Hvorfor Lysstein ble forkastet (Brages dom, bekreftet av Fable)
Det er ikke lenger utførelsen, men **materialspråket som er feil**. Resultatet hadde:
- synlig 3D-bevel og tykk plastkant (6 px «tykkelse»)
- glossy gradienter inne i komponentene
- oppblåste kamera-, score- og HEIA-brikker; flytende candy-knapper
- store, uniforme avrundede rektangler
- statusfelt (LIVE/VIKTIG) som så limt eller støpt på ut
- «fysisk materiale» som ble leketøy/spill-UI

Dette er det **motsatte** av referansene, som viser presise, rolige, gjennomkomponerte systemer: store kontrollerte fargesoner, matte eller forsiktig transparente flater, tynne presise kanter, nested tonalitet, sterke proporsjoner, redaksjonell typografi, fotografi integrert i komposisjonen, komponenter som er originale uten å rope.

**Hvorfor de interne rundene ikke fanget det:** kritikken målte mot egne akseptkriterier («er tykkelsen synlig? brytes konturen? tre luminanstrinn?») — en sjekkliste som belønner *mer* effekt — og referansene ble aldri rendret side om side med kandidaten under kritikk, selv om planen sa det. Når oppskriften er feil, gjør hver runde det verre. Dette er samme feil som §6 allerede dokumenterte (QA i stedet for designkritikk), gjentatt.

### Forbudt fra nå (gjelder alle videre runder)
Synlig bevel/3D-kant, plastkanter, glossy gradienter i komponenter, oppblåste brikker/kuler, candy-knapper, uniforme store avrundede rektangler, statusetiketter som ser påstøpt ut, glassmorfisme, spillestetikk, **navngitte gimmick-materialer** («Kritt», «Flomlys», «Lysstein» — ikke lag et fjerde), og flere CSS-runder innenfor samme oppskrift.

### Råingredienser som beholdes (ikke ferdig design)
- den dominante, levende `#02FFAB`-grunnen (Levende flater-meshen)
- mørkt Heia-blekk `#06291E`
- den mørke liveinngangen som kontrastpunkt
- coral KUN for LIVE, gull for viktighet; egen varselrød (`#C8102E`-klasse) på badget
- eksisterende funksjon, innhold, rekkefølge og navigasjon (produktkontrakten)
- Higgsfield-fotoet (706×420, jubel etter mål, ryggen til) som midlertidig designbevis — ikke produksjonsressurs

### Målbildet (Brage, ordrett i substans)
Dominant og levende `#02FFAB`-verden · matte, rolige, presise innholdsflater · mørkt blekk og tydelig typografisk hierarki · få, men sterke silhuetter · ingen glassmorfisme/plast/bevel/candy/spill · bakgrunnen får være energisk, komponentene gir lesero · originalitet gjennom **komposisjon, proporsjon og rollebasert form — ikke effekter** · samme funksjoner og innhold som appen; visuelle proporsjoner og intern komposisjon er åpne.

Syntesen skal hente: komposisjon og levende lys fra Levende flater; lys, fremdrift og selvsikre former fra Visible Progress; atmosfære og ro fra Green Healer; gradienthåndverk og sportsenergi fra det oransje sportsdesignet; lagdeling, typografi og bildeintegrasjon fra Haaland-referansen; den dominante mintverdenen fra Kalender-referansen; materialpresisjon, nested tonalitet og komponenthåndverk fra Goalify. Ingen referanse kopieres.

### Metodebeslutning (LÅST)
1. **Neste visuelle forsøk begynner ikke med kode.** Det er én statisk, high-fidelity Hjem-komposisjon i 393 pt, bygget med **alle referansene synlige side om side** som målestokk.
2. **Verktøy:** `design`-skillen (Claude Design-canvas i Claude Code: multi-artboard canvas publisert som artifact). Referansebildene legges inn som egne rammer ved siden av komposisjonen. **Først 2–4 lav-fi retningsrammer som Brage velger mellom; hi-fi bygges først etter valg.** Skillens egne regler gjelder: ingen falsk statuslinje, ingen emoji-ikoner (ekte SVG), ingen gradient-slop, bias mot ro. Ærlig forbehold: rammene er HTML under panseret — metodeendringen er canvaset, side-om-side-referansene og skissetrinnet, ikke renderteknikken. Figma-MCP er et bedre alternativ for statisk komp, men krever at Brage autoriserer connectoren i claude.ai først. Canva er uegnet (malgenerering).
3. `artifact-design`/HTML-artifact brukes **kun** til å implementere en allerede godkjent retning.
4. **Ingen nye skills, plugins eller pakker** uten Brages godkjenning.
5. Bildegenerering kun til foto/tekstur — aldri til å finne opp UI.
6. **Kritikkregel:** hver kandidat vurderes i 100 % med referansene ved siden av, med spørsmålet «kunne denne ligget på Behance-siden ved siden av Goalify?» — ikke «er kravene oppfylt». En runde som *legger til* effekt i stedet for å fjerne, reverteres. Komposisjon, proporsjon, typografi og rollebasert form først; effekter sist; hårlinjer og matte flater.
7. Ta så mange reelle interne runder som trengs (10 eller 45) — men etter nullstilt metode, ikke innenfor en forkastet oppskrift.
8. Telefonen avgjør fortsatt. Ingenting spres til andre skjermer før Hjem er på 9/10.

Verktøykart i sesjonen (kartlagt 2026-08-22): `design` (Claude Design-canvas-forhåndsvisning) · `artifact-design`/`artifact-diagramming` (HTML-artifacts) · Canva MCP (malgenerering/redigering) · Figma MCP (krever auth) · Higgsfield (bilde/video) · headless Chrome-rigg (§11.6). Claude Design på claude.ai/design er ikke tilgjengelig fra Claude Code-forhåndsvisningen.

### Eksterne skills vurdert (lest, IKKE installert — Brage avgjør)
Brage ba om at skills som kan hentes («Apple design skill eller hva som helst») vurderes. Ærlig vurdering etter lesing av kildene:

| Skill | Hva den faktisk gjør | Verdi for Heia-problemet |
|---|---|---|
| **`frontend-design`** (Anthropic, offisiell marketplace — ligger allerede lokalt i `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design`, ingen installasjon nødvendig) | Prosess: designplan (palett/type/layout/**signatur**) → kritikk av planen mot «generisk default» → bygg → kritikk med skjermbilder; «spend your boldness in one place», fjern ett tilbehør; AI-slop-kalibrering. | **Høy — prosessen er nøyaktig det som ble hoppet over.** Ingen visuell fasit, men tvinger plan + kritikk før kode. Skal lastes og følges i neste samtale. |
| **apple-hig-designer-skill-2026** (tristan-mcinnis, GitHub) | HIG-verdier: SF Pro 17/34 pt, 8-pt grid, 44-pt mål, tab-bar 49 pt + safe area, konsentriske radier, Liquid Glass-referanser; leverer HTML/CSS/React. | **Lav–middels.** Native-korrekthet, ikke art direction. Nyttig som *guardrail* for proporsjoner (tab-bar, touch-mål, typeskala) — løser ikke «WOW». |
| **ios-hig-design** (wondelai/skills) | HIG-sjekkliste m/ 10-poengs revisjonsrubrikk, semantiske farger, SF Symbols, reserverte gester; 11 referansefiler. | **Lav for art direction** (revisjonsverktøy). Kan brukes som native-gjennomgang *etter* at en retning er valgt. |
| **mobile-app-design** (awesome-skills) | Generiske beste praksiser (touch-mål, WCAG, RN-ytelse), skript for kontrast/touch-mål. | **Lav.** Ingen visuell retning. |
| **ui-ux-pro-max** (nextlevelbuilder) | Python-CLI som søker i database (79 stiler, 192 paletter, 74 fontpar, 119 UX-regler) og kan generere et `MASTER.md`-designsystem med «dials» (variance/motion/density). | **Middels, med risiko.** Kan gi strukturert stilvokabular og et skriftlig designsystem — men palettene/stilene er generiske og kan dra Heia mot mal-look og bort fra den låste identiteten (`#02FFAB`, blekk, banebuer). Hvis den brukes: kun som *ordbok* for å beskrive retningen presist, aldri som kilde til farger/komponenter. Krever python3 (finnes). |

**Konklusjon (Fable, ærlig):** ingen av disse skillene leverer art direction på referansenivå — de gir enten native-regler eller stildatabaser. Det som manglet var ikke en skill, men metoden: referansene side om side, retning valgt på lav-fi, og kritikk mot referansene i stedet for mot egne kriterier. Anbefaling: (1) bruk `frontend-design` (allerede lokalt) for prosess, (2) `design`-canvaset for komposisjonen, (3) eventuelt én HIG-skill som guardrail etter retningsvalg — kun hvis Brage godkjenner installasjon. Kilder: [apple-hig-designer-skill-2026](https://github.com/tristan-mcinnis/apple-hig-designer-skill-2026), [wondelai/skills ios-hig-design](https://github.com/wondelai/skills/blob/HEAD/ios-hig-design/SKILL.md), [awesome-skills/mobile-app-design](https://github.com/awesome-skills/mobile-app-design), [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [oversikt over UI/UX-skills](https://pasqualepillitteri.it/en/news/576/claude-code-skills-design-uiux-guide).
