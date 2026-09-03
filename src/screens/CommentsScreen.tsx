import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors} from '../theme';
import {BackBar, DaylightGround} from '../components';
import {CommentThread} from '../components/CommentThread';
import type {HomeStackParamList} from '../shared/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Comments'>;

/**
 * KOMMENTARTRÅDEN SOM EGEN SKJERM — fra feeden og fra et varsel.
 *
 * ⚠️ SELVE TRÅDEN BOR I `components/CommentThread`. Skive 4.1 ga den en
 * inngang til: fra kampforløpet kommer den opp som et BUNNARK over den
 * grønne kampverdenen (`CommentSheet`), fordi det å bli sendt bort fra en
 * pågående kamp for å lese en kommentar er feil interaksjon.
 *
 * Denne skjermen eier derfor bare RAMMEN — tilbakelinja og flaten.
 * Tastaturet eies av trådens composer-dokk (keyboard.tsx) — ingen
 * KeyboardAvoidingView her (én eier per skjerm). Flaten er SAMME grunn som
 * feeden (Brage 2026-09-02: «dette er detaljsiden fra griden») — du lander
 * i verdenen du trykket i. Alt innhold, alle mutasjoner og all cachelogikk
 * er felles, så de to inngangene ikke kan bli to ulike kommentarløsninger.
 */
export function CommentsScreen({route, navigation}: Props) {
  const {postId, teamSpaceId} = route.params;

  return (
    <View style={styles.screen}>
      <DaylightGround />
      <BackBar title="Kommentarer" />
      <CommentThread
        postId={postId}
        teamSpaceId={teamSpaceId}
        // Innlegget er slettet — tråden finnes ikke lenger, så skjermen
        // skal ikke bli stående tom.
        onPostDeleted={navigation.goBack}
        // «Se kampen ›» på kampkortet — samme mål som fra feeden.
        onOpenMatch={eventId => navigation.navigate('EventDetail', {eventId})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
