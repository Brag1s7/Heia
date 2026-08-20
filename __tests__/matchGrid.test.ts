import {
  matchGrid,
  GRID_FONT_CAP,
  NODE_SIZE,
} from '../src/shared/matchGridGeometry';

/**
 * HENDELSESGRIDDETS GEOMETRIVAKT.
 *
 * Samme rolle som `avatarColors.test.ts` har for den frosne hash-poolen: den
 * vokter tall som ellers ville endret seg helt stille. Flytter noen på ett
 * ledd i kjeden, skal DENNE fila si fra — ikke telefonen tre uker senere.
 *
 * Brage 2026-08-20: ikonet og minuttkolonnens vertikale flukt er LÅST.
 * Innrykk og gap kan komprimeres. Tekst skal aldri klippes.
 *
 * Bredder som må holde:
 *   430 — prototypens målebrett (iPhone Pro Max-klassen)
 *   393 — iPhone 14/15/16 Pro
 *   390 — iPhone 12/13/14
 *   375 — iPhone SE 3 / 13 mini
 *   320 — iPhone SE 1./2. gen (deployment target 15.1 støtter dem formelt)
 *
 * Tekstskalaer: 1.0, 1.235 (Dynamic Type XXL), 1.6 (appens tak).
 */

const WIDTHS = [430, 393, 390, 375, 320];
const SCALES = [1, 1.235, GRID_FONT_CAP];
const XXL = 1.235;

describe('matchGrid — prototypen er fasit på 430 pt', () => {
  it('gjengir prototypens kjede eksakt ved fontScale 1', () => {
    const g = matchGrid(430, 1);
    // Kjeden fra docs/prototypes/kampskjerm/index.html
    expect(g.railLeft).toBe(13.5);
    expect(g.nodeSize).toBe(27);
    // Handoff-en: «node sentrert på x=27». Prototypens 26 er den ene
    // detaljen vi retter — se kommentaren i matchGridGeometry.ts.
    expect(g.nodeCenter).toBe(27);
    expect(g.minuteLeft).toBe(44); // .emin{left:44}
    expect(g.minuteWidth).toBe(30); // .emin{width:30}
    expect(g.minuteLeft + g.minuteWidth).toBe(74); // høyrekant
    expect(g.contentLeft).toBe(82); // .moment{padding-left:82}
    expect(g.gutter).toBe(22); // .moment{padding-right:22}
    expect(g.goalFont).toBe(46); // .g-word{font-size:46}
  });

  it('krittlinja ligger sentrert under noden, ikke 1.75 pt ved siden av', () => {
    // Prototypen har nodesenter 26 og trådsenter 27.75. Usynlig i nettleseren,
    // synlig på @3x. Her avledes tråden av nodesenteret.
    for (const w of WIDTHS) {
      const g = matchGrid(w, 1);
      const threadCenter = g.threadLeft + g.threadWidth / 2;
      expect(Math.abs(threadCenter - g.nodeCenter)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('matchGrid — den låste vertikale flukten', () => {
  it('sentrerer minuttets tekstlinje mot noden ved alle skalaer og bredder', () => {
    for (const w of WIDTHS) {
      for (const fs of SCALES) {
        const g = matchGrid(w, fs);
        const lineHeight = Math.ceil(g.minuteFontSize * 1.25 * fs);
        const minuteCenter = g.minuteTop + lineHeight / 2;
        const nodeCenterY = NODE_SIZE / 2;
        // Innenfor én pikselavrunding. Aldri mer: da leser kolonnen skjevt.
        expect(Math.abs(minuteCenter - nodeCenterY)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('lar aldri noden vokse med teksten', () => {
    for (const fs of SCALES) {
      expect(matchGrid(430, fs).nodeSize).toBe(NODE_SIZE);
      expect(matchGrid(320, fs).nodeSize).toBe(NODE_SIZE);
    }
  });

  it('holder minuttkolonnen fast innenfor én enhet og tekststørrelse', () => {
    // Skannbarheten: 34′ · 31′ · 29′ · 25′ under hverandre. Kolonnen skal
    // ikke variere mellom rader — den er ren funksjon av (bredde, skala).
    const a = matchGrid(390, XXL);
    const b = matchGrid(390, XXL);
    expect(a.minuteLeft).toBe(b.minuteLeft);
    expect(a.contentLeft).toBe(b.contentLeft);
  });
});

describe('matchGrid — ingenting klippes', () => {
  it('gir brukbar innholdsbredde på alle bredder × skalaer', () => {
    for (const w of WIDTHS) {
      for (const fs of SCALES) {
        const g = matchGrid(w, fs);
        // Under ~180 pt kan ikke en setning brytes lesbart.
        expect(g.contentWidth).toBeGreaterThan(180);
      }
    }
  });

  it('skyver innholdet til høyre når minuttet vokser — aldri motsatt', () => {
    for (const w of WIDTHS) {
      const base = matchGrid(w, 1);
      const xxl = matchGrid(w, XXL);
      const cap = matchGrid(w, GRID_FONT_CAP);
      expect(xxl.minuteWidth).toBeGreaterThan(base.minuteWidth);
      expect(xxl.contentLeft).toBeGreaterThan(base.contentLeft);
      expect(cap.contentLeft).toBeGreaterThan(xxl.contentLeft);
      // «120′» ved taket må få plass i kolonnen sin.
      expect(cap.minuteWidth).toBeGreaterThanOrEqual(48);
    }
  });

  it('stabler målfeiringen før den trunkeres', () => {
    // MÅL! (46) + stilling (40) på samme linje er det FØRSTE som brekker.
    expect(matchGrid(430, 1).goalStacked).toBe(false);
    expect(matchGrid(430, XXL).goalStacked).toBe(false);
    // Ved taket er MÅL! 46×1.6 = 74 pt. Da SKAL den stables, også på den
    // bredeste telefonen — alternativet er trunkert feiring.
    expect(matchGrid(430, GRID_FONT_CAP).goalStacked).toBe(true);
    expect(matchGrid(320, XXL).goalStacked).toBe(true);
    expect(matchGrid(375, GRID_FONT_CAP).goalStacked).toBe(true);
  });

  it('klemmer fontScale til appens tak, også over det', () => {
    // iOS går til ×3.571. Uklemt ville geometrien sprunget fra hverandre.
    const cap = matchGrid(430, GRID_FONT_CAP);
    expect(matchGrid(430, 3.571)).toEqual(cap);
    expect(cap.fontCap).toBe(GRID_FONT_CAP);
  });

  it('behandler fontScale under 1 som 1', () => {
    expect(matchGrid(430, 0.8)).toEqual(matchGrid(430, 1));
  });
});

describe('matchGrid — komprimeringen gir etter i riktig ende', () => {
  it('komprimerer innrykk og gap på smale telefoner, ikke kolonnene', () => {
    const wide = matchGrid(430, 1);
    const narrow = matchGrid(320, 1);
    expect(narrow.railLeft).toBeLessThan(wide.railLeft);
    expect(narrow.gutter).toBeLessThan(wide.gutter);
    expect(narrow.contentLeft).toBeLessThan(wide.contentLeft);
    // Men minuttkolonnen selv er like bred — den bærer lesbarheten.
    expect(narrow.minuteWidth).toBe(wide.minuteWidth);
    expect(narrow.nodeSize).toBe(wide.nodeSize);
  });

  it('lar 390 pt og opp stå urørt på prototypens verdier', () => {
    for (const w of [390, 393, 430]) {
      expect(matchGrid(w, 1).contentLeft).toBe(82);
      expect(matchGrid(w, 1).railLeft).toBe(13.5);
    }
    // 375 og under komprimerer.
    expect(matchGrid(375, 1).contentLeft).toBeLessThan(82);
  });

  it('holder seg innenfor skjermen på alle bredder', () => {
    for (const w of WIDTHS) {
      for (const fs of SCALES) {
        const g = matchGrid(w, fs);
        expect(g.contentLeft + g.contentWidth + g.gutter).toBe(w);
      }
    }
  });
});
