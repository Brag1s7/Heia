import {parseJoinCodeFromUrl} from '../src/navigation/deepLink';

describe('parseJoinCodeFromUrl — delelinken', () => {
  it('leser koden fra Universal Link på heiaapp.no', () => {
    expect(parseJoinCodeFromUrl('https://heiaapp.no/lag?kode=bj7k4q2x')).toBe('BJ7K4Q2X');
    expect(parseJoinCodeFromUrl('https://www.heiaapp.no/lag/?kode=BJ7K4Q2X&utm=x')).toBe('BJ7K4Q2X');
  });
  it('leser koden fra heia://lag', () => {
    expect(parseJoinCodeFromUrl('heia://lag?kode=BJ7K4Q2X')).toBe('BJ7K4Q2X');
    expect(parseJoinCodeFromUrl('heia://lag?code=bj7k4q2x')).toBe('BJ7K4Q2X');
  });
  it('avviser andre URL-er og søppel', () => {
    expect(parseJoinCodeFromUrl('heia://lagkassa')).toBeNull();
    expect(parseJoinCodeFromUrl('https://heiaapp.no/betaling?flow=success')).toBeNull();
    expect(parseJoinCodeFromUrl('https://evil.example/lag?kode=ABCDEFGH')).toBeNull();
    expect(parseJoinCodeFromUrl('https://heiaapp.no/lag?kode=')).toBeNull();
    expect(parseJoinCodeFromUrl('https://heiaapp.no/lag?kode=a!')).toBeNull();
    expect(parseJoinCodeFromUrl(null)).toBeNull();
  });
});
