# HEIA — Global Background & Material Master

Use the supplied `Heia_Background_Master.png` as the visual source of truth for the global background. Use `Heia_Material_Preview.png` only to understand how existing Heia components should sit in that world. **Do not copy its layout, icons, wording, navigation, or component arrangement.** Preserve the current application structure and behaviour.

## North star

**One Heia world, different pulse.** The experience is daylight over the pitch on everyday screens and becomes more intense around live matches. It must feel energetic, optimistic, social, warm and premium — never like an admin tool, betting product, dark live-score app, generic AI interface, or glossy cyberpunk concept.

The visual hierarchy is:

1. The mint family creates the world.
2. `#02FFAB` is the living Heia energy and should clearly own the visual impression without becoming a flat full-screen fill.
3. Deep Heia green provides structure, legibility and confident actions.
4. Warm cream/opalescent surfaces provide calm reading areas.

## Locked palette

| Role | Token | Value |
| --- | --- | --- |
| Heia energy | `heiaNeon` | `#02FFAB` |
| Deep control | `heiaDeep` | `#063A2D` |
| Main ink | `heiaInk` | `#052C23` |
| Soft neon | `heiaNeonSoft` | `#79FFD3` |
| Aqua reflection | `heiaAqua` | `#8FFFE0` |
| Sunlit grass warmth | `heiaSun` | `#CFFF74` |
| Light mint | `heiaMint` | `#D8FFF0` |
| Daylight | `heiaDaylight` | `#F5F8E9` |
| Warm reading surface | `heiaCream` | `#F7F5E9` |

`heiaSun` is atmospheric only: use it as one soft, bounded light field, never for controls, text, semantic states or a large flat area. Do not introduce purple, blue category colors, cold grey surfaces or pure white card stacks.

## Background construction

Build one fixed background layer behind the existing screens. It must not scroll as a collection of separate card backgrounds.

- Start with a fully colored light mint/green base. The complete viewport must belong to the green family; there must be no neutral white or cream patch in the background.
- Place one oversized `#02FFAB` light field so neon visually occupies roughly 50–65% of the background impression.
- Build a visibly continuous color journey through lighter mint, a bounded sunlit-lime field, `#02FFAB`, cool aqua/teal and deep-green edge depth. The upper area should be colored mint/green, never white.
- Add one clearly visible cool aqua/teal field toward the opposite side. It must differ enough in hue and luminance that the screen no longer reads as one flat mint color.
- Let the lower/right edge travel farther toward deep Heia green than before, while keeping the majority of the everyday screen bright. Never create a 50/50 neon-to-dark split.
- Add very subtle pitch geometry: partial centre circles, broad pitch arcs and one diagonal stadium-light beam. Geometry must be recognizable only after looking for it.
- Add fine material grain at extremely low opacity. No visible paper texture, glitter, particles, mesh noise or decorative blobs.

The background should resemble colored light moving across a green football pitch, not a white spotlight, a flat fill or a digital gradient preset. Warm cream belongs to the opal reading surfaces, not to the background itself.

## Dynamic team-color top layer

- The Heia master background remains underneath the entire screen at all times.
- The selected team's own color is a separate dynamic layer above the master in the upper safe area/header region.
- Keep the team color confident at the top, then fade it smoothly to transparent so the Heia mint/neon master becomes visible below. There must be no hard seam or replacement of the global background.
- Do not bake a specific club color into the master asset or its global tokens.
- Preserve the app's existing source of team colors and its existing contrast/accessibility handling for header text and icons.
- When reviewing the supplied background image, remember that its upper portion shows the underlying master; the final app will place the team-color layer above it.

## Motion

Movement must be atmospheric and almost subconscious:

- Neon and aqua fields: translate only `15–25 px` over `30–45 s`, with gentle scale variation up to about `1.05`.
- Pitch geometry: `4–8 px` slow parallax over roughly `35 s`.
- Stadium-light beam: very slow opacity breathing; no pulsing.
- No rotation loops, particles, shimmer, liquid waves or continuously animated blur values.
- Respect Reduce Motion by rendering the same composition statically.
- Keep animation on native/compositor-friendly `transform` and `opacity`; do not drive frames from JavaScript.

## Material system

### Everyday surfaces — opal / silk matte

- Warm cream tint rather than pure white.
- Only enough translucency for the background color to influence the surface.
- Soft internal highlight from the upper-right light source.
- Thin light edge and restrained green chromatic shadow.
- Content remains fully legible outdoors.
- The material should look physical and calm, not like glossy transparent plastic.

### Live and match surfaces — stadium glass

- Deep Heia-green, not black.
- Controlled translucency and nested tonal depth.
- Very restrained neon reflection.
- Use for the match hero and genuinely live/intense contexts, not every card.

### Controls

- Default primary actions and active navigation: deep Heia green with light text.
- `#02FFAB`: HEIA, goal, live, score, selected state and small energy signals.
- Dark text and icons on light backgrounds use `heiaInk`, never neon.
- Do not make every button neon; intensity must remain meaningful.

## Implementation constraints

- Keep React Native CLI, existing `StyleSheet` architecture, `src/theme/tokens.ts`, current primitives, layout, copy, icons and behaviour.
- Do not add NativeWind, Expo, UI kits, `expo-blur`, native modules or a new design library.
- Treat these files as a visual and material reference, not code to paste literally into the app.
- Implement the background first on one representative everyday screen. Change only the background layer and the minimum surface tint required to evaluate it.
- Do not redesign cards, buttons, navigation, spacing or information hierarchy during the background test.
- Verify on a physical iPhone in bright and dim environments before propagating the system.

## Acceptance test

The result is correct only if all are true:

- A screenshot is immediately recognizable as Heia even without the logo.
- `#02FFAB` is clearly present and owns the atmosphere, but the screen is comfortable to use for several minutes.
- Existing content is easier, not harder, to read.
- The background feels alive before the user can identify the animation.
- The screen feels like youth-sport joy and belonging, not administration or professional betting.
- Everyday screens remain calm enough that a live match can still become the intensity peak.

## First implementation instruction to Claude

Inspect the existing background and theme primitives before writing code. State exactly which files and tokens currently own the chosen screen background. Then propose the smallest reversible implementation that reproduces `Heia_Background_Master.png` within the constraints above. Do not change code until the proposal has been reviewed.
