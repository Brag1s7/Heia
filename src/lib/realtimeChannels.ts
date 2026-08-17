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
 * `configure` festes KUN ved første acquire for topicet: den setter opp
 * `.on(...)`-handlerne og lar dem rope `emit` — som fordeler til alle
 * lyttere som finnes i det øyeblikket. Returnerer slipp-funksjonen.
 */
export function acquireChannel(
  topic: string,
  configure: (channel: RealtimeChannel, emit: Listener) => void,
  listener: Listener,
): () => void {
  let reg = registry.get(topic);
  if (!reg) {
    const listeners = new Set<Listener>();
    const channel = supabase.channel(topic);
    configure(channel, payload => {
      // Kopi: en lytter kan slippe seg selv (unmount) midt i utdelingen.
      for (const l of [...listeners]) {
        l(payload);
      }
    });
    channel.subscribe();
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
