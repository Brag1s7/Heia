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
import {refreshSessionContext} from '../lib/queries/sessionContext';
import {
  restorePersistedQueries,
  prunePersistedTeams,
  readBootSeed,
  writeBootSeedMemberships,
} from '../lib/queries/persistedCache';
import {
  ACTIVE_TEAM_KEY,
  readStoredActiveTeamSpaceId,
} from '../lib/activeTeamStorage';
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
// som er fjernet fra laget faller trygt tilbake til første lag. Nøkkelen
// bor i lib/activeTeamStorage fra S2: kontekst-RPC-en leser kandidatlaget
// derfra FØR denne provideren har rukket å velge.

export function TeamProvider({children}: PropsWithChildren) {
  const {session} = useAuth();
  const [activeTeamSpaceId, setActiveTeamSpaceId] = useState<string | null>(
    null,
  );
  const [userMemberships, setUserMemberships] = useState<EnrichedMembership[]>(
    [],
  );
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

  // S7b: hvem gjeldende liste er FRØ-booted for (disk, uverifisert). Skilt
  // fra loadedForRef med vilje: frøet slipper navigatoren, men teller ALDRI
  // som fersk — medlemskapsvakten og rolle-gatingen venter på loadedForRef.
  const seededForRef = useRef<string | null>(null);
  // Krav 9: cached rolle er presentasjon, aldri autorisasjon. activeRole
  // holdes null til en fersk liste er verifisert — all isTeamAdmin-gating i
  // appen går via activeRole, så admin-flater kan ikke tegnes fra disk.
  const [rolesVerified, setRolesVerified] = useState(false);

  // Speiler userMemberships synkront for lagbytteren (registrert én gang,
  // leser utenfor render-syklusen — se registerTeamSwitcher-effekten).
  const membershipsRef = useRef<EnrichedMembership[]>([]);
  const applyMemberships = useCallback((list: EnrichedMembership[]) => {
    membershipsRef.current = list;
    setUserMemberships(list);
  }, []);

  // Kandidatlaget til kontekst-RPC-en leses via ref: sto activeTeamSpaceId
  // i fetchMemberships-deps, ville hvert lagbytte gitt hele boot-kjeden på
  // nytt (samme ref-idiom som varselkanalen i NotificationsContext, S1-f).
  const activeTeamSpaceIdRef = useRef<string | null>(null);
  activeTeamSpaceIdRef.current = activeTeamSpaceId;

  // Medlemstallet til TeamHeader-underteksten — cachen bor her (over
  // fetchMemberships, som fyller den fra kontekst-svaret), tegne-effekten
  // lenger ned. Cachet per lagrom, så et lagbytte viser forrige tall med
  // én gang mens ferskt hentes.
  const memberCountCache = useRef<Map<string, number>>(new Map());
  // Når kontekst-RPC-en nettopp leverte medlemstallet for et lag, skal
  // telle-effekten under IKKE sende sitt eget HEAD-kall oppå (60 s-regelen).
  const memberCountFreshRef = useRef<{teamSpaceId: string; at: number} | null>(
    null,
  );

  const fetchMemberships = useCallback(async () => {
    if (!userId) {
      loadedForRef.current = null;
      seededForRef.current = null;
      setRolesVerified(false);
      applyMemberships([]);
      return;
    }
    const isRefresh = loadedForRef.current === userId;
    const isSeeded = seededForRef.current === userId;
    // S7b: en frø-booted app skal ikke rives tilbake til BootScreen av
    // neste henteforsøk (foreground-resync etter feilet boot-kall) —
    // loading brukes kun når hverken ferskt eller frø har sluppet oss inn.
    if (!isRefresh && !isSeeded) {
      setLoading(true);
    }
    // Kappløpet frø/nett: ferskt svar er ALLTID autoritativt (krav 6/7) —
    // flagget gjør en frølanding etter nettet til en no-op.
    let freshApplied = false;
    let seedBoot: Promise<void> = Promise.resolve();
    try {
      // S7: restaurer forrige økts feed/kalender/roster fra disken PARALLELT
      // med kontekst-kallet — startet her, awaitet lenger ned. Ikke await
      // FØR refreshSessionContext: da ville UserContexts effekt vunnet
      // single-flighten og boot-trioens prefetch (§1.4) aldri fyrt.
      const persistedRestore = restorePersistedQueries(userId);
      // S7b: bootfrøet fra forrige økt kan slippe navigatoren FØR nettet
      // svarer — gjentatt kaldstart viser cached hjemskjerm mens kontekst-
      // kallet fortsatt er i flukt. Frøet er presentasjon: loadedForRef og
      // rolle-verifiseringen settes ALDRI her (krav 5/9), så medlemskaps-
      // vakten og admin-gatingen venter fortsatt på fersk liste.
      if (!isRefresh && !isSeeded) {
        seedBoot = readBootSeed(userId)
          .then(async seed => {
            const seedMemberships = seed?.memberships;
            if (!seedMemberships?.length || freshApplied) {
              return;
            }
            // Krav 3: query-cachen skal være hydrert før noen skjerm kan
            // montere og konkludere «tomt» — men vi venter aldri på nett.
            await persistedRestore;
            if (freshApplied) {
              return;
            }
            // Aktivt lag settes I SAMME commit som slippet: ellers ville
            // navigatoren rukket å tegne MainTabs uten lag (bootReady sann)
            // og så hoppet tilbake til BootScreen når laget kom til.
            const stored = await readStoredActiveTeamSpaceId();
            if (freshApplied) {
              return;
            }
            const remembered =
              stored && seedMemberships.some(m => m.teamSpaceId === stored)
                ? stored
                : null;
            seededForRef.current = userId;
            applyMemberships(seedMemberships);
            setActiveTeamSpaceId(
              prev => prev ?? remembered ?? seedMemberships[0].teamSpaceId,
            );
            setLoading(false);
          })
          .catch(() => {});
      }
      // S2: ETT kontekst-kall bærer memberships + membercount (+ profil,
      // unread, livekamp, lagkassa til de andre kontekstene — single-flight
      // i orkestratoren gjør alle konsumentene til dette ene kallet).
      // Kandidatlag: aktivt lag når det finnes (foreground-resume), ellers
      // forrige økts lagrede valg (boot — orkestratoren leser lagringen).
      // Ved boot avfyres feed/events-prefetchen parallelt (§1.4-trioen).
      // S7b endrer ikke dette: kallet starter umiddelbart uansett frø.
      const ctx = await refreshSessionContext(activeTeamSpaceIdRef.current, {
        bootPrefetchUserId: isRefresh ? undefined : userId,
      });
      let memberships = ctx?.memberships ?? null;
      if (ctx?.coveredTeamSpaceId && ctx.memberCount != null) {
        memberCountCache.current.set(ctx.coveredTeamSpaceId, ctx.memberCount);
        memberCountFreshRef.current = {
          teamSpaceId: ctx.coveredTeamSpaceId,
          at: Date.now(),
        };
      }
      // Fallback (RPC mangler/feiler — f.eks. base uten 00079): nøyaktig
      // dagens enkeltkall, med nøyaktig dagens feilhåndtering under.
      if (!memberships) {
        memberships = await getUserMemberships(userId);
      }
      // Krav 7: nettet vant — en frølanding som fortsatt står i kø skal
      // aldri overskrive det ferske svaret. Flagget er nok (IKKE await:
      // en treg disk skal aldri holde den ferske stien igjen): callbacken
      // over sjekker flagget rett før den appliserer, og sjekk+applisering
      // ligger i samme synkrone segment — de kan ikke flettes med denne.
      freshApplied = true;
      // S7: hydreringen SKAL være ferdig før `loading` slippes i finally —
      // det er dette punktet som gjør persisteringen til en garanti mot
      // skeleton-flash, ikke bare en skriv-til-disk.
      await persistedRestore;
      // S7: lag brukeren ikke lenger står i (fjernet/forlatt) ut av både
      // minne og disk — KUN på en fersk, vellykket liste (catch under
      // pruner aldri, så en nettglipp sletter ingenting).
      prunePersistedTeams(memberships.map(m => m.teamSpaceId));
      loadedForRef.current = userId;
      // Krav 9: først NÅ er rollene verifisert — activeRole går fra null
      // til ekte rolle i samme render som den ferske lista.
      setRolesVerified(true);
      applyMemberships(memberships);
      // S7b: frøet speiler alltid siste ferske liste — et forlatt/fjernet
      // lag forsvinner fra disken her, og neste kaldstart booter riktig.
      writeBootSeedMemberships(userId, memberships);
    } catch {
      // La en ev. frølanding fullføre før vi konkluderer — ellers kunne
      // tom-listen under og frølisten kappløpe om siste ord.
      await seedBoot;
      // Første last: tom liste (onboarding-flyten eier feilen). Stille
      // refresh ELLER frø-booted: behold lista som står — et nettverks-
      // glipp skal ikke sende en innlogget bruker til onboarding, og en
      // offline kaldstart skal bli stående på cached innhold (krav 10).
      if (!isRefresh && seededForRef.current !== userId) {
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
  // S7b/krav 9: null til lista er ferskt verifisert — en frø-booted trener
  // ser supporter-flaten i sekundene til nettet svarer, aldri omvendt.
  // Serverens RLS/RPC-dører er uansett autoriteten; dette er UI-hygiene.
  const activeRole = rolesVerified ? activeMembership?.role ?? null : null;

  // Medlemstallet tegnes her. Feiler hentingen beholdes cache/null —
  // headeren har sport · årsklasse som fallback. userMemberships er bevisst
  // med i deps: en refresh av medlemskapene skal også friske opp tallet
  // (head-count er billig).
  const [activeMemberCount, setActiveMemberCount] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!activeTeamSpaceId) {
      setActiveMemberCount(null);
      return;
    }
    setActiveMemberCount(
      memberCountCache.current.get(activeTeamSpaceId) ?? null,
    );
    // RLS teller kun rader man selv ser — uten eget medlemskap ville svaret
    // blitt et falskt 0, så vent til medlemskapet finnes i listen.
    // S7b: og listen må være FERSK — et frø kan påstå medlemskap i et lag
    // brukeren er fjernet fra, og da ville HEAD-kallet gitt nettopp det
    // falske 0-et. Gatingen sparer også boot-budsjettet: tallet kommer fra
    // kontekst-svaret når det lander (fresh-ref-vakten under), ikke fra et
    // ekstra HEAD-kall avfyrt før konteksten.
    if (
      !rolesVerified ||
      !userMemberships.some(m => m.teamSpaceId === activeTeamSpaceId)
    ) {
      return;
    }
    // S2: kontekst-kallet som nettopp trigget denne effekten (ny
    // memberships-identitet) leverte tallet selv — ikke send et HEAD-kall
    // oppå et svar som er sekunder gammelt.
    const fresh = memberCountFreshRef.current;
    if (
      fresh &&
      fresh.teamSpaceId === activeTeamSpaceId &&
      Date.now() - fresh.at <= 60_000
    ) {
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
  }, [activeTeamSpaceId, userMemberships, rolesVerified]);

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
