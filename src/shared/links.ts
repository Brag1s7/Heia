/**
 * Offentlige Heia-lenker.
 *
 * Sidene bor i `web/` og serveres fra Vercel på heiaapp.no (samme repo,
 * Root Directory = web). De er App Store-krav: vilkårene må være lesbare
 * FØR man oppretter konto, og personvernerklæringen må ha en offentlig URL.
 *
 * Hardkodet med vilje — dette er appens ene, faste domene. Edge Functions
 * har sin egen `_shared/web.ts` fordi retur-URL-ene der styres av
 * WEB_BASE_URL-secreten og må kunne slås av.
 */
export const HEIA_WEB_BASE = 'https://heiaapp.no';

export const TERMS_URL = `${HEIA_WEB_BASE}/vilkar/`;
export const PRIVACY_URL = `${HEIA_WEB_BASE}/personvern/`;
