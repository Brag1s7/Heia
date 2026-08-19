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
import {offerClubLogoAfterCreate} from '../lib/clubLogo';
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
  /** `reopen` = «Gjenåpne laget» (§3f-2 i FORLAT-LAG-DORMANT).
   *  Returnerer utfallet så skjermen kan si fra om ventende trenerrolle. */
  executeJoin: (
    inviteCode: string,
    role: MemberRole,
    opts?: {reopen?: boolean},
  ) => Promise<import('../lib/types').JoinResult>;
  executeCreate: (payload: CreateTeamPayload) => Promise<void>;
  /**
   * Settes til team_space-id rett etter at et lag er opprettet fra bunnen.
   * TeamHome bruker det til å vise invite-koden én gang, og nuller det så.
   */
  justCreatedTeamSpaceId: string | null;
  clearJustCreated: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({children}: PropsWithChildren) {
  const {session, profile, refreshProfile} = useAuth();
  const {refreshMemberships, setActiveTeamSpace} = useActiveTeam();
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [justCreatedTeamSpaceId, setJustCreatedTeamSpaceId] = useState<
    string | null
  >(null);
  const runningRef = useRef(false);

  const clearJustCreated = useCallback(() => {
    setJustCreatedTeamSpaceId(null);
  }, []);

  const setPendingAction = useCallback((action: PendingAction) => {
    setLastError(null);
    setPendingActionState(action);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingActionState(null);
  }, []);

  // Fullfør join: refreshMemberships FØR setActive, så TeamContext er klar.
  // refreshProfile til slutt: 00067-triggeren stempler
  // onboarding_completed_at ved FØRSTE join/create, og navigator-porten
  // (§3d) leser stempelet fra profilen — uten refresh sto en helt fersk
  // bruker med utdatert null til neste app-start. Best-effort: selve
  // join-en er alt fullført, og hasTeam-grenen tar uansett over.
  const executeJoin = useCallback(
    async (inviteCode: string, role: MemberRole, opts?: {reopen?: boolean}) => {
      const result = await joinTeamSpace(inviteCode, role, opts);
      await refreshMemberships();
      setActiveTeamSpace(result.teamSpaceId);
      refreshProfile().catch(() => {});
      return result;
    },
    [refreshMemberships, setActiveTeamSpace, refreshProfile],
  );

  const executeCreate = useCallback(
    async (payload: CreateTeamPayload) => {
      const result = await createTeamFromScratch(payload);
      await refreshMemberships();
      setActiveTeamSpace(result.teamSpaceId);
      setJustCreatedTeamSpaceId(result.teamSpaceId);
      refreshProfile().catch(() => {});
      // NY klubb (clubName satt = opprettet nå) → tilby klubblogo (P4).
      // Her og ikke i skjermen, så auth-before-commit-resumet også dekkes.
      if (payload.clubName) {
        offerClubLogoAfterCreate(
          result.teamSpaceId,
          payload.clubName,
          refreshMemberships,
        );
      }
    },
    [refreshMemberships, setActiveTeamSpace, refreshProfile],
  );

  // Resume-effekt: kjør pending action når brukeren er autentisert.
  //
  // Ikke avbryt fordi brukeren allerede har et lag. En trener som logger inn
  // for å bli med i lag nr. 2 har hasTeam=true i det profilen lastes, og
  // join-en ville blitt stille forkastet. runningRef hindrer dobbeltkjøring,
  // og clearPendingAction hindrer ny kjøring etterpå.
  useEffect(() => {
    if (!session?.user || !profile || !pendingAction || runningRef.current) {
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
        justCreatedTeamSpaceId,
        clearJustCreated,
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
