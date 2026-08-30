/**
 * @format
 *
 * LAGKASSA-SIDENS LASTETILSTAND (S7b-polish): frø-boot monterer heroen før
 * kontekst-svaret har seedet lagkassa — siden skal være RESERVERT fra første
 * frame (stabile dots/indeks/rekkefølge), vise en rolig skeleton i samme
 * kort uten falske beløp eller «bli første»-påstand (falsk 0-status), og
 * bytte innhold i ro når tallene lander. Uten data OG uten loading gjelder
 * dagens sluttstatus: ingen lagkassa-side.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';
import {NextEventCarousel} from '../src/components/NextEventCarousel';
import type {HeiaEvent} from '../src/shared/types';

const event: HeiaEvent = {
  id: 'ev-1',
  teamSpaceId: 'ts-1',
  type: 'trening',
  title: 'Trening',
  startTime: new Date('2026-08-28T17:00:00.000Z'),
  rsvp: {coming: 0, notComing: 0, pending: 0, myStatus: 'pending'},
} as HeiaEvent;

function texts(root: ReactTestRenderer.ReactTestRenderer): string[] {
  return root.root
    .findAllByType(Text)
    .map(t =>
      Array.isArray(t.props.children)
        ? t.props.children.join('')
        : String(t.props.children),
    );
}

async function render(
  props: Partial<React.ComponentProps<typeof NextEventCarousel>>,
) {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    root = ReactTestRenderer.create(
      <NextEventCarousel
        events={[event]}
        onEventPress={() => {}}
        onOpenCalendar={() => {}}
        {...props}
      />,
    );
  });
  return root;
}

/** Dots-raden: teller sider via style-arrayen (dot-stilen er nr. 2-elementet). */
function countPages(root: ReactTestRenderer.ReactTestRenderer): number {
  const list = root.root.findByProps({horizontal: true});
  return (list.props.data as unknown[]).length;
}

test('uavklart lagkassa reserverer siden med skeleton — ingen falske tall', async () => {
  const root = await render({lagkassa: null, lagkassaLoading: true});

  // Siden er reservert: event + lagkassa + kalender = 3 sider fra frame 1.
  expect(countPages(root)).toBe(3);
  const shown = texts(root).join(' | ');
  // Pillen (statisk merkevare) står, men ingen beløp, ingen støttespiller-
  // tekst og ingen «bli første»-påstand mens tallene er uavklart.
  expect(shown).toContain('LAGKASSA');
  expect(shown).not.toContain('kr');
  expect(shown).not.toContain('støttespiller');
  expect(shown).not.toContain('Bli lagets første');

  // Tallene lander: innholdet byttes i samme side — antall sider står.
  await act(async () => {
    root.update(
      <NextEventCarousel
        events={[event]}
        onEventPress={() => {}}
        onOpenCalendar={() => {}}
        lagkassa={{supporters: 3, monthlyToClubMinor: 18_000}}
        lagkassaLoading={false}
      />,
    );
  });
  expect(countPages(root)).toBe(3);
  expect(texts(root).join(' | ')).toContain('3 støttespillere');
  root.unmount();
});

test('uten data og uten loading finnes ingen lagkassa-side (dagens sluttstatus)', async () => {
  const root = await render({lagkassa: null, lagkassaLoading: false});
  // Kun event + kalender.
  expect(countPages(root)).toBe(2);
  expect(texts(root).join(' | ')).not.toContain('LAGKASSA');
  root.unmount();
});
