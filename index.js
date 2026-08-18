/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {initSentry} from './src/lib/sentry';
import App from './src/app/App';
import {name as appName} from './app.json';

// Før App importeres inn i registeret: feil under selve oppstarten skal
// også fanges. No-op uten SENTRY_DSN i .env (se src/lib/sentry.ts).
initSentry();

AppRegistry.registerComponent(appName, () => App);
