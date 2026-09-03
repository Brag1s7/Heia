/**
 * @format
 *
 * DATO- OG KLOKKESLETTARKET I «NY HENDELSE» (Brage 2026-09-03).
 *
 * To feil fra telefonen, og to påstander som vokter at de ikke kommer
 * tilbake:
 *   1. Arkene er IKKE en RN `Modal` (den hang i flere sekunder inne i den
 *      native modalen) — de er inline glassark uten scrim, med trykkbar
 *      bakflate og `GLASS.sheet`.
 *   2. Hjulets `contentOffset` er FROSSET per montering: et commit (verdien
 *      settes ved drag-slipp) må ikke gi scrollflaten en ny offset-prop midt
 *      i momentumet — det var hakkingen.
 * Pluss: datoarket er samme glass som månedsvisningen, rutenettet `plain`
 * (ingen bokser per dato), og grensene (fortid/framtid) følger med.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Modal, StyleSheet} from 'react-native';
import {LiquidGlassSurface} from '../src/components/LiquidGlassSurface';
import {TimeSheet} from '../src/components/TimeSheet';
import {DateSheet} from '../src/components/DateSheet';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function mount(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(element);
  });
  mounted.push(tree);
  return tree;
}

// `deep: false`: Animated.ScrollView OG dens indre ScrollView bærer samme
// props — bare de ytterste teller, ellers blir «minuttene» timenes indre.
const wheels = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(n => n.props?.snapToInterval === 44, {deep: false});

describe('klokkeslettarket', () => {
  it('er et inline glassark uten Modal og uten scrim', () => {
    const tree = mount(
      <TimeSheet
        visible
        value="18:00"
        onCancel={jest.fn()}
        onDone={jest.fn()}
        reducedMotion
      />,
    );
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(tree.root.findByType(LiquidGlassSurface).props.variant).toBe(
      'sheet',
    );
    const backdrop = tree.root.find(
      n => n.props?.accessibilityLabel === 'Lukk klokkeslettvelgeren',
    );
    expect(StyleSheet.flatten(backdrop.props.style).backgroundColor).toBe(
      undefined,
    );
  });

  it('hjulets contentOffset står stille gjennom et commit', () => {
    const tree = mount(
      <TimeSheet
        visible
        value="18:00"
        onCancel={jest.fn()}
        onDone={jest.fn()}
        reducedMotion
      />,
    );
    const [hours, minutes] = wheels(tree);
    expect(hours.props.contentOffset).toEqual({x: 0, y: 18 * 44});
    expect(minutes.props.contentOffset).toEqual({x: 0, y: 0});
    // Drag-slipp på 20 — verdien endres, og skjermen rendrer på nytt …
    act(() => {
      hours.props.onScrollEndDrag({nativeEvent: {contentOffset: {y: 20 * 44}}});
    });
    // … men offset-propen er den samme som ved montering.
    const [hoursAfter] = wheels(tree);
    expect(hoursAfter.props.contentOffset).toEqual({x: 0, y: 18 * 44});
  });

  it('«Ferdig» sender hjulets verdi, ikke den gamle', () => {
    const onDone = jest.fn();
    const tree = mount(
      <TimeSheet
        visible
        value="18:07"
        onCancel={jest.fn()}
        onDone={onDone}
        reducedMotion
      />,
    );
    const [hours] = wheels(tree);
    act(() => {
      hours.props.onMomentumScrollEnd({
        nativeEvent: {contentOffset: {y: 9 * 44}},
      });
    });
    const done = tree.root.find(
      n =>
        n.props?.title === 'Ferdig' && typeof n.props?.onPress === 'function',
    );
    act(() => done.props.onPress());
    // 18:07 rundes til 18:05 ved åpning; timen er byttet til 09.
    expect(onDone).toHaveBeenCalledWith('09:05');
  });

  it('lukket ark rendrer ingenting', () => {
    const tree = mount(
      <TimeSheet
        visible={false}
        value="18:00"
        onCancel={jest.fn()}
        onDone={jest.fn()}
        reducedMotion
      />,
    );
    expect(tree.toJSON()).toBeNull();
  });
});

describe('datoarket', () => {
  it('er samme glass som månedsvisningen, rutenettet plain, uten scrim', () => {
    const tree = mount(
      <DateSheet
        visible
        value={new Date(2026, 8, 9)}
        onChange={jest.fn()}
        onClose={jest.fn()}
        busy={{}}
        daysBack={30}
        monthsAhead={18}
        reducedMotion
      />,
    );
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(tree.root.findByType(LiquidGlassSurface).props.variant).toBe(
      'sheet',
    );
    expect(tree.root.findAll(n => n.props?.variant === 'plain')).toHaveLength(
      1,
    );
    const backdrop = tree.root.find(
      n => n.props?.accessibilityLabel === 'Lukk datovelgeren',
    );
    expect(StyleSheet.flatten(backdrop.props.style).backgroundColor).toBe(
      undefined,
    );
    // Fotnoten sier sant om en tom kalender.
    expect(
      tree.root.findAll(
        n =>
          n.type === 'Text' &&
          n.children.join('') === 'Ingenting annet i kalenderen denne perioden',
      ),
    ).toHaveLength(1);
  });

  it('grensene følger med: fortiden er stengt når daysBack = 0', () => {
    const today = new Date();
    const tree = mount(
      <DateSheet
        visible
        value={today}
        onChange={jest.fn()}
        onClose={jest.fn()}
        daysBack={0}
        monthsAhead={1}
        reducedMotion
      />,
    );
    const grid = tree.root.find(n => n.props?.variant === 'plain');
    expect(grid.props.minDay.getTime()).toBe(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime(),
    );
  });

  it('velger OG lukker i ett — onChange får dagen', () => {
    const onChange = jest.fn();
    const tree = mount(
      <DateSheet
        visible
        value={new Date(2026, 8, 9)}
        onChange={onChange}
        onClose={jest.fn()}
        daysBack={30}
        monthsAhead={18}
        reducedMotion
      />,
    );
    const grid = tree.root.find(n => n.props?.variant === 'plain');
    act(() => grid.props.onSelect(new Date(2026, 8, 12)));
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 12));
  });
});
