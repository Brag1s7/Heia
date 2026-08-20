import {arenaLightCap, floodCap, swellCap} from '../src/shared/teamColors';
import {matchColors} from '../src/theme';

/**
 * KAMPFLATENS KONTRASTVAKT — gullverdier, ikke kommentarer.
 *
 * Den frosne designretningen har to påstander som ser riktige ut og måler
 * feil hvis noen justerer en farge «bare litt». Denne fila er grunnen til at
 * de ikke kan gjøre det stille:
 *
 *   1. På ARENAFLATEN har `colors.stadiumDim` for lite luft (4.86:1 — se
 *      rettelsen lenger nede i fila). Dempet tekst der skal være
 *      `matchColors.dim` (#C8E6D8).
 *   2. `matchColors.light` (#3B8062) er en LYSFLATE, ikke en tekstflate.
 *      Bruker noen den som tekst på grunnen, er det en feil.
 *
 * Og den vokter selve safeguarden: lagfargen får aldri lyse så sterkt i
 * målswellen at teksten oppå den blir uleselig. Det er dét som er grunnen til
 * at et rødt lag aldri blir brunt.
 */

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function luminance(c: Rgb): number {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const la = luminance(rgb(a));
  const lb = luminance(rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// De fire grønne rommene, lysest først.
const ROOMS = {
  'Arena topp': matchColors.arenaTop,
  'Arena bunn': matchColors.arenaBottom,
  Puls: matchColors.pulse,
  Kampforløp: matchColors.timeline,
};

const INKS = {
  tekst: matchColors.text,
  dempet: matchColors.dim,
  mint: '#02FFAB',
};

describe('kampflatens fire rom bærer blekket sitt', () => {
  it.each(Object.entries(ROOMS))(
    '%s holder 4.5:1 for all tekst — også den dempede',
    (_room, surface) => {
      for (const ink of Object.values(INKS)) {
        expect(ratio(ink, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('holder 7:1 for brødtekst i alle fire rom', () => {
    for (const surface of Object.values(ROOMS)) {
      expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(7);
    }
  });

  it('rommene er faktisk trinn i lyshet, ikke fire nyanser av det samme', () => {
    const ls = Object.values(ROOMS).map(h => luminance(rgb(h)));
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });

  it('DEN ENE FELLA: stadiumDim har ikke luft nok på arenaflaten', () => {
    // ⚠️ RETTELSE TIL DEN FROSNE BOLKEN. STATUS-HANDOFF.md sier «på
    // arenaflaten faller dempet tekst til 3.7:1». Det tallet reproduserer
    // ikke: `colors.stadiumDim` (#A9CCBC) på #25563F måler 4.86:1, og
    // handoff-ens EGEN tabell sier 4.9 på samme linje. De to påstandene er
    // uenige, og tabellen har rett.
    //
    // Byttet til #C8E6D8 er likevel riktig — bare av en annen grunn enn den
    // som står: 4.86 er marginalt (ingen luft mot 4.5-grensen når flaten
    // varierer i lys), og det er langt under 7:1-kravet brødtekst skal ha.
    // #C8E6D8 gir 6.35 og klarer 7:1 i de tre andre rommene.
    const stadiumDimOnArena = ratio('#A9CCBC', matchColors.arenaTop);
    const dimOnArena = ratio(matchColors.dim, matchColors.arenaTop);

    expect(stadiumDimOnArena).toBeLessThan(5); // marginal, ikke komfortabel
    expect(dimOnArena).toBeGreaterThan(stadiumDimOnArena + 1);
    expect(dimOnArena).toBeGreaterThanOrEqual(4.5);
  });

  it('light er en lysflate, ikke en tekstflate', () => {
    // #3B8062 mot grunnen måler under 4.5:1 — kun stor tekst. Brukes den som
    // brødtekst noe sted, er det en feil, ikke en smakssak.
    expect(ratio(matchColors.light, matchColors.timeline)).toBeLessThan(4.5);
  });
});

describe('swellCap — lagfargen får aldri spise lesbarheten', () => {
  // Paletten laget faktisk kan velge mellom, ytterpunktene først.
  const TEAM_COLORS = [
    '#1E7A46', // skoggrønn
    '#D92B2B', // rød
    '#1D4ED8', // blå
    '#FFC53D', // gul — lysest, klemmes hardest
    '#12315E', // marine — mørkest
    '#E8590C', // oransje
    '#0F766E', // teal
    '#DB2777', // rosa
  ];

  it.each(TEAM_COLORS)(
    '%s holder både 7:1 for tekst og 4.5:1 for mint',
    hex => {
      const cap = swellCap(hex);
      expect(cap.textRatio).toBeGreaterThanOrEqual(7);
      expect(cap.mintRatio).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('holder seg innenfor 2–60 %', () => {
    for (const hex of TEAM_COLORS) {
      const {peak} = swellCap(hex);
      expect(peak).toBeGreaterThanOrEqual(0.02);
      expect(peak).toBeLessThanOrEqual(0.6);
    }
  });

  it('klemmer lyse lagfarger hardere enn mørke', () => {
    // Selve poenget: gult må ned, marineblått kan stå på full styrke.
    expect(swellCap('#FFC53D').peak).toBeLessThan(swellCap('#12315E').peak);
    expect(swellCap('#FFC53D').capped).toBe(true);
    expect(swellCap('#12315E').capped).toBe(false);
  });

  it('er deterministisk — samme farge gir samme klemme', () => {
    expect(swellCap('#D92B2B')).toEqual(swellCap('#D92B2B'));
  });

  it('faller trygt tilbake på ugyldig farge', () => {
    // Ingen krasj, ingen NaN — et lag uten gyldig farge skal fortsatt få
    // en swell, den bare bruker ønsket styrke på Heias egen grønn.
    const cap = swellCap('ikke en farge');
    expect(cap.peak).toBe(0.6);
    expect(Number.isFinite(cap.peak)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SKIVE 2 — GRUNNEN BLE EN TEKSTFLATE
//
// Frem til nå sto all kamptekst på et KORT. Fra og med skive 2 ligger
// reporterlinja, «du følger kampen» og hele forløpet RETT PÅ GRUNNEN. Da er
// grunnens tre toner ikke lenger bare atmosfære — de er tekstflater, og de
// må måles som det.
// ---------------------------------------------------------------------------
const GROUND = {
  'Grunn topp': matchColors.groundTop,
  'Grunn midt': matchColors.groundMid,
  'Grunn bunn': matchColors.groundLow,
};

describe('grunnen bærer blekket sitt — den er ikke bare bakgrunn lenger', () => {
  it.each(Object.entries(GROUND))(
    '%s holder 7:1 for brødtekst OG for den dempede',
    (_room, surface) => {
      expect(ratio(matchColors.text, surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(matchColors.dim, surface)).toBeGreaterThanOrEqual(7);
    },
  );

  it('grunnens midttone er LYSERE enn kampforløpet — derfor scrimet', () => {
    // Det fjerde rommet (#123325) kan ikke oppstå av seg selv på en grunn som
    // er lysere enn det. MatchTimeline tegner derfor et scrim når `ground` er
    // satt. Slettes det, forsvinner rommet — og denne testen sier fra.
    expect(luminance(rgb(matchColors.groundMid))).toBeGreaterThan(
      luminance(rgb(matchColors.timeline)),
    );
  });
});

describe('arenaLightCap — lagets lys spiser aldri lagets eget navn', () => {
  const TEAM_COLORS = [
    '#1E7A46',
    '#D92B2B',
    '#1D4ED8',
    '#FFC53D',
    '#12315E',
    '#E8590C',
    '#0F766E',
    '#DB2777',
  ];

  it.each(TEAM_COLORS)('%s holder 7:1 for tekst og 4.5:1 for mint', hex => {
    const cap = arenaLightCap(hex);
    expect(cap.textRatio).toBeGreaterThanOrEqual(7);
    expect(cap.mintRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('klemmer HARDERE enn swellen — arenaen er kampens lyseste rom', () => {
    // Samme farge, to flater: #25563F har 8.11:1 for brødtekst mot swellens
    // #14382A på 11.4:1. Mindre luft ⇒ mindre lagfarge. Er det motsatt en
    // dag, er en av de to flatene endret uten at vakten fulgte med.
    for (const hex of TEAM_COLORS) {
      expect(arenaLightCap(hex).peak).toBeLessThanOrEqual(swellCap(hex).peak);
    }
  });

  it('gult klemmes, marineblått gjør det ikke', () => {
    expect(arenaLightCap('#FFC53D').peak).toBeLessThan(
      arenaLightCap('#12315E').peak,
    );
    expect(arenaLightCap('#12315E').capped).toBe(false);
  });

  it('faller trygt tilbake på ugyldig farge', () => {
    expect(arenaLightCap('ikke en farge').peak).toBe(0.34);
  });
});

describe('floodCap — måløyeblikket hvitvasker aldri stillingen', () => {
  it.each(['#1E7A46', '#D92B2B', '#1D4ED8', '#FFC53D', '#12315E'])(
    '%s lar mint-tallet holde 3:1 gjennom hele floden',
    hex => {
      // Stillingen er det ENESTE som må overleve floden — og den er 60+ px,
      // altså stor tekst. Brødteksten er ikke det man leser i det sekundet.
      expect(floodCap(hex).mintRatio).toBeGreaterThanOrEqual(3);
    },
  );

  it('slipper lagfargen lengre til enn swellen gjør', () => {
    // Floden er kort og har bare ETT krav; swellen står permanent og har to.
    expect(floodCap('#12315E').peak).toBeGreaterThan(swellCap('#12315E').peak);
  });

  it('faller trygt tilbake på ugyldig farge', () => {
    expect(floodCap('ikke en farge').peak).toBe(0.78);
  });
});
