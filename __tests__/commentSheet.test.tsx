/**
 * @format
 *
 * SAMTALEN KOMMER OPP OVER KAMPEN — den sender deg ikke bort fra den.
 *
 * Skive 4 navigerte til `CommentsScreen`. Riktig fra feeden, feil fra kampen:
 * en pågående kamp er noe du STÅR I. Skive 4.1 gjorde inngangen til et
 * bunnark, og denne fila vokter de tre tingene som ellers kan forsvinne
 * stille i en senere redigering:
 *
 *   1. Det er DEN SAMME tråden (`CommentThread`) — ikke en kampversjon av
 *      kommentarer som kan drifte fra feedens.
 *   2. Veiene ut finnes ALLE TRE: håndtaket/bakgrunnen, Android-tilbake
 *      (`onRequestClose`) og et slettet innlegg.
 *   3. VoiceOver leser ikke kampen bak arket (`accessibilityViewIsModal`).
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

// Selve tråden har hele API-laget bak seg — her er det RAMMEN som testes.
// Mocken beviser samtidig at arket faktisk bruker den delte komponenten.
jest.mock('../src/components/CommentThread', () => {
  const {Text} = require('react-native');
  return {
    CommentThread: (props: {postId: string; onPostDeleted: () => void}) => (
      <Text onPress={props.onPostDeleted}>TRÅD:{props.postId}</Text>
    ),
  };
});

import {CommentSheet} from '../src/components/match/CommentSheet';

/**
 * ⚠️ LUKKINGEN ER ANIMERT (4.2). Arket glir ned FØR `onClose` kalles — ellers
 * ville det forsvunnet med et klipp. Testene må derfor la bevegelsen løpe
 * ferdig; gjør de ikke det, «beviser» de at knappen er død.
 */
function settle() {
  act(() => {
    jest.advanceTimersByTime(600);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  jest.clearAllMocks();
});

function render(
  props: Partial<React.ComponentProps<typeof CommentSheet>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <CommentSheet
        postId="p-goal"
        teamSpaceId="ts1"
        onClose={jest.fn()}
        {...props}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

const RNText = require('react-native').Text;
const RNModal = require('react-native').Modal;

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(RNText).map(n => {
    const c = n.props.children;
    return (Array.isArray(c) ? c : [c])
      .filter((x: unknown) => typeof x === 'string' || typeof x === 'number')
      .join('');
  });
}

describe('kommentararket over kampen', () => {
  it('viser DEN DELTE tråden for den kanoniske posten', () => {
    expect(texts(render())).toContain('TRÅD:p-goal');
  });

  it('er lukket når ingen post er valgt', () => {
    const modal = render({postId: null}).root.findByType(RNModal);
    expect(modal.props.visible).toBe(false);
  });

  it('lukkes av Android-tilbake', () => {
    // Uten `onRequestClose` er arket en blindvei på Android: systemgesten
    // lukker ingenting, og brukeren sitter fast i tråden.
    const onClose = jest.fn();
    const modal = render({onClose}).root.findByType(RNModal);
    act(() => modal.props.onRequestClose());
    settle();
    expect(onClose).toHaveBeenCalled();
  });

  it('lukkes ved trykk utenfor, og den flaten har en label', () => {
    const onClose = jest.fn();
    const backdrop = render({onClose}).root.find(
      node =>
        node.props?.accessibilityLabel === 'Lukk kommentarene' &&
        typeof node.props?.onPress === 'function',
    );
    act(() => backdrop.props.onPress());
    settle();
    expect(onClose).toHaveBeenCalled();
  });

  it('lukkes når innlegget slettes — arket skal ikke bli stående tomt', () => {
    const onClose = jest.fn();
    const tree = render({onClose});
    const thread = tree.root
      .findAllByType(RNText)
      .find(n => String(n.props.children).includes('TRÅD'))!;
    act(() => thread.props.onPress());
    settle();
    expect(onClose).toHaveBeenCalled();
  });

  it('skjuler kampen bak arket for VoiceOver', () => {
    const modal = render().root.findAllByProps({
      accessibilityViewIsModal: true,
    });
    expect(modal.length).toBeGreaterThan(0);
  });

  it('legger IKKE en svart vask over kampen', () => {
    // ⚠️ `rgba(0,0,0,0.5)` (mønsteret fra MatchPhotoSheet) slukket den grønne
    // verdenen. Kampen skal fortsatt være DER bak arket — det er hele
    // grunnen til at dette er et ark og ikke en skjerm.
    const {StyleSheet} = require('react-native');
    const backdrop = render().root.find(
      node =>
        node.props?.accessibilityLabel === 'Lukk kommentarene' &&
        typeof node.props?.onPress === 'function',
    );
    // Fargen ligger på det animerte laget rundt trykkflaten.
    const colorsSeen: string[] = [];
    let cur: typeof backdrop | null = backdrop;
    while (cur) {
      const flat = StyleSheet.flatten(cur.props?.style) ?? {};
      if (typeof flat.backgroundColor === 'string') {
        colorsSeen.push(flat.backgroundColor);
      }
      cur = cur.parent;
    }
    expect(colorsSeen.length).toBeGreaterThan(0);
    for (const c of colorsSeen) {
      expect(c).not.toMatch(/^rgba\(0, *0, *0/);
      expect(c).not.toBe('#000000');
      expect(c).not.toBe('black');
    }
  });

  it('gjør TOPPEN til en gripeflate man kan dra ned', () => {
    // Gesten bor på hodet, ikke på hele arket: under ligger en scrollende
    // tråd, og en drag-to-dismiss over den ville kjempet med scrollen.
    const tree = render();
    const grabbers = tree.root.findAll(
      node => typeof node.props?.onMoveShouldSetResponder === 'function',
      {deep: true},
    );
    expect(grabbers.length).toBeGreaterThan(0);

    // ⚠️ Den må ta responderen ALLEREDE VED BERØRING, og i capture-fasen.
    // Første forsøk hadde bare move-handlere med en 4 pt-terskel, og da var
    // gesten upålitelig: berøringen starter som regel på tittelteksten, og
    // responderen måtte vinnes gjennom en forhandling. Hodet har ingenting
    // å trykke på, så det er trygt å klamre seg til den med én gang.
    for (const g of grabbers) {
      expect(typeof g.props.onStartShouldSetResponder).toBe('function');
      expect(typeof g.props.onStartShouldSetResponderCapture).toBe('function');
      expect(g.props.onStartShouldSetResponder()).toBe(true);
      // …og ingen skal kunne be om å overta MIDT i draget.
      expect(g.props.onResponderTerminationRequest()).toBe(false);
    }

    // …og den skal ligge over tittelen, ikke rundt tråden.
    const heads = grabbers.filter(node =>
      node
        .findAllByType(RNText)
        .some(t => String(t.props.children) === 'Kommentarer'),
    );
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      expect(
        head
          .findAllByType(RNText)
          .some(t => String(t.props.children).includes('TRÅD')),
      ).toBe(false);
    }
  });
});
