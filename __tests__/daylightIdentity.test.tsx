/**
 * @format
 *
 * DAGSLYSGRUNNENS `identity`-PROP (Brage 2026-09-04): Profil deler lerretet
 * med Hjem/Kalender/Varsler, men identitetsfeltet er Heias mørkegrønne, ikke
 * det aktive lagets farge.
 *
 * Tre påstander:
 *   1. uten `identity` tegnes feltet i det aktive lagets farge (som før);
 *   2. med `identity` tegnes feltet i DEN fargen — lagfargen er ikke i
 *      lerretet i det hele tatt;
 *   3. uten `masthead` tegnes ikke noe felt, uansett `identity`.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Stop} from 'react-native-svg';
import {DaylightGround} from '../src/components/DaylightGround';

const TEAM_RED = '#D92B2B';
const HEIA_DEEP = '#08392E';

jest.mock('../src/context', () => ({
  useActiveTeam: () => ({activeTeamSpace: {color: '#D92B2B'}}),
}));

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(props: {masthead?: boolean; identity?: string}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<DaylightGround {...props} />);
  });
  mounted.push(tree);
  // Lerretet tegner først når det er målt opp.
  act(() => {
    (
      tree.root.children[0] as ReactTestRenderer.ReactTestInstance
    ).props.onLayout({nativeEvent: {layout: {width: 393, height: 852}}});
  });
  return tree;
}

/** Fyllgradientens stoppfarger — feltet er den eneste med denne id-en. */
function fieldStops(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const grads = tree.root.findAll(n => n.props?.id === 'dgFieldFill');
  if (grads.length === 0) return [];
  return grads[0].findAllByType(Stop).map(s => s.props.stopColor as string);
}

it('1. uten identity: feltet er det aktive lagets farge', () => {
  const stops = fieldStops(render({masthead: true}));
  expect(stops.length).toBeGreaterThan(0);
  expect(stops[0].toUpperCase()).toBe(TEAM_RED);
});

it('2. med identity: feltet er den fargen, og lagfargen finnes ikke i lerretet', () => {
  const tree = render({masthead: true, identity: HEIA_DEEP});
  const stops = fieldStops(tree);
  expect(stops.length).toBeGreaterThan(0);
  expect(stops[0].toUpperCase()).toBe(HEIA_DEEP);
  const everyStop = tree.root
    .findAllByType(Stop)
    .map(s => String(s.props.stopColor).toUpperCase());
  expect(everyStop).not.toContain(TEAM_RED);
});

it('3. uten masthead: ikke noe felt, uansett identity', () => {
  expect(fieldStops(render({identity: HEIA_DEEP}))).toHaveLength(0);
});
