import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {colors, typography, spacing, radius} from '../theme';
import {
  SectionHeader,
  FeedCard,
  Button,
  LiveMatchBanner,
  TeamHeader,
} from '../components';
import {useActiveTeam, useOnboarding} from '../context';
import {getEventsForTeamSpace} from '../data/teamData';
import {
  getTeamFeed,
  createTextPost,
  createImagePost,
  toggleReaction,
} from '../lib/api/feed';
import type {ImagePostInput} from '../lib/api/feed';
import type {FeedItem, HomeStackParamList} from '../shared/types';

/** Valgt bilde i compose-boksen: preview-uri + payload for opplasting. */
type SelectedImage = ImagePostInput & {uri: string};

type Nav = NativeStackNavigationProp<HomeStackParamList, 'TeamHome'>;

export function TeamHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);
  const {activeTeamSpace, activeTeamSpaceId} = useActiveTeam();
  const {justCreatedTeamSpaceId, clearJustCreated} = useOnboarding();

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeText, setComposeText] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [posting, setPosting] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!activeTeamSpaceId) return;
    setError(null);
    try {
      const items = await getTeamFeed(activeTeamSpaceId);
      setFeed(items);
    } catch (e) {
      setError('Kunne ikke laste feeden. Dra ned for å prøve igjen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamSpaceId]);

  // Last feed når aktivt lag endres.
  useEffect(() => {
    setLoading(true);
    loadFeed();
  }, [loadFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  const handleToggleHeia = useCallback(async (post: FeedItem) => {
    const wasReacted = post.iReacted ?? false;
    const delta = wasReacted ? -1 : 1;
    // Optimistisk lokal oppdatering — snappy, og trygt å reversere ved feil.
    setFeed(prev =>
      prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              iReacted: !wasReacted,
              heiaCount: Math.max(0, (p.heiaCount ?? 0) + delta),
            }
          : p,
      ),
    );
    try {
      await toggleReaction(post.id, wasReacted);
    } catch (e) {
      // Reverter til forrige tilstand.
      setFeed(prev =>
        prev.map(p =>
          p.id === post.id
            ? {
                ...p,
                iReacted: wasReacted,
                heiaCount: Math.max(0, (p.heiaCount ?? 0) - delta),
              }
            : p,
        ),
      );
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      selectionLimit: 1,
    });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset.uri) {
      Alert.alert('Kunne ikke hente bildet', 'Prøv et annet bilde.');
      return;
    }
    setSelectedImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.type ?? 'image/jpeg',
      fileName: asset.fileName ?? 'bilde.jpg',
      sizeBytes: asset.fileSize ?? asset.base64.length,
      width: asset.width,
      height: asset.height,
    });
  }, []);

  const handleRemoveImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const canPost = composeText.trim().length > 0 || selectedImage !== null;

  const handlePost = useCallback(async () => {
    if (!activeTeamSpaceId || !canPost || posting) return;
    setPosting(true);
    try {
      if (selectedImage) {
        await createImagePost({
          teamSpaceId: activeTeamSpaceId,
          content: composeText,
          image: selectedImage,
        });
      } else {
        await createTextPost(activeTeamSpaceId, composeText);
      }
      setComposeText('');
      setSelectedImage(null);
      await loadFeed();
    } catch (e) {
      Alert.alert('Kunne ikke publisere', 'Prøv igjen om litt.');
    } finally {
      setPosting(false);
    }
  }, [activeTeamSpaceId, canPost, composeText, selectedImage, posting, loadFeed]);

  // Vis invite-koden én gang rett etter at laget er opprettet.
  useEffect(() => {
    if (
      justCreatedTeamSpaceId &&
      justCreatedTeamSpaceId === activeTeamSpaceId
    ) {
      clearJustCreated();
      navigation.navigate('Invite', {firstTime: true});
    }
  }, [justCreatedTeamSpaceId, activeTeamSpaceId, clearJustCreated, navigation]);

  if (!activeTeamSpace || !activeTeamSpaceId) return null;

  const teamEvents = getEventsForTeamSpace(activeTeamSpaceId);

  // Finn live kamp (fortsatt mock — events kommer i Fase 3)
  const liveMatch = teamEvents.find(
    e => e.type === 'kamp' && e.matchStatus === 'live',
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + spacing['3xl']}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.heia}
        />
      }>
      {/* Team-header (kompakt) */}
      <TeamHeader />

      {/* Live kamp-banner — HERO */}
      {liveMatch && (
        <View style={styles.section}>
          <LiveMatchBanner
            event={liveMatch}
            onPress={() =>
              navigation.navigate('EventDetail', {eventId: liveMatch.id})
            }
          />
        </View>
      )}

      {/* Feed — hovedinnhold */}
      <SectionHeader title="Siste fra laget" />

      {/* Compose — skriv en enkel tekstpost */}
      <View style={styles.composeCard}>
        <TextInput
          style={styles.composeInput}
          value={composeText}
          onChangeText={setComposeText}
          placeholder="Del noe med laget…"
          placeholderTextColor={colors.textTertiary}
          multiline
          editable={!posting}
        />
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Image
              source={{uri: selectedImage.uri}}
              style={styles.previewThumb}
              resizeMode="cover"
            />
            <Pressable
              style={styles.removeImageBtn}
              onPress={handleRemoveImage}
              hitSlop={8}
              disabled={posting}>
              <Text style={styles.removeImageText}>Fjern bilde</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.composeActions}>
          <Pressable
            style={styles.addImageBtn}
            onPress={handlePickImage}
            hitSlop={8}
            disabled={posting}>
            <Text style={styles.addImageText}>📷 Legg til bilde</Text>
          </Pressable>
          <Button
            title="Publiser"
            onPress={handlePost}
            disabled={!canPost}
            loading={posting}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.feedLoader}
          color={colors.heia}
        />
      ) : error ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Ingen aktivitet ennå</Text>
          <Text style={styles.emptyText}>
            Skriv den første meldingen, eller inviter foreldre og spillere så
            blir laget levende.
          </Text>
          <Button
            title="Inviter laget"
            onPress={() => navigation.navigate('Invite')}
          />
        </View>
      ) : (
        feed.map(item => (
          <View key={item.id} style={styles.cardWrap}>
            <FeedCard
              item={item}
              onHeia={() => handleToggleHeia(item)}
              onComment={() =>
                navigation.navigate('Comments', {
                  postId: item.id,
                  teamSpaceId: activeTeamSpaceId,
                })
              }
            />
          </View>
        ))
      )}

      {/* Støtt laget */}
      <View style={styles.supportCard}>
        <Text style={styles.supportTitle}>
          Støtt {activeTeamSpace.displayName}
        </Text>
        <Text style={styles.supportText}>
          Hjelp laget med å dekke utgifter til kamper, utstyr og sosiale
          arrangementer.
        </Text>
        <Button
          title="Støtt laget"
          variant="secondary"
          onPress={() => navigation.navigate('Support')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cardWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  composeCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  composeInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addImageBtn: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  addImageText: {
    ...typography.body,
    color: colors.heiaInk,
    fontWeight: '600',
  },
  imagePreview: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  previewThumb: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  removeImageBtn: {
    paddingVertical: spacing.xs,
  },
  removeImageText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  feedLoader: {
    marginTop: spacing.xl,
  },
  emptyFeed: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.heading3,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  supportCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  supportTitle: {
    ...typography.heading3,
  },
  supportText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
