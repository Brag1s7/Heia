/**
 * @format
 *
 * FANENE FØLGER INNHOLDET I OVERSCROLL (Brage 2026-09-10).
 *
 * Visningsfanene (Referat · Hendelser · Bilder · Info) er SKJERMFORANKRET
 * chrome som glir med scorekortet til festepunktet og står der. Drar man
 * forbi toppen blir `scrollY` negativ, og med `extrapolate: 'clamp'` på
 * begge ender ble fanene stående stille mens alt annet spratt.
 *
 * Regelen: venstre side EXTEND (følg innholdet), høyre side CLAMP (fest
 * deg). Testen regner på interpolasjonen i stedet for å montere skjermen.
 */
import {Animated} from 'react-native';

const PIN = 240;

function tabsTranslate(scrollY: Animated.Value) {
  return scrollY.interpolate({
    inputRange: [0, PIN],
    outputRange: [PIN, 0],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp',
  });
}

const valueOf = (node: Animated.AnimatedInterpolation<number>) =>
  (node as unknown as {__getValue: () => number}).__getValue();

describe('visningsfanene i overscroll', () => {
  it('følger innholdet punkt for punkt når man drar forbi toppen', () => {
    const scrollY = new Animated.Value(0);
    const t = tabsTranslate(scrollY);
    expect(valueOf(t)).toBe(PIN);
    // −60 pt overscroll ⇒ fanene skal 60 pt LENGER ned, som innholdet.
    scrollY.setValue(-60);
    expect(valueOf(t)).toBe(PIN + 60);
    scrollY.setValue(-140);
    expect(valueOf(t)).toBe(PIN + 140);
  });

  it('fester seg fortsatt ved festepunktet når man blar nedover', () => {
    const scrollY = new Animated.Value(PIN);
    const t = tabsTranslate(scrollY);
    expect(valueOf(t)).toBe(0);
    scrollY.setValue(PIN + 500);
    expect(valueOf(t)).toBe(0);
  });

  it('kilden bruker extrapolateLeft/Right, ikke den doble klemmen', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'src',
        'components',
        'match',
        'MatchChrome.tsx',
      ),
      'utf8',
    );
    const block = src.slice(src.indexOf('const tabsTranslate'));
    expect(block.slice(0, 300)).toContain("extrapolateLeft: 'extend'");
    expect(block.slice(0, 300)).toContain("extrapolateRight: 'clamp'");
  });
});
