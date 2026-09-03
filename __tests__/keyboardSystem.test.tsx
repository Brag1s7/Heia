/**
 * @format
 *
 * TASTATURSYSTEMET (keyboard.tsx) — én eier per skjerm, ingen magiske tall,
 * INGEN layout-animasjon i JS:
 *
 *   · insetten kommer fra tastaturets EGEN ramme (forslagslinja er med),
 *   · safe area telles nøyaktig én gang (løftet = tastatur − safe area),
 *   · løftet er en NATIVE-DREVET transform med tastaturets varighet,
 *   · like verdier starter aldri en ny overgang,
 *   · første trykk på Send går til knappen (persistTaps «handled»),
 *   · Reduce Motion: hopp (varighet 0), ikke bevegelse.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Animated, Dimensions, Keyboard, Text} from 'react-native';
import {
  KEYBOARD_EASING,
  WRITING_SCROLL_PROPS,
  composerLift,
  keyboardDuration,
  keyboardInsetFromEvent,
  useKeyboardLift,
} from '../src/components/keyboard';

const H = Dimensions.get('window').height;
const frame = (screenY: number, duration = 250) =>
  ({
    endCoordinates: {screenY, height: H - screenY, screenX: 0, width: 390},
    startCoordinates: {screenY: H, height: 0, screenX: 0, width: 390},
    duration,
    easing: 'keyboard',
    isEventFromThisApp: true,
  } as never);

describe('insetten fra tastaturets ramme', () => {
  it('er avstanden fra skjermbunnen til rammens topp — forslagslinja er med', () => {
    expect(keyboardInsetFromEvent(frame(H - 336), H)).toBe(336);
    expect(keyboardInsetFromEvent(frame(H - 380), H)).toBe(380);
  });
  it('er 0 når tastaturet er nede, og uten ramme', () => {
    expect(keyboardInsetFromEvent(frame(H), H)).toBe(0);
    expect(keyboardInsetFromEvent(null, H)).toBe(0);
    expect(keyboardInsetFromEvent(undefined, H)).toBe(0);
  });
});

describe('composerLift: safe area nøyaktig én gang', () => {
  it('tastatur oppe: løftet er tastaturet MINUS safe area (den ligger alt i dokkens padding)', () => {
    expect(composerLift(336, 34)).toBe(-302);
    expect(composerLift(336, 0)).toBe(-336);
  });
  it('tastatur nede: ingen løft — aldri positivt', () => {
    expect(composerLift(0, 34)).toBe(-0);
    expect(composerLift(20, 34)).toBe(-0);
  });
});

describe('tastaturets varighet og kurve', () => {
  it('bruker hendelsens varighet; 250 ms uten', () => {
    expect(keyboardDuration(frame(H - 336, 300))).toBe(300);
    expect(keyboardDuration(frame(H - 336, 0))).toBe(250);
  });
  it('kurven er rask ut av start og demper inn (ikke lineær)', () => {
    expect(KEYBOARD_EASING(0.25)).toBeGreaterThan(0.4);
    expect(KEYBOARD_EASING(1)).toBeCloseTo(1, 5);
  });
});

describe('scroll-props for skriveflater', () => {
  it('første trykk på Send går til knappen; drag lukker tastaturet med én gang', () => {
    expect(WRITING_SCROLL_PROPS.keyboardShouldPersistTaps).toBe('handled');
    expect(WRITING_SCROLL_PROPS.keyboardDismissMode).toBe('on-drag');
  });
});

describe('useKeyboardLift', () => {
  type Listener = (e: unknown) => void;
  let listeners: Record<string, Listener[]>;
  let timing: jest.SpyInstance;
  const start = jest.fn();

  beforeEach(() => {
    listeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      evt: string,
      cb: Listener,
    ) => {
      (listeners[evt] ??= []).push(cb);
      return {remove: jest.fn()};
    }) as never);
    timing = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((() => ({
        start,
        stop: jest.fn(),
        reset: jest.fn(),
      })) as never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    start.mockClear();
  });

  function Probe() {
    useKeyboardLift(34);
    return <Text>ok</Text>;
  }

  it('native-drevet transform med tastaturets varighet; like verdier startes ikke to ganger', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(<Probe />);
    });
    expect(listeners.keyboardWillChangeFrame).toHaveLength(1);
    expect(listeners.keyboardWillHide).toHaveLength(1);

    act(() => listeners.keyboardWillChangeFrame[0](frame(H - 336)));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        toValue: -302,
        duration: 250,
        useNativeDriver: true,
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);

    // Skjul: WillChangeFrame OG WillHide fyrer — bare ÉN overgang.
    act(() => listeners.keyboardWillChangeFrame[0](frame(H)));
    act(() => listeners.keyboardWillHide[0](frame(H)));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(
      expect.objectContaining({toValue: -0, useNativeDriver: true}),
    );
    act(() => tree.unmount());
  });
});
