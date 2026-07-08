# Heia — premium UI research: skills, plugins, templates, referanser

_Opprettet: 2026-06-07 · Fase 1 (design-research, før Home/feed-refaktor)_

**Mål:** bruke faktiske skills/plugins/templates/referanser som design- og kvalitetsgrunnlag, slik at Heia får premium, fresh, sosial sportsapp-følelse — lyst tema, sterk `#02ffab` brand energy — **uten AI-slop og uten å reskinne med en template.**

**Status nå:** ingen kode skrevet, ingen tokens endret. Dette er ren kartlegging + anbefalt arbeidsflyt.

---

## 0. Den avgjørende konteksten (les denne først)

To fakta styrer alle anbefalingene under:

1. **Heia er «bare» React Native (RN CLI 0.83), IKKE Expo, og bruker StyleSheet + egne tokens — IKKE NativeWind.**
2. **Nesten alle premium RN-templates/UI-kits i 2026 er bygget på Expo + NativeWind (Tailwind) + Reanimated.**

→ Konsekvens: **ingen** av de kommersielle templatene er «drop-in» for oss. Limet deres (NativeWind-klasser, Expo Router, EAS, expo-* moduler) matcher ikke stacken vår. Kopierer vi kode, drar vi inn nettopp den avhengighets-rotet brukeren vil unngå. **Templates = visuell referanse (moodboard), aldri kildekode.** Det er ikke en begrensning å beklage — det er det som holder Heia særegen.

---

## 1. Verifisert lokalt installert (null/lav risiko — bruk dette)

Den **offisielle Anthropic-marketplacen er allerede installert** (`~/.claude/plugins/marketplaces/claude-plugins-official`). Disse er ekte, reviewbare, og kan aktiveres uten npm/native-risiko.

| Ressurs | Hva det er | Passer Heia? | Hvordan bruke |
|---|---|---|---|
| **`frontend-design`** (skill, installert) | Anthropics egen anti-AI-slop-skill: tving en *bold aesthetic direction*, distinkt typografi, dominante farger + skarpe aksenter, motion på høy-impact-øyeblikk. | **Tankegang ja, kode nei.** Den er **web-orientert** (CSS-variabler, web-fonts, cursors, scroll-triggers) — mapper ikke 1:1 til RN. | Bruk som **designfilosofi og slop-definisjon**, ikke som implementasjon. Verdifullt sitat derfra: «aldri Inter/Roboto/system-font default, aldri purple-gradient-på-hvitt, aldri predictable layouts.» |
| **`figma`** (plugin, design-kategori) | Les Figma-filer, hent ut design-tokens, oversett design → kode. | **Ja** — dette er den *riktige* måten å bruke «iOS 26 Figma UI kit»-idéen på. | Aktiver hvis vi tar inn en Figma-referanse (iOS 26-kit / eget moodboard). Henter spacing/tokens/komponentanatomi som tekst vi kan sammenligne mot `theme/tokens.ts`. |
| **`code-review`** *(du har den allerede som `/code-review`)* | Multi-agent korrekthet + opprydding. | **Ja** | **Slop-audit-port** på hver design-diff (se pipeline §6). |
| **`simplify` / `code-simplifier`** *(du har `/simplify`)* | Fjerner one-off-styles, inkonsistens, duplisering. | **Ja** | Kjør etter hver skjerm-refaktor for å fange random spacing/farger/nested views. |
| **`verify` / `run`** *(du har dem)* | Kjør appen, ta screenshot, bekreft i ekte simulator. | **Ja** | Steg 1 i pipelinen: screenshot av dagens skjerm før kritikk. |
| **`expo`** (plugin) | Expos offisielle RN-skills (Router, NativeWind-oppsett, EAS, SDK-oppgradering). | **Delvis.** Vi er bare RN, ikke Expo. RN-patterns/debug er nyttig; Expo Router/EAS/NativeWind-delene er **ikke** relevante. | Valgfritt referanseoppslag for RN-patterns. Ikke adopter Expo-konvensjoner. |
| **`skill-creator`** (plugin) | Lag/forbedre egne skills. | **Ja, senere** | Hvis vi vil kapsle «Heia design rules» i en gjenbrukbar skill (se §6, valgfritt steg). |

**Tilgjengelige MCP-er i dette miljøet** (krever bare auth, ingen kode): **Figma MCP** (`mcp__claude_ai_Figma`) — samme nytte som figma-pluginen, design-referanser/tokens. **Canva MCP** og **Higgsfield** (bilde/video-gen) — kun relevant for *innholds*-assets (f.eks. tomme-tilstand-illustrasjoner, app-ikon-eksperimenter), ikke for selve UI-koden.

---

## 2. Tredjeparts skills (ekte, men install-at-own-risk)

ChatGPT nevnte disse. De **finnes**, men er **ikke** i den offisielle marketplacen — de er community-repoer. Behandle som ekstern kode: les SKILL.md før bruk, ikke gi dem fri tøyle.

| Ressurs | Hva det er | Vurdering for Heia |
|---|---|---|
| **UI/UX Pro Max** (`nextlevelbuilder/ui-ux-pro-max-skill`) | Søkbar design-database: ~50+ stiler, 160+ palettar, 57 font-par, 99 UX-guidelines, fleire stacks. Python-CLI som Claude kaller for å hente designretning. | **Nyttig som design-*database*, ikke som kodegenerator.** Bruk den til å *informere* paletter/UX-valg og gi Claude struktur før refaktor — men la den aldri skrive Heia-komponenter direkte (RN-output blir generisk). Tredjeparts → review repoet før install. |
| **«React Native Design» skill** | Community-skill for RN UI / Reanimated-mønstre. | Marginal. Vi har allerede primitiver + tokens. Bruk høyst som referanse for *animasjons*-mønstre når vi tar Reanimated (senere). Ikke en prioritet. |
| **alirezarezvani/claude-skills (337-skill mega-repo)** | Enormt skill-samlerepo. | **Unngå.** Kvantitet > kvalitet, vanskelig å revidere, høy slop-risiko. |

---

## 3. Claude Design (Anthropic Labs) — egen kategori

**Hva:** Anthropics nye conversational visual-tool (research preview, Pro/Max/Team/Enterprise). Bygger et designsystem ved å lese kodebasen din, lar deg prompte fram designs/prototyper på et canvas, outputter **HTML/CSS/JS**.

**Vurdering for Heia:**
- **Sterk til:** rask *utforskning* av hvordan en premium Heia-feed/profil kan se ut — generere 3–4 retninger å reagere på, før vi rører RN-kode. Den leser tokenene våre, så den kan respektere `#02ffab` + lyst tema.
- **Svakhet:** output er **web (HTML/CSS)**, ikke RN. Det blir **mockup/retningsgiver**, ikke kode vi limer inn.
- **Hvordan bruke:** som erstatning for «kjøp en Figma-kit» — bruk den til å lage Heia-moodboard/mockups vi så *implementerer for hånd* med våre egne primitiver. Krever abonnement; valgfritt.

---

## 4. Templates / UI-kits / referanser (KUN moodboard — aldri kopier)

Alle disse er Expo + NativeWind + TS. **Bruk for visuell research, ikke kode.** Lag et Heia-moodboard på 10–15 screens (feed, team-profil, bottom nav, composer, match-card, kommentarer) på tvers av disse — ikke kopier én app.

| Kilde | Hva | Pris | Bruk for Heia |
|---|---|---|---|
| **Mobbin** | 1000+ ekte iOS/web-apper, ukentlig oppdatert, egen «mobile social feed»-kategori (770+ screens). | Abonnement | **Beste research-verktøyet.** Samle ekte sosiale feed/profil/composer-mønstre. Ingen kode-risiko. |
| **gluestack market / pro** | 50+ produksjons-screens, egen Social Media-template. Expo+NativeWind+TS. | ~$99 enkelt / $199 pro | Referanse for feed-cards, profil, kommentarer, media-cards. **Ikke** kopier koden (NativeWind). |
| **Craft React Native** | Premium komponenter, rene animasjoner, design-token-system, TS+Expo+Reanimated, lifetime updates. | Premium | God referanse for *hvordan* token-system + Reanimated-polish struktureres. Igjen: studér, ikke kopier. |
| **Native Templates «Feedy»** | Social media-template, 25+ screens, stories/feed/profil. Expo. | Premium | Referanse for sosiale flows og skjerm-inventar. |
| **Instamobile** | Vertical clones (social), $99–249. | $99–249 | Lavere prioritet; mer «template-look»-risiko. |
| **iOS/iPadOS 26 Figma UI Kit** | Native spacing, tab bars, sheets, glass-kontroller, system-farger. | Gratis/Figma | **Beste native-referanse.** Ta inn via Figma-plugin/MCP for å matche ekte iOS-spacing og sheet-anatomi. |

---

## 5. Hva vi bør UNNG�å (eksplisitt)

- ❌ **Kopiere template-kode** (gluestack/Feedy/Craft/Instamobile) → drar inn NativeWind/Expo-antakelser, gjør kodebasen rotete, gir generisk look. *Dette er hovedfella.*
- ❌ **Innføre NativeWind** nå → ny toolchain + babel/metro-risiko på en RN 0.83-stack som nettopp ble stabil. Vi har StyleSheet+tokens som funker.
- ❌ **`expo-blur`** → Expo-bundet; vi er bare RN. (Hvis glass først skal skje: `@react-native-community/blur` eller `@sbaiahmed1/react-native-blur` (`LiquidGlassView`, iOS 26) — men **begge er native moduler → pod install + rebuild**, samme klasse som Clipboard-krasjet. **Utsett til en bevisst native-økt.**)
- ❌ **Tunge UI-bibliotek** (UI Kitten, Paper) → generisk, sluker særpreg.
- ❌ **Mega-skill-repoer** (337-skills) → ureviderbart, høy slop-risiko.
- ❌ **La en skill skrive ferdige Heia-komponenter** → skills informerer valg; mennesket + våre primitiver skriver koden.

---

## 6. Anbefalt design-polish pipeline (Cursor + Claude Code)

Per skjerm, i denne rekkefølgen. Alt bygger på ressursene over, og holder diffene små og slop-frie.

**Forarbeid (én gang, før første skjerm):**
1. **Moodboard:** 10–15 referanse-screens fra Mobbin + iOS 26-kit (+ evt. Claude Design-mockups). Lagre som Heia-retning, ikke kopier-mal.
2. **(Valgfritt) UI/UX Pro Max** for å hente palett-/UX-guidelines som *informerer* — sammenlign mot eksisterende `theme/tokens.ts`, ikke overstyr.

**Per skjerm (start med Home/feed):**
1. **Screenshot først** — `/run` eller `/verify` → fang dagens skjerm i simulator. Be Claude kritisere som senior mobil-produktdesigner. **Ikke kod.**
2. **Design-brief** — Claude foreslår Heia-spesifikk redesign: layout / komponent / token / animasjon. Forankret i moodboardet + `frontend-design`-prinsippene (bold retning, distinkt hierarki, `#02ffab` som dominant aksent på lyst tema). Fortsatt ingen kode.
3. **Begrenset implementering** — kun da: bruk **eksisterende primitiver** (`Card`, `Button`, `Chip`, `Avatar`, `ScoreBoard`…). Mangler en token/komponent → legg den i `theme/tokens.ts` *først*. Ingen one-off-farger/radii/spacing. Ikke rør logikk/Supabase/auth. Liten reviewbar diff.
4. **Slop-audit (kvalitetsport)** — `/simplify` så `/code-review` på diffen: random farger/shadows/spacing, glass-overforbruk, svak kontrast (WCAG på `#02ffab`-på-hvitt!), for mange nested views, feed-performance. Fiks kun det nødvendige.
5. **Visuell bekreftelse** — `/verify` → screenshot igjen, sammenlign mot brief + moodboard.

**Valgfritt, hvis vi vil låse disiplinen:** bruk `skill-creator` til en liten `heia-design`-skill som koder reglene (lyst tema, `#02ffab`-aksent-disiplin, kun-eksisterende-tokens, post-type-cards) — så hver fremtidig skjerm starter konsistent.

---

## 7. Anbefaling — én konkret workflow før Home/feed-refaktor

1. **Aktiver `figma`-pluginen** (eller Figma MCP) + behold dine eksisterende `/run`, `/verify`, `/simplify`, `/code-review` som kvalitetsporter. Null native-risiko.
2. **Bygg Heia-moodboard** (Mobbin + iOS 26 Figma-kit, evt. 2–3 Claude Design-mockups av feeden). Dette er «sannheten» for hvordan premium-Heia ser ut — ikke en template.
3. **Behold StyleSheet + `theme/tokens.ts` som eneste designsystem.** Skills/templates *informerer*; de erstatter ikke.
4. **Kjør pipelinen §6 på Home/feed først**, som referanseskjerm. Glass/Reanimated **utsettes** til en egen, bevisst native-rebuild-økt etter at den lyse feed-looken sitter.
5. **`frontend-design`-skillen + `/code-review`** brukes som anti-slop-vakter — ikke som generatorer.

**Kjernen:** Heia bygges for hånd med våre egne primitiver. Skills gir disiplin og anti-slop-kritikk, referanser/templates gir visuell ambisjon, Figma/Claude Design gir raske mockups å reagere på. Ingen av dem får skrive Heia-koden — det holder appen premium *og* særegen.

---

## Kilder

- [gluestack market](https://market.gluestack.io/) · [gluestack-ui pro](https://pro.gluestack.io/) · [Social Media-template](https://market.gluestack.io/apps/social-media-app)
- [UI/UX Pro Max skill (GitHub)](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) · [Snyk: Top Claude Skills for UI/UX](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/)
- [Claude Design (Anthropic Labs)](https://www.anthropic.com/news/claude-design-anthropic-labs) · [Frontend Design plugin](https://claude.com/plugins/frontend-design)
- [Native Templates «Feedy»](https://www.native-templates.com/templates/social-media) · [CatDoes: 12 Best RN Templates 2026](https://catdoes.com/blog/react-native-templates)
- [@react-native-community/blur (npm)](https://www.npmjs.com/package/@react-native-community/blur) · [@sbaiahmed1/react-native-blur (LiquidGlassView)](https://github.com/sbaiahmed1/react-native-blur) · [expo-blur](https://docs.expo.dev/versions/latest/sdk/blur-view/)
