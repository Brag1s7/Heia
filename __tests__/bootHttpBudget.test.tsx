/**
 * @format
 *
 * OPPSTARTSBUDSJETTET, MÅLT DER DET FAKTISK BRUKES (punkt 104).
 *
 * `bootBudget.test.tsx` vokter ORKESTRERINGEN (ingen duplikate enkeltkall
 * mens kontekst-RPC-en er i flukt) — men den kan ikke telle budsjettet, for
 * den mocker bort api-modulene kallene ville gått gjennom. Den påsto seks
 * kall mens tallet i virkeligheten var sju til ni.
 *
 * Denne teller ÉTT sted: `global.fetch`. Alt supabase-js sender — RPC,
 * PostgREST, storage-signering — går gjennom den ene sømmen (se
 * `supabase.ts` → `trackedFetch`). Ingen api-modul, ingen query-modul og
 * ingen context er mocket bort; det eneste som er byttet ut er transporten
 * under dem, pluss auth-sesjonen (som ellers ville krevd en ekte GoTrue) og
 * realtime-kanalen (websocket, ikke HTTP).
 *
 * Hva som telles: hvert HTTP-kall fra appen starter til nettet står stille.
 *
 * ⚠️ SERVEREN HER ER EN 00086-SERVER. Feed-svaret bærer `my_reactions`, som
 * er det klienten møter i prod når migrasjonen er kjørt. Står appen mot en
 * eldre base, tar `getTeamFeed` sin gamle reactions-spørring — og DET er
 * voktet i `feedMineReaksjoner.test.ts`, ikke her.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import App from '../src/app/App';
import {supabase} from '../src/lib/supabase';
import {queryClient} from '../src/lib/queries/queryClient';
import {abandonSessionContext} from '../src/lib/queries/sessionContext';
import {
  stopPersistenceForTests,
  flushBootSeedWrites,
  flushPersistedWrites,
} from '../src/lib/queries/persistedCache';
import {ACTIVE_TEAM_KEY} from '../src/lib/activeTeamStorage';
import {resetRuntimeConfig} from '../src/lib/runtimeConfig';
import {_resetMediaUrlCacheForTests} from '../src/lib/media/resolver';
import {_resetSportsCacheForTests} from '../src/lib/api/teams';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_SPACE_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

// ---------------------------------------------------------------------------
// Nettverkssømmen: én router, én teller.
// ---------------------------------------------------------------------------

type Call = {method: string; path: string; url: string};

let calls: Call[] = [];
/** Slås på av feilstien — kontekst-RPC-en svarer 500. */
let failSessionContext = false;
/** Settes av punkt 99-testen: kontekst-RPC-en svarer først når vi sier fra. */
let holdSessionContext: Promise<void> | null = null;
let releaseSessionContext: (() => void) | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

/** Svar per endepunkt. Formen speiler det ekte svaret mapperne forventer. */
async function respond(
  method: string,
  path: string,
  body: string | null,
  single: boolean,
): Promise<Response> {
  if (path.endsWith('/rpc/get_session_context')) {
    if (holdSessionContext) {
      await holdSessionContext;
    }
    return failSessionContext
      ? json({message: 'boom'}, 500)
      : json(sessionContextPayload());
  }
  if (path.endsWith('/rpc/get_team_feed')) {
    return json(feedRows());
  }
  if (path.includes('/storage/v1/object/sign/')) {
    // createSignedUrls tar en liste paths og gir en liste tilbake.
    const paths = (JSON.parse(body ?? '{}').paths ?? []) as string[];
    return json(
      paths.map(p => ({path: p, signedURL: `/object/sign/${p}?token=t`})),
    );
  }
  // Fallback-stien (kontekst-RPC-en feilet) tar de gamle enkeltkallene —
  // og de må svare ekte, ellers havner appen i onboarding og måler noe
  // annet enn en oppstart.
  if (path.includes('/rest/v1/memberships')) return json([membershipRow()]);
  if (path.includes('/rest/v1/profiles')) {
    const row = sessionContextPayload().profile;
    return json(single ? row : [row]);
  }
  if (path.includes('/rest/v1/reactions')) return json([]);
  if (path.includes('/rest/v1/sports')) return json([]);
  if (path.includes('/rest/v1/events')) return json([]);
  if (path.includes('/rest/v1/notifications')) return json([]);
  return json([]);
}

function installFetch(): void {
  calls = [];
  failSessionContext = false;
  holdSessionContext = null;
  releaseSessionContext = null;
  (globalThis as {fetch: unknown}).fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url;
      const method = (init?.method ?? 'GET').toUpperCase();
      const path = url.split('?')[0];
      calls.push({method, path, url});
      const body =
        typeof init?.body === 'string' ? (init.body as string) : null;
      // PostgREST' `.single()` ber om ETT objekt, ikke en liste.
      const accept = String(
        (init?.headers as Record<string, string> | undefined)?.Accept ??
          (init?.headers as Record<string, string> | undefined)?.accept ??
          '',
      );
      return await respond(method, path, body, accept.includes('pgrst.object'));
    },
  );
}

// ---------------------------------------------------------------------------
// Serversvarene
// ---------------------------------------------------------------------------

function membershipRow() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    user_id: USER_ID,
    team_space_id: TEAM_SPACE_ID,
    role: 'parent',
    status: 'active',
    joined_at: '2026-01-01T00:00:00Z',
    managed_child_id: null,
    team_space: {
      id: TEAM_SPACE_ID,
      team_id: '55555555-5555-4555-8555-555555555555',
      display_name: 'Ridabu G14',
      color: '#0B6E4F',
      logo_url: null,
      invite_code: 'ABC123',
      is_activated: true,
      activated_at: null,
      team: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Ridabu G14',
        age_group: 'G14',
        gender: 'gutter',
        level: null,
        club: {
          id: 'c1',
          name: 'Ridabu IL',
          short_name: 'Ridabu',
          logo_url: null,
        },
        sport: {id: 's1', slug: 'fotball', display_name: 'Fotball'},
      },
    },
  };
}

function sessionContextPayload() {
  return {
    v: 1,
    profile: {
      id: USER_ID,
      display_name: 'Test Testesen',
      avatar_url: `${USER_ID}/avatar-1.jpg`,
      avatar_color: '#0B6E4F',
      phone: null,
      locale: 'nb',
      onboarding_completed: true,
      onboarding_completed_at: '2026-01-01T00:00:00Z',
      household_id: null,
    },
    memberships: [membershipRow()],
    team_space_id: TEAM_SPACE_ID,
    member_count: 12,
    unread_count: 0,
    live_match: null,
    support_summary: null,
    runtime_flags: {},
  };
}

/** Én bildepost med forfatteravatar — den vanlige feeden, ikke en tom. */
function feedRows() {
  return [
    {
      id: POST_ID,
      team_space_id: TEAM_SPACE_ID,
      author_id: USER_ID,
      author_name: 'Test Testesen',
      author_avatar: `${USER_ID}/avatar-1.jpg`,
      author_avatar_color: '#0B6E4F',
      author_role: 'parent',
      content: 'Hei laget',
      created_at: '2026-09-01T10:00:00Z',
      type: 'message',
      is_pinned: false,
      reaction_counts: {'🎉': 2},
      comment_count: 0,
      // 00086: RPC-en bærer mine egne reaksjoner, så klienten slipper den
      // serielle reactions-spørringen (punkt 100).
      my_reactions: [],
      media: [
        {
          storage_path: `${TEAM_SPACE_ID}/1757000000000-abc.jpg`,
          thumbnail_path: `${TEAM_SPACE_ID}/1757000000000-abc_thumb.jpg`,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Montering
// ---------------------------------------------------------------------------

let root: ReactTestRenderer.ReactTestRenderer | undefined;

/** Monter appen og la nettet gå til ro (ingen nye kall på en hel runde). */
async function bootApp(): Promise<void> {
  await act(async () => {
    root = ReactTestRenderer.create(<App />);
  });
  let seen = -1;
  for (let i = 0; i < 60 && seen !== calls.length; i++) {
    seen = calls.length;
    await act(async () => {
      await new Promise(res => setTimeout(res, 5));
    });
  }
}

async function unmountApp(): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
}

/**
 * Prosessdød og ny kaldstart: modulminnet glemmes, DISKEN står. Det er
 * dette den gjentatte oppstarten faktisk er — frø, query-snapshot og
 * signerte URL-er ligger der fra forrige økt.
 */
let timeOffsetMs = 0;

/** Flytt klokka fram — en gjentatt kaldstart skjer ikke i samme millisekund. */
function advanceClock(ms: number): void {
  timeOffsetMs += ms;
}

async function simulateProcessRestart(): Promise<void> {
  await flushBootSeedWrites();
  await flushPersistedWrites();
  stopPersistenceForTests();
  abandonSessionContext();
  queryClient.clear();
  resetRuntimeConfig();
  _resetMediaUrlCacheForTests();
  _resetSportsCacheForTests();
  calls = [];
}

/** `POST /rest/v1/rpc/x` — verten og query strippes, som i netMetrics. */
function summary(): string[] {
  return calls.map(
    c => `${c.method} ${c.path.replace(/^https?:\/\/[^/]+/, '')}`,
  );
}

beforeEach(async () => {
  jest.restoreAllMocks();
  installFetch();

  jest.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: {
      session: {
        access_token: 'test-token',
        refresh_token: 'r',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {id: USER_ID} as never,
      } as never,
    },
    error: null,
  } as never);
  jest.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
    data: {subscription: {id: 's', callback: () => {}, unsubscribe: () => {}}},
  } as never);
  jest.spyOn(supabase.auth, 'startAutoRefresh').mockResolvedValue(undefined);
  jest.spyOn(supabase.auth, 'stopAutoRefresh').mockResolvedValue(undefined);

  const channelStub: Record<string, unknown> = {};
  channelStub.on = jest.fn(() => channelStub);
  channelStub.subscribe = jest.fn(() => channelStub);
  channelStub.unsubscribe = jest.fn(() => Promise.resolve('ok'));
  jest.spyOn(supabase, 'channel').mockReturnValue(channelStub as never);
  jest.spyOn(supabase, 'removeChannel').mockResolvedValue('ok' as never);

  timeOffsetMs = 0;
  const realNow = Date.now.bind(Date);
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + timeOffsetMs);

  await AsyncStorage.clear();
  stopPersistenceForTests();
  abandonSessionContext();
  queryClient.clear();
  resetRuntimeConfig();
  _resetMediaUrlCacheForTests();
  _resetSportsCacheForTests();
});

afterEach(async () => {
  await unmountApp();
  await flushBootSeedWrites();
  stopPersistenceForTests();
  abandonSessionContext();
  queryClient.clear();
});

/**
 * FØRSTE KALDSTART etter installasjon (tom disk, men lagvalget husket).
 *
 * ⚠️ LISTA ER EKSAKT MED VILJE. Et nytt kall i boot skal gjøre denne rød og
 * kreve en bevisst beslutning — ikke bare flytte et tall. Når et kall
 * fjernes (punkt 100/103), strykes linja her og tallet i handoffen
 * oppdateres samtidig.
 */
test('kaldstart med tom disk: kallene er nøyaktig disse', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, TEAM_SPACE_ID);
  await bootApp();

  expect(summary().sort()).toEqual(
    [
      // Boot-trioen (§1.4): kontekst + feed + hendelser, parallelt.
      'POST /rest/v1/rpc/get_session_context',
      'POST /rest/v1/rpc/get_team_feed',
      'GET /rest/v1/events',
      // Feedens bilder og forfatteravatarer — én runde per bucket.
      'POST /storage/v1/object/sign/feed-media',
      'POST /storage/v1/object/sign/avatars',
    ].sort(),
  );
});

/**
 * GJENTATT KALDSTART — den vanlige. Disken har frø, query-snapshot og
 * gyldige signerte URL-er fra forrige økt.
 */
test('gjentatt kaldstart: disken bærer det den kan', async () => {
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, TEAM_SPACE_ID);
  await bootApp();
  await unmountApp();
  await simulateProcessRestart();
  // Fem minutter senere: alt i query-cachen er stale igjen (60 s), mens de
  // signerte URL-ene (24 t) og frøet (24 t) fortsatt gjelder.
  advanceClock(5 * 60_000);

  await bootApp();

  expect(summary().sort()).toEqual(
    [
      'POST /rest/v1/rpc/get_session_context',
      'POST /rest/v1/rpc/get_team_feed',
      'GET /rest/v1/events',
      // Signeringen er BORTE: URL-ene fra forrige økt har 24 t og gjelder
      // fortsatt. Det er gevinsten den gjentatte oppstarten faktisk har.
      //
      // Og badgen tar ikke lenger sitt eget HEAD-kall her: `refreshUnread`
      // hopper på kontekst-kallet i flukt, som uansett bærer tallet.
    ].sort(),
  );
});

/**
 * KONTEKST-RPC-EN FEILER (base uten 00079, eller nettglipp midt i boot):
 * konsumentene tar sine gamle enkeltkall. Det er dette som gjorde det
 * reelle tallet ni — og fallbacken SKAL finnes, så den står her som en
 * målt kostnad, ikke som en overraskelse.
 */
test('kontekstfeil: fallback-kallene er de gamle enkeltkallene', async () => {
  failSessionContext = true;
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, TEAM_SPACE_ID);
  await bootApp();

  // TOLV KALL. Punkt 104 anslo «sju til ni»; det var for lavt, fordi hele
  // fallback-viften slår inn samtidig — hver flate tar sitt gamle enkeltkall.
  expect(summary().sort()).toEqual(
    [
      // Boot-trioen gikk som vanlig (prefetchen bryr seg ikke om RPC-en).
      'POST /rest/v1/rpc/get_team_feed',
      'GET /rest/v1/events',
      'POST /rest/v1/rpc/get_session_context',
      'POST /storage/v1/object/sign/feed-media',
      'POST /storage/v1/object/sign/avatars',
      // … og så viften, én flate om gangen, nøyaktig som før S2:
      'GET /rest/v1/memberships', // TeamContext
      'GET /rest/v1/profiles', // UserContext
      'GET /rest/v1/events', // getLiveMatch — kampknappen
      'POST /rest/v1/rpc/get_team_support_summary', // lagkassa
      'HEAD /rest/v1/notifications', // badgen
      'HEAD /rest/v1/memberships', // medlemstallet i headeren
    ].sort(),
  );
});

// ---------------------------------------------------------------------------
// PUNKT 99 — appen åpner uten å vente på kampsvaret.
// ---------------------------------------------------------------------------

/** Alle a11y-etiketter i det rendrede treet. */
function a11yLabels(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      props?: Record<string, unknown>;
      children?: unknown[] | null;
    };
    const label = n.props?.accessibilityLabel;
    if (typeof label === 'string') out.push(label);
    for (const child of n.children ?? []) walk(child);
  };
  const tree = root?.toJSON() ?? null;
  for (const node of Array.isArray(tree) ? tree : [tree]) walk(node);
  return out;
}

test('punkt 99: frø-boot åpner appen mens kampsvaret fortsatt er i flukt', async () => {
  // Forrige økt ligger på disken.
  await AsyncStorage.setItem(ACTIVE_TEAM_KEY, TEAM_SPACE_ID);
  await bootApp();
  await unmountApp();
  await simulateProcessRestart();
  advanceClock(5 * 60_000);

  // Ny kaldstart der kontekst-RPC-en (som BÆRER livekampen) aldri svarer.
  holdSessionContext = new Promise<void>(res => {
    releaseSessionContext = res;
  });
  await bootApp();

  const labels = a11yLabels();
  // Oppstartsflaten er FORBI — frøet slapp oss inn.
  expect(labels).not.toContain('Laster Heia');
  // Og kampknappen påstår ingenting: «unknown», ikke «KAMP».
  expect(labels).toContain('Kamp. Henter kampstatus');
  expect(labels).not.toContain('Kamp. Åpner Sesongen');

  // Svaret lander sent: knappen bytter etikett — og ingen har flyttet seg.
  releaseSessionContext?.();
  holdSessionContext = null;
  await bootApp();
  expect(a11yLabels()).toContain('Kamp. Åpner Sesongen');
});
