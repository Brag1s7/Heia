// ============================================================
// apns.ts — send APNs-push direkte fra Deno (ingen Firebase).
//
// APNs krever:
//   - HTTP/2 (Deno fetch bruker det automatisk mot https).
//   - En provider-JWT signert ES256 med .p8-nøkkelen din. Gyldig i
//     opptil 60 min; vi cacher den ~50 min i isolatet.
//
// Miljø (supabase secrets set ...):
//   APNS_KEY      — hele .p8-innholdet (-----BEGIN PRIVATE KEY----- ...)
//   APNS_KEY_ID   — 10-tegns Key ID fra Apple Developer
//   APNS_TEAM_ID  — 10-tegns Team ID
//   APNS_BUNDLE_ID— app-ens bundle id (apns-topic), f.eks. org.heia.Heia2
//   APNS_HOST     — api.sandbox.push.apple.com (Xcode-debug!) eller
//                   api.push.apple.com (TestFlight/App Store)
// ============================================================

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cachedKey: CryptoKey | null = null;
let cachedJwt: {token: string; iat: number} | null = null;

async function getSigningKey(pem: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['sign'],
  );
  return cachedKey;
}

async function providerToken(cfg: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // JWT-en er gyldig i 60 min; forny etter 50 for margin.
  if (cachedJwt && now - cachedJwt.iat < 50 * 60) {
    return cachedJwt.token;
  }

  const header = b64url(JSON.stringify({alg: 'ES256', kid: cfg.keyId}));
  const payload = b64url(JSON.stringify({iss: cfg.teamId, iat: now}));
  const key = await getSigningKey(cfg.key);
  // Web Crypto gir råsignatur (r||s, 64 byte) — nøyaktig JOSE ES256-format.
  const sig = await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const token = `${header}.${payload}.${b64url(sig)}`;
  cachedJwt = {token, iat: now};
  return token;
}

export interface ApnsConfig {
  key: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  host: string;
}

export function apnsConfigFromEnv(): ApnsConfig | null {
  const key = Deno.env.get('APNS_KEY');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const host = Deno.env.get('APNS_HOST') ?? 'api.sandbox.push.apple.com';
  if (!key || !keyId || !teamId || !bundleId) return null;
  return {key, keyId, teamId, bundleId, host};
}

export interface ApnsPayload {
  title: string;
  body: string;
  // Fritt data-objekt appen leser når brukeren trykker på varselet.
  data?: Record<string, unknown>;
  threadId?: string;
}

export type ApnsResult =
  | {token: string; ok: true}
  | {token: string; ok: false; status: number; reason?: string; gone: boolean};

/**
 * Sender ett varsel til én device-token. `gone: true` betyr at token er
 * ugyldig (avinstallert / feil miljø) og skal slettes hos oss.
 */
export async function sendApns(
  cfg: ApnsConfig,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  const jwt = await providerToken(cfg);
  const body = JSON.stringify({
    aps: {
      alert: {title: payload.title, body: payload.body},
      sound: 'default',
      'thread-id': payload.threadId,
    },
    ...(payload.data ?? {}),
  });

  const res = await fetch(`https://${cfg.host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body,
  });

  if (res.status === 200) {
    await res.body?.cancel();
    return {token: deviceToken, ok: true};
  }

  let reason: string | undefined;
  try {
    reason = ((await res.json()) as {reason?: string}).reason;
  } catch {
    // ignorer parse-feil på tom body
  }
  // 410 = Unregistered, 400 BadDeviceToken/DeviceTokenNotForTopic → dødt token.
  const gone =
    res.status === 410 ||
    reason === 'BadDeviceToken' ||
    reason === 'Unregistered' ||
    reason === 'DeviceTokenNotForTopic';

  return {token: deviceToken, ok: false, status: res.status, reason, gone};
}
