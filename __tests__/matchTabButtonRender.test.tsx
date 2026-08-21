/**
 * @format
 *
 * RØYKTEST FOR KAMPKNAPPEN — at pillen faktisk TEGNER seg i alle åtte
 * tilstandene, med riktig ord og riktig glyf.
 *
 * `tabBar.test.tsx` stubber komponenten (den testen handler om baren), og
 * `matchButton.test.ts` tester tilstanden uten å tegne. Uten denne fila
 * ville selve flaten stått uprøvd til den nådde telefonen.
 */
import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import type {MatchButtonState} from '../src/shared/matchButton';

let mockState: MatchButtonState;

jest.mock('../src/context/MatchButtonContext', () => ({
  useMatchButton: () => ({state: mockState}),
}));
jest.mock('../src/components/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

let mockReducedMotion = false;

import {MatchTabButton} from '../src/components/MatchTabButton';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(state: MatchButtonState) {
  mockState = state;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<MatchTabButton />);
  });
  mounted.push(tree);
  return tree;
}

function tekster(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map(n => {
      const c = n.props.children;
      return (Array.isArray(c) ? c : [c])
        .filter((x: unknown) => typeof x === 'string')
        .join('');
    })
    .filter(Boolean);
}

const s = (over: Partial<MatchButtonState>): MatchButtonState => ({
  kind: 'idle',
  label: 'KAMP',
  tabLabel: 'Sesongen',
  a11yLabel: 'Kamp',
  disabled: false,
  ...over,
});

it.each([
  ['idle', 'KAMP'],
  ['live', '2–1'],
  ['pause', 'PAUSE 2–1'],
  ['heia', 'HEIA!'],
  ['heiet', 'HEIET'],
  ['heia-tom', 'HEIA!'],
  ['rapporter', 'RAPPORTER'],
  ['lukk', 'LUKK'],
] as const)('tegner «%s» med ordet %s', (kind, label) => {
  expect(tekster(render(s({kind, label})))).toContain(label);
});

/**
 * ⚠️ HEIA-SYMBOLET ER 👏 — IKKE PROTOTYPENS HÅND-SVG. Skive 4.1 avviste
 * nøyaktig det lånet én gang før: i feeden, i kommentarene og i kampforløpet
 * er HEIA 👏, og et sjette sted med en sjuende tegning ville vært et ikon å
 * vedlikeholde uten en betydning å bære.
 */
it('bruker 👏 på HEIA — samme glyf som feeden og forløpet', () => {
  expect(tekster(render(s({kind: 'heia', label: 'HEIA!'})))).toContain('👏');
});

it('lange ord bærer ingen glyf — plassen er ikke der', () => {
  expect(tekster(render(s({kind: 'rapporter', label: 'RAPPORTER'})))).toEqual([
    'RAPPORTER',
  ]);
});

it('en disabled knapp tegnes dempet, men står der', () => {
  const tree = render(s({kind: 'heia-tom', label: 'HEIA!', disabled: true}));
  expect(tekster(tree)).toContain('HEIA!');
});

it('overlever Reduce Motion — prikken puster ikke, men ordet står', () => {
  mockReducedMotion = true;
  expect(tekster(render(s({kind: 'live', label: '2–1'})))).toContain('2–1');
  mockReducedMotion = false;
});
