# Heia — design-notater (ChatGPT-historikk + reality-check)

_Opprettet: 2026-06-07 · Fase 1 (design-baseline)_

> Denne fila har to deler:
> 1. **ChatGPT-historikken** — designretningen Brage diskuterte med ChatGPT, organisert men ikke endret i substans.
> 2. **Claude reality-check** — vurdering mot den faktiske kodebasen, slik at baseline settes på riktig grunnlag.
>
> Del 1 er innspill. Del 2 er kritikk av innspillet. Baseline (egen fil, `docs/design-system.md`) settes av Brage etterpå.

---

# DEL 1 — ChatGPT-historikken

## Kjerneidé: bygg et stramt visuelt system først, så implementer innenfor det

Ikke be AI «gjøre appen penere» — det gir AI-slop. Definer et stramt system, og la AI implementere innenfor systemet. Alt skal gå gjennom Heia-tokens og Heia-komponenter; AI får aldri finne på nye farger.

## Designretning: «sports social premium»

- **Kjernefølelse:** gøy, sosialt, energisk, premium, lagfølelse.
- **Visuelt tema:** mørk / nesten sort base + neon grønn identitet + glass-lag + store myke cards + små sportslige detaljer.
- **Referanser:** Strava-energi + BeReal-sosialitet + Apple Liquid Glass + Nike/EA Sports-polish + norsk klubbfølelse.
- **Unngå:** generisk startup/SaaS-app, kjedelig klubb-adminverktøy.

## Apple Liquid Glass — ja, men kontrollert

iOS 26 introduserte Liquid Glass (translucent/glass-elementer i navigasjon, kontroller, widgets). Kritisert for lesbarhet når for transparent; Apple justerte mot mer «frosted».

- Ikke lag hele appen glass. Bruk glass som **premium-lag**, ikke hovedlayout.
- **Bruk glass på:** bottom nav, top header, modals, invite/join-card, match result card, floating + button, små status-pills, profil/team-switcher.
- **Ikke bruk glass på:** lange feeds, teksttunge cards, alt som skal leses raskt.
- I React Native: `expo-blur` (BlurView) er naturlig start.

## Foreslått fargesystem (ChatGPT v1)

```
background:       #050706
surface:          #0B0F0D
surfaceElevated:  #111713
heiaGreen:        #39FF88
heiaGreenSoft:    #B7FFD4
textPrimary:      #F4FFF7
textSecondary:    #A8B8AD
borderSubtle:     rgba(255,255,255,0.08)
glass:            rgba(255,255,255,0.08)
glassStrong:      rgba(255,255,255,0.14)
```

- **Form:** store avrundede flater, 20–28 px radius. Ikke små corporate boxes.
- **Typografi:** stor, tydelig, litt sporty. Systemfont først, sterkt hierarki:
  - Screen title 30–34 bold · Card title 18–22 semibold · Meta 13–15 · CTA 16–17 semibold.
- **Motion (Reanimated, viktigere enn fancy UI):** cards popper litt ved press; button mikro-bounce; tab-bytte smooth scale/fade; resultater «scoreboard animate»; pull-to-refresh med Heia-grønn glow.

## Heia sitt visuelle språk

1. **Dark stadium mode** — nesten sort, ikke ren svart. Føles som kveldskamp/flomlys.
2. **Neon green identity** — grønn på active tab, CTA, live-indikatorer, score-highlights, badges, reactions, progress. Ikke overalt — da mister den kraft.
3. **Glass layer** — premium iOS-lag: bottom nav, modal sheets, floating action menu, team switcher, invite code card.
4. **Social cards** — feed-cards må føles som sosialt innhold, ikke admin-posts: avatar/team-crest, author + role, time, stort tydelig innhold, reactions/comments, post-typer («kamp», «trening», «beskjed», «resultat»).
5. **Sport-specific signature components** — match result card, player/member shoutout, training reminder, team invite card, «Heia moment»/celebration, live match update.

## Foreslåtte Heia-primitiver

`HeiaScreen`, `HeiaCard`, `HeiaGlassCard`, `HeiaButton`, `HeiaPill`, `HeiaAvatar`, `HeiaTeamHeader`, `HeiaBottomNav`, `HeiaComposer`, `HeiaMatchCard`.

## Foreslått stack for polish

- Design/komponentlag: NativeWind **eller** StyleSheet + tokens.
- `expo-blur` / `@react-native-community/blur`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`, `lucide-react-native` eller custom icons, `@shopify/flash-list` for feed-performance.
- Ikke tungt UI-bibliotek (UI Kitten/Paper blir generisk). Bruk egne primitiver.

## Research-verktøy / referanser (ikke kopier — lag moodboard)

- **Mobbin** — ekte app-referanser (1000+ apper, mobile social feed-kategori). Lag Heia-moodboard av 10–15 screens: home feed, team profile, bottom nav, notifications, invite flow, composer, match result, member list, comments/reactions.
- **iOS/iPadOS 26 Figma UI Kit** — native spacing, tab bars, modals, sheets, glass-kontroller, ikon-styling.
- **gluestack social media template** — referanse for feed cards, profile, comments, media cards (ikke bruk hele templaten).
- **Native Templates** — se hvordan proffe templates strukturerer onboarding/theming/auth.

## Claude Code / Cursor skills (anti-slop quality gates)

- **Expo Skills** — RN-patterns, build/debug, Expo-konvensjoner.
- **React Native Design skill** — polished cards, animated pressables, tabs, gestures, Reanimated 3-mønstre.
- **UI/UX Pro Max skill** — hent designretning/UX-patterns *før* implementering.
- **Frontend-design / Anthropic / Vercel-skills** — bruk til å *reviewe* og finne generic AI-slop, ikke til å lage design.

## Foreslått workflow per skjerm (4 steg)

1. **Screenshot først** — gi AI dagens skjerm, be om kritikk som senior mobil-produktdesigner. Ikke kod ennå.
2. **Design brief** — foreslå Heia-spesifikk redesign (layout/komponent/token/animasjon).
3. **Begrens implementering** — ikke endre business-logikk/Supabase/API; ingen one-off styles; bruk eksisterende primitiver; legg manglende tokens/komponenter til *før* skjerm-styles; liten reviewbar diff.
4. **Slop-audit** — sjekk egen diff for inkonsistent spacing, random farger/shadows, glass-overforbruk, svak accessibility, for mange nested views, feed-performance. Fiks kun det nødvendige.

## ChatGPT sitt «neste trekk»

Lag en `design/heia-visual-foundation`-branch: audit eksisterende UI → `src/design/tokens.ts` → primitiver → refaktorer kun Home/feed først → ikke rør logikk/Supabase/auth/RLS/DB. Oppsummer struktur + foreslå tokens + foreslå filer → vent på godkjenning før koding.

---

# DEL 2 — Claude reality-check (mot faktisk kodebase)

ChatGPT-rådet er **directionally bra, men skrevet blindt** — som om Heia er greenfield. Det er det ikke. Her er hva som allerede stemmer, hva som ikke gjelder, og hvilke beslutninger som faktisk gjenstår.

## Hva som allerede er gjort (ChatGPT antar bort dette)

- **Token-system finnes:** `src/theme/tokens.ts` med `colors`, `typography`, `spacing` (4px-grid), `radius`, `shadows`. Komponentene importerer fra `../theme` og bruker dem allerede. ChatGPTs «lag tokens først» er **stort sett gjort**.
- **Merkevaregrønn er satt:** `heia: #02ffab` (+ `heiaPressed #00D492`, `heiaSoft`). Allerede en elektrisk mint/neon. Vi trenger **ikke** ChatGPTs `#39FF88` — vår er etablert og brukt i feed-roller, live-badges osv. Ikke bytt hex uten grunn.
- **Primitiver finnes:** `Card`, `Button`, `Chip`, `Avatar`, `ListRow`, `SectionHeader`, `TeamHeader`, pluss sport-spesifikke (`ScoreBoard`, `LiveBadge`, `LiveMatchBanner`, `MatchEventRow`, `EventCard`, `RSVPBar`). ChatGPTs «bygg HeiaCard/HeiaButton/…» er i praksis allerede der — bare uten `Heia`-prefiks. Rename er kosmetikk, ikke verdi.

**Konsekvens:** ChatGPTs «lag visual-foundation fra scratch»-branch er feil utgangspunkt. Riktig utgangspunkt er **migrér/forskyv eksisterende system**, ikke bygg nytt ved siden av.

## Den ene store, lite reversible beslutningen: lyst vs. mørkt

Dette er den eneste beslutningen som virkelig betyr noe, og som er dyr å snu.

- **Dagens app er LYST:** `background #F7F7F8`, hvit surface, mørk tekst. Rent, lyst iOS-look.
- **ChatGPT vil ha MØRK «stadium»-base** (nær sort + neon + glass). Hele glass/neon-estetikken hans henger på dette.

Å gå mørk er **ikke** «pynt» — det er en full inversjon: hver farge, hvert shadow (shadows er nesten usynlige på mørk → må erstattes av borders/elevation-flater), hver event-type-bakgrunn (`treningBg`, `kampBg`, `sosialtBg` er alle lyse pasteller — fungerer ikke på sort) må redesignes. Glass-laget gir mening *kun* på mørk base.

**Alt annet i ChatGPT-rådet er reversibelt. Dette er ikke.** Derfor er dette beslutning #1 før noe UI bygges. Mitt råd: ta stilling bevisst, ikke drift dit via enkeltskjermer.

## Glass/blur og motion har en reell kostnad ChatGPT underkommuniserer

Memory + STATUS-HANDOFF: native moduler har vært gjentatt smerte (Clipboard-krasj i RN 0.83, «aldri build i bakgrunnen», bruker kjører Metro selv, første RN 0.83-oppstart 1–2 min).

- `expo-blur` / `@react-native-community/blur` = **ny native modul → pod install + rebuild**. Samme klasse problem som Clipboard. Ikke en CSS-toggle.
- `react-native-reanimated`, `gesture-handler`, `flash-list` = **alle native → hver sin rebuild**. Ikke installert nå.
- `react-native-svg` **er** installert (+ transformer). Ikoner via SVG er trygt.

**Konsekvens:** glass og Reanimated-motion er bra mål, men de er native-investeringer, ikke quick wins. Planlegg dem som bevisste rebuild-økter (forgrunn, når Brage er klar), ikke noe som sniker seg inn i en design-diff.

## Liten reell gjeld å rydde

Et fåtall komponenter har fortsatt inline-hex utenfor tokens (`EventCard`, `Avatar` m.fl. — bl.a. `#6366F1`, `#DC2626`-familier). Lite, men ekte. Migrér disse inn i tokens **uansett** lys/mørk-beslutning.

## NativeWind: nei (for nå)

ChatGPT nevner «NativeWind eller StyleSheet+tokens». Vi har allerede StyleSheet+tokens som fungerer og er konsistent. Å innføre NativeWind nå = ny toolchain + babel/metro-config-risiko på en RN 0.83-oppsett som nettopp ble stabil. Ingen gevinst som rettferdiggjør risikoen. Behold StyleSheet+tokens.

## Hva jeg ville gjort som baseline (forslag — Brage avgjør)

1. **Bestem lys vs. mørk først.** Resten avhenger av det. (Anbefaling: hvis «stadium/kveldskamp»-følelsen er kjernen i merkevaren, er mørk verdt inversjonskostnaden — men da committer vi til den, ikke halvveis.)
2. **Forskyv eksisterende tokens** til valgt retning i `src/theme/tokens.ts` — ikke ny `src/design/`-mappe ved siden av. Én sannhetskilde.
3. **Migrér de få inline-hex-komponentene inn i tokens.** Billig, gjøres uansett.
4. **Refaktorer kun Home/feed først** (enig med ChatGPT her) som referanseskjerm.
5. **Utsett glass + Reanimated** til en bevisst native-rebuild-økt etter at lys/mørk + feed-look sitter. Ikke bland inn i første design-diff.
6. **Skriv baseline i `docs/design-system.md`** når valgene er tatt.

## Hvor ChatGPT har rett (verdt å beholde)

- «Alt gjennom tokens/komponenter, AI finner aldri på farger» — ja, hold hardt på dette.
- Feed = sosialt innhold, ikke admin-posts; post-typer som visuelle moments — stemmer med produktidentiteten (Strava for ungdomslag, ikke Spond).
- Sport-spesifikke signature-komponenter som det som gjør Heia til Heia — ja.
- Mobbin-moodboard + iOS 26-kit som referanse (ikke template-reskin) — sunt.
- Screenshot → kritikk → begrenset diff → slop-audit som arbeidsflyt — bra disiplin.
