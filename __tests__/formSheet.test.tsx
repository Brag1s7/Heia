/**
 * @format
 *
 * SKJEMA-ARKET (Brage 2026-09-03): «Ny hendelse» oppfører seg som
 * kommentararket — full bredde, opp over skjermen bak, dras ned. Vokter:
 *   1. arket ER glasset (`GLASS.sheet`, fyller arket) — ingen panel oppå;
 *   2. scrimmet er feedarkets Heia-blekk 0,24 (ikke svart), og bakflaten
 *      er trykkbar med label;
 *   3. Avbryt, bakflaten og `ref.dismiss()` går ALLE via utglidningen før
 *      `onDismissed` (= goBack) — aldri goBack rett fra en knapp;
 *   4. utglidningens tider er feedarkets regel (sakte slipp = 210 ms
 *      ease-in; kast = fingerens fart, 120–240 ms, lineært).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {
  FormSheet,
  FORM_SHEET_SCRIM,
  closeTiming,
  type FormSheetHandle,
} from '../src/components/FormSheet';
import {LiquidGlassSurface} from '../src/components/LiquidGlassSurface';

jest.useFakeTimers();
const settle = () => {
  act(() => {
    jest.advanceTimersByTime(600);
  });
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(onDismissed = jest.fn(), ref?: React.Ref<FormSheetHandle>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FormSheet ref={ref} title="Ny hendelse" onDismissed={onDismissed}>
        <Text>SKJEMA</Text>
      </FormSheet>,
    );
  });
  mounted.push(tree);
  return tree;
}

describe('skjema-arket', () => {
  it('er glasset selv — sheet-varianten fyller arket, innholdet ligger oppå', () => {
    const tree = render();
    const glass = tree.root.findByType(LiquidGlassSurface);
    expect(glass.props.variant).toBe('sheet');
    expect(glass.props.fill).toBe(true);
    expect(
      tree.root.findAll(
        n => n.type === 'Text' && n.children.join('') === 'SKJEMA',
      ),
    ).toHaveLength(1);
    expect(
      tree.root.findAll(
        n => n.type === 'Text' && n.children.join('') === 'Ny hendelse',
      ),
    ).toHaveLength(1);
  });

  it('scrimmet er Heia-blekk 0,24, og bakflaten lukker via utglidningen', () => {
    const onDismissed = jest.fn();
    const tree = render(onDismissed);
    expect(FORM_SHEET_SCRIM).toBe('rgba(8, 57, 46, 0.24)');
    const backdrop = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'Lukk skjemaet' &&
        typeof n.props?.onPress === 'function',
    );
    act(() => backdrop.props.onPress());
    // Ikke med én gang — arket skal ut først.
    expect(onDismissed).not.toHaveBeenCalled();
    settle();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('«Avbryt» går samme vei', () => {
    const onDismissed = jest.fn();
    const tree = render(onDismissed);
    const cancel = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'Avbryt' &&
        typeof n.props?.onPress === 'function',
    );
    act(() => cancel.props.onPress());
    settle();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('ref.dismiss() — skjermens egen lukking etter lagring — går samme vei, og er idempotent', () => {
    const onDismissed = jest.fn();
    const ref = React.createRef<FormSheetHandle>();
    render(onDismissed, ref);
    act(() => {
      ref.current!.dismiss();
      ref.current!.dismiss();
    });
    settle();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('hodet er gripeflaten (responder-props) og har handle 36×5', () => {
    const tree = render();
    // PanResponder.panHandlers legges på hodet som responder-props.
    const head = tree.root.find(
      n =>
        n.type === 'View' &&
        typeof n.props?.onMoveShouldSetResponderCapture === 'function',
    );
    expect(head).toBeTruthy();
    const handle = tree.root.find(
      n =>
        n.type === 'View' &&
        StyleSheet.flatten(n.props.style)?.width === 36 &&
        StyleSheet.flatten(n.props.style)?.height === 5,
    );
    expect(handle).toBeTruthy();
  });

  it('utglidningen følger feedarkets regel', () => {
    expect(closeTiming(500, undefined)).toEqual({duration: 210, linear: false});
    expect(closeTiming(500, 0.4)).toEqual({duration: 210, linear: false});
    expect(closeTiming(600, 2)).toEqual({duration: 240, linear: true});
    expect(closeTiming(100, 2)).toEqual({duration: 120, linear: true});
    expect(closeTiming(300, 2)).toEqual({duration: 150, linear: true});
  });
});
