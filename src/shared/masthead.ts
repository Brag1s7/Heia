/**
 * MASTHEAD — lagets identitetsfelt bygget inn i Heia-headeren (Brage
 * 2026-09-03).
 *
 * Retningen kom fra Spotify/Apple Music: identitetsfargen eier toppen, men
 * som del av ÉTT lerret, ikke som en egen banner. Lagheaderen er
 * gjennomsiktig innhold (logo, navn, chip) oppå DaylightGround i
 * masthead-modus, som spenner fra statuslinja til bunnen:
 *
 *   1. REISEN — én sammenhengende vertikal gradient: #0E211A i statuslinja,
 *      broen #143126 ved laghodets underkant, og derfra E-clean-rampen.
 *      Ingen fot som egen flate, ingen skjøt.
 *   2. IDENTITETSFELTET — den avrundede rammen rundt logo/navn, åpen mot
 *      venstre, fylt med den faktiske lagfargen i full styrke og svakt
 *      mørknet med samme hue mot den runde enden. All lagfarge er klippet
 *      til innsiden: ingen glød opp i statuslinja, under feltet eller ut på
 *      høyresiden (runde 1 og 2 lyste over hele toppen — «sprayflaske»).
 *      Streken er et subtilt kantlys med åpne sider.
 *   3. BUENE — ett sirkelpar på den mørke flaten utenfor feltet, forankret
 *      der laghodet slutter, konstant gjennom laghodet og fadet ut nedover.
 *
 * Alt her er i PUNKTER fra skjermens venstre kant og topp. REN MODUL:
 * `__tests__/masthead.test.ts` beviser tallene uten å rendre.
 */
import {HEADER_CONTENT_HEIGHT, HEADER_FOOT_HEIGHT} from './headerGeometry';

/** Laghodets høyde: statuslinje + innholdsrad + luft under (samme 113 pt). */
export function mastheadHeight(insetTop: number): number {
  return insetTop + HEADER_CONTENT_HEIGHT + HEADER_FOOT_HEIGHT;
}

export const FRAME_RADIUS = 24;
/** Luft mellom innholdsraden og feltets over-/underkant. */
export const FRAME_AIR = 4;
/** Feltets runde høyre ende, som andel av bredden. Uavhengig av navnesonen
 *  (NAME_REACH), som må ligge innenfor feltets FULLE lagfarge. */
export const FRAME_RIGHT = 0.66;
/** Hårlinja: et svært subtilt kantlys, ingen bloom utenfor formen. */
export const FRAME_STROKE = 0.8;
export const FRAME_OPACITY = 0.22;
/** Andel av feltets bredde med full lagfarge; resten mørknes svakt. */
export const FIELD_FULL = 0.85;
/** Mørkning med samme hue ved den runde høyre enden — materialdybde,
 *  fortsatt tydelig lagfarge, aldri gjennomsiktig. */
export const FIELD_END_DARKEN = 0.86;

export interface IdentityFrame {
  /** Selve feltet: avrundet form, åpen mot venstre (starter utenfor
   *  skjermen), fylt med lagfargen. Gradienten går fra x 0 til `right`. */
  fill: {d: string; right: number; fullUntil: number};
  /** Topplinja: fra venstre kant langs feltets overkant, løses opp mellom
   *  fadeFrom og fadeTo (x). */
  top: {d: string; y: number; fadeFrom: number; fadeTo: number};
  /** Bunnlinja + nedre runde hjørne; løses opp oppover langs hjørnet
   *  mellom fadeFrom og fadeTo (y). Øvre hjørne og høyre side er åpne. */
  side: {d: string; x: number; y: number; fadeFrom: number; fadeTo: number};
}

/**
 * IDENTITETSFELTET — lagfargen bygget INN i Heia-headeren (Brage
 * 2026-09-03, runde 3): all lagfarge er klippet til innsiden av den
 * avrundede identitetsrammen. Utenfor er headeren ren #0E211A, statuslinja
 * helt mørk med hvite ikoner, buene på den mørke flaten. Innenfor står den
 * faktiske lagfargen i full styrke bak logo, navn og metadata gjennom 84 %
 * av feltets bredde, og mørknes svakt med samme hue mot den runde enden.
 * Streken er et subtilt kantlys som følger formen med åpne sider.
 */
export function identityFrame(width: number, insetTop: number): IdentityFrame {
  const rowTop = insetTop;
  const rowBottom = insetTop + HEADER_CONTENT_HEIGHT;
  const r = FRAME_RADIUS;
  const xR = FRAME_RIGHT * width;
  // Lavere og mer avlangt (Brage 2026-09-03): 4 pt luft over og under
  // innholdsraden i stedet for 8 — innholdet er uendret, boksen er smalere.
  const yB = rowBottom + FRAME_AIR;
  const yT = rowTop - FRAME_AIR;
  return {
    fill: {
      d:
        `M -8 ${yT} H ${xR - r} A ${r} ${r} 0 0 1 ${xR} ${yT + r} ` +
        `V ${yB - r} A ${r} ${r} 0 0 1 ${xR - r} ${yB} H -8 Z`,
      right: xR,
      fullUntil: FIELD_FULL * xR,
    },
    top: {
      d: `M -8 ${yT} H ${0.42 * width}`,
      y: yT,
      fadeFrom: 0.18 * width,
      fadeTo: 0.42 * width,
    },
    side: {
      d: `M -8 ${yB} H ${xR - r} A ${r} ${r} 0 0 0 ${xR} ${yB - r}`,
      x: xR,
      y: yB,
      fadeFrom: yB - r / 2,
      fadeTo: yB - r,
    },
  };
}

export type ColorStops = ReadonlyArray<readonly [number, string]>;

/**
 * Reisen over hele skjermen: toppfargen ved 0, broen ved laghodets
 * underkant, og kroppens stopp skalert inn under. Posisjoner er andeler av
 * SKJERMHØYDEN. Kroppens eget 0 %-stopp må være broen.
 */
export function journeyStops(
  headerHeight: number,
  screenHeight: number,
  topColor: string,
  bodyStops: ColorStops,
): ColorStops {
  const h0 = headerHeight / screenHeight;
  return [
    [0, topColor],
    ...bodyStops.map(
      ([p, c]) => [h0 + p * (1 - h0), c] as readonly [number, string],
    ),
  ];
}

/**
 * Så langt lagnavnet får rekke: til 55 % av bredden, innenfor feltets
 * fulle lagfarge (85 % av 66 % = 56 %) — så mørkt blekk (gul, lyseblå,
 * oransje) alltid står på ren lagfarge, og «Fotball · 12 medlemmer» får
 * plass uten klipping. Måles fra navneblokkens venstre kant.
 */
export const NAME_REACH = 0.55;
export function nameMaxWidth(width: number, nameStart: number): number {
  return Math.max(0, NAME_REACH * width - nameStart);
}
