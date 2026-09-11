/**
 * @format
 *
 * RØYKTEST — og ikke noe mer enn det.
 *
 * Den beviser ÉN ting: at hele komponenttreet kan monteres og faktisk
 * tegnes. Fanger altså importfeil, ødelagte moduler og komponenter som
 * krasjer eller stopper treet ved første render.
 *
 * ⛔ Den beviser IKKE at appen virker. Alt som gjør Heia til Heia er mocket
 * eller uteblir her: innlogging, Supabase, navigasjon mellom skjermer, push,
 * og — viktigst — ALT som handler om layout, scroll og gester. Kalender-
 * skiva ble avvist tre ganger på telefonen mens denne testen var grønn hele
 * veien.
 *
 * Ikke bygg flyt-tester oppå denne. Rene funksjoner testes uten app
 * (`shared/calendar`, `shared/calendarList`, `shared/inbox`); alt som har med
 * flate å gjøre, verifiseres på enhet.
 *
 * De native mockene den er avhengig av, står i `jest.setup.js` — hver med en
 * begrunnelse for hva som brekker uten den.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../src/app/App';

/** Bare formen vi trenger av `toJSON()`, så testen slipper `any`. */
interface TestNode {
  children: ReadonlyArray<TestNode | string> | null;
}

/** Antall elementer i det rendrede treet. Tekstnoder teller ikke. */
function countNodes(node: TestNode | string | null): number {
  if (node === null || typeof node === 'string') return 0;
  return (node.children ?? []).reduce<number>(
    (sum, child) => sum + countNodes(child),
    1,
  );
}

test('hele komponenttreet monteres og tegner faktisk noe', async () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const tree = renderer?.toJSON() ?? null;
  const nodes = Array.isArray(tree)
    ? tree.reduce<number>((sum, node) => sum + countNodes(node), 0)
    : countNodes(tree);

  /**
   * ⚠️ DETTE ER HELE POENGET, og terskelen er en regresjonsvakt mot en ekte
   * hendelse (2026-08-07).
   *
   * Å bare montere uten å kaste er IKKE nok — og `toJSON() !== null` er det
   * heller ikke. `SafeAreaProvider` rendrer barna sine først når den har fått
   * innsettinger målt av native, og i Node kommer den målingen aldri. Da
   * rendres det ÉN node, `RNCSafeAreaProvider` med `children: null`, og
   * testen «består» på 15 ms uten at noe av appen er tegnet.
   *
   * Målt: 31 noder når treet er ekte, 1 node når en provider svelger det.
   * Terskelen ligger lavt med vilje — den skal fange at treet KOLLAPSER, ikke
   * gå i stykker hver gang noen legger til en View.
   */
  expect(nodes).toBeGreaterThan(5);

  /**
   * AVMONTER. Uten dette blir hele apptreet stående etter at testen er
   * ferdig, og da lever effektene videre: `MatchButtonProvider` har en
   * `setTimeout` på BOOT_MAX_MS (1,5 s) og `TeamProvider` en
   * AsyncStorage-lesing. Begge rydder korrekt etter seg i opprydningen sin
   * — men opprydningen kjører bare når treet avmonteres.
   *
   * Skjer ikke det, fyrer timeren ETTER at Jest har revet ned miljøet:
   *   ReferenceError: You are trying to `import` a file after the Jest
   *   environment has been torn down. From __tests__/App.test.tsx
   * og arbeideren blir stående. Lokalt force-exit-er jest den med
   * «A worker process has failed to exit gracefully»; i CI ble hele
   * jest-steget hengende og jobben traff `timeout-minutes: 15` — siste
   * testutskrift kom 31 sekunder inn, så var det stille i 14 minutter.
   *
   * Produktkoden er uendret: den rydder allerede riktig. Det var testen som
   * aldri ga den sjansen.
   */
  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});
