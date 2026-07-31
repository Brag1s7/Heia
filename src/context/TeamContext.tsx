import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {useAuth} from './UserContext';
import {getUserMemberships, getTeamMemberCount} from '../lib/api/teams';
import type {
  EnrichedMembership,
  MemberRole,
  TeamSpace,
  Team,
} from '../lib/types';

interface TeamContextValue {
  activeTeamSpaceId: string | null;
  activeTeamSpace: TeamSpace | null;
  activeTeam: Team | null;
  /** Innlogget brukers rolle i det aktive lagrommet. */
  activeRole: MemberRole | null;
  /**
   * Antall aktive medlemskap i det aktive lagrommet (TeamHeader-underteksten).
   * null til tallet er hentet — vis sport · årsklasse som fallback, aldri tomt.
   */
  activeMemberCount: number | null;
  userMemberships: EnrichedMembership[];
  loading: boolean;
  setActiveTeamSpace: (teamSpaceId: string) => void;
  refreshMemberships: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

export function TeamProvider({children}: PropsWithChildren) {
  const {session} = useAuth();
  const [activeTeamSpaceId, setActiveTeamSpaceId] = useState<string | null>(
    null,
  );
  const [userMemberships, setUserMemberships] = useState<
    EnrichedMembership[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Se kommentaren i UserContext: ID-en er stabil, mens `session.user` får ny
  // objekt-identitet ved hver token-refresh.
  const userId = session?.user?.id;

  // Hvem gjeldende liste er lastet for. Refresh for samme bruker er STILLE:
  // AppNavigator river ned hele navigatoren når loading er true, så en
  // lagfarge-/navne-/logo-lagring (som refresher memberships) ville ellers
  // kastet brukeren til Hjem-fanen (telefonfunn 2026-07-31).
  const loadedForRef = useRef<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    if (!userId) {
      loadedForRef.current = null;
      setUserMemberships([]);
      return;
    }
    const isRefresh = loadedForRef.current === userId;
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      const memberships = await getUserMemberships();
      loadedForRef.current = userId;
      setUserMemberships(memberships);
    } catch {
      // Første last: tom liste (onboarding-flyten eier feilen). Stille
      // refresh: behold forrige liste — et nettverksglipp skal ikke sende
      // en innlogget bruker tilbake til onboarding.
      if (!isRefresh) {
        setUserMemberships([]);
      }
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [userId]);

  // Hent memberships når session endres
  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  // Auto-velg første lag ved innlogging
  useEffect(() => {
    if (userId && userMemberships.length > 0 && !activeTeamSpaceId) {
      setActiveTeamSpaceId(userMemberships[0].teamSpaceId);
    }
    if (!userId) {
      setActiveTeamSpaceId(null);
    }
  }, [userId, userMemberships, activeTeamSpaceId]);

  const activeTeamSpace = useMemo(
    () =>
      userMemberships.find(m => m.teamSpaceId === activeTeamSpaceId)
        ?.teamSpace ?? null,
    [userMemberships, activeTeamSpaceId],
  );

  const activeTeam = useMemo(
    () =>
      userMemberships.find(m => m.teamSpaceId === activeTeamSpaceId)
        ?.team ?? null,
    [userMemberships, activeTeamSpaceId],
  );

  const activeRole = useMemo(
    () =>
      userMemberships.find(m => m.teamSpaceId === activeTeamSpaceId)?.role ??
      null,
    [userMemberships, activeTeamSpaceId],
  );

  // Medlemstallet til TeamHeader-underteksten. Cachet per lagrom, så et
  // lagbytte viser forrige tall med én gang mens ferskt hentes. Feiler
  // hentingen beholdes cache/null — headeren har sport · årsklasse som
  // fallback. userMemberships er bevisst med i deps: en refresh av
  // medlemskapene skal også friske opp tallet (head-count er billig).
  const memberCountCache = useRef<Map<string, number>>(new Map());
  const [activeMemberCount, setActiveMemberCount] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!activeTeamSpaceId) {
      setActiveMemberCount(null);
      return;
    }
    setActiveMemberCount(memberCountCache.current.get(activeTeamSpaceId) ?? null);
    // RLS teller kun rader man selv ser — uten eget medlemskap ville svaret
    // blitt et falskt 0, så vent til medlemskapet finnes i listen.
    if (!userMemberships.some(m => m.teamSpaceId === activeTeamSpaceId)) {
      return;
    }
    let cancelled = false;
    getTeamMemberCount(activeTeamSpaceId)
      .then(count => {
        memberCountCache.current.set(activeTeamSpaceId, count);
        if (!cancelled) {
          setActiveMemberCount(count);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTeamSpaceId, userMemberships]);

  const setActiveTeamSpace = useCallback((teamSpaceId: string) => {
    setActiveTeamSpaceId(teamSpaceId);
  }, []);

  return (
    <TeamContext.Provider
      value={{
        activeTeamSpaceId,
        activeTeamSpace,
        activeTeam,
        activeRole,
        activeMemberCount,
        userMemberships,
        loading,
        setActiveTeamSpace,
        refreshMemberships: fetchMemberships,
      }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useActiveTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useActiveTeam must be used within TeamProvider');
  }
  return ctx;
}
