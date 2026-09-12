/**
 * @format
 *
 * «KNAPPEN BLINKER LITT FØR RIKTIG VISNING KOMMER» (Brage, telefon
 * 2026-09-12, andre runde).
 *
 * ⚠️ DENNE TESTEN FINNES FORDI FORRIGE VAKT SÅ PÅ FEIL TALL.
 *
 * Første forsøk ga `unknown` en `layoutLabel` og sammenliknet BREDDENE fra
 * `matchButtonGeometry`. De ble like, testen ble grønn — og blinket sto
 * igjen på telefonen. Årsaken: `g.width` settes på den YTRE wrapperen,
 * mens selve pillen er innholdsstyrt (padding + glyf + tekst). Med tom
 * tekst var pillen ~41 pt og vokste til ~85 når ordet kom. Slottet sto
 * stille; det man SER gjorde ikke.
 *
 * Derfor sammenlikner denne det som faktisk TEGNES, ikke tallene som gikk
 * inn i tegningen. Endrer noen på hva `unknown` viser — en tom etikett, en
 * annen undertekst, en betinget `g.label` i komponenten — blir den rød.
 *
 * Det som SKAL skille de to, og som testen vokter at fortsatt skiller dem:
 * `kind` (manglende svar er ikke «ingen kamp») og skjermleserens tekst.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {matchButtonState} from '../src/shared/matchButton';

const UKJENT = matchButtonState({
  presence: null,
  liveMatch: null,
  known: false,
});
const HVILE = matchButtonState({presence: null, liveMatch: null, known: true});

let mockState = UKJENT;
jest.mock('../src/context/MatchButtonContext', () => ({
  useMatchButton: () => ({
    state: mockState,
    inMatch: false,
    press: jest.fn(),
    enterMatch: jest.fn(),
    leaveMatch: jest.fn(),
  }),
}));

jest.mock('../src/components/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

import {MatchTabButton} from '../src/components/MatchTabButton';

function tegn(state: typeof UKJENT): unknown {
  mockState = state;
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = ReactTestRenderer.create(<MatchTabButton />);
  });
  const json = JSON.parse(JSON.stringify(tree?.toJSON() ?? null));
  act(() => {
    tree?.unmount();
  });
  return json;
}

test('unknown og idle tegner NØYAKTIG det samme — ingenting å blinke med', () => {
  expect(tegn(UKJENT)).toEqual(tegn(HVILE));
});

test('ordet står der fra første bilde', () => {
  expect(UKJENT.label).toBe('KAMP');
  expect(UKJENT.tabLabel).toBe('Sesongen');
  expect(UKJENT.label).toBe(HVILE.label);
  expect(UKJENT.tabLabel).toBe(HVILE.tabLabel);
});

test('men internt vet appen fortsatt at den ikke vet', () => {
  // Manglende svar er IKKE «ingen kamp». `kind` er det kallstedene spør.
  expect(UKJENT.kind).toBe('unknown');
  expect(HVILE.kind).toBe('idle');
  // Og skjermleseren får sannheten, ikke knappeteksten.
  expect(UKJENT.a11yLabel).toBe('Kamp. Henter kampstatus');
  expect(HVILE.a11yLabel).toBe('Kamp. Åpner Sesongen');
  // Trykkbar mens vi venter: Sesongen er riktig mål uansett hva svaret blir.
  expect(UKJENT.disabled).toBe(false);
});

test('en livekamp endrer knappen ÉN gang — og uten sprett', () => {
  const live = matchButtonState({
    presence: null,
    known: true,
    liveMatch: {
      eventId: 'e1',
      status: 'live',
      home: 2,
      away: 1,
      teamName: 'HAM-KAM G14',
      opponent: 'Ottestad',
    },
  });
  // Stillingen ER nyheten, og den skal synes.
  expect(live.label).toBe('2–1');
  expect(tegn(UKJENT)).not.toEqual(tegn(live));
});
