import Config from 'react-native-config';

/**
 * Sentry (B3, prod-observability): krasj og JS-feil fra TestFlight/prod —
 * netMetrics måler kall, Sentry fanger det som velter.
 *
 * Helt AV uten SENTRY_DSN i .env: dev-hverdagen og testene skal ikke ha en
 * feilrapporterings-avhengighet i kritisk sti, og modulen lastes ikke engang
 * (require inne i vakten — Metro bundler den, men den evalueres ikke).
 *
 * Native-delen (crash handler for iOS-krasj utenfor JS) aktiveres først når
 * Brage kjører `pod install` + nytt bygg — det hører til neste byggerunde
 * (B1-testbranchen tar uansett pods). Frem til da kjører SDK-en i ren
 * JS-modus: den logger «Native Client is not available» og fanger JS-feil
 * via fetch-transporten. try/catch-en er vern mot at init selv velter appen
 * i det vinduet.
 */
export function initSentry(): void {
  const dsn = Config.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      // Kun feil/krasj i denne omgangen — tracing er et bevisst B3-nei
      // (netMetrics + edge_logs eier ytelsesbildet, P9).
      tracesSampleRate: 0,
      // Ingen persondata utover det et stacktrace bærer (ip av, ingen
      // default-PII) — ungdomslag-appen sender aldri mer enn den må.
      sendDefaultPii: false,
    });
  } catch {
    // Init skal ALDRI kunne hindre appstart — da er observability verre
    // enn ingenting.
  }
}
