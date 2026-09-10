/**
 * @format
 */

// ⚠️ ALLER FØRSTE IMPORT, FØR ALT ANNET. Realtime-serialisatoren i
// @supabase/realtime-js dekoder binære broadcast-rammer med TextDecoder —
// som Hermes ikke har. Uten denne kaster hver eneste kamp-hendelse på vei
// inn (telefonfunn 2026-09-07). Se src/lib/textCodec.ts.
import './src/lib/installPolyfills';

import {AppRegistry} from 'react-native';
import {initSentry} from './src/lib/sentry';
import App from './src/app/App';
import {name as appName} from './app.json';

// Før App importeres inn i registeret: feil under selve oppstarten skal
// også fanges. No-op uten SENTRY_DSN i .env (se src/lib/sentry.ts).
initSentry();

AppRegistry.registerComponent(appName, () => App);
