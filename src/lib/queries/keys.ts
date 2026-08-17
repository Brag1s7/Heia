/**
 * queryKey-konvensjonen — LÅST i P7 (EGRESS-MEDIA-ARKITEKTUR, Fase B).
 *
 * Realtime-handlerne (B3) muterer disse nøklene med
 * `queryClient.setQueryData` — derfor bor de her som funksjoner, ikke
 * som inline-arrays i skjermene: én kilde, ingen stavefeil-cache-miss.
 *
 * KUN de varme lesestiene får nøkler (avgrensningen i P7):
 * payments/ops/onboarding beholder imperative kall.
 */
export const queryKeys = {
  feed: (teamSpaceId: string) => ['feed', teamSpaceId] as const,
  events: (teamSpaceId: string, window?: string) =>
    window === undefined
      ? (['events', teamSpaceId] as const)
      : (['events', teamSpaceId, window] as const),
  event: (eventId: string) => ['event', eventId] as const,
  matchPhotos: (eventId: string) => ['matchPhotos', eventId] as const,
  members: (teamSpaceId: string) => ['members', teamSpaceId] as const,
  notifications: (teamSpaceId: string) =>
    ['notifications', teamSpaceId] as const,
  /** Uleste-telleren er notifications-domenet, men egen nøkkel: den
   *  invalideres langt oftere (hver lest-markering) enn selve lista. */
  unreadCount: (teamSpaceId: string) =>
    ['notifications', teamSpaceId, 'unread'] as const,
} as const;
