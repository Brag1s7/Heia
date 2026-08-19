import {Alert} from 'react-native';
import {reportContent, type ReportableEntity} from './api/reports';

/**
 * Rapporteringsflyten: årsaksvalg → innsending → takk. Delt mellom feeden og
 * kommentartråden så spørsmålene og språket er identiske begge steder.
 *
 * Takk-svaret er det samme også når rapporten alt fantes (RPC-en er
 * idempotent) — «du har allerede sagt fra» er et svar ingen trenger.
 */
const REPORT_TITLES: Record<ReportableEntity, string> = {
  feed_post: 'Hva er galt med innholdet?',
  comment: 'Hva er galt med innholdet?',
  avatar: 'Hva er galt med profilbildet?',
};

export function promptReport(entityType: ReportableEntity, entityId: string) {
  const send = async (reason: 'upassende' | 'trakassering' | 'annet') => {
    try {
      await reportContent(entityType, entityId, reason);
      Alert.alert(
        'Takk for beskjeden 💚',
        'Heia ser på rapporten så raskt som mulig og rydder opp om det trengs.',
      );
    } catch {
      Alert.alert('Kunne ikke sende rapporten', 'Prøv igjen om litt.');
    }
  };

  Alert.alert('Rapporter til Heia', REPORT_TITLES[entityType], [
    {text: 'Upassende innhold', onPress: () => send('upassende')},
    {text: 'Mobbing eller trakassering', onPress: () => send('trakassering')},
    {text: 'Noe annet', onPress: () => send('annet')},
    {text: 'Avbryt', style: 'cancel'},
  ]);
}
