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
    CommentThread: (props: {
      postId: string;
      onPostDeleted: () => void;
      onOpenMatch?: (eventId: string) => void;
    }) => (
      <>
        <Text onPress={props.onPostDeleted}>TRÅD:{props.postId}</Text>
        {props.onOpenMatch && (
          <Text onPress={() => props.onOpenMatch!('ev-1')}>SE-KAMPEN</Text>
        )}
      </>
    ),
  };
});

import {
  CommentSheet,
  FEED_CLOSE,
  feedCloseTiming,
  FEED_SHEET_REST_RATIO,
  FEED_SHEET_SCRIM,
  FEED_SHEET_TOP_GAP,
} from '../src/components/match/CommentSheet';

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

/**
 * FEEDARKET (variant="feed", 2026-09-03) — kommentarer fra Hjem som ark
 * over feeden. Vokter: kamparket er URØRT, hvilepunkt 68 %, full = safe
 * area + 8, tastatur utvider, «Se kampen» lukker FØR kampen åpnes, scrimmet
 * er Heia-blekk og ikke kampens grønne.
 */
describe('kommentararket fra Hjem (variant="feed")', () => {
  const RNStyleSheet = require('react-native').StyleSheet;
  const RNKeyboard = require('react-native').Keyboard;
  // Arket måler seg mot `useWindowDimensions` (jest-vinduet), safe area 0.
  const H: number = require('react-native').Dimensions.get('window').height;

  function sheetTop(tree: ReactTestRenderer.ReactTestRenderer): number {
    const sheet = tree.root.find(
      n =>
        n.props?.accessibilityViewIsModal === true &&
        n.props?.accessibilityLabel === 'Kommentarer' &&
        typeof n.type === 'string',
    );
    const top = RNStyleSheet.flatten(sheet.props.style).top;
    return typeof top === 'number' ? top : Number(top);
  }

  it('kamparket er urørt: fast 78 %-ramme, ingen «Se kampen»', () => {
    const tree = render({onOpenMatch: jest.fn()});
    const frames = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        RNStyleSheet.flatten(n.props.style)?.height === '78%',
    );
    expect(frames.length).toBeGreaterThan(0);
    expect(texts(tree)).not.toContain('SE-KAMPEN');
  });

  it('åpner på hvilepunktet 68 % — og har ingen 78 %-ramme', () => {
    const tree = render({variant: 'feed'});
    settle();
    expect(sheetTop(tree)).toBeCloseTo(H * (1 - FEED_SHEET_REST_RATIO), 3);
    const frames = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        RNStyleSheet.flatten(n.props.style)?.height === '78%',
    );
    expect(frames).toHaveLength(0);
    expect(texts(tree)).toContain('TRÅD:p-goal');
  });

  it('tastaturet utvider arket til full høyde (safe area + 8)', () => {
    const listeners: Record<string, (e: {duration?: number}) => void> = {};
    const spy = jest.spyOn(RNKeyboard, 'addListener').mockImplementation(((
      evt: string,
      cb: (e: unknown) => void,
    ) => {
      listeners[evt] = cb;
      return {remove: jest.fn()};
    }) as never);
    const tree = render({variant: 'feed'});
    settle();
    // iOS lytter FØR tastaturet kommer, så arket og tastaturet går sammen.
    expect(listeners.keyboardWillShow).toBeDefined();
    act(() => {
      listeners.keyboardWillShow({duration: 250});
    });
    settle();
    expect(sheetTop(tree)).toBe(0 + FEED_SHEET_TOP_GAP);
    spy.mockRestore();
  });

  it('«Se kampen» glir arket ned FØR kampen åpnes', () => {
    const onClose = jest.fn();
    const onOpenMatch = jest.fn();
    const tree = render({variant: 'feed', onClose, onOpenMatch});
    settle();
    const link = tree.root
      .findAllByType(RNText)
      .find(t => String(t.props.children) === 'SE-KAMPEN')!;
    act(() => {
      link.props.onPress();
    });
    // Ikke med én gang — bevegelsen først.
    expect(onOpenMatch).not.toHaveBeenCalled();
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenMatch).toHaveBeenCalledWith('ev-1');
  });

  it('scrimmet er Heia-blekk på 0,24 — ikke kampens grønne 0,32, ikke svart', () => {
    expect(FEED_SHEET_SCRIM).toBe('rgba(8, 57, 46, 0.24)');
    const tree = render({variant: 'feed'});
    const colorsUsed = tree.root
      .findAll(n => typeof n.type === 'string')
      .map(n => RNStyleSheet.flatten(n.props.style)?.backgroundColor)
      .filter(Boolean) as string[];
    expect(colorsUsed).toContain(FEED_SHEET_SCRIM);
    expect(colorsUsed).not.toContain('rgba(8, 27, 19, 0.32)');
  });

  it('veiene ut finnes: bakgrunn, Android-tilbake, slettet innlegg — og hodet er gripeflate', () => {
    const onClose = jest.fn();
    const tree = render({variant: 'feed', onClose});
    settle();
    // Android-tilbake.
    act(() => {
      tree.root.findByType(RNModal).props.onRequestClose();
    });
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Hodet tar responderen ved berøring, i capture-fasen — som kamparket.
    const grabbers = tree.root.findAll(
      node => typeof node.props?.onMoveShouldSetResponder === 'function',
      {deep: true},
    );
    expect(grabbers.length).toBeGreaterThan(0);
    for (const g of grabbers) {
      expect(typeof g.props.onStartShouldSetResponderCapture).toBe('function');
      expect(g.props.onStartShouldSetResponder()).toBe(true);
      expect(g.props.onResponderTerminationRequest()).toBe(false);
    }
    expect(
      tree.root.findAll(
        n => n.props?.accessibilityLabel === 'Lukk kommentarene',
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('tastaturet har ÉN eier (keyboard.tsx)', () => {
  const RNKAV = require('react-native').KeyboardAvoidingView;
  it('verken kamparket eller feedarket har KeyboardAvoidingView — dokken i tråden eier tastaturet', () => {
    // Rotårsaken 2026-09-03: KAV inne i det absolutt plasserte feedarket
    // regnet overlappen fra `frame.y` relativt til forelderen (= 0), og
    // feltet + Send lå bak tastaturet. Ingen KAV i noen vert.
    expect(render().root.findAllByType(RNKAV)).toHaveLength(0);
    expect(render({variant: 'feed'}).root.findAllByType(RNKAV)).toHaveLength(0);
  });
});

describe('berøring av hodet lukker tastaturet med én gang', () => {
  const RNKeyboard = require('react-native').Keyboard;
  for (const variant of ['match', 'feed'] as const) {
    it(`${variant}: trykk eller drag på hodet → Keyboard.dismiss`, () => {
      const dismiss = jest
        .spyOn(RNKeyboard, 'dismiss')
        .mockImplementation(() => {});
      const tree = render(variant === 'feed' ? {variant} : {});
      settle();
      // Hodet: responderen som også bærer tittelen (ikke bakgrunnens
      // Pressable, som har egen grant via Pressability).
      const heads = tree.root
        .findAll(
          node => typeof node.props?.onMoveShouldSetResponder === 'function',
          {deep: true},
        )
        .filter(node =>
          node
            .findAllByType(RNText)
            .some(t => String(t.props.children) === 'Kommentarer'),
        );
      expect(heads.length).toBeGreaterThan(0);
      const touch = {
        touchActive: true,
        startPageX: 0,
        startPageY: 0,
        startTimeStamp: 0,
        currentPageX: 0,
        currentPageY: 0,
        currentTimeStamp: 0,
        previousPageX: 0,
        previousPageY: 0,
        previousTimeStamp: 0,
      };
      act(() => {
        heads[0].props.onResponderGrant({
          persist() {},
          nativeEvent: {touches: [], pageX: 0, pageY: 0, timestamp: 0},
          touchHistory: {
            touchBank: [touch],
            numberActiveTouches: 1,
            indexOfSingleActiveTouch: 0,
            mostRecentTimeStamp: 0,
          },
        });
      });
      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });
  }
});

describe('feedarkets utglidning: rask som bakgrunnstrykket (Brage 2026-09-03)', () => {
  it('sakte slipp og trykk = samme 210 ms ease-in som bakgrunnstrykket', () => {
    expect(feedCloseTiming(580, undefined)).toEqual({
      duration: 210,
      linear: false,
    });
    expect(feedCloseTiming(580, 0)).toEqual({duration: 210, linear: false});
    expect(feedCloseTiming(580, 0.6)).toEqual({duration: 210, linear: false});
  });
  it('ekte kast fortsetter i fingerens fart, men aldri lenger enn 240 ms', () => {
    const fast = feedCloseTiming(580, 1.2);
    expect(fast.linear).toBe(true);
    expect(fast.duration).toBe(FEED_CLOSE.maxMs);
    expect(FEED_CLOSE.maxMs).toBeLessThanOrEqual(240);
    const veryFast = feedCloseTiming(580, 8);
    expect(veryFast.duration).toBe(FEED_CLOSE.minMs);
    expect(feedCloseTiming(300, 2).duration).toBe(150);
  });
});
