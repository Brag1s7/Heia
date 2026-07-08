# Heia FeedCard — referansekort-spesifikasjon («Stadium Light», lyst)

_Opprettet: 2026-07-08 · Fase 1 · proof-of-direction før bred Home/feed-refaktor_

**Retning:** A «Stadium Light» — **lyst, fresh, sosialt**, litt varme lånt fra B, men ikke Instagram/BeReal-klone. Premium light sports-social, team-first, lekent, tydelig Heia.

**Constraints:** RN CLI · StyleSheet · [tokens.ts](../src/theme/tokens.ts) · eksisterende `Card/Button/Chip/Avatar/ScoreBoard/LiveBadge/LiveMatchBanner` · brand `#02ffab` · lyst tema. Ingen native modules · ingen glass/reanimated · ingen ny designsystem-mappe · ingen template-kode · ingen logikk/API/auth/navigation-endring.

**Datagrunnlag (viktig):** `FeedItem` ([types.ts:106](../src/shared/types.ts#L106)) har **ingen** reaksjon/kommentar-felt, og typene er `melding | bilde | paaminnelse | resultat | match_event | match_start | match_end`. → ReactionBar er **presentasjons-only** nå (ingen tall-wiring før Fase 2), og post-type-markør vises **kun** på meningsbærende typer.

---

## 1. Endelig FeedCard-layout (topp → bunn)

```
┌─────────────────────────────────────────────┐  ← kort: surface, radius.xl (24)
│ [rail]  ●Avatar  Navn  ·Trener              │     borderSubtle + shadows.cardResting
│         md(40)   time siden      [type-mark] │
│                                              │
│  Innhold — body, lineHeight 22               │
│  (resultat/match: litt større + semibold)    │
│                                              │
│  ┌────────────────────────────────────────┐ │  ← media (valgfri): radius.lg,
│  │            bilde 16:9 ~220h            │ │     litt større enn i dag (varme fra B)
│  └────────────────────────────────────────┘ │
│  ───────────────────────────────────────────│  ← hairline borderSubtle (kun når reaksjoner vises)
│  👏 Heia          💬 Kommenter               │  ← ReactionBar (lettvekt, presentasjons-only)
└─────────────────────────────────────────────┘
```

**Anatomi:**
- **Header-rad:** `Avatar` md (40) + kolonne {navn-rad, tid}. Navn = `body` semibold `textPrimary`. Rolle («Trener») = liten pill, `heiaSoft` bg + **`heiaInk` tekst** (kontrast-fix). Tid = `caption` `textTertiary`.
- **Type-markør (høyre i header, betinget):** vises **kun** for `resultat`, `match_event/start/end`, `paaminnelse`. `melding` og `bilde` får **ingen** markør (anti-slop: ikke badge alt). Nøytral chip + aksent-prikk (se §3).
- **Innhold:** `body`, lineHeight 22. For `resultat`/`match_*`: `fontSize 17`, semibold (som dagens `matchContent`).
- **Media (valgfri):** litt større enn i dag (~220h), `radius.lg`, `marginTop md`. Varme fra B = mer generøs media, men fortsatt innrammet i kortet (ikke full-bleed nå — hold diff liten).
- **ReactionBar (nederst, presentasjons-only):** hairline-skille over, så «👏 Heia» + «💬 Kommenter» som affordances. Ingen fabrikerte tall.

---

## 2. Radius / border / shadow

| Egenskap | Verdi | Hvorfor |
|---|---|---|
| Kort-radius | `radius.xl` = **24** (finnes) | Premium, mykt — større enn dagens `md`(12), uten å bli «boble». Ingen ny radius trengs for selve kortet. |
| Border | 1px **`borderSubtle`** (ny, ~`#EDEEF0`) | Skarp, rolig avgrensning på nær-hvit bakgrunn — premium light-signatur. |
| Shadow | **`shadows.cardResting`** (ny) | Mykt ambient-løft så kortet «sitter». Erstatter dagens nesten-usynlige `shadows.card` (0.06) på feed-kort. |

Prinsipp: **border + myk skygge sammen** gir premium separasjon på lyst — ikke tung skygge alene.

---

## 3. Chip — nøytral bakgrunn + aksent-prikk

Gjelder to steder, men samme visuelle regel:

**A) Event-`Chip`** ([Chip.tsx](../src/components/Chip.tsx), brukt i kalender/EventCard) — retnings-uavhengig fix:
- Bakgrunn: **nøytral** `surfaceMuted` (ny, ~`#F1F2F4`) for `trening/kamp/sosialt/annet`.
- Tekst: `textSecondary`, `label`-stil (uppercase).
- **Prikk (6px, radius.full) foran teksten** bærer fargen — gjenbruk eksisterende `treningText`/`kampText`/`sosialtText` som prikkfarge. Semantikken beholdes, pastell-fyllet forsvinner.
- `live` beholder sin røde behandling (semantisk kritisk).

**B) FeedCard type-markør** (egen, lettere) — for `resultat`/`match_*`/`paaminnelse`:
- Samme nøytral-chip-mønster (nøytral bg + prikk + `textSecondary`-label).
- Prikkfarge: `resultat`/`match_*` → **`heiaInk`** (Heia-grønn signatur på kamp/resultat), `paaminnelse` → `warning`.

Resultat: én dempet, konsistent chip-familie. Grønn forblir dominant brand-farge fordi de andre er nøytralisert.

---

## 4. `heiaInk` vs `#02ffab` — den harde regelen

**`#02ffab` (`heia`) er en FYLL-farge, aldri en tekstfarge på lyst — uansett størrelse.** (Kontrast mot hvit ≈ 1.3:1, feiler WCAG også for stor tekst.)

- **`heia` #02ffab brukes på:** primær-knapp-fyll (finnes), grønn energy-rail (§6), badge-/pill-*fyll* med mørk tekst oppå. Store flater.
- **`heiaInk` (ny, ~`#047857`, verifiser ≥4.5:1 på hvit) brukes på:** all grønn **tekst og ikon** på lyst — rolle-pill-tekst, aktiv «Heia»-reaksjon, grønn prikk på kamp/resultat, evt. grønne lenker.

Konkret første fix: `FeedCard` rolle-pill `color: colors.heia` → `colors.heiaInk`. (Samme klasse-bug finnes i `LiveMatchBanner` sin store grønne score — **flagget, men utenfor scope** for dette kortet.)

---

## 5. ReactionBar — lettvekt, ikke social-template-klone

**Slop-fella:** rader med 👍❤️😂-tray + «Like / Comment / Share». Det er hvilken som helst feed.

**Heia-vrien:**
- **Én merkevare-reaksjon, ikke en emoji-meny:** appen heter *Heia* (= heie). Primærreaksjonen er **«👏 Heia»** (å heie på laget), ikke generisk like. Aktiv tilstand: `heiaInk` tekst/ikon; hvile: `textSecondary`.
- **Maks to affordances:** «Heia» + «Kommenter». **Ingen share-knapp** (deling skjer via andre flows), ingen emoji-tray nå.
- **Presentasjons-only nå:** ingen tall (data finnes ikke i `FeedItem`). Vis affordancene i hviletilstand. Tall/telling wires i Fase 2 uten redesign.
- **Norsk tone:** senere kan tall vises som «12 heier» (ikke «12 likes») — differensierer og er på-brand.
- **Implementasjon:** inline i `FeedCard` for proof-of-direction. Ekstraher til egen `ReactionBar`-primitiv **først når retningen er godkjent** (unngå for tidlig abstraksjon).

---

## 6. Grønn «energy rail» — uten å bli generisk

**Slop-fella:** farget venstrekant på *alle* kort = generisk callout-mønster.

**Heia-vrien:**
- **Kun på signal-poster:** `match_*` og `resultat` (kampøyeblikk). Aldri dekorativt på vanlige meldinger.
- **Form:** 4px bred, `radius.full` (avrundet pille), **innrykket vertikalt** med kortets padding så den ikke slåss med kort-radiusen — ikke en hard full-høyde kant.
- **Farge:** `heia` #02ffab (dette er *fyll*, ikke tekst → korrekt bruk).
- Effekt: kampinnhold får en subtil grønn «flomlys»-puls i randen, resten av feeden er ren.

---

## 7. Token-endringer som trengs først (additive, null visuell endring i seg selv)

I [tokens.ts](../src/theme/tokens.ts):
```
colors:
  heiaInk:      ~#047857   // grønn tekst/ikon på lyst (WCAG ≥4.5:1 — verifiser)
  borderSubtle: ~#EDEEF0   // rolig 1px kort-kant
  surfaceMuted: ~#F1F2F4   // nøytral chip-bg
radius:
  2xl: 28                  // hero/feature-kort (ikke FeedCard selv; til LiveMatchBanner senere)
shadows:
  cardResting: { color:#000, offset:{0,6}, opacity:0.07, radius:20, elevation:3 }
```
Alt er tillegg — ingenting fjernes, ingen eksisterende bruk endres av dette steget alene.

---

## 8. Komponenter som må endres

| Fil | Endring | Risiko |
|---|---|---|
| [tokens.ts](../src/theme/tokens.ts) | Legg til 5 tokens (§7) | Null (additivt) |
| [Chip.tsx](../src/components/Chip.tsx) | Nøytral bg + aksent-prikk (§3A) | Lav — påvirker kalender/EventCard-visning (screenshot der også) |
| [FeedCard.tsx](../src/components/FeedCard.tsx) | Radius xl, borderSubtle+cardResting, rolle-pill→heiaInk, betinget type-markør, større media, betinget energy-rail, inline ReactionBar | Lav (presentasjon), men største enkeltdiff |
| `ReactionBar` (ny) | **Utsatt** — ekstraher fra FeedCard etter godkjenning | — |
| `LiveMatchBanner` score→heiaInk | **Flagget, utenfor scope** | — |

Ingen `TeamHomeScreen`/navigation/logikk røres i proof-fasen.

---

## 9. Eksakt liten implementeringsrekkefølge

**Del inn i to små differ** (hver reviewbar for seg):

**Steg 0 — Baseline:** `/verify` (eller `/run`) → screenshot av dagens TeamHome-feed **og** kalender (Chip brukes begge steder). Lagre som «før».

**Diff 1 — Retnings-uavhengige forbedringer (liten, trygg):**
1. Legg til de 5 tokenene (§7). Ingen visuell endring ennå.
2. Kontrast-fix: `FeedCard` rolle-pill `heia` → `heiaInk`.
3. Dempe `Chip`: nøytral `surfaceMuted` bg + aksent-prikk (§3A).
4. `/simplify` → `/code-review` → `/verify` + screenshot. Sammenlign kalender + feed «før/etter». **Stopp og vurder** før Diff 2.

**Diff 2 — FeedCard proof-of-direction (kun `FeedCard.tsx`):**
5. Kort: `radius.xl`, `borderSubtle`, `shadows.cardResting`.
6. Header-forfining + betinget type-markør (§1, §3B).
7. Større media (§1).
8. Betinget energy-rail på `match_*`/`resultat` (§6).
9. Inline ReactionBar «👏 Heia / 💬 Kommenter», presentasjons-only (§5).
10. `/simplify` → `/code-review` → `/verify` + screenshot «etter». Vurder proof-of-direction.

**Etterpå (kun ved godkjenning):** ekstraher `ReactionBar`, vurder `LiveMatchBanner`-score-fix, så bred Home/feed-refaktor. Glass/Reanimated forblir utsatt til egen native-økt.
