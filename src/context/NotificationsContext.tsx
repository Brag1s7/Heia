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
import {createResyncStatusHandler} from '../lib/realtimeChannels';
import {
  peekSessionContext,
  refreshSessionContext,
} from '../lib/queries/sessionContext';
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
 * Payload-først (B3, P6): et INSERT på kanalen teller +1 lokalt — ingen
 * count-spørring per varsel. HEAD-spørringen (getUnreadCount) er RESYNC-en:
 * fane-fokus, forgrunn, reconnect og lest-markeringer henter fasit, så
 * lokal drift aldri overlever lenge.
 */
interface NotificationsContextValue {
  unreadCount: number;
  /** Fire-and-forget: henter telleren på nytt. */
  refreshUnread: () => void;
  /**
   * Fanebytte-porten (S1-a): henter telleren KUN hvis forrige vellykkede
   * henting er > 60 s gammel — samme regel som `useScreenFocusRefetch`.
   * Resync-stiene (forgrunn, reconnect, lest-markeringer) bruker fortsatt
   * den ubetingede `refreshUnread`.
   */
  refreshUnreadIfStale: () => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * NONCE-SPLITTEN (S1-d). Før bar ETT tall begge jobbene, og da
   * invaliderte HVERT varsel (👏, kommentar, RSVP …) livekamp-spørringen.
   *
   * `matchNonce` teller KUN kampvarsler (`match_live`) — den driver
   * kampknappens invalidering i MatchButtonContext.
   */
  matchNonce: number;
  /**
   * `inboxNonce` teller ALLE varsler — den driver InboxScreens
   * inkrementelle resync. Da holder fortsatt ÉN kanal for både badgen
   * og skjermen.
   */
  inboxNonce: number;
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
  const [matchNonce, setMatchNonce] = useState(0);
  const [inboxNonce, setInboxNonce] = useState(0);
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

  // Forrige VELLYKKEDE tellerhenting (epoch ms) — grunnlaget for
  // fanebytte-porten. En feilet henting stempler ikke: neste fokus skal
  // få prøve igjen.
  const unreadFetchedAtRef = useRef(0);

  const refreshUnread = useCallback(() => {
    if (!userId || !activeTeamSpaceId) {
      setUnreadCount(0);
      return;
    }
    // Svelger feil med vilje: en badge skal aldri kunne velte appen.
    getUnreadCount(activeTeamSpaceId)
      .then(count => {
        unreadFetchedAtRef.current = Date.now();
        setUnreadCount(count);
      })
      .catch(() => {});
  }, [userId, activeTeamSpaceId]);

  // 60 s-porten (S1-a) — samme regel som `useScreenFocusRefetch`. Raske
  // fanebytter var før dette ETT HEAD-kall HVER, uansett hvor ferskt
  // tallet var.
  const refreshUnreadIfStale = useCallback(() => {
    if (Date.now() - unreadFetchedAtRef.current > 60_000) {
      refreshUnread();
    }
  }, [refreshUnread]);

  // Kanalen (lenger ned) er BRUKER-scopet, ikke lag-scopet — derfor leses
  // `activeTeamSpaceId` og `refreshUnread` via refs i callbackene (S1-f).
  // Sto de i effect-deps, ville hvert lagbytte revet og gjenoppbygget
  // WS-kanalen for et abonnement som er identisk uansett lag. Lagbyttets
  // unread-refresh skjer fortsatt: mount-effekten under fyrer når
  // `refreshUnread` bytter identitet.
  const activeTeamSpaceIdRef = useRef(activeTeamSpaceId);
  activeTeamSpaceIdRef.current = activeTeamSpaceId;
  const refreshUnreadRef = useRef(refreshUnread);
  refreshUnreadRef.current = refreshUnread;

  // Fyrer ved boot (laget blir valgt) OG ved lagbytte. S2: ved boot ligger
  // telleren allerede i kontekst-svaret TeamContext hentet — peek er et
  // rent minneoppslag og koster null HTTP. Ved lagbytte dekker svaret det
  // GAMLE laget → miss → dagens HEAD-kall. RPC-feil/manglende 00079 gir
  // også miss → samme HEAD-kall som før S2.
  useEffect(() => {
    if (userId && activeTeamSpaceId) {
      const hit = peekSessionContext(activeTeamSpaceId);
      if (hit && hit.ctx.unreadCount != null) {
        unreadFetchedAtRef.current = hit.fetchedAt;
        setUnreadCount(hit.ctx.unreadCount);
        return;
      }
    }
    refreshUnread();
  }, [userId, activeTeamSpaceId, refreshUnread]);

  // Varsler kommer mens appen ligger i bakgrunnen — resync når den kommer
  // tilbake, ellers ville badgen ligget etter til neste fanebytte. S2:
  // foreground-resumen DELER kontekst-kallet (TeamContexts og kampknappens
  // lyttere fyrer i samme tick — single-flight gjør dem til ETT kall).
  // Uten aktivt lag, eller når svaret ikke dekker laget (feil/lagbytte i
  // mellomtiden), tas dagens vei: refreshUnread.
  useEffect(() => {
    if (!userId) {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        return;
      }
      const ts = activeTeamSpaceIdRef.current;
      if (!ts) {
        refreshUnreadRef.current();
        return;
      }
      refreshSessionContext(ts).then(ctx => {
        const now = activeTeamSpaceIdRef.current;
        if (
          ctx &&
          now &&
          ctx.coveredTeamSpaceId === now &&
          ctx.unreadCount != null
        ) {
          unreadFetchedAtRef.current = Date.now();
          setUnreadCount(ctx.unreadCount);
        } else {
          refreshUnreadRef.current();
        }
      });
    });
    return () => sub.remove();
  }, [userId]);

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
          // INSERT-gaten står FØR alt annet (fase A, F16-fiksen):
          // kanalen lytter på '*', men en UPDATE er «markert som lest» og en
          // DELETE er opprydding — begge er ekko av noe klienten alt vet.
          // Kun et NYTT varsel skal koste noe.
          if (payload.eventType !== 'INSERT') return;

          const row = payload.new as any;

          // Payload-først (B3, P6): badgen teller per lag, og raden bærer
          // team_space_id (null = globalt systemvarsel, teller i alle lag —
          // samme scope som getUnreadCount). +1 lokalt; HEAD-spørringen er
          // henvist til resync-stiene (fokus/forgrunn/reconnect). Mangler
          // feltene (skjemadrift) → tell fasit (P6s fallback).
          if (row?.id == null) {
            refreshUnreadRef.current();
          } else if (
            row.team_space_id == null ||
            row.team_space_id === activeTeamSpaceIdRef.current
          ) {
            setUnreadCount(c => c + 1);
          }
          // Nonce-splitten (S1-d): alle varsler driver inboxen, men KUN
          // kampvarsler skal invalidere livekamp-spørringen.
          setInboxNonce(n => n + 1);
          if (row?.category === 'match_live') {
            setMatchNonce(n => n + 1);
          }
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
      // Resync ved reconnect (B3, P6): kanalen har vært nede → +1-strømmen
      // kan ha mistet rader. Hent fasit-telleren og dytt BEGGE noncene —
      // vi kan ikke vite hvilke kategorier som gikk tapt — så en fokusert
      // inbox drar sin inkrementelle resync (hull-vakten der tar store
      // gap) og kampknappen henter fasit. Første SUBSCRIBED er IKKE
      // resync — mount-effekten over har alt hentet telleren.
      .subscribe(
        createResyncStatusHandler(() => {
          refreshUnreadRef.current();
          setInboxNonce(n => n + 1);
          setMatchNonce(n => n + 1);
        }),
      );

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
      refreshUnreadIfStale,
      markRead,
      markAllRead,
      matchNonce,
      inboxNonce,
      banner,
      dismissBanner,
      watchEvent,
    }),
    [
      unreadCount,
      refreshUnread,
      refreshUnreadIfStale,
      markRead,
      markAllRead,
      matchNonce,
      inboxNonce,
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
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    );
  }
  return ctx;
}
