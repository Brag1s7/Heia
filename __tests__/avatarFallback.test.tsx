/**
 * @format
 *
 * INITIALENE ER ALLTID UNDER (00068). Avataren er den ene bildeflaten i
 * appen som ALDRI får stå tom: en tom sirkel i en feed-rad, en kommentar
 * eller et varsel leses som en feil i appen, ikke som «uten bilde».
 *
 * De tre tilstandene som faktisk oppstår, og som denne fila vokter:
 *
 *   1. INGEN PATH — de aller fleste kontoer. Initialer.
 *   2. PATH MED BILDE — bildet dekker initialene, og det hentes fra
 *      `avatars`-bucketen med bucket+path som cache-nøkkel (samme path i
 *      feed-media skal aldri kunne treffe her).
 *   3. PATH UTEN OBJEKT — bildet er FJERNET (av eieren eller av en trener),
 *      men den signerte URL-en lever i inntil 24 t hos alle ANDRE enheter:
 *      den som slettet invaliderer bare sin egen cache. URL-en finnes,
 *      bytene gjør ikke. Uten denne grenen ville hele laget sett en tom
 *      sirkel til tokenet utløp — akkurat i det tilfellet der noen nettopp
 *      har bedt om å bli kvitt et bilde.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

// `mock`-prefikset er påkrevd: jest.mock heises over alt annet, og
// factory-en får bare referere variabler som starter slik.
let mockObjectExists = true;
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn((bucket: string) => ({
        createSignedUrls: jest.fn(async (paths: string[]) => ({
          data: paths.map(p => ({
            path: p,
            // Et slettet objekt gir feil per path — ikke en kastet feil.
            signedUrl: mockObjectExists
              ? `https://cdn.test/${bucket}/${p}?token=1`
              : null,
            error: mockObjectExists ? null : 'Object not found',
          })),
          error: null,
        })),
      })),
    },
  },
}));

import {Avatar} from '../src/components/Avatar';
import {avatarRef, primeAvatars} from '../src/lib/media/avatar';
import {
  clearMediaUrlCache,
  _resetMediaUrlCacheForTests,
} from '../src/lib/media/resolver';

const PATH = 'u-1/avatar-1.jpg';

interface Node {
  type: string;
  props: Record<string, any>;
  children: ReadonlyArray<Node | string> | null;
}

function walk(node: Node | string | null, out: (Node | string)[] = []) {
  if (node === null) return out;
  out.push(node);
  if (typeof node === 'string') return out;
  for (const child of node.children ?? []) walk(child, out);
  return out;
}

function inspect(tree: ReactTestRenderer.ReactTestRenderer) {
  const nodes = walk(tree.toJSON() as unknown as Node);
  const texts = nodes.filter((n): n is string => typeof n === 'string');
  const images = nodes.filter(
    (n): n is Node => typeof n !== 'string' && n.type === 'Image',
  );
  return {texts, images};
}

beforeEach(async () => {
  mockObjectExists = true;
  await clearMediaUrlCache();
  _resetMediaUrlCacheForTests();
});

test('uten path: initialer', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Avatar name="Kari Nordmann" />);
  });

  const {texts, images} = inspect(tree);
  expect(texts).toContain('KN');
  expect(images).toHaveLength(0);
});

test('valgt farge tegnes bak initialene, med lesbart blekk (00070)', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <Avatar name="Kari Nordmann" color="#FFC53D" />,
    );
  });

  const nodes = walk(tree.toJSON() as unknown as Node);
  const circle = nodes.find(
    (n): n is Node => typeof n !== 'string' && n.type === 'View',
  )!;
  const bg = [circle.props.style].flat(3).find((x: any) => x?.backgroundColor);
  expect(bg.backgroundColor).toBe('#FFC53D');

  // Gult er den ene lyse fargen i paletten — hvite initialer ville
  // forsvunnet i den.
  const label = nodes.find(
    (n): n is Node => typeof n !== 'string' && n.type === 'Text',
  )!;
  const ink = [label.props.style].flat(3).find((x: any) => x?.color);
  expect(ink.color).toBe('#11241B');
});

test('uten valgt farge: navne-hashen, uendret fra før fargevalget', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Avatar name="Kari Nordmann" />);
  });
  const circle = walk(tree.toJSON() as unknown as Node).find(
    (n): n is Node => typeof n !== 'string' && n.type === 'View',
  )!;
  const bg = [circle.props.style].flat(3).find((x: any) => x?.backgroundColor);
  expect(bg.backgroundColor).toBe('#059669');
});

test('med bilde: initialene vike, og bildet hentes fra avatars-bucketen', async () => {
  await primeAvatars([PATH]);

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <Avatar name="Kari Nordmann" media={avatarRef(PATH)} />,
    );
  });

  const {texts, images} = inspect(tree);
  expect(texts).not.toContain('KN');
  expect(images).toHaveLength(1);
  expect(images[0].props.source.uri).toContain('/avatars/');
  // Cache-nøkkelen BÆRER bucketen: en avatar og et feed-bilde med samme
  // path skal aldri dele oppføring i expo-images disk-cache.
  expect(images[0].props.source.cacheKey).toBe(`avatars/${PATH}`);
});

test('fjernet bilde med levende token: initialene kommer tilbake', async () => {
  // Varm cache fra før slettingen — nøyaktig situasjonen hos alle ANDRE
  // enn den som trykket «Fjern bildet».
  await primeAvatars([PATH]);

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <Avatar name="Kari Nordmann" media={avatarRef(PATH)} />,
    );
  });
  expect(inspect(tree).texts).not.toContain('KN');

  // Objektet er borte. Bildet feiler → komponenten fornyer én gang →
  // signeringen finner ingenting → initialene skal tilbake.
  mockObjectExists = false;
  await act(async () => {
    inspect(tree).images[0].props.onError();
  });

  expect(inspect(tree).texts).toContain('KN');
});
