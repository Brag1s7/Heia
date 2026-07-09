import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {useAuth} from './UserContext';
import {getUserMemberships} from '../lib/api/teams';
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

  const fetchMemberships = useCallback(async () => {
    if (!session?.user) {
      setUserMemberships([]);
      return;
    }
    setLoading(true);
    try {
      const memberships = await getUserMemberships();
      setUserMemberships(memberships);
    } catch {
      setUserMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Hent memberships når session endres
  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  // Auto-velg første lag ved innlogging
  useEffect(() => {
    if (
      session?.user &&
      userMemberships.length > 0 &&
      !activeTeamSpaceId
    ) {
      setActiveTeamSpaceId(userMemberships[0].teamSpaceId);
    }
    if (!session?.user) {
      setActiveTeamSpaceId(null);
    }
  }, [session?.user, userMemberships, activeTeamSpaceId]);

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
