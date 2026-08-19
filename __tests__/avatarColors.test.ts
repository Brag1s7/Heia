/**
 * @format
 *
 * AVATARFARGEN (00070). Brages beslutning: fargen er IKKE en unik
 * identifikator — den gir personlighet, og den er alternativet for dem som
 * bevisst ikke vil ha profilbilde.
 *
 * Det som vaktes her er de tre tingene som ellers ryker STILLE:
 *
 *   1. HASH-POOLEN ER FROSSET. Den avgjør fargen til alle som ikke har
 *      valgt selv — altså nesten alle. Legger noen til en farge eller
 *      bytter rekkefølge, flytter `% length` seg og halve laget bytter
 *      farge over natten uten at én bruker har bedt om det. Gullverdiene
 *      under er hele poenget med denne fila.
 *   2. VALGPALETTEN MÅ INNEHOLDE HASH-POOLEN. Ellers kan ikke den som
 *      allerede liker fargen sin velge nettopp den og beholde den.
 *   3. BLEKKET MÅ FØLGE FLATEN. Gult er med i paletten med vilje, og hvite
 *      initialer på gult er usynlige.
 */
import {
  AVATAR_COLORS,
  AVATAR_HASH_COLORS,
  avatarColorFor,
  hashedAvatarColor,
  inkOnAvatarColor,
} from '../src/shared/avatarColors';

test('hash-poolen er FROSSET — endres den, bytter alle farge', () => {
  // Ikke «en liste med åtte farger», men NØYAKTIG denne, i NØYAKTIG denne
  // rekkefølgen. Endrer du den bevisst, må du også endre gullverdiene
  // under — og da har du sett hva det koster.
  expect([...AVATAR_HASH_COLORS]).toEqual([
    '#7C3AED',
    '#2563EB',
    '#059669',
    '#D97706',
    '#DC2626',
    '#0891B2',
    '#7C2D12',
    '#4338CA',
  ]);
});

test('gullverdier: kjente navn beholder fargen sin', () => {
  expect(hashedAvatarColor('Kari Nordmann')).toBe('#059669');
  expect(hashedAvatarColor('Ola Nordmann')).toBe('#D97706');
  expect(hashedAvatarColor('Brage Lothe Weium')).toBe('#7C3AED');
  expect(hashedAvatarColor('Emma')).toBe('#DC2626');
});

test('hashen er stabil og lander alltid i poolen', () => {
  for (const name of ['A', 'Åse Ø', '', 'x'.repeat(200), 'Medlem']) {
    const c = hashedAvatarColor(name);
    expect(hashedAvatarColor(name)).toBe(c);
    expect(AVATAR_HASH_COLORS).toContain(c);
  }
});

test('valgpaletten inneholder HELE hash-poolen', () => {
  const chooseable = AVATAR_COLORS.map(c => c.value);
  for (const c of AVATAR_HASH_COLORS) {
    expect(chooseable).toContain(c);
  }
});

test('valgpaletten har ingen duplikater og bare gyldige hex', () => {
  const values = AVATAR_COLORS.map(c => c.value);
  expect(new Set(values).size).toBe(values.length);
  for (const v of values) {
    expect(v).toMatch(/^#[0-9A-F]{6}$/);
  }
  // Hver farge må ha et norsk navn — det er accessibilityLabel-en.
  expect(AVATAR_COLORS.every(c => c.name.length > 0)).toBe(true);
});

test('valgt farge vinner over hashen', () => {
  expect(avatarColorFor('Kari Nordmann', '#DB2777')).toBe('#DB2777');
  // ...men bare når den er valgt. null/undefined = hashen, som før.
  expect(avatarColorFor('Kari Nordmann', null)).toBe('#059669');
  expect(avatarColorFor('Kari Nordmann')).toBe('#059669');
});

test('søppel i kolonnen tegnes ikke — den faller til hashen', () => {
  // CHECK-en i 00070 er FORMAT, ikke palett, og en rå-klient kan skrive
  // hva som helst i sin egen rad. `backgroundColor: 'drop table'` ville
  // gitt en usynlig avatar i stedet for en farget.
  for (const junk of ['', 'blå', 'drop table', '#12345', '#1234567', 'rgb(1,2,3)']) {
    expect(avatarColorFor('Kari Nordmann', junk)).toBe('#059669');
  }
  // Gyldig hex utenfor paletten godtas — paletten er en app-kuratering,
  // ikke en sikkerhetsgrense, og en gammel verdi skal ikke bli usynlig.
  expect(avatarColorFor('Kari Nordmann', '#123456')).toBe('#123456');
});

test('blekket følger flaten — gult tåler ikke hvite initialer', () => {
  expect(inkOnAvatarColor('#FFC53D')).toBe('#11241B');
  expect(inkOnAvatarColor('#111827')).toBe('#FFFFFF');
  // Hele hash-poolen er mørk nok for hvitt blekk — ellers ville dagens
  // avatarer vært uleselige lenge før fargevalget kom.
  for (const c of AVATAR_HASH_COLORS) {
    expect(inkOnAvatarColor(c)).toBe('#FFFFFF');
  }
});
