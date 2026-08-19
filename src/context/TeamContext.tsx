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
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from './UserContext';
import {registerTeamSwitcher} from '../navigation/deepLink';
import {getUserMemberships, getTeamMemberCount} from '../lib/api/teams';
import {pickPrimaryMembership} from '../shared/activeMembership';
import {purgeMediaCacheByPrefix} from '../lib/media/resolver';
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

// Sist aktive lag overlever app-omstart (telefonfunn 2026-08-18: bruker med
// tre lag ble kastet til lag 1 ved hver oppstart). Kun ID-en lagres —
// gyldigheten avgjøres ALLTID mot ferske memberships før den brukes, så en
// som er fjernet fra laget faller trygt tilbake til første lag.
const ACTIVE_TEAM_KEY = 'heia:activeTeamSpace:v1';

export function TeamProvider({children}: PropsWithChildren) {
  const {session} = useAuth();
  const [activeTeamSpaceId, setActiveTeamSpaceId] = useState<string | null>(
    null,
  );
  const [userMemberships, setUserMemberships] = useState<
    EnrichedMembership[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Husket lagvalg fra forrige økt. undefined = ikke lest ennå (auto-valget
  // venter på lesingen — den er lokal og langt raskere enn membership-
  // fetchen, så ingen synlig forsinkelse); null = ingenting lagret.
  const [storedTeamSpaceId, setStoredTeamSpaceId] = useState<
    string | null | undefined
  >(undefined);
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_TEAM_KEY)
      .then(v => setStoredTeamSpaceId(v))
      .catch(() => setStoredTeamSpaceId(null));
  }, []);

  // Se kommentaren i UserContext: ID-en er stabil, mens `session.user` får ny
  // objekt-identitet ved hver token-refresh.
  const userId = session?.user?.id;

  // Hvem gjeldende liste er lastet for. Refresh for samme bruker er STILLE:
  // AppNavigator river ned hele navigatoren når loading er true, så en
  // lagfarge-/navne-/logo-lagring (som refresher memberships) ville ellers
  // kastet brukeren til Hjem-fanen (telefonfunn 2026-07-31).
  const loadedForRef = useRef<string | null>(null);

  // Speiler userMemberships synkront for lagbytteren (registrert én gang,
  // leser utenfor render-syklusen — se registerTeamSwitcher-effekten).
  const membershipsRef = useRef<EnrichedMembership[]>([]);
  const applyMemberships = useCallback((list: EnrichedMembership[]) => {
    membershipsRef.current = list;
    setUserMemberships(list);
  }, []);

  const fetchMemberships = useCallback(async () => {
    if (!userId) {
      loadedForRef.current = null;
      applyMemberships([]);
      return;
    }
    const isRefresh = loadedForRef.current === userId;
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      const memberships = await getUserMemberships(userId);
      loadedForRef.current = userId;
      applyMemberships(memberships);
    } catch {
      // Første last: tom liste (onboarding-flyten eier feilen). Stille
      // refresh: behold forrige liste — et nettverksglipp skal ikke sende
      // en innlogget bruker tilbake til onboarding.
      if (!isRefresh) {
        applyMemberships([]);
      }
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [userId, applyMemberships]);

  // Hent memberships når session endres
  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  // Lett resync når appen våkner (P1, fjernet-medlem-hullet): før kjørte
  // refreshMemberships kun ved join/create/settings, så en bruker som ble
  // fjernet fra laget sto igjen med activeTeamSpaceId mot et lag hun ikke
  // er medlem av — helt til app-omstart. Refreshen er stille (loadedForRef)
  // og river aldri navigatoren.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        fetchMemberships();
      }
    });
    return () => sub.remove();
  }, [fetchMemberships]);

  // Medlemskapstap: peker aktivt lag på et lag som ikke lenger står i en
  // FERSK liste (loadedForRef vokter — en feilet stille refresh beholder
  // forrige liste og når aldri hit), byttes laget og lagets signerte
  // medie-URL-er purges (P1: tilgang borte → cache borte).
  useEffect(() => {
    if (!userId || loadedForRef.current !== userId || !activeTeamSpaceId) {
      return;
    }
    if (userMemberships.some(m => m.teamSpaceId === activeTeamSpaceId)) {
      return;
    }
    purgeMediaCacheByPrefix(activeTeamSpaceId).catch(() => {});
    setActiveTeamSpaceId(userMemberships[0]?.teamSpaceId ?? null);
  }, [userId, userMemberships, activeTeamSpaceId]);

  // Auto-velg lag ved innlogging: husket valg hvis det fortsatt er gyldig,
  // ellers første lag. Funksjonell oppdatering: et push-trykk ved kaldstart
  // kan allerede ha køet et lagvalg i samme commit (lagbytteren kjører i
  // barne-effekter, denne i foreldre-effekten) — auto-valget skal fylle
  // tomrommet, aldri overstyre et valg som alt er tatt.
  useEffect(() => {
    if (userId && userMemberships.length > 0 && !activeTeamSpaceId) {
      // Vent til det lagrede valget er lest — ellers ville lag 1 vinne
      // kappløpet ved hver kaldstart og gjøre husk-funksjonen død.
      if (storedTeamSpaceId === undefined) {
        return;
      }
      const remembered =
        storedTeamSpaceId &&
        userMemberships.some(m => m.teamSpaceId === storedTeamSpaceId)
          ? storedTeamSpaceId
          : null;
      setActiveTeamSpaceId(
        prev => prev ?? remembered ?? userMemberships[0].teamSpaceId,
      );
    }
    if (!userId) {
      setActiveTeamSpaceId(null);
      // Utlogging: neste bruker på enheten skal ikke arve lagvalget.
      AsyncStorage.removeItem(ACTIVE_TEAM_KEY).catch(() => {});
    }
  }, [userId, userMemberships, activeTeamSpaceId, storedTeamSpaceId]);

  // Ett sted for persistering: uansett HVEM som satte laget (bruker-bytte,
  // push-trykk, medlemskapstap-fallback, auto-valg) er det gjeldende valget
  // det som skal huskes til neste oppstart.
  useEffect(() => {
    if (userId && activeTeamSpaceId) {
      AsyncStorage.setItem(ACTIVE_TEAM_KEY, activeTeamSpaceId).catch(() => {});
    }
  }, [userId, activeTeamSpaceId]);

  // ÉN primærrad avgjør lagrom, lag OG rolle — deterministisk. `find` tok
  // «første rad», og en trener som også er forelder i laget har flere:
  // rollen (og dermed all isTeamAdmin-gating) var prisgitt radrekkefølgen.
  // Den personlige raden bærer alltid den faktiske rollen (se modulen).
  const activeMembership = useMemo(
    () => pickPrimaryMembership(userMemberships, activeTeamSpaceId),
    [userMemberships, activeTeamSpaceId],
  );

  const activeTeamSpace = activeMembership?.teamSpace ?? null;
  const activeTeam = activeMembership?.team ?? null;
  const activeRole = activeMembership?.role ?? null;

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

  // Push-trykk kan gjelde et annet lag enn det aktive (push omgår inboxens
  // lag-scoping), og trykk-håndteringen bor utenfor React-treet. Samme
  // idiom som navigationRef: deepLink får en registrert bytter, med
  // medlemskapsvakten her hvor listen bor. Refs, IKKE state, i vakten:
  // registreringen skjer én gang ved mount, og ved kaldstart resolver
  // getInitialNotification FØR medlemskaps-fetchen er ferdig — da må
  // svaret være 'pending' (målet parkeres og flushes når fanene monteres),
  // aldri et falskt 'not_member' fra en tom liste (telefonfunn 2026-08-03:
  // kaldstart-trykk ble svelget).
  useEffect(() => {
    registerTeamSwitcher(teamSpaceId => {
      if (loadedForRef.current === null) {
        return 'pending';
      }
      if (!membershipsRef.current.some(m => m.teamSpaceId === teamSpaceId)) {
        return 'not_member';
      }
      setActiveTeamSpaceId(teamSpaceId);
      return 'switched';
    });
    return () => registerTeamSwitcher(null);
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
