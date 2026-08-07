import {
  buildSavePayload,
  changedEventFields,
  eventIsUpcoming,
  formValuesFromEvent,
  isNotifyingField,
  parseTime,
  resolveEndTime,
  resolveMeetingTime,
  willNotifyTeam,
  type EditableEvent,
  type EventFormValues,
} from '../src/shared/eventForm';

// ---------------------------------------------------------------------------
// REDIGERING AV ARRANGEMENT (2026-08-07).
//
// `NewEventScreen` ble tosidig i stedet for at det ble bygget et eget
// redigeringsskjema. Det som gjør det trygt er at regnestykkene ligger i
// `shared/eventForm.ts` og ikke i skjermen — og denne fila er beviset på at
// de stemmer.
//
// De seks tilfellene Brage krevde dekket, er testene under: endre dato, endre
// tidspunkt, endre sted, redigere noe historisk uten push, redigere en
// turnering uten å ødelegge datoperioden, og avlyse en fremtidig kamp.
//
// ⚠️ To ting KAN IKKE testes her, og skal ikke late som: vaktene i
// `update_event`/`set_match_cancelled` (SQL, 00057) og selve pushen. Det som
// testes er at appen regner det SAMME som migrasjonen gjør — at løftet i
// skjemaet og oppførselen i basen er én regel, ikke to.
// ---------------------------------------------------------------------------

const NOW = new Date(2026, 7, 7, 12, 0); // fredag 7. august 2026, kl. 12:00

/** En vanlig trening om en uke: fredag 14. august kl. 18:00. */
function training(overrides: Partial<EditableEvent> = {}): EditableEvent {
  return {
    id: 'evt-1',
    teamSpaceId: 'ts-1',
    type: 'trening',
    title: 'Trening',
    startTime: new Date(2026, 7, 14, 18, 0),
    location: 'Kunstgresset',
    isHome: true,
    ...overrides,
  };
}

/** En kamp om en uke: lørdag 15. august kl. 12:00, mot Lyn. */
function match(overrides: Partial<EditableEvent> = {}): EditableEvent {
  return {
    id: 'evt-2',
    teamSpaceId: 'ts-1',
    type: 'kamp',
    title: 'Kamp mot Lyn',
    startTime: new Date(2026, 7, 15, 12, 0),
    location: 'Briskeby',
    opponent: 'Lyn',
    isHome: true,
    matchStatus: 'upcoming',
    ...overrides,
  };
}

/** En cup-helg: 22.–23. august. `end_time` bærer SLUTTDATOEN, 23:59. */
function tournament(overrides: Partial<EditableEvent> = {}): EditableEvent {
  return {
    id: 'evt-3',
    teamSpaceId: 'ts-1',
    type: 'turnering',
    title: 'Hamar Cup',
    startTime: new Date(2026, 7, 22, 9, 0),
    endTime: new Date(2026, 7, 23, 23, 59),
    location: 'Hamar',
    isHome: true,
    ...overrides,
  };
}

/** Prefyll skjemaet, endre nøyaktig ett felt, og bygg nyttelasten. */
function edit(
  event: EditableEvent,
  changes: Partial<EventFormValues>,
): ReturnType<typeof buildSavePayload> {
  return buildSavePayload({...formValuesFromEvent(event), ...changes}, event);
}

// ---------------------------------------------------------------------------
// Prefyllingen: skjemaet skal åpne som arrangementet ER
// ---------------------------------------------------------------------------
describe('prefylling', () => {
  it('speiler arrangementet felt for felt', () => {
    const values = formValuesFromEvent(match());

    expect(values.type).toBe('kamp');
    expect(values.title).toBe('Kamp mot Lyn');
    expect(values.time).toBe('12:00');
    expect(values.location).toBe('Briskeby');
    expect(values.opponent).toBe('Lyn');
    expect(values.isHome).toBe(true);
    // Datoen er midnatt — klokkeslettet bor i `time`, ikke i `day`.
    expect(values.day).toEqual(new Date(2026, 7, 15));
  });

  it('gir tomme strenger, ikke undefined, for felt som mangler', () => {
    const values = formValuesFromEvent(
      training({location: undefined, description: undefined}),
    );
    // En TextInput med `undefined` som value blir ukontrollert og advarer.
    expect(values.location).toBe('');
    expect(values.description).toBe('');
    expect(values.opponent).toBe('');
  });

  it('polstrer klokkeslettet — 09:05, ikke 9:5', () => {
    expect(formValuesFromEvent(training({
      startTime: new Date(2026, 7, 14, 9, 5),
    })).time).toBe('09:05');
  });

  it('en lagring uten endringer er en tom lagring', () => {
    const event = match();
    const payload = buildSavePayload(formValuesFromEvent(event), event)!;
    expect(changedEventFields(event, payload)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 1. ENDRE DATO
// ---------------------------------------------------------------------------
describe('endre dato', () => {
  it('flytter starten og lar klokkeslettet stå', () => {
    const event = training();
    const payload = edit(event, {day: new Date(2026, 7, 21)})!;

    expect(payload.startTime).toEqual(new Date(2026, 7, 21, 18, 0));
    expect(changedEventFields(event, payload)).toEqual(['start']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });

  it('flytter en arvet sluttid like langt — varigheten er det avtalen sier', () => {
    // Et arrangement fra FØR sluttidsfeltet ble fjernet (2026-08-06):
    // 18:00–19:30. Skjemaet viser ikke sluttiden, men den skal ikke gå tapt,
    // og den kan aldri havne før starten.
    const event = training({endTime: new Date(2026, 7, 14, 19, 30)});
    const payload = edit(event, {day: new Date(2026, 7, 21)})!;

    expect(payload.endTime).toEqual(new Date(2026, 7, 21, 19, 30));
    expect(payload.endTime!.getTime()).toBeGreaterThan(
      payload.startTime.getTime(),
    );
  });

  it('flytter et arvet oppmøte like langt — «30 min før» blir stående', () => {
    const event = match({meetingTime: new Date(2026, 7, 15, 11, 30)});
    const payload = edit(event, {day: new Date(2026, 7, 22)})!;

    expect(payload.meetingTime).toEqual(new Date(2026, 7, 22, 11, 30));
    expect(payload.meetingTime!.getTime()).toBeLessThanOrEqual(
      payload.startTime.getTime(),
    );
  });

  it('sletter ikke sluttid og oppmøte som ikke finnes', () => {
    const payload = edit(training(), {day: new Date(2026, 7, 21)})!;
    expect(payload.endTime).toBeUndefined();
    expect(payload.meetingTime).toBeUndefined();
  });

  it('varsler når en utsatt kamp flyttes fra fortiden og fram i tid', () => {
    // Kampen ble utsatt i går. Nå settes den opp igjen neste lørdag — det er
    // nøyaktig det laget MÅ få vite, selv om arrangementet var historikk.
    const event = match({startTime: new Date(2026, 7, 6, 12, 0)});
    const payload = edit(event, {day: new Date(2026, 7, 15)})!;

    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. ENDRE TIDSPUNKT
// ---------------------------------------------------------------------------
describe('endre tidspunkt', () => {
  it('flytter klokkeslettet og lar datoen stå', () => {
    const event = training();
    const payload = edit(event, {time: '17:30'})!;

    expect(payload.startTime).toEqual(new Date(2026, 7, 14, 17, 30));
    expect(changedEventFields(event, payload)).toEqual(['start']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });

  it('gir ingen nyttelast før klokkeslettet er et klokkeslett', () => {
    // Knappen er deaktivert så lenge denne er null — halvskrevet «17» skal
    // ikke kunne lagres som midnatt.
    expect(edit(training(), {time: '17'})).toBeNull();
    expect(edit(training(), {time: '25:00'})).toBeNull();
    expect(edit(training(), {time: '17:75'})).toBeNull();
  });

  it('parseTime godtar bare et ekte klokkeslett', () => {
    // `TimeField` (rutenettet) kan bare sende gyldige verdier, men lagrede
    // rader og ruteparametere er ikke like disiplinerte — dette er skansen.
    expect(parseTime('09:05')).toEqual({hours: 9, minutes: 5});
    expect(parseTime('00:00')).toEqual({hours: 0, minutes: 0});
    expect(parseTime('23:55')).toEqual({hours: 23, minutes: 55});
    expect(parseTime('9:05')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime('tull')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. ENDRE STED
// ---------------------------------------------------------------------------
describe('endre sted', () => {
  it('lagrer det nye stedet og varsler laget', () => {
    const event = training();
    const payload = edit(event, {location: 'Grusbanen'})!;

    expect(payload.location).toBe('Grusbanen');
    expect(changedEventFields(event, payload)).toEqual(['location']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });

  it('et tømt sted BLIR tømt — update_event er en full erstatning', () => {
    const event = training();
    const payload = edit(event, {location: '   '})!;

    expect(payload.location).toBeUndefined();
    expect(changedEventFields(event, payload)).toEqual(['location']);
  });

  it('endret beskjed alene varsler IKKE (Brage 2026-08-06)', () => {
    const event = training();
    const payload = edit(event, {description: 'Husk drikkeflaske'})!;

    expect(changedEventFields(event, payload)).toEqual(['description']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(false);
  });

  it('hjemme/borte varsler ikke — basen ser ikke den endringen', () => {
    const event = match();
    const payload = edit(event, {isHome: false})!;

    expect(changedEventFields(event, payload)).toEqual(['isHome']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(false);
  });

  it('ny motstander varsler', () => {
    const event = match();
    const payload = edit(event, {opponent: 'Ham-Kam'})!;

    expect(payload.opponent).toBe('Ham-Kam');
    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. REDIGERE ET HISTORISK ARRANGEMENT — INGEN PUSH
//
// Den åpne saken 00056 lot stå igjen, og vakten som lukker den bor i 00057.
// Testene her vokter at APPEN sier det samme som SQL-en gjør.
// ---------------------------------------------------------------------------
describe('historisk arrangement', () => {
  const yesterday = () => match({startTime: new Date(2026, 7, 6, 12, 0)});

  it('varsler ikke når stedet rettes på en kamp som er spilt', () => {
    const event = yesterday();
    const payload = edit(event, {location: 'Stangehallen'})!;

    expect(changedEventFields(event, payload)).toEqual(['location']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(false);
  });

  it('varsler ikke når tidspunktet rettes innenfor fortiden', () => {
    const event = yesterday();
    const payload = edit(event, {time: '13:00'})!;

    expect(payload.startTime).toEqual(new Date(2026, 7, 6, 13, 0));
    expect(willNotifyTeam(event, payload, NOW)).toBe(false);
  });

  it('varsler ikke når et fremtidig arrangement flyttes BAKOVER i tid', () => {
    // Feilskrevet dato som rettes tilbake: arrangementet er historikk etter
    // lagringen, og da er stillhet riktig.
    const event = match();
    const payload = edit(event, {day: new Date(2026, 7, 1)})!;

    expect(willNotifyTeam(event, payload, NOW)).toBe(false);
  });

  it('grensen er NÅ, ikke «i dag»', () => {
    // En trening som startet kl. 09 er historikk kl. 12, selv om datoen er
    // dagens. Samme test som 00056 og som `create_event`-flyten bruker.
    const morning = training({startTime: new Date(2026, 7, 7, 9, 0)});
    const evening = training({startTime: new Date(2026, 7, 7, 19, 0)});

    expect(willNotifyTeam(morning, edit(morning, {location: 'A'})!, NOW)).toBe(
      false,
    );
    expect(willNotifyTeam(evening, edit(evening, {location: 'A'})!, NOW)).toBe(
      true,
    );
  });

  it('er akkurat NÅ fortsatt fremtid', () => {
    // `start_time < now()` i SQL betyr at likhet slipper gjennom. Vipper
    // denne, vipper appen og basen hver sin vei.
    expect(eventIsUpcoming(NOW, NOW)).toBe(true);
    expect(eventIsUpcoming(new Date(NOW.getTime() - 1), NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. REDIGERE EN TURNERING UTEN Å ØDELEGGE DATOPERIODEN
//
// ⚠️ Turneringens `end_time` er SLUTTDATOEN (siste dag 23:59), ikke et
// sluttklokkeslett. Behandles den som et klokkeslett — eller tømmes den fordi
// skjemaet ikke viser feltet — mister cupen helga si.
// ---------------------------------------------------------------------------
describe('turnering', () => {
  it('leser sluttdatoen ut av end_time ved prefylling', () => {
    const values = formValuesFromEvent(tournament());

    expect(values.day).toEqual(new Date(2026, 7, 22));
    expect(values.endDay).toEqual(new Date(2026, 7, 23));
    expect(values.time).toBe('09:00');
  });

  it('beholder perioden når bare stedet rettes', () => {
    const event = tournament();
    const payload = edit(event, {location: 'Ankerskogen'})!;

    expect(payload.startTime).toEqual(new Date(2026, 7, 22, 9, 0));
    expect(payload.endTime).toEqual(new Date(2026, 7, 23, 23, 59));
    expect(changedEventFields(event, payload)).toEqual(['location']);
  });

  it('flytter HELE perioden når begge datoene flyttes', () => {
    const event = tournament();
    const payload = edit(event, {
      day: new Date(2026, 7, 29),
      endDay: new Date(2026, 7, 30),
    })!;

    expect(payload.startTime).toEqual(new Date(2026, 7, 29, 9, 0));
    expect(payload.endTime).toEqual(new Date(2026, 7, 30, 23, 59));
  });

  it('en forlenget cup-helg er en varslet endring', () => {
    const event = tournament();
    const payload = edit(event, {endDay: new Date(2026, 7, 24)})!;

    expect(payload.endTime).toEqual(new Date(2026, 7, 24, 23, 59));
    expect(changedEventFields(event, payload)).toEqual(['end']);
    expect(willNotifyTeam(event, payload, NOW)).toBe(true);
  });

  it('en endagsturnering får end_time ETTER start_time', () => {
    // DB-kravet `end_time > start_time` (00019) må holde også når cupen
    // varer én dag — derfor 23:59 og ikke midnatt.
    const start = new Date(2026, 7, 22);
    const payload = resolveEndTime(
      {...formValuesFromEvent(tournament()), endDay: start},
      new Date(2026, 7, 22, 9, 0),
    )!;

    expect(payload).toEqual(new Date(2026, 7, 22, 23, 59));
    expect(payload.getTime()).toBeGreaterThan(
      new Date(2026, 7, 22, 9, 0).getTime(),
    );
  });

  it('arver ALDRI varighet — turneringen eier sin egen sluttdato', () => {
    // Faller turneringen ned i «bevar varigheten»-grenen, blir en helgecup
    // 38 timer lang fra ny startdato i stedet for til og med søndag.
    const event = tournament();
    const payload = edit(event, {day: new Date(2026, 8, 5)})!;

    // Sluttdatoen ble ikke rørt, så den står — og da er perioden ugyldig
    // riktig vei rundt: skjemaet drar sluttdatoen med seg (`setStartDay`).
    expect(payload.endTime).toEqual(new Date(2026, 7, 23, 23, 59));
  });

  it('sluttdatoen varsler KUN for turneringer', () => {
    // For en trening er sluttiden en arvet varighet som flytter seg sammen
    // med starten. En egen «sluttiden er endret»-linje ville vært støy.
    expect(isNotifyingField('end', 'turnering')).toBe(true);
    expect(isNotifyingField('end', 'trening')).toBe(false);
    expect(isNotifyingField('end', 'kamp')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. AVLYSE EN FREMTIDIG KAMP
//
// Avlysningen er en statusendring i basen (`set_match_cancelled`, 00057) og
// har ingen skjemaverdier. Det som er APPENS ansvar er å si sant om hva som
// skjer med laget FØR man trykker — og det er samme vakt som alt annet.
// ---------------------------------------------------------------------------
describe('avlysning', () => {
  it('en fremtidig kamp gir varsel', () => {
    expect(eventIsUpcoming(match().startTime, NOW)).toBe(true);
  });

  it('en kamp som har vært gir ingen varsel', () => {
    const played = match({startTime: new Date(2026, 7, 6, 12, 0)});
    expect(eventIsUpcoming(played.startTime, NOW)).toBe(false);
  });

  it('en kamp som startet tidligere i dag gir ingen varsel', () => {
    const earlier = match({startTime: new Date(2026, 7, 7, 9, 0)});
    expect(eventIsUpcoming(earlier.startTime, NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tittelen: valgfri i UI-et, påkrevd i basen
// ---------------------------------------------------------------------------
describe('tittel', () => {
  it('faller til en fornuftig standard når feltet tømmes', () => {
    const event = match();
    const payload = edit(event, {title: '  '})!;

    expect(payload.title).toBe('Kamp mot Lyn');
    // …og da er ingenting endret, selv om feltet står tomt på skjermen.
    expect(changedEventFields(event, payload)).toEqual([]);
  });

  it('standardtittelen følger motstanderen', () => {
    const event = match();
    const payload = edit(event, {title: '', opponent: 'Ham-Kam'})!;

    expect(payload.title).toBe('Kamp mot Ham-Kam');
    expect(changedEventFields(event, payload).sort()).toEqual([
      'opponent',
      'title',
    ]);
  });

  it('trimmer en egen tittel', () => {
    expect(edit(training(), {title: '  Ekstraøkt  '})!.title).toBe('Ekstraøkt');
  });
});

// ---------------------------------------------------------------------------
// Arv av felt skjemaet ikke viser — direkte
// ---------------------------------------------------------------------------
describe('felt skjemaet ikke viser', () => {
  it('resolveMeetingTime gir ingenting når det ikke fantes noe', () => {
    expect(resolveMeetingTime(new Date(2026, 7, 21, 18, 0))).toBeUndefined();
    expect(
      resolveMeetingTime(new Date(2026, 7, 21, 18, 0), training()),
    ).toBeUndefined();
  });

  it('resolveEndTime gir ingenting når det ikke fantes noe', () => {
    const values = formValuesFromEvent(training());
    expect(
      resolveEndTime(values, new Date(2026, 7, 21, 18, 0), training()),
    ).toBeUndefined();
  });

  it('opprettelse arver ingenting — det finnes ingen original', () => {
    const values = formValuesFromEvent(
      training({
        endTime: new Date(2026, 7, 14, 19, 30),
        meetingTime: new Date(2026, 7, 14, 17, 30),
      }),
    );
    const payload = buildSavePayload(values)!;

    expect(payload.endTime).toBeUndefined();
    expect(payload.meetingTime).toBeUndefined();
  });
});
