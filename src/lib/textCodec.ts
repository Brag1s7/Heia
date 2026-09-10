/* eslint-disable no-bitwise */
// ---------------------------------------------------------------------------
// TextEncoder / TextDecoder — UTF-8, for Hermes.
//
// ⚠️ DETTE ER IKKE PYNT. Uten den er LIVE-RAPPORTERING ØDELAGT.
//
// `@supabase/realtime-js` sin Serializer dekoder BINÆRE broadcast-rammer med
// `new TextDecoder()` (lib/serializer.js → `_binaryDecode`), og koder
// utgående broadcast med `new TextEncoder()`. Hverken Hermes eller React
// Native leverer dem — RN har ingen polyfill for disse i det hele tatt.
// Resultatet på telefonen (Brage 2026-09-07):
//
//     ReferenceError: Property 'TextDecoder' doesn't exist
//     …RCTDeviceEventEmitter → EventTarget.dispatchEvent → console.js
//
// Hendelsen kommer inn på WebSocket-en, dekodingen kaster, og kamp-
// hendelsen blir aldri levert. Det er derfor rapporteringen har vært
// ustabil siden Broadcast ble skrudd på for kamp (2026-09-02): appen falt
// tilbake på polling og etterhenting, og fikk en feilbanner på toppen.
//
// ⚠️ EGEN IMPLEMENTASJON, IKKE EN PAKKE. To grunner: den skal virke etter en
// Metro-reload (ingen `npm install`, ingen `pod install`, ingen nytt bygg
// midt i en kampsesong), og UTF-8 er et lukket, testbart problem — se
// `__tests__/textCodec.test.ts`, som vokter æøå, emoji (👏 ⚽) og
// surrogatpar. Kommer det en dag en plattform-innebygd variant, vinner den:
// installasjonen under rører aldri noe som finnes fra før.
//
// Dekket: UTF-8 encode/decode, `ArrayBuffer` og alle typede visninger, og
// erstatningstegnet U+FFFD for ugyldige sekvenser. IKKE dekket: andre
// tegnsett enn UTF-8, `stream: true`, og `encodeInto`. Realtime bruker
// ingen av dem.
// ---------------------------------------------------------------------------

/** UTF-8-bytene for `input`. Enslige surrogater blir U+FFFD, som spec-en. */
export function utf8Encode(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    // Surrogatpar → ett kodepunkt. Et ENSLIG surrogat er ikke gyldig tekst.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }

    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

/** Tekst av UTF-8-bytes. Ugyldige sekvenser blir U+FFFD, aldri et kast. */
export function utf8Decode(bytes: Uint8Array): string {
  // Bygges i biter: én lang `+=` på tusenvis av tegn er merkbart tregere,
  // og en broadcast-ramme kan bære et helt kampforløp.
  const parts: string[] = [];
  let chunk: number[] = [];
  const flush = () => {
    if (chunk.length > 0) {
      parts.push(String.fromCharCode(...chunk));
      chunk = [];
    }
  };

  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    let code: number;
    let size: number;

    if (b0 < 0x80) {
      code = b0;
      size = 1;
    } else if ((b0 & 0xe0) === 0xc0) {
      code = b0 & 0x1f;
      size = 2;
    } else if ((b0 & 0xf0) === 0xe0) {
      code = b0 & 0x0f;
      size = 3;
    } else if ((b0 & 0xf8) === 0xf0) {
      code = b0 & 0x07;
      size = 4;
    } else {
      chunk.push(0xfffd);
      i++;
      continue;
    }

    // Avkuttet i enden, eller en fortsettelsesbyte som ikke er det:
    // ETT erstatningstegn, og gå videre fra neste byte.
    let valid = i + size <= bytes.length;
    if (valid) {
      for (let k = 1; k < size; k++) {
        if ((bytes[i + k] & 0xc0) !== 0x80) {
          valid = false;
          break;
        }
        code = (code << 6) | (bytes[i + k] & 0x3f);
      }
    }
    if (!valid) {
      chunk.push(0xfffd);
      i++;
      continue;
    }

    i += size;
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      chunk.push(0xfffd);
    } else if (code > 0xffff) {
      code -= 0x10000;
      chunk.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      chunk.push(code);
    }

    // `String.fromCharCode(...chunk)` er et spread på argumentlista —
    // for stor og den sprenger stakken. 4096 er godt innenfor på alle
    // motorer og gir fortsatt få skjøter.
    if (chunk.length >= 4096) flush();
  }
  flush();
  return parts.join('');
}

type Source = ArrayBuffer | ArrayBufferView | null | undefined;

function toBytes(input: Source): Uint8Array {
  if (input == null) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
}

export class Utf8TextEncoder {
  readonly encoding = 'utf-8';
  encode(input = ''): Uint8Array {
    return utf8Encode(String(input));
  }
}

export class Utf8TextDecoder {
  readonly encoding: string;
  readonly fatal = false;
  readonly ignoreBOM = false;

  constructor(label = 'utf-8') {
    const normalized = String(label).toLowerCase();
    // Realtime ber alltid om standarden. Ber noen om noe annet, sier vi fra
    // med én gang i stedet for å levere feil tekst i det stille.
    if (normalized !== 'utf-8' && normalized !== 'utf8' && normalized !== '') {
      throw new RangeError(`textCodec: kun utf-8 er støttet (fikk «${label}»)`);
    }
    this.encoding = 'utf-8';
  }

  decode(input?: Source): string {
    const bytes = toBytes(input);
    // BOM hører ikke til teksten.
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      return utf8Decode(bytes.subarray(3));
    }
    return utf8Decode(bytes);
  }
}

/**
 * Installerer polyfillene på global. Idempotent, og den RØRER ALDRI en
 * innebygd implementasjon — får Hermes dem en dag, vinner de av seg selv.
 * Returnerer hva som faktisk ble satt (brukt av testen).
 */
export function installTextCodec(
  target: Record<string, unknown> = globalThis as unknown as Record<
    string,
    unknown
  >,
): {encoder: boolean; decoder: boolean} {
  const installed = {encoder: false, decoder: false};
  if (typeof target.TextEncoder !== 'function') {
    target.TextEncoder = Utf8TextEncoder;
    installed.encoder = true;
  }
  if (typeof target.TextDecoder !== 'function') {
    target.TextDecoder = Utf8TextDecoder;
    installed.decoder = true;
  }
  return installed;
}
