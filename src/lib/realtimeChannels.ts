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
 */
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from './supabase';

type Listener = (payload: unknown) => void;

interface Registration {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
}

const registry = new Map<string, Registration>();

/**
 * Resync-signalet (B3, P6-reconnect-raden): deles ut til lytterne når kanalen
 * har VÆRT nede og er oppe igjen — hendelser kan ha gått tapt i mellomtiden,
 * så mottakeren skal refetche i stedet for å stole på payloadene den aldri
 * fikk. Identitets-sjekket sentinel-objekt, ikke en payload-form: kan aldri
 * kollidere med noe Supabase sender.
 */
export const CHANNEL_RESYNC: unique symbol = Symbol('channel-resync');

export function isChannelResync(payload: unknown): payload is typeof CHANNEL_RESYNC {
  return payload === CHANNEL_RESYNC;
}

/**
 * Status-callbacken til `.subscribe()`: rop `onResync` ved hvert SUBSCRIBED
 * som følger etter et frafall (CHANNEL_ERROR/TIMED_OUT/CLOSED) ELLER etter et
 * tidligere SUBSCRIBED (socket-reconnect gir rejoin uten feilstatus først).
 * Første vellykkede join er IKKE resync — skjermens åpningshenting pågår
 * allerede, og en ekstra refetch der ville gjeninnført dobbelhentingen
 * eventDetail-vakten beviste (staleMs-flippen).
 *
 * Eksportert som ren fabrikk: NotificationsContext har sin egen kanal utenfor
 * registryet og trenger nøyaktig samme logikk.
 */
export function createResyncStatusHandler(
  onResync: () => void,
): (status: string) => void {
  let wasSubscribed = false;
  let dropped = false;
  return status => {
    if (status === 'SUBSCRIBED') {
      if (wasSubscribed || dropped) {
        dropped = false;
        onResync();
      }
      wasSubscribed = true;
    } else if (
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'
    ) {
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
 * får ALLE lyttere `CHANNEL_RESYNC` (sjekk med `isChannelResync`), uansett
 * hvilken payload-form kanalen ellers fordeler.
 */
export function acquireChannel(
  topic: string,
  configure: (channel: RealtimeChannel, emit: Listener) => void,
  listener: Listener,
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
    const channel = supabase.channel(topic);
    configure(channel, distribute);
    channel.subscribe(
      createResyncStatusHandler(() => distribute(CHANNEL_RESYNC)),
    );
    reg = {channel, listeners};
    registry.set(topic, reg);
  }
  reg.listeners.add(listener);

  return () => {
    const current = registry.get(topic);
    if (!current || !current.listeners.delete(listener)) return;
    if (current.listeners.size === 0) {
      registry.delete(topic);
      supabase.removeChannel(current.channel);
    }
  };
}
