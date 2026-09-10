/**
 * Polyfills som må stå FØR alt annet i appen.
 *
 * ⚠️ EGEN MODUL MED VILJE. `import` heises — både i ES-moduler og etter
 * Babels commonjs-transform kjøres ALLE `require`-ene i en fil før første
 * setning i filkroppen. Et `installTextCodec()` plassert mellom to importer
 * i `index.js` ville derfor kjørt ETTER at Supabase-klienten var bygget.
 * Som side-effekt av en modul som importeres først, kjører den først.
 */
import {installTextCodec} from './textCodec';

installTextCodec();
