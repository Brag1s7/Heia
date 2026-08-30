import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {dehydrate, hydrate, type DehydratedState} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import type {EnrichedMembership, Profile} from '../types';

// ---------------------------------------------------------------------------
// SELEKTIV DISK-PERSISTERING AV QUERY-CACHEN (S7, skaleringsplan §2).
//
// Mål: gjentatt kaldstart viser sist kjente feed/kalender/roster fra disken
// FØR nettverkskallene er ferdige — skeleton-flashen forsvinner. Dette er en
// UX-skive, ikke skalering: alt restaurert er stale etter husets 60 s-regel,
// så mount-refetchene fyrer nøyaktig som før og henter ferskt i bakgrunnen.
//
// KUN fire domener persisteres (hvitliste, aldri svarteliste):
//   feed (side 1), events, members, authors.
// ALDRI: liveMatch (sanntid), notifications/unread (personlig + flyktig),
// supportSummary/betaling, session context/runtime-flagg, auth/signerte
// URL-er. De står ikke i hvitlisten og kan dermed ikke lekke til disk ved
// et uhell — en ny nøkkel i keys.ts er upersistert til noen AKTIVT fører
// den opp her.
//
// Nøkkelen er scopet til innlogget bruker + schemaversjon, og payloaden
// bærer bruker-id-en i tillegg (belte og bukseseler: feil brukers fil
// forkastes selv om nøkkelen skulle treffe). Rydding:
//   · utlogging/kontosletting → clearPersistedQueryCache (clearLocalCaches)
//   · medlemskapstap/forlat lag → prunePersistedTeams (TeamContext, kun på
//     en FERSK vellykket medlemsliste — en nettglipp sletter aldri noe)
//   · buster-endring / eldre enn PERSIST_MAX_AGE_MS → forkastes ved restore
//
// JSON dreper Date-objektene i FeedItem/HeiaEvent/TeamMember — restore
// gjenoppliver dem felt for felt (aldri mønster-gjetting på strenger: en
// posttekst som LIGNER en ISO-dato skal forbli tekst).
// ---------------------------------------------------------------------------

const PERSIST_KEY_PREFIX = 'heia:querycache:';
/** Bootfrøet (S7b) — se seksjonen nederst. Egen nøkkel, samme ryddeveier. */
const SEED_KEY_PREFIX = 'heia:bootseed:';
/** Buster: bump når persistert form endres (nye felter, annen trimming). */
const PERSIST_SCHEMA_VERSION = 1;
/** Konservativt tak — eldre snapshots forkastes ved restore. Dataen er
 *  uansett stale lenge før dette; taket begrenser bare hvor gammelt et
 *  «sist kjente» bilde kan være. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Skrive-demping: cache-hendelser kommer i byger (hydrering, refetch-svar,
 *  realtime-patcher) — én skriv per byge holder. */
const WRITE_THROTTLE_MS = 1_000;

/** Hvitlisten — nøkkelform ['<domene>', teamSpaceId, ...] (keys.ts). */
const PERSISTED_DOMAINS: ReadonlySet<string> = new Set([
  'feed',
  'events',
  'members',
  'authors',
]);

type PersistedPayload = {
  v: number;
  userId: string;
  savedAt: number;
  state: DehydratedState;
};

function storageKey(userId: string): string {
  return `${PERSIST_KEY_PREFIX}${userId}`;
}

function isPersistableKey(queryKey: readonly unknown[]): boolean {
  return (
    typeof queryKey[0] === 'string' &&
    PERSISTED_DOMAINS.has(queryKey[0]) &&
    typeof queryKey[1] === 'string' &&
    queryKey[1].length > 0
  );
}

// --- modultilstand ---------------------------------------------------------

let activeUserId: string | null = null;
let restorePromise: Promise<void> | null = null;
let unsubscribeCache: (() => void) | null = null;
let appStateSub: {remove: () => void} | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: Promise<void> | null = null;

// --- snapshot (skriving) ---------------------------------------------------

/** Dehydrer KUN hvitlistede, vellykkede queries — og trim feeden til side 1
 *  (side 2+ er uendelig hale; kaldstart trenger bare det øverste bildet, og
 *  paginering etter restore henter resten normalt via cursoren i side 1). */
function buildSnapshot(userId: string): PersistedPayload {
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: query =>
      query.state.status === 'success' && isPersistableKey(query.queryKey),
  });
  for (const q of state.queries) {
    if (q.queryKey[0] === 'feed') {
      const data = q.state.data as
        | {pages?: unknown[]; pageParams?: unknown[]}
        | undefined;
      if (data?.pages && data.pages.length > 1) {
        // Nye objekter/arrays — aldri muter dataen som lever i cachen.
        q.state.data = {
          pages: data.pages.slice(0, 1),
          pageParams: (data.pageParams ?? [null]).slice(0, 1),
        };
      }
    }
  }
  return {v: PERSIST_SCHEMA_VERSION, userId, savedAt: Date.now(), state};
}

async function writeNow(userId: string): Promise<void> {
  // Brukeren kan ha logget ut mens skrivet sto i kø — aldri skriv da.
  if (activeUserId !== userId) {
    return;
  }
  try {
    await AsyncStorage.setItem(
      storageKey(userId),
      JSON.stringify(buildSnapshot(userId)),
    );
  } catch {
    // Full disk / storage-feil: persistering er best-effort, appen lever
    // videre på nettverket som før.
  }
}

function scheduleWrite(): void {
  const userId = activeUserId;
  if (!userId || writeTimer) {
    return;
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    pendingWrite = writeNow(userId).finally(() => {
      pendingWrite = null;
    });
  }, WRITE_THROTTLE_MS);
}

/** Tving et køet skriv gjennom NÅ — bakgrunns-overgangen bruker den (iOS
 *  kan drepe prosessen etterpå, og siste byge skal med), testene også. */
export async function flushPersistedWrites(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    const userId = activeUserId;
    if (userId) {
      pendingWrite = writeNow(userId).finally(() => {
        pendingWrite = null;
      });
    }
  }
  await pendingWrite;
}

// --- gjenoppliving av datoer ----------------------------------------------

function toDate(value: unknown): Date | undefined {
  return typeof value === 'string' ? new Date(value) : undefined;
}

/** Feltene som er `Date` i typene (shared/types + api/members) — JSON gjorde
 *  dem til ISO-strenger, her settes de tilbake. Per domene, per felt. */
function reviveQueryDates(queryKey: readonly unknown[], data: any): void {
  const domain = queryKey[0];
  if (domain === 'feed' && Array.isArray(data?.pages)) {
    for (const page of data.pages) {
      if (!Array.isArray(page)) {
        continue;
      }
      for (const item of page) {
        item.createdAt = toDate(item.createdAt) ?? item.createdAt;
      }
    }
  } else if (domain === 'events' && Array.isArray(data)) {
    for (const ev of data) {
      ev.startTime = toDate(ev.startTime) ?? ev.startTime;
      ev.endTime = toDate(ev.endTime);
      ev.meetingTime = toDate(ev.meetingTime);
      ev.startedAt = toDate(ev.startedAt);
      ev.clockStartedAt = toDate(ev.clockStartedAt);
    }
  } else if (domain === 'members' && Array.isArray(data)) {
    for (const m of data) {
      m.joinedAt = toDate(m.joinedAt);
    }
  }
  // authors: ingen Date-felter.
}

// --- restore (lesing) ------------------------------------------------------

async function doRestore(userId: string): Promise<void> {
  const key = storageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) {
      return;
    }
    const payload = JSON.parse(raw) as PersistedPayload;
    if (
      payload.v !== PERSIST_SCHEMA_VERSION ||
      payload.userId !== userId ||
      typeof payload.savedAt !== 'number' ||
      Date.now() - payload.savedAt > PERSIST_MAX_AGE_MS
    ) {
      // Buster/utløpt/feil eier: forkast — dagens loading-opplevelse tar over.
      await AsyncStorage.removeItem(key).catch(() => {});
      return;
    }
    // Belte og bukseseler: hvitlisten håndheves også ved LESING, så en
    // eldre/fremmed fil aldri kan smugle inn forbudte domener.
    const queries = payload.state.queries.filter(q =>
      isPersistableKey(q.queryKey),
    );
    for (const q of queries) {
      reviveQueryDates(q.queryKey, q.state.data);
    }
    // hydrate lar ferskere data i minnet vinne (dataUpdatedAt-sammenlikning)
    // — et boot-prefetch-svar som alt har landet blir aldri overskrevet.
    hydrate(queryClient, {mutations: [], queries});
  } catch {
    // Korrupt fil: forkast og fortsett uten — aldri velt boot.
    await AsyncStorage.removeItem(key).catch(() => {});
  }
}

/**
 * Restaurer forrige økts snapshot for DENNE brukeren og start skrivingen.
 * Idempotent per bruker — boot og hver foreground-resume kan kalle trygt.
 *
 * TeamContext awaiter promiset FØR `loading` slippes til false, så
 * hydreringen er garantert ferdig før noen skjerm monterer og kan
 * konkludere «tomt» (kravets rekkefølgegaranti — ikke bare skriv-til-disk).
 */
export function restorePersistedQueries(userId: string): Promise<void> {
  if (activeUserId === userId && restorePromise) {
    return restorePromise;
  }
  // Defensivt: brukerbytte uten clearPersistedQueryCache skal ikke kunne
  // skje (signOut er eneste vei), men om det gjør det — stopp forrige
  // brukers skriving før den nyes restore.
  if (activeUserId !== null && activeUserId !== userId) {
    detach();
  }
  activeUserId = userId;
  restorePromise = doRestore(userId).finally(() => {
    // Skriving starter FØRST etter restore — et tidlig cache-event skal
    // ikke få skrive et tomt snapshot oppå fjorårets gode.
    if (activeUserId === userId) {
      attach();
    }
  });
  return restorePromise;
}

function attach(): void {
  if (!unsubscribeCache) {
    unsubscribeCache = queryClient.getQueryCache().subscribe(event => {
      if (event.query && isPersistableKey(event.query.queryKey)) {
        scheduleWrite();
      }
    });
  }
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        flushPersistedWrites().catch(() => {});
      }
    });
  }
}

function detach(): void {
  unsubscribeCache?.();
  unsubscribeCache = null;
  appStateSub?.remove();
  appStateSub = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  activeUserId = null;
  restorePromise = null;
}

// --- rydding ---------------------------------------------------------------

/**
 * Medlemskapstap/«forlat lag»: fjern hvitlistede queries for lag som ikke
 * står i en FERSK, vellykket medlemsliste — fra minnet nå, og fra disken ved
 * neste skriv (snapshotet er alltid en full omskriving). Kalles fra
 * TeamContext etter hver vellykkede memberships-henting; en feilet henting
 * når aldri hit (nettglipp skal ikke slette et gyldig snapshot).
 */
export function prunePersistedTeams(
  validTeamSpaceIds: readonly string[],
): void {
  const valid = new Set(validTeamSpaceIds);
  queryClient.removeQueries({
    predicate: query =>
      isPersistableKey(query.queryKey) &&
      !valid.has(query.queryKey[1] as string),
  });
  // removeQueries fyrer cache-events → scheduleWrite via subscriben, men
  // kall den også direkte: prune skal på disk selv i en stille cache.
  scheduleWrite();
}

/**
 * Utlogging/kontosletting (clearLocalCaches): stopp skrivingen og slett ALLE
 * persisterte snapshots (prefiks-sweep, ikke bare aktiv bruker — en fil som
 * måtte ha overlevd et tidligere avbrutt ryddeforsøk skal også bort). Neste
 * bruker på enheten kan aldri se forrige brukers data.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  detach();
  try {
    // La et køet frøskriv lande FØR sweepen — ellers kunne det gjenoppstå
    // etter slettingen (samme resonnement som skrivestoppen i detach).
    await seedWriteQueue.catch(() => {});
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      k => k.startsWith(PERSIST_KEY_PREFIX) || k.startsWith(SEED_KEY_PREFIX),
    );
    if (ours.length > 0) {
      // async-storage v3-API: `removeMany`, ikke v1/v2s `multiRemove`.
      await AsyncStorage.removeMany(ours);
    }
  } catch {
    // Best-effort — queryClient.clear() i clearLocalCaches har uansett tømt
    // minnet, og uten aktiv bruker skrives aldri noe nytt til disk.
  }
}

// ---------------------------------------------------------------------------
// BOOTFRØET (S7b) — det minste som slipper navigatoren uten nettverk.
//
// AppNavigator-portene krever `profile` og `memberships` FØR noen skjerm
// monterer, og begge bor i context-state fra nett — så S7-cachen alene
// fjernet aldri BootScreen-ventingen (analysen 2026-08-26). Frøet lagrer
// nøyaktig det portene og tegningen av sist aktive lag trenger, og IKKE mer:
//
//   · minimal profil: id/visningsnavn/avatar/onboarding-status —
//     telefon og husholdning nulles ut ved skriving.
//   · medlemsradene i formen TeamContext alt konsumerer (lagromsnavn/farge/
//     logo + lagets navnedata) — felt-for-felt-mapping, så et nytt felt i
//     typen aldri persisteres ved et uhell.
//
// ALDRI: tokens, signerte URL-er, notifications, liveMatch, runtime-config,
// betalingsdata eller resten av session context-payloaden.
//
// SIKKERHETSKONTRAKTEN (håndhevet av konsumentene, dokumentert her):
//   · Frøet er PRESENTASJON, aldri autorisasjon: TeamContext holder
//     `activeRole` null til en FERSK medlemsliste er verifisert, så cached
//     rolle aldri tegner admin-flater; serverens RLS/RPC-dører er uansett
//     autoriteten.
//   · Frøet setter ALDRI loadedForRef/«ferskt verifisert» — vaktene som
//     purger ved medlemskapstap venter fortsatt på fersk liste.
//   · Samme userId-scoping, buster, 24 t maxAge og ryddeveier som
//     query-snapshotet (clearPersistedQueryCache sveiper begge prefiksene).
// ---------------------------------------------------------------------------

export type BootSeed = {
  profile: Profile | null;
  memberships: EnrichedMembership[] | null;
};

type SeedPayload = {v: number; userId: string; savedAt: number} & BootSeed;

function seedKey(userId: string): string {
  return `${SEED_KEY_PREFIX}${userId}`;
}

/** Kun feltene bootporten og navigasjonen trenger — telefon og husholdning
 *  har ingenting på disk å gjøre og nulles. */
function toSeedProfile(p: Profile): Profile {
  return {
    id: p.id,
    displayName: p.displayName,
    avatarPath: p.avatarPath,
    avatarColor: p.avatarColor,
    phone: null,
    locale: p.locale,
    onboardingCompleted: p.onboardingCompleted,
    onboardingCompletedAt: p.onboardingCompletedAt,
    householdId: null,
  };
}

/**
 * Felt-for-felt-HVITLISTE, aldri spread: et nytt felt i EnrichedMembership
 * er upersistert til noen aktivt fører det opp her. Endelig feltliste:
 *
 *   rad:       id, userId, teamSpaceId, role¹, status, joinedAt,
 *              managedChildId (primærrad-valget), managedChildName
 *              (Profil-radenes barnetekst)
 *   teamSpace: id, teamId, displayName, color, logoUrl, isActivated
 *   team:      id, name, ageGroup, gender, level,
 *              club {id, name, shortName, logoUrl},
 *              sport {id, slug, displayName}
 *
 * ¹ rolle er kun til pickPrimaryMembership/senere verifisert visning —
 *   activeRole er uansett null til fersk liste (krav 9).
 *
 * NULLES/TOMMES (typen krever feltene, verdiene skal ikke på disk):
 * inviteCode (join-/delingskode — InviteScreen er admin-gatet og dermed
 * uansett unåbar før fersk verifisering har gitt ekte verdi) og
 * activatedAt (unødvendig for å tegne boot).
 *
 * logoUrl-ene (teamSpace + club) er trygge å persistere som URL: begge
 * skrives KUN av uploadLogo (api/teams.ts), som laster opp til den
 * OFFENTLIGE `club-logos`-bucketen (public=true i 00034:41-43) med
 * immutable filnavn og lagrer `getPublicUrl(...)` — en stabil, usignert
 * URL uten token eller utløp. TeamBadge tegner den direkte uten resolver.
 * Skulle logoene noen gang flyttes til en privat/signert bucket, MÅ disse
 * feltene ut av frøet samtidig (samme regel som avatar-paths: aldri
 * signerte URL-er på disk).
 */
function toSeedMembership(m: EnrichedMembership): EnrichedMembership {
  return {
    id: m.id,
    userId: m.userId,
    teamSpaceId: m.teamSpaceId,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt,
    managedChildId: m.managedChildId,
    managedChildName: m.managedChildName,
    teamSpace: {
      id: m.teamSpace.id,
      teamId: m.teamSpace.teamId,
      displayName: m.teamSpace.displayName,
      color: m.teamSpace.color,
      logoUrl: m.teamSpace.logoUrl,
      inviteCode: '',
      isActivated: m.teamSpace.isActivated,
      activatedAt: null,
    },
    team: {
      id: m.team.id,
      name: m.team.name,
      ageGroup: m.team.ageGroup,
      gender: m.team.gender,
      level: m.team.level,
      club: {
        id: m.team.club.id,
        name: m.team.club.name,
        shortName: m.team.club.shortName,
        logoUrl: m.team.club.logoUrl,
      },
      sport: {
        id: m.team.sport.id,
        slug: m.team.sport.slug,
        displayName: m.team.sport.displayName,
      },
    },
  };
}

// Profildelen (UserContext) og medlemsdelen (TeamContext) skrives fra hver
// sin kant — køen serialiserer read-modify-write så de aldri taper
// hverandres halvdel.
let seedWriteQueue: Promise<void> = Promise.resolve();

function mergeBootSeed(userId: string, patch: Partial<BootSeed>): void {
  seedWriteQueue = seedWriteQueue.then(async () => {
    try {
      const key = seedKey(userId);
      let existing: SeedPayload | null = null;
      const raw = await AsyncStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as SeedPayload;
        if (parsed.v === PERSIST_SCHEMA_VERSION && parsed.userId === userId) {
          existing = parsed;
        }
      }
      const next: SeedPayload = {
        v: PERSIST_SCHEMA_VERSION,
        userId,
        savedAt: Date.now(),
        profile:
          patch.profile !== undefined
            ? patch.profile
            : existing?.profile ?? null,
        memberships:
          patch.memberships !== undefined
            ? patch.memberships
            : existing?.memberships ?? null,
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Best-effort som resten av persisteringen — neste vellykkede
      // henting prøver igjen.
    }
  });
}

/** Skrives ved hvert vellykkede profilsvar fra nett (UserContext). */
export function writeBootSeedProfile(userId: string, profile: Profile): void {
  mergeBootSeed(userId, {profile: toSeedProfile(profile)});
}

/** Skrives ved hver FERSKE, vellykkede medlemsliste (TeamContext) — en
 *  fjernet/forlatt lagrad forsvinner dermed fra frøet i samme slengen. */
export function writeBootSeedMemberships(
  userId: string,
  memberships: EnrichedMembership[],
): void {
  mergeBootSeed(userId, {memberships: memberships.map(toSeedMembership)});
}

/**
 * Les frøet for NØYAKTIG denne brukeren. Feil buster, feil eier eller eldre
 * enn 24 t → forkastes og slettes (dagens BootScreen-flyt tar over). Kalles
 * med `session.user.id` — frøet kan aldri brukes uten lokal session med
 * samme id.
 */
export async function readBootSeed(userId: string): Promise<BootSeed | null> {
  const key = seedKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) {
      return null;
    }
    const payload = JSON.parse(raw) as SeedPayload;
    if (
      payload.v !== PERSIST_SCHEMA_VERSION ||
      payload.userId !== userId ||
      typeof payload.savedAt !== 'number' ||
      Date.now() - payload.savedAt > PERSIST_MAX_AGE_MS
    ) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
    return {
      profile: payload.profile ?? null,
      memberships: Array.isArray(payload.memberships)
        ? payload.memberships
        : null,
    };
  } catch {
    await AsyncStorage.removeItem(key).catch(() => {});
    return null;
  }
}

/** KUN FOR TESTER: vent på at køede frøskriv har landet. */
export function flushBootSeedWrites(): Promise<void> {
  return seedWriteQueue.catch(() => {});
}

/** KUN FOR TESTER: koble av skrivingen og glem aktiv bruker uten å røre
 *  disken — simulerer prosessdød før en ny kaldstart. */
export function stopPersistenceForTests(): void {
  detach();
}
