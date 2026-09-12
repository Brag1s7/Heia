/**
 * Sitemap for markedssidene. Broene og arbeidsflatene står bevisst
 * utenfor — de er noindex og krever innlogging eller et token.
 */
import type {APIRoute} from 'astro';

const SIDER = ['/', '/stott-laget/', '/om/', '/hjelp/', '/vilkar/', '/personvern/'];

export const GET: APIRoute = ({site}) => {
  const base = (site ?? new URL('https://heiaapp.no')).origin;
  const urls = SIDER.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {headers: {'Content-Type': 'application/xml; charset=utf-8'}},
  );
};
