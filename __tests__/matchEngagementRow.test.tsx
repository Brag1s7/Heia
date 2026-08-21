/**
 * @format
 *
 * ENGASJEMENTSLINJA (skive 4) — HEIA og kommentarer på ett øyeblikk.
 *
 * Fire ting kan gå galt her uten at noen ser det før på en telefon:
 *
 *   1. HEIA dukker opp på et mål IMOT. Det er P1, låst av Brage — og fordi
 *      det er SAMME kanoniske post som i feeden, ville en knapp her brutt
 *      beslutningen begge steder.
 *   2. Linja får en pill, en ramme eller en flate. Feeden har pills, og der
 *      er de riktige — et innlegg ER et kort. Kampen har ingen kort; skillet
 *      kommer av lys og luft.
 *      ⚠️ Testen forbyr BOKSEN, ikke fargene. Den låste retningen er dominant
 *      mint på lyse flater, og skal kunne poleres uten å slåss mot en test
 *      som har frosset en palett.
 *   3. Trykkflaten blir optisk liten. Ikon + tall måler ~30 pt, og de to
 *      knappene er naboer — `hitSlop` alene gir OVERLAPPENDE treffområder, og
 *      da avgjør view-rekkefølgen hvem som fikk trykket.
 *   4. Knappen er trykkbar før den vet hvilken post den hører til. Et trykk
 *      som stille ikke gjør noe er verre enn en knapp som sier den ikke er
 *      klar.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';

import {MatchEngagementRow} from '../src/components/match/MatchEngagementRow';
import {colors, matchColors, typography} from '../src/theme';
import type {MatchEngagement} from '../src/shared/matchEngagement';

const ENGAGEMENT: MatchEngagement = {
  postId: 'p-goal',
  heiaCount: 12,
  commentCount: 2,
  iReacted: false,
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(
  props: Partial<React.ComponentProps<typeof MatchEngagementRow>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <MatchEngagementRow
        engagement={ENGAGEMENT}
        canHeia
        heiaLabel="Heia på målet på 34 minutter. 12 heier."
        commentLabel="Åpne samtalen om målet på 34 minutter. 2 kommentarer."
        fontCap={1.6}
        onHeia={jest.fn()}
        onComment={jest.fn()}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/** De trykkbare elementene, med onPress i behold. */
function buttons(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    node =>
      node.props?.accessibilityRole === 'button' &&
      typeof node.props?.onPress === 'function',
    {deep: true},
  );
}

/** Stilen slik den faktisk gjelder i hviletilstand. */
function styleOf(node: {props: Record<string, any>}) {
  const raw =
    typeof node.props.style === 'function'
      ? node.props.style({pressed: false})
      : node.props.style;
  return StyleSheet.flatten(raw) ?? {};
}

describe('P1 — mål imot har samtale, aldri HEIA', () => {
  it('rendrer NØYAKTIG én knapp uten HEIA, og det er kommentaren', () => {
    const tree = render({
      canHeia: false,
      commentLabel: 'Åpne samtalen om målet til motstanderen på 23 minutter.',
    });
    const found = buttons(tree);
    expect(found).toHaveLength(1);
    expect(found[0].props.accessibilityLabel).toBe(
      'Åpne samtalen om målet til motstanderen på 23 minutter.',
    );
  });

  it('rendrer ikke en DISABLET HEIA — den finnes ikke', () => {
    // En avslått knapp ville sagt «du kan heie hvis du får lov». Beslutningen
    // er at det ikke finnes HEIA der i det hele tatt.
    const tree = render({canHeia: false});
    const labels = buttons(tree).map(b => b.props.accessibilityLabel);
    expect(labels.some((l: string) => l.startsWith('Heia'))).toBe(false);
  });

  it('gir mål for oss begge handlingene', () => {
    expect(buttons(render())).toHaveLength(2);
  });
});

describe('ingen pill, ingen boks, ingen flate', () => {
  it('tegner ikke en eneste bakgrunn, ramme eller kortradius', () => {
    // ⚠️ Dette er regelen som test — ikke en fargetest. Hvilke FARGER linja
    // bruker skal kunne endres når retningen poleres; at den ikke blir et
    // KORT skal ikke kunne skli tilbake ved neste redigering.
    // ⚠️ NULL OG `transparent` TELLER IKKE. `react-native-svg` stempler
    // `backgroundColor: 'transparent'` og `borderWidth: 0` på hver eneste
    // <Svg> — altså på begge ikonene. Det er ikke en boks, og en test som
    // ikke skiller de to ville aldri kunnet bestå.
    const seen: string[] = [];
    const isDrawn = (key: string, value: unknown) => {
      if (value === undefined || value === null) return false;
      if (key === 'backgroundColor') {
        return value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
      }
      return typeof value === 'number' ? value > 0 : true;
    };
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      const n = node as {props?: Record<string, unknown>; children?: unknown};
      const flat = (StyleSheet.flatten(n.props?.style as never) ??
        {}) as Record<string, unknown>;
      for (const key of [
        'backgroundColor',
        'borderWidth',
        'borderTopWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderRightWidth',
        'borderRadius',
        'shadowOpacity',
        'elevation',
      ]) {
        if (isDrawn(key, flat[key])) {
          seen.push(`${key}=${String(flat[key])}`);
        }
      }
      visit(n.children);
    };
    visit(render().toJSON());
    expect(seen).toEqual([]);
  });
});

describe('44 pt er layout, ikke hitSlop', () => {
  it('gir hver knapp ekte 44×44 gjennom stilen', () => {
    for (const button of buttons(render())) {
      const style = styleOf(button) as Record<string, number>;
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });

  it('lar ikke hitSlop være det som skaper trykkflaten', () => {
    // To naboer med raus hitSlop får overlappende treffområder, og da
    // avgjør view-rekkefølgen hvem som «vant» trykket i overlappet.
    for (const button of buttons(render())) {
      const slop = button.props.hitSlop ?? {};
      expect(slop.left ?? 0).toBe(0);
      expect(slop.right ?? 0).toBe(0);
    }
  });
});

describe('tilstand og trykk', () => {
  it('sier fra til skjermleseren at JEG har heiet', () => {
    const on = buttons(
      render({engagement: {...ENGAGEMENT, iReacted: true}}),
    )[0];
    expect(on.props.accessibilityState).toMatchObject({selected: true});

    const off = buttons(render())[0];
    expect(off.props.accessibilityState).toMatchObject({selected: false});
  });

  it('sender post-id og NÅVÆRENDE tilstand til kalleren', () => {
    const onHeia = jest.fn();
    const tree = render({onHeia, engagement: {...ENGAGEMENT, iReacted: true}});
    const heia = buttons(tree)[0];
    act(() => heia.props.onPress());
    expect(onHeia).toHaveBeenCalledWith('p-goal', true);
  });

  it('åpner samtalen på den kanoniske posten', () => {
    const onComment = jest.fn();
    const comment = buttons(render({onComment}))[1];
    act(() => comment.props.onPress());
    expect(onComment).toHaveBeenCalledWith('p-goal');
  });

  it('er ekte disablet før den kanoniske posten er kjent', () => {
    // Vinduet finnes: et ferskt mål står i forløpet noen hundre millisekunder
    // før `get_match_feed` har lest posten. Da tegnes nullene, men trykket
    // skal ikke være en stille no-op.
    const onHeia = jest.fn();
    const onComment = jest.fn();
    const tree = render({engagement: undefined, onHeia, onComment});
    for (const button of buttons(tree)) {
      expect(button.props.disabled).toBe(true);
      expect(button.props.accessibilityState).toMatchObject({disabled: true});
      act(() => {
        button.props.onPress();
      });
    }
    expect(onHeia).not.toHaveBeenCalled();
    expect(onComment).not.toHaveBeenCalled();
  });
});

describe('samme handling som i feeden — ikke en ny', () => {
  const RNText = require('react-native').Text;

  function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
    return tree.root.findAllByType(RNText).map(n => {
      const c = n.props.children;
      return (Array.isArray(c) ? c : [c])
        .filter((x: unknown) => typeof x === 'string' || typeof x === 'number')
        .join('');
    });
  }

  it('bruker appens eget produktspråk: «Heia» på null, «N heier» ellers', () => {
    // Ordrett `FeedCard`/`CommentThread`. «2 HEIA» var prototypens
    // plassholder og behandlet HEIA som en måleenhet.
    expect(texts(render({engagement: {...ENGAGEMENT, heiaCount: 0}}))).toContain(
      '👏 Heia',
    );
    expect(texts(render({engagement: {...ENGAGEMENT, heiaCount: 1}}))).toContain(
      '👏 1 heier',
    );
    expect(texts(render())).toContain('👏 12 heier');
  });

  it('bruker feedens kommentartekst: «Kommenter» på null, ellers tallet', () => {
    expect(
      texts(render({engagement: {...ENGAGEMENT, commentCount: 0}})),
    ).toContain('Kommenter');
    expect(texts(render())).toContain('2');
  });

  it('bruker 👏-glyfen appen alt har — ingen egen hånd-SVG', () => {
    // Begrunnelsen for `HeiaHand` var at en emoji ikke kan farges mint. Men
    // i feeden skifter glyfen ALDRI farge; det er teksten og flaten som
    // bærer på/av. Det var altså aldri noe å løse.
    const heia = buttons(render())[0];
    const paths = heia.findAll(
      node => typeof node.props?.d === 'string',
      {deep: true},
    );
    expect(paths).toEqual([]);
  });

  it('bruker typography.action — ikke displayfonten, ikke rå tall', () => {
    // `fonts.display` er uttrykkelig dokumentert som «aldri brødtekst».
    // Den sto på HEIA-tallet før 4.1.
    for (const node of render().root.findAllByType(RNText)) {
      const style = StyleSheet.flatten(node.props.style) ?? {};
      expect(style.fontSize).toBe(typography.action.fontSize);
      expect(style.fontWeight).toBe(typography.action.fontWeight);
      expect(style.fontFamily).toBe(typography.action.fontFamily);
      // Prototypens letterSpacing hørte til dens egen font.
      expect(style.letterSpacing).toBeUndefined();
    }
  });

  it('flytter på/av til BLEKKET, siden kampen ikke har flater', () => {
    // Feeden viser «på» som pill (heiaTint + heiaInk). Her er det mint ink
    // mot dempet — samme semantikk, kampens språk.
    const inkOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
      StyleSheet.flatten(tree.root.findAllByType(RNText)[0].props.style)?.color;

    expect(inkOf(render({engagement: {...ENGAGEMENT, iReacted: true}}))).toBe(
      colors.heia,
    );
    expect(inkOf(render())).toBe(matchColors.dim);
  });
});
