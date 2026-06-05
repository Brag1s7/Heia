import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {useAuth} from './UserContext';
import {useActiveTeam} from './TeamContext';
import {joinTeamSpace, createTeamFromScratch} from '../lib/api/teams';
import type {CreateTeamPayload, MemberRole} from '../lib/types';

// ---------------------------------------------------------------------------
// OnboardingContext — bærer intent + payload over auth-grensen.
//
// Auth-before-commit: en gjest kan velge intent og fylle inn data FØR konto.
// Vi lagrer da en pendingAction her (over navigatoren, så den overlever at
// OnboardingStack remountes ved innlogging), og fullfører join/create i en
// effekt når session + profil er klare. En allerede innlogget bruker kaller
// executeJoin/executeCreate direkte.
// ---------------------------------------------------------------------------

export type PendingAction =
  | {type: 'join'; inviteCode: string; role: MemberRole}
  | {type: 'create'; payload: CreateTeamPayload};

interface OnboardingContextValue {
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction) => void;
  clearPendingAction: () => void;
  lastError: string | null;
  setLastError: (msg: string | null) => void;
  executeJoin: (inviteCode: string, role: MemberRole) => Promise<void>;
  executeCreate: (payload: CreateTeamPayload) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({children}: PropsWithChildren) {
  const {session, profile} = useAuth();
  const {refreshMemberships, setActiveTeamSpace, userMemberships} =
    useActiveTeam();
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const setPendingAction = useCallback((action: PendingAction) => {
    setLastError(null);
    setPendingActionState(action);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingActionState(null);
  }, []);

  // Fullfør join: refreshMemberships FØR setActive, så TeamContext er klar.
  const executeJoin = useCallback(
    async (inviteCode: string, role: MemberRole) => {
      const result = await joinTeamSpace(inviteCode, role);
      await refreshMemberships();
      setActiveTeamSpace(result.teamSpaceId);
    },
    [refreshMemberships, setActiveTeamSpace],
  );

  const executeCreate = useCallback(
    async (payload: CreateTeamPayload) => {
      const result = await createTeamFromScratch(payload);
      await refreshMemberships();
      setActiveTeamSpace(result.teamSpaceId);
    },
    [refreshMemberships, setActiveTeamSpace],
  );

  // Resume-effekt: kjør pending action når brukeren er autentisert.
  // clearPendingAction kalles ETTER at execute* har awaited refresh, så
  // hasTeam er true før pending nulles (ingen flicker innom intent-skjermen).
  useEffect(() => {
    const hasTeam = userMemberships.length > 0;
    if (
      !session?.user ||
      !profile ||
      !pendingAction ||
      runningRef.current ||
      hasTeam
    ) {
      return;
    }
    runningRef.current = true;
    (async () => {
      try {
        if (pendingAction.type === 'join') {
          await executeJoin(pendingAction.inviteCode, pendingAction.role);
        } else {
          await executeCreate(pendingAction.payload);
        }
        clearPendingAction();
      } catch (e: any) {
        setLastError(e?.message ?? 'Noe gikk galt. Prøv igjen.');
        clearPendingAction();
      } finally {
        runningRef.current = false;
      }
    })();
  }, [
    session?.user,
    profile,
    pendingAction,
    userMemberships.length,
    executeJoin,
    executeCreate,
    clearPendingAction,
  ]);

  return (
    <OnboardingContext.Provider
      value={{
        pendingAction,
        setPendingAction,
        clearPendingAction,
        lastError,
        setLastError,
        executeJoin,
        executeCreate,
      }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
