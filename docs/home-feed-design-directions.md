# Heia — Home/feed designretninger (premium light)

_Opprettet: 2026-06-07 · Fase 1 · moodboard/mockup-utforskning før refaktor_

**Ingen kode her.** Dette er 2–3 konkrete premium light-retninger for Home/feed, forankret i [design-research-premium-ui.md](design-research-premium-ui.md) og begrenset av faktisk stack.

**Constraints (hardt):** RN CLI 0.83 · StyleSheet · [src/theme/tokens.ts](../src/theme/tokens.ts) · eksisterende primitiver (`Card`, `Button`, `Chip`, `Avatar`, `ScoreBoard`, `LiveBadge`, `LiveMatchBanner`, `FeedCard`, `TeamHeader`) · brand `#02ffab` · lyst tema. Ingen NativeWind/Expo/UI-bibliotek. Token-endringer skal være **additive**, ikke ombygging.

---

## 0. Diagnose av dagens Home/feed (utgangspunktet)

Fra [TeamHomeScreen.tsx](../src/screens/TeamHomeScreen.tsx) + komponentene:

**Layout i dag:** `TeamHeader` (liten: farget dot + navn, hairline) → `LiveMatchBanner` (hero ved live, grønn-kantet kort, stor grønn score) → `SectionHeader "Siste fra laget"` → `FeedCard`-stabel → `supportCard` (donasjon).

**Hva som allerede er bra (behold):** ett kolonne-feed, live-banner som hero med grønn score, grønn primær-knapp med mørk tekst (premium light-grep), pulserende `LiveBadge`, konsistent tokensbruk.

**Hva som trekker mot generic/SaaS (slop-tells å fikse):**
1. **Kort = radius 12 + nesten usynlig skygge** (`shadows.card`: opacity 0.06) på nær-hvit bakgrunn → svak separasjon, «hvit dashboard»-følelse. Premium-apper bruker enten større radius + rikere mykt lys, eller skarpe hairline-kanter.
2. **Pastell event-chips** (`treningBg` indigo, `kampBg` oransje, `sosialtBg` lilla i [Chip.tsx](../src/components/Chip.tsx)) — dette er den mest generiske detaljen. Tre konkurrerende pastellfarger som ikke er på-brand stjeler energi fra grønn.
3. **Grønn brukes timid** — kun liten pill, knapp, score. Brand-energien er ikke følbar i feeden.
4. **Ingen sosial energi** — `FeedCard` har ingen reaksjoner/kommentarer/post-type-identitet utover kamp-badge. Føles som oppslagstavle, ikke lagrom.
5. **Kontrast-bug (accessibility + slop-tell):** «Trener»-pillen bruker `color: colors.heia` (#02ffab) på `heiaSoft` — grønn tekst på lys grønn ligger på ~1.3:1 kontrast, **feiler WCAG grovt**. `#02ffab` er for lys til tekst på lyst. → Grønn skal aldri brukes som *tekst/tynne linjer* på lyst; kun som *fyll* (med mørk tekst) eller store flater. Dette er et gjennomgående prinsipp under.

---

## Retning A — «Stadium Light» (anbefalt)

Premium sporty editorial. Energisk, men ryddig og lys.

**1. Referanser:** Strava (nyere lyse aktivitets-cards), Nike Run Club (lyst), EA Sports FC «moments», Linear (skarp presisjon). Fra researchen: bruk Mobbin sin «sports/social feed»-kategori + iOS 26-kit for native spacing. Ikke kopier — moodboard.

**2. Hvordan feeden føles:** som å åpne et levende lagrom rett før avspark — selvsikker, rask, tydelig. Grønn dukker opp som energi-aksent (live, score, aktiv reaksjon, CTA), ikke som dekorasjon. Innhold er stort og lettlest.

**3. Layout-prinsipp:** én kolonne, sjenerøs vertikal rytme. **Boldere team-header** (større lagnavn som skjermtittel-anker, evt. lag-crest/dot større). Live-banner forblir hero. Klare seksjonsskiller med sterkt typografisk hierarki (`heading1` for skjermtittel, `label` uppercase for seksjoner). Post-type vises som **liten farget ledetekst/ikon-prikk**, ikke som pastell-fyll-blokk.

**4. Card-stil:** hvit surface, **større radius (20–24)**, 1px `borderSubtle` + litt rikere men fortsatt myk skygge → kortet «sitter» uten å skrike. Tettere intern gruppering (header/innhold/handlinger). **Lettvekts reaksjons-rad nederst** (👏/🔥/❤️ + antall) — den ene tingen som gjør feeden sosial.

**5. Grønn brand energy:** selvsikker, men disiplinert. Grønn på: aktiv reaksjon, live-score, primær-CTA, en tynn grønn «energi-rail» (3–4px venstrekant) på fremhevede/kamp-poster, pull-to-refresh-glow. Erstatt pastell-chips med **nøytral chip + farget prikk** (én aksentfarge per type, dempet) så grønn forblir den dominante.

**6. Token-endringer (additive):**
- `radius`: legg til `2xl: 28` (hero/feature-cards).
- `colors`: legg til **`heiaInk` (mørk, WCAG-trygg grønn, f.eks. ~#0A7D55)** for grønn *tekst/ikon* på lyst. Behold `heia` kun til fyll/store flater.
- `shadows`: legg til `cardResting` (litt rikere myk skygge enn dagens 0.06) for premium løft på nær-hvit bakgrunn.
- `colors`: dempe event-type-pastellene til nøytral chip-bg + separate aksent-prikkfarger (behold semantikken, fjern SaaS-looken).

**7. Komponenter som må justeres:** `FeedCard` (radius, kanter, reaksjons-rad, grønn-tekst-fix → `heiaInk`), `Chip` (nøytral + prikk i stedet for pastell-fyll), `TeamHeader` (boldere), `Card` (radius/skygge-token), evt. ny liten `ReactionBar`-primitiv (gjenbrukbar). Ingen logikk røres.

**8. Slop-risiko:** lav–middels. Faren er at «energi-rail» + reaksjoner blir generisk hvis de kopieres rått fra Strava. Motgift: hold grønn-disiplinen (én dominant aksent), distinkt typografisk hierarki, ekte norske post-typer (kamp/trening/beskjed/resultat) som visuell identitet.

---

## Retning B — «Lagrom Sosialt» (varm, foto-forward, community-first)

Mer BeReal/Instagram-light energi. Varmere, rundere, lekent.

**1. Referanser:** BeReal, Instagram (lyst), Partiful (varm, lekent), gluestack/Feedy social-templates *som visuell referanse* (ikke kode — de er Expo/NativeWind). Mobbin social-feed.

**2. Hvordan feeden føles:** som en delt lag-tråd — varm, personlig, foto-først. Folk vil scrolle for å se hverandre, ikke for å lese oppslag. Større avatarer, bilder som helt, reaksjoner/kommentarer fremtredende.

**3. Layout-prinsipp:** mer luft, rundere alt (radius `xl`/`full`), **edge-to-edge media** i kort, større avatarer (lg), «team moments» fremhevet. Lett varm off-white base i stedet for kjølig `#F7F7F8`.

**4. Card-stil:** mykere, stor radius, bilde som blør til kantene, **emoji-reaksjonsrad + kommentar-preview** synlig. Mindre skygge, mer rundhet. Profil/avatar mer dominant.

**5. Grønn brand energy:** grønn som «liv»-aksent — aktiv reaksjon, online/aktiv-indikator, CTA, lag-aksent. Litt mer leken bruk (grønn celebration-glow på «Heia moment»-poster).

**6. Token-endringer (additive):**
- `colors.background`: vurder en varmere off-white (f.eks. ~#F7F8F5) — subtil, ikke hvit-blå.
- `radius`: `2xl: 28` + bruk `xl/full` mer aggressivt.
- Samme `heiaInk` + dempede chips som A (kontrast-fix gjelder uansett retning).
- `colors`: vurder en «warm neutral» tekst-tone for varmere følelse.

**7. Komponenter som må justeres:** `FeedCard` (større omarbeiding: media-bleed, reaksjoner, kommentar-preview, større avatar), `Avatar` (lg som standard i feed), `TeamHeader`, `Chip`. Mer omfattende enn A.

**8. Slop-risiko:** **middels–høy.** Dette er retningen som lettest blir «generisk social-media-klone». Motgift: sterk Heia-identitet i post-typer + grønn-signatur + norsk klubbtone — ellers ser det ut som hvilken som helst feed-template.

---

## Retning C — «Stille Premium» (refined minimal) — dokumentert, men off-brief

Linear/Things/Apple Fitness-aktig ro: monokrom nøytraler, hairline-skiller i stedet for tunge kort, grønn som éneste signaturfarge brukt sparsomt.

**1. Referanser:** Linear, Things 3, Apple Fitness (lyst), Cron/Notion Calendar.

**2–4. Feel/layout/card:** veldig rolig, presist, mye whitespace; feed som hairline-separerte rader heller enn kort-stabel; grønn som mikro-aksent.

**8. Slop-risiko (hvorfor off-brief):** denne er *premium*, men risikerer **«admin/SaaS/quiet»** — stikk i strid med «lekent / sosialt / ikke admin / ikke Spond». Tatt med for fullstendighet og som kilde til enkeltgrep (typografisk presisjon, hairline-disiplin), **ikke** som helhetlig retning for Heia.

---

## 6+7 oppsummert: token- & komponent-endringer som gjelder uansett valg

Disse er retnings-uavhengige og bør gjøres først (de er ren forbedring):
- **`heiaInk`** mørk grønn for tekst/ikon på lyst → fikser WCAG-buggen i `FeedCard`-pillen. `heia` (#02ffab) reserveres til fyll/store flater.
- **Dempe pastell event-chips** → nøytral chip + aksent-prikk, så grønn forblir dominant brand-energi.
- **`radius.2xl: 28`** + **`shadows.cardResting`** → premium kort-løft på lyst.
Resten (varm bg, media-bleed, reaksjoner) er retnings-spesifikt.

---

## 9. Anbefalt retning

**Retning A «Stadium Light», med selektiv varme lånt fra B.**

Begrunnelse:
- **Treffer brandet:** premium + sporty + lekent + sosialt, uten å bli generisk social-klone (B sin risiko) eller admin/quiet (C sin risiko).
- **Minst ombygging:** bygger på primitivene vi har; token-endringene er additive; ingen logikk røres. Lav diff = lett å slop-auditere.
- **Grønn får mening:** disiplinert aksentbruk gjør `#02ffab` til identitet, ikke pynt — og kontrast-fixen (`heiaInk`) løser et reelt accessibility-problem samtidig.
- **Sosial uten å være klone:** den ene `ReactionBar` + norske post-typer gir lagrom-følelse uten å kopiere Instagram.

**Lån fra B inn i A:** litt varmere off-white vurderes, og «Heia moment»/celebration-post som signatur-korttype senere.

**Neste steg (når du har valgt):** kjør pipelinen fra [design-research-premium-ui.md](design-research-premium-ui.md) §6 på `FeedCard` først som referansekort — screenshot → brief → liten diff (start med de retnings-uavhengige token-fixene) → `/simplify` + `/code-review` → `/verify`. Glass/Reanimated forblir utsatt til egen native-økt.
