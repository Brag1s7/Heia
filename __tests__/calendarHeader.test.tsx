import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {CalendarNav} from '../src/components/calendar/CalendarNav';

/**
 * ⚠️ «NY HENDELSE» MÅ FINNES NÅR KALENDEREN ER FULL (P4, skive 10).
 *
 * Fram til skive 10 lå den eneste opprettelsen i Kalender i TOMTILSTANDEN,
 * med den begrunnelsen at den grønne «+» i baren dekket resten. Plussen er nå
 * kampknappen. Hadde denne pillen manglet, ville en trener med en full
 * kalender stått uten vei til å opprette noe i det hele tatt.
 *
 * Den bor i den FESTEDE navigatoren, ikke i overskriften: agendaen er lang,
 * og en knapp som ruller bort er ikke en permanent inngang.
 */

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(onNewEvent?: () => void) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <CalendarNav
        month={new Date(2026, 7, 20)}
        onToday={jest.fn()}
        onOpenMonth={jest.fn()}
        atToday={false}
        onNewEvent={onNewEvent}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Alle a11y-labeler i treet — det brukeren faktisk kan trykke på. */
function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll(n => typeof n.props?.accessibilityLabel === 'string', {
      deep: true,
    })
    .map(n => n.props.accessibilityLabel as string);
}

function nyPille(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.find(n => n.props?.accessibilityLabel === 'Ny hendelse');
}

it('trener ser «Ny hendelse» ved siden av «I dag» og «Måned»', () => {
  const tree = render(jest.fn());
  expect(labels(tree)).toEqual(
    expect.arrayContaining([
      'Gå til i dag',
      'Åpne månedsvisning',
      'Ny hendelse',
    ]),
  );
});

it('vanlig medlem ser den IKKE — samme regel som RLS på events', () => {
  const tree = render(undefined);
  expect(labels(tree)).not.toContain('Ny hendelse');
  // De to andre står urørt.
  expect(labels(tree)).toEqual(
    expect.arrayContaining(['Gå til i dag', 'Åpne månedsvisning']),
  );
});

it('trykk åpner opprettelsen', () => {
  const onNewEvent = jest.fn();
  const tree = render(onNewEvent);
  act(() => nyPille(tree).props.onPress());
  expect(onNewEvent).toHaveBeenCalledTimes(1);
});

/**
 * ⚠️ NAVIGATORENS HØYDE MÅ ALDRI ENDRE SEG. Endres den, flytter
 * festeterskelen, alle målte posisjoner og scrollposisjonen seg — nøyaktig
 * det hoppet kalenderen brukte tre runder på å bli kvitt (`statusRow` i
 * KalenderScreen). Pillen arver derfor de andres høyde.
 */
it('pillen har SAMME høyde som de to andre — navblokka står stille', () => {
  const tree = render(jest.fn());
  const hoyder = tree.root
    .findAll(n => typeof n.props?.accessibilityRole === 'string', {deep: true})
    .filter(n => n.props.accessibilityRole === 'button')
    .map(n => {
      const st =
        typeof n.props.style === 'function'
          ? n.props.style({pressed: false})
          : n.props.style;
      return StyleSheet.flatten(st)?.minHeight;
    })
    .filter(h => h !== undefined);
  // Tre pillene: «I dag», «Måned», «Ny».
  expect(hoyder.length).toBeGreaterThanOrEqual(3);
  expect(new Set(hoyder)).toEqual(new Set([32]));
});

/**
 * Pillene er 32 pt. 44 pt-kravet løses med hitSlop, som ikke rører layouten
 * med ett eneste punkt — den ENE måten å få trykkflaten opp uten å endre
 * navigatorens høyde.
 */
it('trykkflaten er minst 44 pt, uten at layouten vokser', () => {
  const tree = render(jest.fn());
  const slop = nyPille(tree).props.hitSlop;
  expect(32 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
});
