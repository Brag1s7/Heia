// ============================================================
// _shared/stripe.ts — minimal Stripe-klient for Edge Functions.
//
// Bevisst UTEN npm:stripe (samme håndrullede mønster som apns.ts):
// fase 2 trenger kun to ting — signaturverifisering (WebCrypto HMAC)
// og noen få GET-kall — og API-versjonen SKAL være eksplisitt pinnet
// (fase 0-funn #4: invoice.charge/payment_intent finnes ikke lenger;
// objektformene vi parser er verifisert mot loggene i spike-mappen
// på akkurat denne versjonen).
//
// Webhook-funksjonen er rent observerende: kun GET. stripePost
// (fase 3) brukes av stripe-onboarding til å PROVISJONERE (konto +
// Account Link) — aldri til å flytte penger. Alt som flytter penger
// (refusjoner, transfer-reverseringer) er bevisste ops-/RPC-
// handlinger — aldri en webhook-bivirkning.
// ============================================================

// Pinnet både her (alle API-kall) og på webhook-endepunktene i Stripe
// (event-payloads serveres på endepunktets versjon). Bump = ny
// verifisering av objektformene mot sandbox, aldri stille.
export const STRIPE_API_VERSION = '2026-07-29.dahlia';

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Konstant-tid-sammenligning så signatursjekken ikke lekker via timing.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Stripe-Signature-headeren: `t=<epoch>,v1=<hex>[,v1=<hex>…]`.
// Vi godtar flere secrets (platform + Connect deler URL, men har hver
// sin secret) og flere v1-verdier (Stripe sender begge ved rotasjon).
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secrets: string[],
  toleranceSec = 300,
): Promise<boolean> {
  if (!header || secrets.length === 0) return false;

  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k === 't') timestamp = Number(v);
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  // Replay-vern: gamle signaturer avvises selv om de er gyldige.
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;

  const signedPayload = `${timestamp}.${payload}`;
  for (const secret of secrets) {
    const expected = await hmacSha256Hex(secret, signedPayload);
    if (signatures.some((sig) => timingSafeEqualHex(sig, expected))) {
      return true;
    }
  }
  return false;
}

// deno-lint-ignore no-explicit-any
export type StripeObject = Record<string, any>;

export async function stripeGet(
  path: string,
  query?: Record<string, string>,
): Promise<StripeObject> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY mangler i miljøet');

  const url = new URL(`https://api.stripe.com${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Stripe GET ${path} → ${res.status}: ${body?.error?.message ?? 'ukjent feil'}`,
    );
  }
  return body;
}

// Form-enkodet POST (Stripes eneste format). Nøstede felter skrives
// med bracket-nøkler («controller[fees][payer]») — samme form som
// spike-RUNBOOK-ens curl-kall, så parameterne kan sammenlignes 1:1.
// Idempotency-Key gjør kall trygge å gjenta (Stripe returnerer det
// første resultatet) — brukes ved kontoopprettelse så et dobbeltklikk
// aldri kan gi to Stripe-kontoer.
export async function stripePost(
  path: string,
  params: Record<string, string>,
  idempotencyKey?: string,
): Promise<StripeObject> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY mangler i miljøet');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': STRIPE_API_VERSION,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Stripe POST ${path} → ${res.status}: ${body?.error?.message ?? 'ukjent feil'}`,
    );
  }
  return body;
}
