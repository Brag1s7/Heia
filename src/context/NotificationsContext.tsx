import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {AppState} from 'react-native';
import {useAuth} from './UserContext';
import {useActiveTeam} from './TeamContext';
import {supabase} from '../lib/supabase';
import {
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../lib/api/notifications';

/**
 * Ulest-telleren bor her fordi to steder trenger den samtidig: badgen på
 * Varsler-fanen (AppNavigator) og InboxScreen, som senker den i det du leser
 * en rad. Uten en delt tilstand ville badgen blitt stående til neste omstart.
 *
 * `notifications` er ikke i `supabase_realtime`-publiseringen, så det finnes
 * ingen push-oppdatering av telleren. Vi refresher i stedet ved fane-fokus og
 * når appen kommer i forgrunn — billig (én HEAD-spørring med count).
 */
interface NotificationsContextValue {
  unreadCount: number;
  /** Fire-and-forget: henter telleren på nytt. */
  refreshUnread: () => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * Teller opp for hvert live-varsel. InboxScreen bruker den som
   * dependency for å laste lista på nytt — da holder ÉN kanal for både
   * badgen og skjermen.
   */
  liveNonce: number;
  /**
   * Siste varsel som kom inn mens appen var åpen, til banneret. Databasen har
   * allerede bestemt hvem som skal ha det: triggeren i 00023 skriver rader til
   * alle aktive lagmedlemmer UNNTATT forfatteren. Derfor slipper klienten å
   * gjette hvem som skal varsles — får du en rad, er den til deg.
   */
  banner: {id: string; title: string; body: string} | null;
  dismissBanner: () => void;
  /**
   * Kampsiden melder fra at den viser en pågående kamp: match_live-varsler
   * for AKKURAT den kampen dempes mens den er i fokus — scoren spretter jo
   * rett foran deg (P2), og et banner oppå ville dekket øyeblikket. Badgen
   * og inbox-raden består. Returnerer en slipp-funksjon (kalles ved blur).
   */
  watchEvent: (eventId: string) => () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({children}: {children: ReactNode}) {
  const {session} = useAuth();
  const {activeTeamSpaceId} = useActiveTeam();
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveNonce, setLiveNonce] = useState(0);
  const [banner, setBanner] = useState<{
    id: string;
    title: string;
    body: string;
  } | null>(null);

  const dismissBanner = useCallback(() => setBanner(null), []);

  // Ref, ikke state: leses inne i realtime-callbacken, og en state-verdi
  // ville enten vært foreldet i closuren eller tvunget re-subscribe.
  const watchedEventRef = useRef<string | null>(null);
  const watchEvent = useCallback((eventId: string) => {
    watchedEventRef.current = eventId;
    return () => {
      // Bare nullstill hvis ingen andre har tatt over i mellomtiden
      // (blur- og focus-rekkefølgen ved navigasjon er ikke garantert).
      if (watchedEventRef.current === eventId) {
        watchedEventRef.current = null;
      }
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const refreshUnread = useCallback(() => {
    if (!userId || !activeTeamSpaceId) {
      setUnreadCount(0);
      return;
    }
    // Svelger feil med vilje: en badge skal aldri kunne velte appen.
    getUnreadCount(activeTeamSpaceId)
      .then(setUnreadCount)
      .catch(() => {});
  }, [userId, activeTeamSpaceId]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  // Varsler kommer mens appen ligger i bakgrunnen — hent telleren når den
  // kommer tilbake, ellers ville badgen ligget etter til neste fanebytte.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshUnread();
      }
    });
    return () => sub.remove();
  }, [refreshUnread]);

  // Live badge (00025). Uten denne kom varselet først ved fanebytte — mens
  // kampen på Hjem oppdaterte seg selv. Filteret på user_id er ikke bare
  // effektivitet: RLS ville uansett stoppet andres rader, men da hadde vi
  // fått tomme events å refetche på.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          // INSERT-gaten står FØR refetch-kallene (fase A, F16-fiksen):
          // kanalen lytter på '*', men en UPDATE er «markert som lest» og en
          // DELETE er opprydding — begge er ekko av noe klienten alt vet.
          // Før sto gaten etter refreshUnread/liveNonce, så «merk alle som
          // lest» av N varsler ga N meldinger → N tellerspørringer og N
          // inbox-reloads. Kun et NYTT varsel skal koste noe.
          if (payload.eventType !== 'INSERT') return;

          refreshUnread();
          setLiveNonce(n => n + 1);

          const row = payload.new as any;
          // Står du på kampsiden, ER dette øyeblikket skjermen foran deg
          // (scoren spretter, forløpet ruller). Demp banneret for den
          // kampen — badgen/inboxen over er allerede oppdatert.
          if (
            row?.category === 'match_live' &&
            row?.data?.event_id != null &&
            row.data.event_id === watchedEventRef.current
          ) {
            return;
          }
          if (row?.id && row?.title) {
            setBanner({id: row.id, title: row.title, body: row.body ?? ''});
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      // Optimistisk: badgen skal svare med én gang du trykker.
      setUnreadCount(c => Math.max(0, c - ids.length));
      try {
        await markAsRead(ids);
      } catch {
        // stille — refreshen under retter opp uansett
      }
      refreshUnread();
    },
    [refreshUnread],
  );

  const markAllRead = useCallback(async () => {
    if (!activeTeamSpaceId) {
      return;
    }
    setUnreadCount(0);
    try {
      await markAllAsRead(activeTeamSpaceId);
    } catch {
      // stille
    }
    refreshUnread();
  }, [activeTeamSpaceId, refreshUnread]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnread,
      markRead,
      markAllRead,
      liveNonce,
      banner,
      dismissBanner,
      watchEvent,
    }),
    [
      unreadCount,
      refreshUnread,
      markRead,
      markAllRead,
      liveNonce,
      banner,
      dismissBanner,
      watchEvent,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
