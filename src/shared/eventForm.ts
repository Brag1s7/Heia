import {atTime, startOfDay} from './calendar';
import type {EventType, MatchStatus} from './types';

/**
 * Skjemaets logikk for ETT arrangement — rene funksjoner, ingen React og
 * ingen Supabase.
 *
 * `NewEventScreen` er tosidig fra 2026-08-07: den oppretter og den redigerer.
 * Alt som skiller de to sidene fra hverandre er PREFYLLING og HVILKEN RPC som
 * kalles til slutt. Regnestykkene — hvilken tittel som brukes når feltet er
 * tomt, hva `end_time` skal være, hva som faktisk er endret, om laget får
 * varsel — er de SAMME, og de bor her i stedet for i skjermen.
 *
 * ⚠️ Turneringens `end_time` er en DATO, ikke et klokkeslett: siste dag kl.
 * 23:59. Det er en semantikk som er låst i datamodellen (00019/00032), og
 * denne fila er stedet den er skrevet ned. Alle andre typer har enten ingen
 * sluttid, eller en arvet varighet — se `resolveEndTime`.
 */

// ---------------------------------------------------------------------------
// Klokkeslett
// ---------------------------------------------------------------------------

// ⛔ `maskTime` er FJERNET (2026-08-07). Den tvang inndata mot HH:MM mens
// brukeren skrev, og fantes kun for det maskerte tekstfeltet — som er byttet
// ut med `components/TimeField`, et rutenett man ikke kan skrive i. Ingen
// caller igjen; en maske uten tastatur er bare kode å vedlikeholde.

/**
 * «HH:MM» → tall. Fortsatt i bruk, og fortsatt streng: `TimeField` sender bare
 * gyldige verdier, men lagrede rader og ruteparametere gjør det ikke
 * nødvendigvis, og `buildSavePayload` er siste skanse før basen.
 */
export function parseTime(value: string): {hours: number; minutes: number} | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return {hours, minutes};
}

/** En lagret dato tilbake til skjemaets tekstfelt: «18:00». */
export function formatTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/** Tittel er valgfri i UI-et — DB krever den, så vi fyller inn en fornuftig. */
export function defaultTitle(type: EventType, opponent: string): string {
  switch (type) {
    case 'trening':
      return 'Trening';
    case 'kamp':
      return opponent.trim() ? `Kamp mot ${opponent.trim()}` : 'Kamp';
    case 'turnering':
      return 'Turnering';
    case 'sosialt':
      return 'Sosialt';
    default:
      return 'Hendelse';
  }
}

// ---------------------------------------------------------------------------
// Skjemaets verdier
// ---------------------------------------------------------------------------

/** Alt skjemaet samler inn. Rå tekst — trimming skjer i `buildSavePayload`. */
export interface EventFormValues {
  type: EventType;
  title: string;
  /** Startdato (midnatt). Klokkeslettet bor i `time`. */
  day: Date;
  /** Turneringens siste dag (midnatt). Ignorert for alle andre typer. */
  endDay: Date;
  /** «HH:MM». Ugyldig tekst gir null fra `buildSavePayload`. */
  time: string;
  location: string;
  description: string;
  opponent: string;
  isHome: boolean;
}

/**
 * Arrangementet slik det ligger i basen, med akkurat det skjemaet må vite for
 * å fylle seg selv ut igjen. Bevisst en egen type og ikke `HeiaEvent`:
 * redigering trenger `isHome` og `parentEventId`, som kalender- og
 * hjemkortene aldri har hatt bruk for.
 */
export interface EditableEvent {
  id: string;
  teamSpaceId: string;
  type: EventType;
  title: string;
  startTime: Date;
  endTime?: Date;
  meetingTime?: Date;
  location?: string;
  description?: string;
  opponent?: string;
  isHome: boolean;
  parentEventId?: string;
  matchStatus?: MatchStatus;
}

/**
 * Basen → skjemaet. Turneringens sluttdato leses ut av `end_time`; alle andre
 * typer får `endDay = day`, slik at feltet har en gyldig verdi hvis noen
 * likevel skulle bytte type senere.
 */
export function formValuesFromEvent(event: EditableEvent): EventFormValues {
  const day = startOfDay(event.startTime);
  return {
    type: event.type,
    title: event.title,
    day,
    endDay:
      event.type === 'turnering' && event.endTime
        ? startOfDay(event.endTime)
        : day,
    time: formatTimeValue(event.startTime),
    location: event.location ?? '',
    description: event.description ?? '',
    opponent: event.opponent ?? '',
    isHome: event.isHome,
  };
}

// ---------------------------------------------------------------------------
// Skjemaet → det som lagres
// ---------------------------------------------------------------------------

/** Feltene `create_event` og `update_event` deler. */
export interface EventSavePayload {
  title: string;
  startTime: Date;
  endTime?: Date;
  /** Aldri skrevet inn i skjemaet — kun arvet ved redigering. */
  meetingTime?: Date;
  location?: string;
  description?: string;
  opponent?: string;
  isHome: boolean;
}

/**
 * Hva `end_time` skal være etter lagring.
 *
 * Tre tilfeller, og de er ikke det samme:
 *  - **Turnering:** sluttDATOEN, siste dag kl. 23:59. Det er turneringens
 *    egen semantikk (00019/00032), og en endagsturnering tilfredsstiller da
 *    også DB-kravet `end_time > start_time`.
 *  - **Redigering av noe som ALLEREDE har en sluttid:** varigheten arves.
 *    Skjemaet spør ikke om sluttid lenger (Brage 2026-08-06), men eldre
 *    arrangementer har den. Å sende `null` ville stille slettet den; å sende
 *    den uendret ville lagt sluttiden FØR starten så snart noen flyttet
 *    dagen. Vi flytter den like langt som starten flyttet seg — «18:00–19:30»
 *    blir «17:00–18:30», og raden kan aldri bli ugyldig.
 *  - **Alt annet:** ingen sluttid.
 */
export function resolveEndTime(
  values: EventFormValues,
  startTime: Date,
  original?: EditableEvent,
): Date | undefined {
  if (values.type === 'turnering') {
    return atTime(values.endDay, 23, 59);
  }
  if (original?.endTime) {
    const durationMs =
      original.endTime.getTime() - original.startTime.getTime();
    return new Date(startTime.getTime() + durationMs);
  }
  return undefined;
}

/**
 * Hva `meeting_time` skal være etter lagring.
 *
 * Skjemaet spør IKKE om oppmøtetid (Brage 2026-08-06), men kolonnen finnes og
 * eldre arrangementer har den. `update_event` er en full erstatning, så et
 * utelatt felt ville blitt slettet — «møt opp 17:30» ville forsvunnet fordi
 * noen rettet et stedsnavn.
 *
 * Vi arver derfor AVSTANDEN til starten, ikke tidspunktet: «30 minutter før»
 * er det avtalen faktisk sier, og den holder seg sann når kampen flyttes.
 * Avstanden er aldri negativ, så DB-kravet `meeting_time <= start_time` kan
 * ikke brytes av en flytting.
 */
export function resolveMeetingTime(
  startTime: Date,
  original?: EditableEvent,
): Date | undefined {
  if (!original?.meetingTime) return undefined;
  const leadMs = original.startTime.getTime() - original.meetingTime.getTime();
  return new Date(startTime.getTime() - leadMs);
}

/**
 * Skjemaets verdier → det som sendes til basen. Returnerer null når
 * klokkeslettet ikke er et klokkeslett — da er det ingenting å lagre.
 *
 * `original` sendes kun i redigering, og brukes av `resolveEndTime` og
 * `resolveMeetingTime` — de to feltene skjemaet ikke viser, men som ikke skal
 * gå tapt av at noen retter et stedsnavn.
 */
export function buildSavePayload(
  values: EventFormValues,
  original?: EditableEvent,
): EventSavePayload | null {
  const parsed = parseTime(values.time);
  if (!parsed) return null;

  const startTime = atTime(values.day, parsed.hours, parsed.minutes);
  const isMatch = values.type === 'kamp';

  return {
    title: values.title.trim() || defaultTitle(values.type, values.opponent),
    startTime,
    endTime: resolveEndTime(values, startTime, original),
    meetingTime: resolveMeetingTime(startTime, original),
    location: values.location.trim() || undefined,
    description: values.description.trim() || undefined,
    opponent: isMatch ? values.opponent.trim() : undefined,
    isHome: values.isHome,
  };
}

// ---------------------------------------------------------------------------
// Hva ble endret — og varsles laget?
// ---------------------------------------------------------------------------

export type EventChangeField =
  | 'title'
  | 'start'
  | 'end'
  | 'location'
  | 'description'
  | 'opponent'
  | 'isHome';

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '');
}

function sameTime(a: Date | undefined, b: Date | undefined): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

/**
 * Forskjellen mellom det som ligger i basen og det som er i ferd med å bli
 * lagret. Brukes til to ting: å hoppe over lagringen når ingenting er endret,
 * og til å si sant om varslingen FØR man trykker.
 */
export function changedEventFields(
  original: EditableEvent,
  payload: EventSavePayload,
): EventChangeField[] {
  const changed: EventChangeField[] = [];
  if (original.title !== payload.title) changed.push('title');
  if (!sameTime(original.startTime, payload.startTime)) changed.push('start');
  if (!sameTime(original.endTime, payload.endTime)) changed.push('end');
  if (!sameText(original.location, payload.location)) changed.push('location');
  if (!sameText(original.description, payload.description)) {
    changed.push('description');
  }
  if (!sameText(original.opponent, payload.opponent)) changed.push('opponent');
  if (original.isHome !== payload.isHome) changed.push('isHome');
  return changed;
}

/**
 * Feltene som utløser endringsvarsel i basen (00054).
 *
 * ⛔ `description` er BEVISST utenfor (Brage 2026-08-06): beskjeden til laget
 * endres ofte og betyr sjelden noe for oppmøtet. `isHome` er heller ikke med —
 * databasen ser den ikke som en endring, og skjemaet skal ikke love et varsel
 * basen ikke sender.
 *
 * `end` teller kun for turneringer, der `end_time` ER perioden. For alle andre
 * typer er sluttiden en arvet varighet som flytter seg sammen med starten, og
 * den skal ikke gi en egen linje i varselet.
 */
export function isNotifyingField(
  field: EventChangeField,
  type: EventType,
): boolean {
  switch (field) {
    case 'title':
    case 'start':
    case 'location':
    case 'opponent':
      return true;
    case 'end':
      return type === 'turnering';
    default:
      return false;
  }
}

/**
 * Selve tidsvakten fra migrasjon 00057, alene: sender basen varsel om noe som
 * skjer på DETTE tidspunktet?
 *
 * ⚠️ Grensen er `now()`, ikke «i dag» — en trening som startet kl. 12 er
 * historikk kl. 16, selv om datoen er dagens. Nøyaktig samme test som
 * opprettelsen bruker (00056), og som SQL-en gjør (`start_time < now()` →
 * ingenting).
 *
 * Brukes to steder i appen: notatet i skjemaet, og bekreftelsen før en
 * avlysning. Begge steder må si det SAMME som basen gjør — derfor én
 * funksjon, ikke to `> Date.now()` spredt rundt.
 */
export function eventIsUpcoming(
  startTime: Date,
  now: Date = new Date(),
): boolean {
  return startTime.getTime() >= now.getTime();
}

/**
 * Får laget beskjed om denne lagringen?
 *
 * To betingelser, og begge må holde: arrangementet må fortsatt ligge fram i
 * tid, OG minst ett felt databasen faktisk ser på må være endret.
 *
 * Merk at det er den NYE starttiden som avgjør: flytter man en utsatt kamp fra
 * i går til neste tirsdag, skal laget selvsagt vite det. Går flyttingen andre
 * veien, er arrangementet historikk etterpå, og stillhet er riktig.
 */
export function willNotifyTeam(
  original: EditableEvent,
  payload: EventSavePayload,
  now: Date = new Date(),
): boolean {
  if (!eventIsUpcoming(payload.startTime, now)) return false;
  return changedEventFields(original, payload).some(field =>
    isNotifyingField(field, original.type),
  );
}
