/**
 * @format
 *
 * TRÅDENS COMPOSER-DOKK ER TASTATURETS ENESTE EIER (keyboard.tsx).
 *
 * Telefonbildet 2026-09-03: feltet og Send lå bak tastaturet i feedarket.
 * Rotårsaken var KeyboardAvoidingView inne i det absolutt plasserte arket
 * (RN regner `frame.y` relativt til forelderen = 0). Nå padder dokken seg
 * selv fra tastaturets egen ramme — likt i CommentSheet ×2 og
 * CommentsScreen, fordi det er SAMME komponent.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {
  Animated,
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  // Safe area 34 — så «ikke dobbelt» kan bevises med tall.
  useSafeAreaInsets: () => ({top: 59, right: 0, bottom: 34, left: 0}),
}));
jest.mock('../src/context', () => ({
  useAuth: () => ({session: {user: {id: 'u1'}}}),
  useActiveTeam: () => ({
    activeTeamSpace: {id: 'ts1', color: '#1D4633'},
    activeTeamSpaceId: 'ts1',
    activeRole: 'spiller',
  }),
}));
const mockCreateComment = jest.fn(() => Promise.resolve());
jest.mock('../src/lib/api/comments', () => ({
  getFeedPost: () =>
    Promise.resolve({
      id: 'p1',
      teamSpaceId: 'ts1',
      type: 'melding',
      author: {id: 'u2', name: 'Ola Nordmann', role: 'spiller'},
      content: 'God trening i dag!',
      createdAt: new Date(),
      heiaCount: 0,
      commentCount: 0,
      iReacted: false,
    }),
  getComments: () =>
    Promise.resolve([
      {
        id: 'c-old',
        author: {id: 'u3', name: 'Kari'},
        createdAt: new Date(Date.now() - 60_000),
        content: 'Første kommentar',
      },
      {
        id: 'c-new',
        author: {id: 'u4', name: 'Per'},
        createdAt: new Date(),
        content: 'Nyeste kommentar',
      },
    ]),
  createComment: (...a: unknown[]) => mockCreateComment(...(a as [])),
  deleteComment: jest.fn(),
}));
jest.mock('../src/lib/api/feed', () => ({
  toggleReaction: jest.fn(),
  deletePost: jest.fn(),
}));
jest.mock('../src/lib/queries/feed', () => ({adjustFeedItemCounts: jest.fn()}));
jest.mock('../src/lib/queries/eventDetail', () => ({
  adjustMatchEngagement: jest.fn(),
}));
jest.mock('../src/lib/moderation', () => ({promptReport: jest.fn()}));
jest.mock('../src/lib/media/MediaImage', () => ({MediaImage: () => null}));
jest.mock('../src/lib/media/avatar', () => ({avatarRef: () => undefined}));

import {CommentThread} from '../src/components/CommentThread';
import {spacing} from '../src/theme';

const H = Dimensions.get('window').height;
const frame = (screenY: number) =>
  ({
    endCoordinates: {screenY, height: H - screenY, screenX: 0, width: 390},
    duration: 250,
    easing: 'keyboard',
  } as never);

type Listener = (e: unknown) => void;
let listeners: Record<string, Listener[]>;
beforeEach(() => {
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    evt: string,
    cb: Listener,
  ) => {
    (listeners[evt] ??= []).push(cb);
    return {remove: jest.fn()};
  }) as never);
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  mockCreateComment.mockClear();
});

async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <CommentThread postId="p1" teamSpaceId="ts1" onPostDeleted={() => {}} />,
    );
  });
  await act(async () => {});
  return tree;
}

const flat = (s: unknown) =>
  StyleSheet.flatten(s as never) as Record<string, number>;

/** Dokken = forelderen til skrivefeltet (composeBar). */
function dock(tree: ReactTestRenderer.ReactTestRenderer) {
  const input = tree.root.findByType(TextInput);
  return input.parent!;
}
function sendButton(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    n => n.props?.title === 'Send' && typeof n.props?.onPress === 'function',
    {deep: false},
  )[0];
}

it('dokken: safe area i egen padding (én gang), løftes med NATIVE transform = tastatur − safe area', async () => {
  const start = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockImplementation((() => ({
    start,
    stop: jest.fn(),
    reset: jest.fn(),
  })) as never);
  const tree = await render();
  // Paddingen endres ALDRI av tastaturet — ingen layout-animasjon.
  expect(flat(dock(tree).props.style).paddingBottom).toBe(34 + spacing.sm);
  // Animated.View-elementet rundt dokken: første forelder med en
  // translateY som er en Animated.Value (hostens View har tallet).
  let node = dock(tree).parent;
  let translateY: unknown;
  while (node) {
    const t = flat(node.props?.style).transform as unknown as
      | Array<{translateY?: unknown}>
      | undefined;
    if (t?.[0]?.translateY instanceof Animated.Value) {
      translateY = t[0].translateY;
      break;
    }
    node = node.parent;
  }
  expect(translateY).toBeInstanceOf(Animated.Value);
  const transform = [{translateY}];

  await act(async () => listeners.keyboardWillChangeFrame[0](frame(H - 336)));
  expect(flat(dock(tree).props.style).paddingBottom).toBe(34 + spacing.sm);
  expect(timing).toHaveBeenLastCalledWith(
    transform[0].translateY,
    expect.objectContaining({toValue: -302, useNativeDriver: true}),
  );

  await act(async () => listeners.keyboardWillHide[0](frame(H)));
  expect(timing).toHaveBeenLastCalledWith(
    transform[0].translateY,
    expect.objectContaining({toValue: -0, useNativeDriver: true}),
  );
  timing.mockRestore();
  act(() => tree.unmount());
});

it('lista: native tastatur-inset, dokkens høyde reservert, og ÉN lukkeregel — berøring utenfor feltet lukker ved berøringsstart', async () => {
  const tree = await render();
  const list = tree.root.findByType(ScrollView);
  expect(list.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(list.props.keyboardDismissMode).toBe('on-drag');
  expect(list.props.keyboardShouldPersistTaps).toBe('handled');
  // Trykk, hold eller drag: samme øyeblikk (touch start), samme resultat.
  act(() => list.props.onTouchStart());
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  // Lista ligger bak dokken og reserverer dokkens høyde + pust nederst.
  expect(flat(list.props.contentContainerStyle).paddingBottom).toBe(
    0 + spacing.lg,
  );
  act(() => tree.unmount());
});

it('nyeste kommentar øverst — det du nettopp sendte ligger rett under innlegget', async () => {
  const tree = await render();
  const {Text} = require('react-native');
  const texts = tree.root
    .findAllByType(Text)
    .map(t =>
      Array.isArray(t.props.children)
        ? t.props.children.join('')
        : String(t.props.children),
    );
  const iNew = texts.indexOf('Nyeste kommentar');
  const iOld = texts.indexOf('Første kommentar');
  expect(iNew).toBeGreaterThan(-1);
  expect(iOld).toBeGreaterThan(-1);
  expect(iNew).toBeLessThan(iOld);
  act(() => tree.unmount());
});

it('Send står UTENFOR lista (første trykk treffer) og virker på første trykk med tastaturet oppe', async () => {
  const tree = await render();
  await act(async () => listeners.keyboardWillChangeFrame[0](frame(H - 336)));
  const list = tree.root.findByType(ScrollView);
  expect(
    list.findAll(n => n.props?.title === 'Send', {deep: true}),
  ).toHaveLength(0);

  const input = tree.root.findByType(TextInput);
  act(() => input.props.onChangeText('Heia!'));
  await act(async () => sendButton(tree).props.onPress());
  expect(mockCreateComment).toHaveBeenCalledTimes(1);
  expect(mockCreateComment).toHaveBeenCalledWith('p1', 'Heia!');
  act(() => tree.unmount());
});

it('sendepolicy: Return = linjeskift (multiline, ingen submit), Send publiserer; etter sending tømmes feltet og beholder fokus/tastatur', async () => {
  const tree = await render();
  const input = tree.root.findByType(TextInput);
  expect(input.props.multiline).toBe(true);
  expect(input.props.onSubmitEditing).toBeUndefined();
  expect(input.props.blurOnSubmit).toBeUndefined();

  act(() => input.props.onChangeText('Heia!'));
  await act(async () => sendButton(tree).props.onPress());
  const after = tree.root.findByType(TextInput);
  expect(after.props.value).toBe('');
  // …og lista ruller til der kommentarene begynner, så den nye er synlig
  // UTEN å lukke tastaturet.
  await act(async () => {
    await new Promise(r => setTimeout(r, 30));
  });
  const list = tree.root.findByType(ScrollView);
  expect(list.instance.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({animated: true}),
  );
  // ⚠️ `editable={false}` resignerer feltet på iOS → tastaturet forsvant.
  expect(after.props.editable).not.toBe(false);
  expect(Keyboard.dismiss).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
