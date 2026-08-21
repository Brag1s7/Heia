import {
  matchButtonState,
  shouldNudge,
  type LiveMatchSummary,
  type MatchPresence,
} from '../src/shared/matchButton';
import type {HeiableMoment} from '../src/shared/matchEngagement';

/**
 * KAMPKNAPPENS TILSTANDSVAKT (P4, skive 10).
 *
 * Knappen er den ene flaten i Heia som betyr fire forskjellige ting avhengig
 * av hvor du står og hvem du er. Alt som kan gå galt med den er tilstand, og
 * denne fila er derfor hoveddekningen — ikke en render-test.
 *
 * Fasit: `docs/prototypes/kampskjerm/index.html`, `btnState()`.
 */

const LIVE: LiveMatchSummary = {
  eventId: 'e1',
  status: 'live',
  home: 2,
  away: 1,
  teamName: 'Ham-Kam G14',
  opponent: 'Ridabu G14',
};

const MOMENT: HeiableMoment = {
  postId: 'p-goal',
  iReacted: false,
  what: 'målet på 34 minutter',
};

function presence(over: Partial<MatchPresence> = {}): MatchPresence {
  return {
    eventId: 'e1',
    isReporter: false,
    dockOpen: false,
    heiaTarget: MOMENT,
    onPress: () => {},
    ...over,
  };
}

describe('«vet ikke ennå» — oppstartshoppet (Brage 2026-08-21)', () => {
  /**
   * ⚠️ «når man går inn på appen og det er en pågående kamp, så viser knappen
   * først kamp, deretter hopper den over til stillingen.»
   *
   * Det var ikke en animasjonsfeil. `KAMP` BETYR «ingen kamp pågår», og det
   * er en påstand appen ikke har dekning for før første henting har landet.
   */
  it('før første svar sier knappen INGENTING — ikke «KAMP»', () => {
    const s = matchButtonState({presence: null, liveMatch: null, known: false});
    expect(s.kind).toBe('unknown');
    expect(s.label).toBe('');
    // Den lyver altså ikke, men den er fortsatt trykkbar: Sesongen er
    // riktig mål uansett hva svaret blir.
    expect(s.disabled).toBe(false);
    expect(s.a11yLabel).toBe('Kamp. Henter kampstatus');
  });

  it('når svaret lander uten kamp, blir det KAMP', () => {
    expect(
      matchButtonState({presence: null, liveMatch: null, known: true}).kind,
    ).toBe('idle');
  });

  it('når svaret lander MED kamp, går den rett til stillingen', () => {
    const s = matchButtonState({presence: null, liveMatch: LIVE, known: true});
    expect(s.kind).toBe('live');
    expect(s.label).toBe('2–1');
  });

  it('inne i kampen vet vi alt — «vet ikke» kan ikke oppstå der', () => {
    // Spørringen er slått AV inne i kampen, så `known` er falsk for alltid.
    // Presence bærer likevel hele sannheten.
    const s = matchButtonState({
      presence: presence(),
      liveMatch: null,
      known: false,
    });
    expect(s.kind).toBe('heia');
  });

  it('det første svaret spretter ikke — det er ingen nyhet', () => {
    expect(shouldNudge('unknown', 'live')).toBe(false);
    expect(shouldNudge(null, 'live')).toBe(false);
    // Et EKTE skifte skal merkes: et mål mens du står utenfor kampen.
    expect(shouldNudge('idle', 'live')).toBe(true);
    expect(shouldNudge('heia', 'heiet')).toBe(true);
    expect(shouldNudge('live', 'live')).toBe(false);
  });
});

describe('utenfor kampen', () => {
  it('INGEN livekamp ⇒ KAMP, og etiketten sier hvor du havner', () => {
    const s = matchButtonState({presence: null, liveMatch: null});
    expect(s.kind).toBe('idle');
    expect(s.label).toBe('KAMP');
    // Prototypens sublabel: knappen fører til Sesongen når ingenting pågår.
    expect(s.tabLabel).toBe('Sesongen');
    expect(s.a11yLabel).toBe('Kamp. Åpner Sesongen');
    expect(s.openEventId).toBeUndefined();
  });

  it('ÉN livekamp ⇒ stillingen, og labelen lover ÅPNE — ikke heia', () => {
    const s = matchButtonState({presence: null, liveMatch: LIVE});
    expect(s.kind).toBe('live');
    expect(s.label).toBe('2–1');
    expect(s.tabLabel).toBe('Kamp');
    expect(s.openEventId).toBe('e1');
    // ⚠️ Sier den «heia», tror skjermleserbrukeren at hun nettopp heiet.
    expect(s.a11yLabel).toBe('Live: Ham-Kam G14 2–1 Ridabu G14. Åpne kampen');
    expect(s.a11yLabel).not.toMatch(/heia/i);
    // Et trykk her skriver ingenting.
    expect(s.heiaPostId).toBeUndefined();
  });

  it('PAUSE er fortsatt pågående — knappen faller ikke til KAMP', () => {
    const s = matchButtonState({
      presence: null,
      liveMatch: {...LIVE, status: 'halfTime'},
    });
    expect(s.kind).toBe('pause');
    expect(s.label).toBe('PAUSE 2–1');
    expect(s.openEventId).toBe('e1');
  });

  it.each(['finished', 'cancelled', 'upcoming'] as const)(
    'status %s ⇒ tilbake til KAMP',
    status => {
      const s = matchButtonState({
        presence: null,
        liveMatch: {...LIVE, status},
      });
      expect(s.kind).toBe('idle');
      expect(s.label).toBe('KAMP');
    },
  );

  it('0–0 er en ekte stilling, ikke «ingen kamp»', () => {
    const s = matchButtonState({
      presence: null,
      liveMatch: {...LIVE, home: 0, away: 0},
    });
    expect(s.kind).toBe('live');
    expect(s.label).toBe('0–0');
  });

  /**
   * ⚠️ FLERE SAMTIDIGE LIVEKAMPER ER UTSATT (P4), IKKE GLEMT.
   * `getLiveMatch` returnerer nyeste avspark og bare den. Knappen viser da
   * ÉN ekte livekamp — den lyver ikke, den er bare ikke uttømmende.
   * Denne testen er dokumentasjonen av utsettelsen: endres oppførselen til
   * en «N LIVE»-velger, skal DENNE fila si fra.
   */
  it('flere livekamper: kilden kollapser til nyeste, og knappen viser den', () => {
    const nyeste: LiveMatchSummary = {...LIVE, eventId: 'e-nyeste', home: 3};
    const s = matchButtonState({presence: null, liveMatch: nyeste});
    expect(s.kind).toBe('live');
    expect(s.openEventId).toBe('e-nyeste');
    expect(s.label).toBe('3–1');
  });
});

describe('inne i kampen', () => {
  it('reporter ⇒ RAPPORTER, og LUKK når dokken står åpen', () => {
    const lukket = matchButtonState({
      presence: presence({isReporter: true, heiaTarget: null}),
      liveMatch: LIVE,
    });
    expect(lukket.kind).toBe('rapporter');
    expect(lukket.label).toBe('RAPPORTER');

    const apen = matchButtonState({
      presence: presence({isReporter: true, dockOpen: true, heiaTarget: null}),
      liveMatch: LIVE,
    });
    expect(apen.kind).toBe('lukk');
    expect(apen.label).toBe('LUKK');
  });

  it('publikum med et øyeblikk ⇒ HEIA!, og labelen sier HVA man heier på', () => {
    const s = matchButtonState({presence: presence(), liveMatch: LIVE});
    expect(s.kind).toBe('heia');
    expect(s.label).toBe('HEIA!');
    expect(s.a11yLabel).toBe('Heia på målet på 34 minutter');
    expect(s.heiaPostId).toBe('p-goal');
    expect(s.disabled).toBe(false);
  });

  /**
   * ⚠️ ADD-ONLY. Knappen skal ALDRI kunne fjerne en heia. Uten post-id
   * finnes det ikke noe å skrive, uansett hva kallstedet finner på.
   */
  it('har jeg alt heiet ⇒ HEIET, og det finnes ingen post å skrive til', () => {
    const s = matchButtonState({
      presence: presence({heiaTarget: {...MOMENT, iReacted: true}}),
      liveMatch: LIVE,
    });
    expect(s.kind).toBe('heiet');
    expect(s.label).toBe('HEIET');
    expect(s.heiaPostId).toBeUndefined();
    expect(s.a11yLabel).toBe('Du har heiet på dette øyeblikket');
  });

  it('ingenting har skjedd ennå ⇒ ekte disabled, ikke stille død', () => {
    const s = matchButtonState({
      presence: presence({heiaTarget: null}),
      liveMatch: LIVE,
    });
    expect(s.kind).toBe('heia-tom');
    expect(s.disabled).toBe(true);
    expect(s.heiaPostId).toBeUndefined();
    expect(s.a11yLabel).toBe('Ingen øyeblikk å heie på ennå');
  });

  it('en trener som IKKE er reporter er publikum — rollen er ikke rangen', () => {
    // `isReporter` er det eneste som gir verktøyet. En lagadmin som ikke er
    // utpekt skal heie som alle andre.
    const s = matchButtonState({
      presence: presence({isReporter: false}),
      liveMatch: LIVE,
    });
    expect(s.kind).toBe('heia');
  });

  it('presence slår live-kampen: du er INNE, uansett hva baren ellers vet', () => {
    const s = matchButtonState({presence: presence(), liveMatch: null});
    expect(s.kind).toBe('heia');
  });

  it('sublabelen er «Kamp» i alle tilstander unntatt hvile', () => {
    const inne = [
      presence(),
      presence({heiaTarget: {...MOMENT, iReacted: true}}),
      presence({heiaTarget: null}),
      presence({isReporter: true}),
      presence({isReporter: true, dockOpen: true}),
    ];
    for (const p of inne) {
      expect(matchButtonState({presence: p, liveMatch: LIVE}).tabLabel).toBe(
        'Kamp',
      );
    }
    expect(matchButtonState({presence: null, liveMatch: LIVE}).tabLabel).toBe(
      'Kamp',
    );
    expect(matchButtonState({presence: null, liveMatch: null}).tabLabel).toBe(
      'Sesongen',
    );
  });
});
