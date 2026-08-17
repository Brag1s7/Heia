import {
  buildEntries,
  groupByAge,
  mapNotificationRow,
  mergeNotifications,
} from '../src/shared/inbox';
import {matchEventLine, stripLeadingGlyph} from '../src/shared/matchCopy';

// ---------------------------------------------------------------------------
// Varsler = «lagets puls». Det viktigste akseptansekriteriet er at ÉN kamp
// forblir ÉTT objekt gjennom hele forløpet: avspark → mål → pause →
// andre omgang → mål → slutt. Blir noen av hendelsene liggende som en egen
// rad, er kriteriet brutt.
//
// Testen bygger radene NØYAKTIG slik migrasjon 00051 skriver dem
// (jsonb_build_object i notify_on_feed_post), og kjører den EKTE
// grupperingen — ikke en kopi av den.
//
// Regresjonen den vokter: `match_events.type` har ÅTTE verdier (00009).
// Første versjon av mappingen listet bare fire, så `avspark` og
// `andre_omgang` mistet kampkonteksten og falt ut av grupperingen.
// ---------------------------------------------------------------------------

const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const EVENT = 'bbbbbbbb-0000-4000-8000-000000000002';
const TEAM = 'Stange G10';

let clock = Date.parse('2026-08-06T18:00:00Z');

/** Én rad slik notify_on_feed_post() (00051) setter den inn. */
function matchRow(
  id: string,
  eventType: string,
  opts: {
    minute?: number;
    teamSide?: 'home' | 'away';
    home?: number;
    away?: number;
    body?: string;
  } = {},
) {
  clock += 60_000;
  return {
    id,
    category: 'match_live',
    title: TEAM,
    body: opts.body ?? '',
    read_at: null,
    created_at: new Date(clock).toISOString(),
    team_space_id: 'ts-1',
    data: {
      feed_post_id: `fp-${id}`,
      event_id: EVENT,
      team_space_id: 'ts-1',
      type: 'match_event',
      match_session_id: SESSION,
      match_event_type: eventType,
      minute: opts.minute ?? 0,
      team_side: opts.teamSide ?? null,
      home_score: opts.home ?? 0,
      away_score: opts.away ?? 0,
      opponent: 'Oslo',
    },
  };
}

/** Hele kampen, i den rekkefølgen den faktisk spilles. */
function fullMatchRows() {
  return [
    matchRow('n1', 'avspark', {minute: 0, body: '⚽ Kampen er i gang: Stange G10 mot Oslo'}),
    matchRow('n2', 'mål', {minute: 28, teamSide: 'home', home: 1, away: 0, body: '⚽ MÅL! Stange G10 1–0 Oslo'}),
    matchRow('n3', 'pause', {minute: 45, home: 1, away: 0, body: '⏸ Pause. Stange G10 1–0 Oslo'}),
    matchRow('n4', 'andre_omgang', {minute: 45, home: 1, away: 0, body: '▶️ Andre omgang i gang. Stange G10 1–0 Oslo'}),
    matchRow('n5', 'mål', {minute: 63, teamSide: 'away', home: 1, away: 1, body: 'Mål til Oslo. Stange G10 1–1 Oslo'}),
    matchRow('n6', 'mål', {minute: 78, teamSide: 'home', home: 2, away: 1, body: '⚽ MÅL! Stange G10 2–1 Oslo'}),
    matchRow('n7', 'slutt', {minute: 90, home: 2, away: 1, body: '🏁 Slutt! Stange G10 2–1 Oslo'}),
  ];
}

describe('Varsler — kampen er ett objekt', () => {
  it('samler HELE kampforløpet i én oppføring', () => {
    // Serveren leverer nyest først.
    const rows = fullMatchRows().reverse();
    const entries = buildEntries(rows.map(mapNotificationRow));

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('match');
    if (entries[0].kind !== 'match') throw new Error('unreachable');
    expect(entries[0].sessionId).toBe(SESSION);
    expect(entries[0].items).toHaveLength(7);
  });

  it('mister ingen hendelsestype — heller ikke avspark og andre_omgang', () => {
    // Regresjonen: disse to var utelatt og ble til løse rader.
    const rows = fullMatchRows();
    const mapped = rows.map(mapNotificationRow);
    const withoutContext = mapped.filter(n => n.match === undefined);

    expect(withoutContext).toEqual([]);
    expect(mapped.map(n => n.match?.eventType)).toEqual([
      'avspark',
      'mål',
      'pause',
      'andre_omgang',
      'mål',
      'mål',
      'slutt',
    ]);
  });

  it('holder kampen samlet selv med andre varsler imellom', () => {
    const rows: any[] = fullMatchRows().reverse();
    rows.splice(2, 0, {
      id: 'c1',
      category: 'new_comment',
      title: 'Emma kommenterte bildet ditt',
      body: '«For en scoring!»',
      read_at: null,
      created_at: new Date(clock + 30_000).toISOString(),
      team_space_id: 'ts-1',
      data: {
        feed_post_id: 'fp-x',
        team_space_id: 'ts-1',
        actor_id: 'u-emma',
        actor_name: 'Emma',
        actor_avatar: 'https://example.test/emma.png',
      },
    });

    const entries = buildEntries(rows.map(mapNotificationRow));
    const matches = entries.filter(e => e.kind === 'match');
    const plainRows = entries.filter(e => e.kind === 'row');

    expect(matches).toHaveLength(1);
    expect(plainRows).toHaveLength(1);
  });

  it('lar kampvarsler UTEN kontekst (før 00051) falle tilbake til rader', () => {
    const legacy = {
      id: 'old',
      category: 'match_live',
      title: TEAM,
      body: '⚽ MÅL! Stange G10 1–0 Oslo',
      read_at: null,
      created_at: new Date(clock).toISOString(),
      team_space_id: 'ts-1',
      data: {feed_post_id: 'fp-old', event_id: EVENT},
    };
    const entries = buildEntries([mapNotificationRow(legacy)]);
    expect(entries[0].kind).toBe('row');
  });
});

describe('Varsler — menneskelig tekst', () => {
  const line = (row: any) => {
    const n = mapNotificationRow(row);
    return matchEventLine(n.match, n.body, TEAM);
  };

  it('erstatter systemtekstene og glyfene', () => {
    const [avspark, maal1, pause, andre, motmaal, maal2, slutt] =
      fullMatchRows();

    expect(line(avspark)).toBe('Kampen er i gang');
    expect(line(maal1)).toBe('Stange G10 tar ledelsen');
    expect(line(pause)).toBe('Pause');
    expect(line(andre)).toBe('Andre omgang i gang');
    expect(line(motmaal)).toBe('Oslo utligner');
    expect(line(maal2)).toBe('Stange G10 tar ledelsen');
    expect(line(slutt)).toBe('Full tid');
  });

  it('sier «reduserer» når målet ikke gir ledelse', () => {
    const row = matchRow('r1', 'mål', {
      minute: 80,
      teamSide: 'home',
      home: 1,
      away: 2,
    });
    expect(line(row)).toBe('Stange G10 reduserer');
  });

  it('fjerner ledende glyfer der vi må falle tilbake på basens tekst', () => {
    expect(stripLeadingGlyph('⚽ MÅL! Stange G10 1–0 Oslo')).toBe(
      'MÅL! Stange G10 1–0 Oslo',
    );
    expect(stripLeadingGlyph('▶️ Andre omgang i gang.')).toBe(
      'Andre omgang i gang.',
    );
    expect(stripLeadingGlyph('🏁 Slutt!')).toBe('Slutt!');
    expect(stripLeadingGlyph('Ingen glyf her')).toBe('Ingen glyf her');
  });
});

describe('Varsler — mennesket bak varselet', () => {
  it('plukker ut aktør med avatar (00051)', () => {
    const n = mapNotificationRow({
      id: 'c2',
      category: 'new_reaction',
      title: 'Brage heiet på innlegget ditt',
      body: '«Hei»',
      read_at: null,
      created_at: new Date(clock).toISOString(),
      team_space_id: 'ts-1',
      data: {
        feed_post_id: 'fp-y',
        actor_id: 'u-brage',
        actor_name: 'Brage',
        actor_avatar: 'https://example.test/b.png',
      },
    });

    expect(n.actor).toEqual({
      id: 'u-brage',
      name: 'Brage',
      avatarUrl: 'https://example.test/b.png',
    });
    // Tittelen bærer handlingen, body-en er innholdsutdraget (00052).
    expect(n.title).toBe('Brage heiet på innlegget ditt');
    expect(n.body).toBe('«Hei»');
  });

  it('gir ingen aktør når navnet mangler', () => {
    const n = mapNotificationRow({
      id: 'c3',
      category: 'new_comment',
      title: 'Noen',
      body: 'hei',
      read_at: null,
      created_at: new Date(clock).toISOString(),
      team_space_id: 'ts-1',
      data: {feed_post_id: 'fp-z'},
    });
    expect(n.actor).toBeUndefined();
  });
});

describe('Varsler — hva kortet skal fortelle', () => {
  const lineOf = (row: any) => {
    const n = mapNotificationRow(row);
    return matchEventLine(n.match, n.body, TEAM);
  };

  // Regresjonen Brage fant 2026-08-06: kortet klappet sammen (og mistet
  // tidslinja) i det MOTSTANDEREN scoret, fordi «utvidet» var knyttet til
  // vårt eget mål i stedet for til om noe var ulest.
  it('gir motstanderens mål en like informativ linje som vårt eget', () => {
    const motmaal = matchRow('x1', 'mål', {
      minute: 63,
      teamSide: 'away',
      home: 1,
      away: 1,
    });
    expect(lineOf(motmaal)).toBe('Oslo utligner');

    const motLedelse = matchRow('x2', 'mål', {
      minute: 70,
      teamSide: 'away',
      home: 1,
      away: 2,
    });
    expect(lineOf(motLedelse)).toBe('Oslo tar ledelsen');
  });

  // Brage 2026-08-06: «Hvis Ridabu leder 2–1 og scorer 3–1, blir det feil at
  // det står 'Ridabu tar ledelsen'.» Stillingen ETTER holder ikke — man må
  // vite om ledelsen ble tatt eller økt, altså stillingen FØR målet.
  it('skiller mellom å TA og å ØKE ledelsen', () => {
    const goal = (
      side: 'home' | 'away',
      home: number,
      away: number,
    ): string => lineOf(matchRow(`g-${side}-${home}${away}`, 'mål', {
      teamSide: side,
      home,
      away,
      minute: 50,
    }));

    // Eget lag
    expect(goal('home', 1, 0)).toBe('Stange G10 tar ledelsen'); // 0–0 → 1–0
    expect(goal('home', 2, 1)).toBe('Stange G10 tar ledelsen'); // 1–1 → 2–1
    expect(goal('home', 3, 1)).toBe('Stange G10 øker ledelsen'); // 2–1 → 3–1
    expect(goal('home', 2, 0)).toBe('Stange G10 øker ledelsen'); // 1–0 → 2–0
    expect(goal('home', 1, 1)).toBe('Stange G10 utligner'); //      0–1 → 1–1
    expect(goal('home', 1, 2)).toBe('Stange G10 reduserer'); //     0–2 → 1–2

    // Motstanderen — samme regel sett fra deres side
    expect(goal('away', 1, 1)).toBe('Oslo utligner'); //            1–0 → 1–1
    expect(goal('away', 1, 2)).toBe('Oslo tar ledelsen'); //        1–1 → 1–2
    expect(goal('away', 1, 3)).toBe('Oslo øker ledelsen'); //       1–2 → 1–3
    expect(goal('away', 2, 1)).toBe('Oslo reduserer'); //           2–0 → 2–1
  });

  it('navngir ingen når vi ikke vet hvem som scoret', () => {
    const row = matchRow('g-null', 'mål', {minute: 20, home: 1, away: 0});
    expect(lineOf(row)).toBe('Nytt mål');
  });

  it('gir pause og andre omgang egne linjer — de skal SES i tidslinja', () => {
    expect(lineOf(matchRow('x3', 'pause', {minute: 45}))).toBe('Pause');
    expect(lineOf(matchRow('x4', 'andre_omgang', {minute: 45}))).toBe(
      'Andre omgang i gang',
    );
  });

  it('gir ingen hendelse tom tekst — en tom tidslinjerad er en feil', () => {
    const types = [
      'avspark',
      'mål',
      'pause',
      'andre_omgang',
      'slutt',
      'bytte',
      'kort',
      'melding',
    ];
    for (const t of types) {
      const row = matchRow(`e-${t}`, t, {minute: 10, teamSide: 'home', home: 1});
      // `melding` uten beskrivelse er den ene som kan bli tom — den
      // filtreres bort av kortet i stedet for å vise et nakent minutt.
      const text = lineOf(row);
      if (t !== 'melding') {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Varsler — sosialt teller ikke som kamphendelser', () => {
  // Brage 2026-08-06 (LÅST): kommentarer og reaksjoner er sosiale varsler.
  // De skal aldri havne i kamptidslinja eller telle med i «N nye hendelser».
  const social = (id: string, category: string) => ({
    id,
    category,
    title: 'Emma kommenterte bildet ditt',
    body: '«For en scoring!»',
    read_at: null,
    created_at: new Date(clock + 1000).toISOString(),
    team_space_id: 'ts-1',
    // NB: samme feed-post som en kamphendelse — likevel ingen match-kontekst.
    data: {
      feed_post_id: 'fp-n2',
      event_id: EVENT,
      team_space_id: 'ts-1',
      actor_id: 'u-emma',
      actor_name: 'Emma',
    },
  });

  it('holder kommentar og 👏 utenfor kampgruppa', () => {
    const rows: any[] = [
      social('s1', 'new_comment'),
      social('s2', 'new_reaction'),
      ...fullMatchRows().reverse(),
    ];
    const entries = buildEntries(rows.map(mapNotificationRow));
    const match = entries.find(e => e.kind === 'match');
    if (!match || match.kind !== 'match') throw new Error('fant ingen kamp');

    // Kampgruppa inneholder KUN kamphendelser …
    expect(match.items).toHaveLength(7);
    expect(match.items.every(i => i.category === 'match_live')).toBe(true);

    // … og «nye hendelser» telles av nettopp den gruppa, så de sosiale
    // varslene kan ikke blåse opp tallet.
    const nyeHendelser = match.items.filter(i => i.readAt === null).length;
    expect(nyeHendelser).toBe(7);

    // De sosiale ligger som egne rader.
    expect(entries.filter(e => e.kind === 'row')).toHaveLength(2);
  });

  it('gir aldri sosiale varsler kampkontekst, selv med event_id i data', () => {
    const n = mapNotificationRow(social('s3', 'new_comment'));
    expect(n.match).toBeUndefined();
    expect(n.eventId).toBe(EVENT);
  });
});

describe('Varsler — endringer på et arrangement', () => {
  const changeRow = (changes: any[]) => ({
    id: 'ch1',
    category: 'event_reminder',
    title: 'Kamp mot Oslo er endret',
    body: 'oppmøtet er flyttet: 17:30 → 17:00',
    read_at: null,
    created_at: new Date(clock).toISOString(),
    team_space_id: 'ts-1',
    data: {
      kind: 'change',
      event_id: EVENT,
      team_space_id: 'ts-1',
      event_title: 'Kamp mot Oslo',
      changes,
    },
  });

  it('plukker ut gammel og ny verdi (00054)', () => {
    const n = mapNotificationRow(
      changeRow([
        {field: 'meeting_time', label: 'oppmøtet er flyttet', old: '17:30', new: '17:00'},
        {field: 'location', label: 'nytt sted', old: 'Bane 1', new: 'Bane 2'},
      ]),
    );
    expect(n.eventKind).toBe('change');
    expect(n.changes).toHaveLength(2);
    expect(n.changes?.[0]).toEqual({
      field: 'meeting_time',
      label: 'oppmøtet er flyttet',
      old: '17:30',
      new: '17:00',
    });
  });

  it('ignorerer ufullstendige endringer', () => {
    const n = mapNotificationRow(changeRow([{field: 'x'}, {label: 'bare label'}]));
    expect(n.changes).toBeUndefined();
  });

  it('gir ingen endringer på en påminnelse', () => {
    const n = mapNotificationRow({
      id: 'rem1',
      category: 'event_reminder',
      title: 'Kamp mot Oslo — oppmøte om én time',
      body: 'Oppmøte 17:30, Bane 2. Start 18:00.',
      read_at: null,
      created_at: new Date(clock).toISOString(),
      team_space_id: 'ts-1',
      data: {kind: 'reminder', event_id: EVENT, anchor: 'meeting'},
    });
    expect(n.eventKind).toBe('reminder');
    expect(n.changes).toBeUndefined();
  });
});

describe('Varsler — bolkene', () => {
  it('deler i Nå / I dag / Tidligere', () => {
    const now = Date.parse('2026-08-06T20:00:00Z');
    const at = (iso: string, id: string) =>
      mapNotificationRow({
        id,
        category: 'system',
        title: 't',
        body: 'b',
        read_at: null,
        created_at: iso,
        team_space_id: 'ts-1',
        data: {},
      });

    const entries = buildEntries([
      at('2026-08-06T19:45:00Z', 'a'), // siste time
      at('2026-08-06T09:00:00Z', 'b'), // tidligere i dag
      at('2026-08-01T09:00:00Z', 'c'), // tidligere
    ]);

    expect(groupByAge(entries, now).map(s => s.label)).toEqual([
      'Nå',
      'I dag',
      'Tidligere',
    ]);
  });
});

describe('Varsler — inkrementell fletting (B2)', () => {
  const at = (id: string, iso: string, readAt: string | null = null) =>
    mapNotificationRow({
      id,
      category: 'system',
      title: 't',
      body: 'b',
      read_at: readAt,
      created_at: iso,
      team_space_id: 'ts-1',
      data: {},
    });

  it('fletter nyere rader inn øverst (realtime-resync)', () => {
    const existing = [
      at('b', '2026-08-06T18:00:00Z'),
      at('a', '2026-08-06T17:00:00Z'),
    ];
    const fresh = [at('c', '2026-08-06T19:00:00Z')];

    expect(mergeNotifications(existing, fresh).map(n => n.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('fletter eldre sider inn nederst (paginering)', () => {
    const existing = [
      at('c', '2026-08-06T19:00:00Z'),
      at('b', '2026-08-06T18:00:00Z'),
    ];
    const older = [at('a', '2026-08-06T17:00:00Z')];

    expect(mergeNotifications(existing, older).map(n => n.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('deduper på id — den innkommende raden vinner (ferskest readAt)', () => {
    // Sidegrense-overlapp og fokus-resync leverer rader lista alt har;
    // serverens versjon skal vinne, for det er den som vet at raden er lest.
    const existing = [
      at('b', '2026-08-06T18:00:00Z', null),
      at('a', '2026-08-06T17:00:00Z'),
    ];
    const fresh = [
      at('c', '2026-08-06T19:00:00Z'),
      at('b', '2026-08-06T18:00:00Z', '2026-08-06T18:30:00Z'),
    ];

    const merged = mergeNotifications(existing, fresh);
    expect(merged.map(n => n.id)).toEqual(['c', 'b', 'a']);
    expect(merged[1].readAt?.toISOString()).toBe('2026-08-06T18:30:00.000Z');
  });

  it('nedgraderer ALDRI en lokal lest-markering til ulest', () => {
    // Tidslinjen vernet dekker: bruker trykker raden (lokal readAt=now,
    // markAsRead i flukt) mens en fokus-henting alt var ute — snapshotet
    // dens bærer read_at=null fra FØR skrivet committet.
    const existing = [at('b', '2026-08-06T18:00:00Z', '2026-08-06T18:30:00Z')];
    const fresh = [at('b', '2026-08-06T18:00:00Z', null)];

    const merged = mergeNotifications(existing, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].readAt?.toISOString()).toBe('2026-08-06T18:30:00.000Z');
  });
});
