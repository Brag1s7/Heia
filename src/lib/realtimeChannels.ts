/**
 * Kanal-registry (P6, duplikatvern): ÉN realtime-kanal per topic, uansett
 * hvor mange skjerminstanser som lytter.
 *
 * EventDetail er registrert i tre stacks (Hjem/Kalender/Varsler), så samme
 * kamp kan stå montert to ganger — uten registryet ga det dobbel kanal og
 * dobbelt sett refetches per hendelse (F19). Fokus-gatingen i skjermene
 * reduserer normalt til én lytter; registryet er den strukturelle garantien
 * som holder uansett hva navigasjonen finner på.
 *
 * Første `acquire` for et topic bygger og abonnerer kanalen; siste slipp
 * river den. Payloadene fordeles til alle registrerte lyttere.
 *
 * RE-ACQUIRE-RACEN (S3b-2a): `supabase.channel(topic)` DEDUPLISERER på
 * topic-navn mot klientens interne liste og ignorerer nye params, og
 * `removeChannel` er asynkron — kanalen forlater listen først når leave-
 * pushen kvitteres ('ok'/'timeout' trigger close → `_remove`, FØR promiset
 * løses). Et acquire i det vinduet fikk før den FORLATENDE kanalen tilbake:
 * `.subscribe()` på en kanal i leaving-tilstand, og med `{private: true}`
 * som aldri ble satt (dedupen kaster params) — en stille død kanal uten
 * feilstatus. Nå venter kanalbyggingen på forrige rivings promise per topic;
 * lyttere registreres umiddelbart (synkron API utad er uendret), kanalen
 * kommer én mikrotask senere med riktige params.
 */
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from './supabase';

type Listener = (payload: unknown) => void;

/**
 * Kanalparams videre til `supabase.channel(topic, params)`. Kun første
 * acquire for et topic bestemmer dem (bibliotekets dedupe ignorerer params
 * på gjenbruk — derfor er registry-nøkkel = topic også transportvalget).
 */
export interface ChannelParams {
  config: {private?: boolean};
}

interface Registration {
  /**
   * null til kanalen faktisk er bygget: forrige kanal på samme topic kan
   * fortsatt være under riving (re-acquire-racen), og da må byggingen vente.
   */
  channel: RealtimeChannel | null;
  listeners: Set<Listener>;
}

const registry = new Map<string, Registration>();

/**
 * Pågående riving per topic. Neste acquire for topicet må vente på denne
 * før `supabase.channel()` kalles — ellers gir bibliotekets dedupe den
 * forlatende kanalen tilbake.
 */
const teardowns = new Map<string, Promise<void>>();

/**
 * Resync-signalet (B3, P6-reconnect-raden): deles ut til lytterne når kanalen
 * har VÆRT nede og er oppe igjen — hendelser kan ha gått tapt i mellomtiden,
 * så mottakeren skal refetche i stedet for å stole på payloadene den aldri
 * fikk. Identitets-sjekket sentinel-objekt, ikke en payload-form: kan aldri
 * kollidere med noe Supabase sender.
 */
export const CHANNEL_RESYNC: unique symbol = Symbol('channel-resync');

export function isChannelResync(
  payload: unknown,
): payload is typeof CHANNEL_RESYNC {
  return payload === CHANNEL_RESYNC;
}

/**
 * Første RENE join (S3b-2): deles ut ved kanalens FØRSTE SUBSCRIBED når
 * ingen feil kom først. Broadcast-stien bruker den til fallback-emitten som
 * lukker fetch→subscribe-vinduet (ett ferskt snapshot ved-eller-etter join);
 * pgc-lyttere skal IGNORERE den (dagens atferd: første join emitter
 * ingenting — resync ved første join var bevist dobbelhenting, jf.
 * staleMs-flip-funnet i B2). Kommer joinen først etter et frafall, deles
 * CHANNEL_RESYNC ut i stedet — aldri begge.
 */
export const CHANNEL_READY: unique symbol = Symbol('channel-ready');

export function isChannelReady(
  payload: unknown,
): payload is typeof CHANNEL_READY {
  return payload === CHANNEL_READY;
}

/**
 * Join-feil FØR første SUBSCRIBED (S3b-2): CHANNEL_ERROR i join-fasen —
 * S3b-1-klassifiseringen sier at dét (ikke TIMED_OUT, som er transient) er
 * den eneste kandidaten til terminal nekt. Deles ut per forekomst; det er
 * LYTTEREN som teller og avgjør (broadcast-stien: én retry med frisk kanal,
 * så pgc-nødkanalen). pgc-lyttere ignorerer den.
 */
export const CHANNEL_JOIN_ERROR: unique symbol = Symbol('channel-join-error');

export function isChannelJoinError(
  payload: unknown,
): payload is typeof CHANNEL_JOIN_ERROR {
  return payload === CHANNEL_JOIN_ERROR;
}

/** Valgfrie kroker utover resync — se CHANNEL_READY/CHANNEL_JOIN_ERROR. */
export interface ChannelStatusHooks {
  onFirstSubscribed?: () => void;
  onJoinError?: () => void;
}

/**
 * Status-callbacken til `.subscribe()`: rop `onResync` ved hvert SUBSCRIBED
 * som følger etter et frafall (CHANNEL_ERROR/TIMED_OUT/CLOSED) ELLER etter et
 * tidligere SUBSCRIBED (socket-reconnect gir rejoin uten feilstatus først).
 * Første vellykkede join er IKKE resync — skjermens åpningshenting pågår
 * allerede, og en ekstra refetch der ville gjeninnført dobbelhentingen
 * eventDetail-vakten beviste (staleMs-flippen). Den rene førstejoinen roper
 * i stedet `onFirstSubscribed`; CHANNEL_ERROR før første join roper
 * `onJoinError` — begge valgfrie, se sentinel-dokumentasjonen over.
 *
 * Eksportert som ren fabrikk: NotificationsContext har sin egen kanal utenfor
 * registryet og trenger nøyaktig samme logikk.
 */
export function createResyncStatusHandler(
  onResync: () => void,
  hooks: ChannelStatusHooks = {},
): (status: string) => void {
  let wasSubscribed = false;
  let dropped = false;
  return status => {
    if (status === 'SUBSCRIBED') {
      if (wasSubscribed || dropped) {
        dropped = false;
        onResync();
      } else {
        hooks.onFirstSubscribed?.();
      }
      wasSubscribed = true;
    } else if (
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'
    ) {
      if (status === 'CHANNEL_ERROR' && !wasSubscribed) {
        hooks.onJoinError?.();
      }
      dropped = true;
    }
  };
}

/**
 * `configure` festes KUN ved første acquire for topicet: den setter opp
 * `.on(...)`-handlerne og lar dem rope `emit` — som fordeler til alle
 * lyttere som finnes i det øyeblikket. Returnerer slipp-funksjonen.
 *
 * Registryet eier abonnementet og dermed status-callbacken: ved reconnect
 * får ALLE lyttere `CHANNEL_RESYNC`, ved ren førstejoin `CHANNEL_READY`,
 * ved join-feil `CHANNEL_JOIN_ERROR` (sjekk med `isChannelResync`/
 * `isChannelReady`/`isChannelJoinError`), uansett hvilken payload-form
 * kanalen ellers fordeler.
 *
 * Pågår en riving av samme topic, registreres lytteren straks, men selve
 * kanalen bygges først når rivingen er ferdig — se filhodet om racen.
 */
export function acquireChannel(
  topic: string,
  configure: (channel: RealtimeChannel, emit: Listener) => void,
  listener: Listener,
  params?: ChannelParams,
): () => void {
  let reg = registry.get(topic);
  if (!reg) {
    const listeners = new Set<Listener>();
    const distribute: Listener = payload => {
      // Kopi: en lytter kan slippe seg selv (unmount) midt i utdelingen.
      for (const l of [...listeners]) {
        l(payload);
      }
    };
    const newReg: Registration = {channel: null, listeners};
    registry.set(topic, newReg);

    const start = () => {
      // Slapp alle mens vi ventet på rivingen, er registreringen alt
      // fjernet (slipp-funksjonen under) — da skal ingen kanal bygges.
      if (registry.get(topic) !== newReg) return;
      const channel = params
        ? supabase.channel(topic, params)
        : supabase.channel(topic);
      newReg.channel = channel;
      configure(channel, distribute);
      channel.subscribe(
        createResyncStatusHandler(() => distribute(CHANNEL_RESYNC), {
          onFirstSubscribed: () => distribute(CHANNEL_READY),
          onJoinError: () => distribute(CHANNEL_JOIN_ERROR),
        }),
      );
    };

    const pending = teardowns.get(topic);
    if (pending) {
      pending.then(start);
    } else {
      start();
    }
    reg = newReg;
  }
  const acquired = reg;
  acquired.listeners.add(listener);

  return () => {
    // Identitetssjekk mot EGEN registrering: et sent slipp fra en forrige
    // generasjon skal aldri kunne rive en nyere kanal på samme topic.
    const current = registry.get(topic);
    if (current !== acquired || !current.listeners.delete(listener)) return;
    if (current.listeners.size > 0) return;

    registry.delete(topic);
    const channel = current.channel;
    if (!channel) return; // aldri bygget (slapp under venting) — intet å rive

    // Promise.resolve-innpakningen tåler mocker der removeChannel er sync.
    let done: Promise<void>;
    done = Promise.resolve(supabase.removeChannel(channel))
      .then(
        () => undefined,
        () => undefined,
      )
      .then(() => {
        // 'error'-utfallet på leave fjerner IKKE kanalen fra bibliotekets
        // dedupe-liste (kun 'ok'/'timeout' trigger close → _remove). Riv da
        // en gang til, ellers kunne neste acquire fått zombien tilbake.
        if (
          typeof supabase.getChannels === 'function' &&
          supabase.getChannels().includes(channel)
        ) {
          return Promise.resolve(supabase.removeChannel(channel)).then(
            () => undefined,
            () => undefined,
          );
        }
        return undefined;
      })
      .then(() => {
        if (teardowns.get(topic) === done) teardowns.delete(topic);
      });
    teardowns.set(topic, done);
  };
}
