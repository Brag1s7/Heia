/**
 * @format
 *
 * P1 I FEEDEN (skive 9) — ingen HEIA på mål imot, heller ikke fra Hjem.
 *
 * ⚠️ DETTE VAR EN LEVENDE FEIL, IKKE BARE «neste skive». P1 ble låst
 * 2026-08-20 og gjelder BEGGE flatene, fordi det er den SAMME kanoniske
 * posten: heiet du på baklengsmålet fra feeden, dukket heiet opp inne i
 * kampskjermen — på et øyeblikk der knappen bevisst ikke finnes.
 *
 * ⚠️ GATEN ER SMAL MED VILJE, og det er det halve av denne fila som vokter.
 * Feeden har HEIA på avspark, bilder, resultater og vanlige innlegg, og skal
 * beholde det. Bare målet imot mister den. Brukes `allowsHeia` (kampens,
 * strengere gate) her ved et uhell, forsvinner HEIA fra halve feeden — og
 * ingen enkelttest på et mål ville fanget det.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

jest.mock('../src/lib/media/MediaImage', () => {
  const {View} = require('react-native');
  return {MediaImage: (props: object) => <View {...props} />};
});

import {FeedCard} from '../src/components/FeedCard';
import {allowsHeia, isOpponentGoal} from '../src/shared/matchEngagement';
import type {FeedItem} from '../src/shared/types';

const BASE: FeedItem = {
  id: 'p1',
  type: 'melding',
  author: {id: 'u1', name: 'Jarle Vik', role: 'trener'},
  createdAt: new Date(2026, 7, 20, 18, 34),
  content: 'Noe skjedde',
  heiaCount: 3,
  commentCount: 1,
  iReacted: false,
} as unknown as FeedItem;

function render(item: FeedItem) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<FeedCard item={item} />);
  });
  return tree;
}

/** Finnes HEIA-pillen i det hele tatt? (Ikke «er den disabled».) */
function hasHeia(item: FeedItem): boolean {
  const found: boolean[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as {
      props?: {accessibilityLabel?: string};
      children?: unknown;
    };
    if (node.props?.accessibilityLabel === 'Heia') found.push(true);
    walk(node.children);
  };
  walk(render(item).toJSON());
  return found.length > 0;
}

/**
 * ⚠️ POSTTYPEN ER EN DEL AV FIXTUREN, IKKE PYNT (skive 8).
 *
 * Gaten spør om TO ting: er øyeblikket et mål imot, OG er posten systemets
 * egen. En fixture som lot alt være `melding` ville derfor bestått mens
 * produksjonen gjorde noe annet — og den ene raden som faktisk driftet
 * (kampbildet) hadde vært usynlig i suiten.
 */
const withMatchEvent = (
  type: FeedItem['matchEvent'] extends infer T
    ? T extends {type: infer U}
      ? U
      : never
    : never,
  teamSide?: 'home' | 'away',
  postType: FeedItem['type'] = 'match_event',
): FeedItem => ({...BASE, type: postType, matchEvent: {type, teamSide}});

describe('HEIA-pillen i feeden', () => {
  it('FINNES IKKE på mål imot', () => {
    expect(hasHeia(withMatchEvent('mål', 'away'))).toBe(false);
  });

  it('finnes på vårt eget mål', () => {
    expect(hasHeia(withMatchEvent('mål', 'home'))).toBe(true);
  });

  it('⚠️ mål uten teamSide behandles som mål IMOT', () => {
    // Skal ikke skje etter 00020, men forsiktighetsregelen er låst: bedre å
    // underfeire eget mål enn å feire motstanderens.
    expect(hasHeia(withMatchEvent('mål', undefined))).toBe(false);
  });

  it.each([
    ['avspark', 'match_start'],
    ['pause', 'match_event'],
    ['andre_omgang', 'match_event'],
    ['slutt', 'match_end'],
    ['melding', 'match_event'],
  ] as const)(
    '⚠️ RØRER IKKE %s — feeden er ikke kampforløpet',
    (type, postType) => {
      expect(hasHeia(withMatchEvent(type, undefined, postType))).toBe(true);
    },
  );

  it('⭐ BRUKERENS BILDE på et mål imot BEHOLDER HEIA (skive 8)', () => {
    // Et kampbilde bærer SAMME match_event_id som øyeblikket det henger på
    // (00028), så `get_team_feed` gir det `match_event_type = mål/away`.
    // Skive 9s gate så bare på det og tok knappen fra brukerens eget bilde.
    // Basen avviser heller ikke bildet (`trg_no_heia_on_opponent_goal` krever
    // at posten er systemets), så en skjult knapp her var ren tapt HEIA.
    expect(hasHeia(withMatchEvent('mål', 'away', 'bilde'))).toBe(true);
  });

  it('rører ikke vanlige poster', () => {
    expect(hasHeia(BASE)).toBe(true);
  });

  it('rører ikke en server som er eldre enn 00072', () => {
    // `matchEvent` mangler ⇒ oppfør deg nøyaktig som før migrasjonen.
    const uten: FeedItem = {...withMatchEvent('mål', 'away')};
    delete uten.matchEvent;
    expect(hasHeia(uten)).toBe(true);
  });

  it('kommentarpillen står igjen alene på målet imot', () => {
    const tree = render(withMatchEvent('mål', 'away'));
    const labels: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const node = n as {
        props?: {accessibilityLabel?: string};
        children?: unknown;
      };
      if (node.props?.accessibilityLabel) {
        labels.push(node.props.accessibilityLabel);
      }
      walk(node.children);
    };
    walk(tree.toJSON());
    expect(labels).toContain('Kommenter');
    expect(labels).not.toContain('Heia');
  });
});

describe('isOpponentGoal er ÉN kilde, ikke to formuleringer', () => {
  it('er sann bare for mål som ikke er våre', () => {
    expect(isOpponentGoal({type: 'mål', teamSide: 'away'})).toBe(true);
    expect(isOpponentGoal({type: 'mål'})).toBe(true);
    expect(isOpponentGoal({type: 'mål', teamSide: 'home'})).toBe(false);
    expect(isOpponentGoal({type: 'melding'})).toBe(false);
    expect(isOpponentGoal({type: 'avspark'})).toBe(false);
  });

  it('kampens gate er fortsatt STRENGERE enn feedens', () => {
    // Rytmemarkørene har ingen engasjementslinje i kampforløpet, men de har
    // HEIA i feeden. Blir disse to like, er noe slått sammen som ikke skulle.
    expect(allowsHeia({type: 'avspark'})).toBe(false);
    expect(isOpponentGoal({type: 'avspark'})).toBe(false);
  });

  it('ingen av dem tillater HEIA på mål imot', () => {
    expect(allowsHeia({type: 'mål', teamSide: 'away'})).toBe(false);
    expect(allowsHeia({type: 'mål'})).toBe(false);
  });
});
