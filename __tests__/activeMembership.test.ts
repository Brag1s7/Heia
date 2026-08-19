import {
  pickPrimaryMembership,
  uniqueTeamMemberships,
} from '../src/shared/activeMembership';

// Minimale fixturer — strukturell type, samme felter som
// EnrichedMembership bruker for valget.
const personlig = {id: 'p', teamSpaceId: 'lag-1', managedChildId: null, role: 'trener'};
const barnA = {id: 'a', teamSpaceId: 'lag-1', managedChildId: 'barn-a', role: 'forelder'};
const barnB = {id: 'b', teamSpaceId: 'lag-1', managedChildId: 'barn-b', role: 'forelder'};
const annetLag = {id: 'x', teamSpaceId: 'lag-2', managedChildId: null, role: 'forelder'};

describe('pickPrimaryMembership', () => {
  it('foretrekker den personlige raden uansett plassering i lista', () => {
    expect(pickPrimaryMembership([barnA, barnB, personlig], 'lag-1')).toBe(personlig);
    expect(pickPrimaryMembership([personlig, barnA, barnB], 'lag-1')).toBe(personlig);
  });

  it('faller tilbake til første barne-rad når personlig rad mangler', () => {
    expect(pickPrimaryMembership([barnA, barnB], 'lag-1')).toBe(barnA);
  });

  it('blander aldri inn rader fra andre lag', () => {
    expect(pickPrimaryMembership([annetLag, barnA], 'lag-1')).toBe(barnA);
    expect(pickPrimaryMembership([barnA], 'lag-2')).toBeNull();
  });

  it('tåler tomt utvalg og manglende aktivt lag', () => {
    expect(pickPrimaryMembership([], 'lag-1')).toBeNull();
    expect(pickPrimaryMembership([personlig], null)).toBeNull();
  });

  it('godtar undefined som «ingen barn-kobling» (eldre payloads)', () => {
    const utenFelt = {id: 'u', teamSpaceId: 'lag-1'};
    expect(pickPrimaryMembership([barnA, utenFelt], 'lag-1')).toBe(utenFelt);
  });
});

describe('uniqueTeamMemberships', () => {
  it('gir ett kort per lag, med primærraden som representant', () => {
    const result = uniqueTeamMemberships([barnA, barnB, personlig, annetLag]);
    expect(result).toEqual([personlig, annetLag]);
  });

  it('bevarer lagenes første-forekomst-rekkefølge', () => {
    const result = uniqueTeamMemberships([annetLag, barnA, personlig]);
    expect(result.map(m => m.teamSpaceId)).toEqual(['lag-2', 'lag-1']);
  });

  it('er identitet for lista uten dubletter', () => {
    expect(uniqueTeamMemberships([personlig, annetLag])).toEqual([
      personlig,
      annetLag,
    ]);
  });
});
