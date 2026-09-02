/**
 * Vakter for probelogikken i S3b-exit-scriptet (`scripts/wsProbeCore.mjs`).
 *
 * Det viktigste som låses her er Brages S3b-1-regler: en timeout kan aldri
 * bli en grønn sikkerhetsnekt, negativene er ugyldige uten grønne positiver
 * i samme kjøring, et sikkerhetsbrudd (join tillatt der den skulle nektes)
 * kan aldri maskeres av senere forsøk, og uuid-er når aldri utskriften.
 */
import {
  applyPositiveGate,
  classifyAttempt,
  combineAttempts,
  evaluateProbe,
  maskUuids,
  summarize,
} from '../scripts/wsProbeCore.mjs';

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('classifyAttempt', () => {
  it('SUBSCRIBED → ok', () => {
    expect(classifyAttempt('SUBSCRIBED', null)).toEqual({
      kind: 'ok',
      reason: null,
    });
  });

  it('CHANNEL_ERROR med reason → denied, med maskert reason', () => {
    const a = classifyAttempt(
      'CHANNEL_ERROR',
      `You do not have permissions to read from this Channel topic: team:${UUID}`,
    );
    expect(a.kind).toBe('denied');
    expect(a.reason).toContain('team:<uuid>');
    expect(a.reason).not.toContain(UUID);
  });

  it('CHANNEL_ERROR UTEN reason er uavklart — ikke bevist nekt', () => {
    expect(classifyAttempt('CHANNEL_ERROR', null).kind).toBe('inconclusive');
  });

  it('TIMED_OUT og CLOSED er uavklart — aldri grønn nekt', () => {
    expect(classifyAttempt('TIMED_OUT', null).kind).toBe('inconclusive');
    expect(classifyAttempt('CLOSED', null).kind).toBe('inconclusive');
  });
});

describe('combineAttempts', () => {
  it('retry som finner eksplisitt nekt etter timeout → NEKT', () => {
    const outcome = combineAttempts([
      {kind: 'inconclusive', reason: 'TIMED_OUT'},
      {kind: 'denied', reason: 'avvist'},
    ]);
    expect(outcome).toEqual({outcome: 'NEKT', reason: 'avvist'});
  });

  it('kun uavklarte forsøk → UAVKLART', () => {
    expect(
      combineAttempts([
        {kind: 'inconclusive', reason: 'TIMED_OUT'},
        {kind: 'inconclusive', reason: 'CLOSED'},
      ]).outcome,
    ).toBe('UAVKLART');
  });

  it('en vellykket join dominerer alt — et sikkerhetsbrudd maskeres aldri', () => {
    expect(
      combineAttempts([
        {kind: 'denied', reason: 'avvist'},
        {kind: 'ok', reason: null},
      ]).outcome,
    ).toBe('OK');
  });
});

describe('evaluateProbe', () => {
  it('forventet tillatt: OK ✅, NEKT ❌, UAVKLART ⚠️', () => {
    expect(evaluateProbe('allow', 'OK')).toBe('✅');
    expect(evaluateProbe('allow', 'NEKT')).toBe('❌');
    expect(evaluateProbe('allow', 'UAVKLART')).toBe('⚠️');
  });

  it('forventet nekt: NEKT ✅, OK ❌ (sikkerhetsbrudd), UAVKLART ⚠️', () => {
    expect(evaluateProbe('deny', 'NEKT')).toBe('✅');
    expect(evaluateProbe('deny', 'OK')).toBe('❌');
    expect(evaluateProbe('deny', 'UAVKLART')).toBe('⚠️');
  });
});

describe('applyPositiveGate', () => {
  const greenPositive = {name: 'P', expected: 'allow', mark: '✅'};
  const greenDeny = {name: 'N', expected: 'deny', mark: '✅'};

  it('grønne positiver → negativene står urørt', () => {
    expect(applyPositiveGate([greenPositive, greenDeny])).toEqual([
      greenPositive,
      greenDeny,
    ]);
  });

  it('rød positiv → grønn nekt nedgraderes til ⚠️ ugyldig', () => {
    const gated = applyPositiveGate([
      {name: 'P', expected: 'allow', mark: '⚠️'},
      greenDeny,
    ]);
    expect(gated[1].mark).toBe('⚠️');
    expect(gated[1].note).toMatch(/ugyldig/);
  });

  it('rød positiv rører ikke nekter som alt er røde/uavklarte', () => {
    const redDeny = {name: 'N', expected: 'deny', mark: '❌'};
    const gated = applyPositiveGate([
      {name: 'P', expected: 'allow', mark: '❌'},
      redDeny,
    ]);
    expect(gated[1]).toEqual(redDeny);
  });
});

describe('summarize', () => {
  it('alt grønt → exit 0', () => {
    expect(summarize([{mark: '✅'}, {mark: '✅'}])).toEqual({
      green: 2,
      total: 2,
      exitCode: 0,
    });
  });

  it('én ⚠️ eller ❌ → exit 1 (UAVKLART godkjennes aldri)', () => {
    expect(summarize([{mark: '✅'}, {mark: '⚠️'}]).exitCode).toBe(1);
    expect(summarize([{mark: '✅'}, {mark: '❌'}]).exitCode).toBe(1);
  });
});

describe('maskUuids', () => {
  it('maskerer alle uuid-er, tåler null/undefined', () => {
    expect(maskUuids(`team:${UUID} og match:${UUID.toUpperCase()}`)).toBe(
      'team:<uuid> og match:<uuid>',
    );
    expect(maskUuids(null)).toBe('');
    expect(maskUuids(undefined)).toBe('');
  });

  it('rører ikke tekst uten uuid-er', () => {
    expect(maskUuids('team:ikke-en-uuid')).toBe('team:ikke-en-uuid');
  });
});
