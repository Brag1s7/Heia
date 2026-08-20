import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors, matchColors, spacing, fonts} from '../theme';
import {MediaImage} from '../lib/media/MediaImage';
import {EventNode} from './EventNode';
import {MatchEventRow} from './MatchEventRow';
import {useMatchGrid, NOW_DOT, type MatchGrid} from '../shared/matchGridGeometry';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent, User} from '../shared/types';

interface MatchTimelineProps {
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  /** Kampstart — grunnlaget for å regne ut hvilket minutt et bilde tilhører. */
  startedAt?: Date;
  /** Live-modus vil ha det ferskeste øverst; kamprapporten leses forfra. */
  newestFirst?: boolean;
  /**
   * Kampminuttet NÅ, til retningsmarkøren.
   *
   * ⚠️ PROP, ALDRI EGEN UTREGNING. Alt som viser kampminuttet skal oppdateres
   * fra samme kilde i samme tick — hodet, pulsen, retningsmarkøren og
   * sticky-baren. Prototypen hadde nettopp den bugen: kamphodet viste 40′ mens
   * pulsen sto igjen på 37′ fordi tickeren bare oppdaterte den ene.
   * Ingen komponent her inne kaller `Date.now()` eller `setInterval`.
   */
  nowMinute?: number;
  /** Slår opp reporteren bak en oppdatering. Noden sier HVA, avataren HVEM. */
  authorFor?: (userId: string) => User | undefined;
  /** HEIA + kommentarer per øyeblikk — se `MatchEventRow.engagement`. */
  renderEngagement?: (entry: {
    event?: MatchEvent;
    photo?: MatchPhoto;
  }) => React.ReactNode;
  onPressPhoto?: (photo: MatchPhoto) => void;
}

type Entry =
  | {
      kind: 'event';
      key: string;
      event: MatchEvent;
      photos: MatchPhoto[];
      /** Stillingen ETTER dette øyeblikket — satt på mål og slutt. */
      score?: string;
    }
  | {kind: 'photo'; key: string; photo: MatchPhoto; minute: number};

/**
 * Samme regnestykke som serveren bruker i `report_match_event`
 * (`FLOOR(EXTRACT(EPOCH FROM (now() - started_at)) / 60)`), så bilder og
 * hendelser havner på én og samme minuttskala.
 */
function minuteOf(photo: MatchPhoto, startedAt?: Date): number {
  if (!startedAt) return Number.MAX_SAFE_INTEGER;
  return Math.max(
    0,
    Math.floor((photo.createdAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

/**
 * KRITTLINJA — én sammenhengende strek gjennom hele forløpet.
 *
 * 1 px, varm off-white, ~22 %. Dempet mellom hendelsene, våkner i nodene.
 * Toner inn og ut i endene så den ikke stopper brått.
 *
 * ⚠️ Ingen hendelse får sin egen ekstra vertikale linje. Et mål TENNER den
 * samme linja i mint — samme x, samme bredde — og det gjøres inne i målraden
 * (se `MatchEventRow`), ikke som et eget lag her. Da trenger vi ingen måling
 * av radhøyder, og tenningen dekker nøyaktig målets utstrekning.
 */
function ChalkLine({grid}: {grid: MatchGrid}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.chalk,
        {left: grid.threadLeft, width: grid.threadWidth},
      ]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="chalkFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor="#EAFFF6" stopOpacity={0} />
            <Stop offset="0.04" stopColor="#EAFFF6" stopOpacity={0.22} />
            <Stop offset="0.96" stopColor="#EAFFF6" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#EAFFF6" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#chalkFade)" />
      </Svg>
    </View>
  );
}

/**
 * RETNINGSMARKØREN — «NÅ · 40′ · Nyeste øverst, bla nedover i kampen».
 *
 * Uten den er en omvendt kronologisk liste bare forvirrende. På ferdig kamp
 * snus den: «SLUTT · Kampen leses forfra».
 */
function NowMarker({
  grid,
  newestFirst,
  nowMinute,
}: {
  grid: MatchGrid;
  newestFirst: boolean;
  nowMinute?: number;
}) {
  const live = newestFirst;
  const dotTop = 3;

  return (
    <View
      style={[
        styles.nowMarker,
        {paddingLeft: grid.contentLeft, paddingRight: grid.gutter},
      ]}>
      <View
        pointerEvents="none"
        style={[
          styles.nowDot,
          {left: grid.nodeCenter - NOW_DOT / 2, top: dotTop},
          live ? styles.nowDotLive : styles.nowDotDone,
        ]}
      />
      {/* ⚠️ INGEN PERMANENT HJELPETEKST (Brage, telefontest 2026-08-20).
          Prototypen har «Nyeste øverst — bla nedover i kampen» under
          markøren. Med ekte data forklarer «NÅ · 81′» og minuttkolonnen
          under den retningen helt av seg selv, og setningen ble stående
          som varig instruksjon på en flate som skal være kampen — ikke en
          bruksanvisning. Samme for «Kampen leses forfra» i rapporten. */}
      <Text style={styles.nowText} maxFontSizeMultiplier={grid.fontCap}>
        {live ? `NÅ · ${nowMinute ?? 0}′` : 'SLUTT'}
      </Text>
    </View>
  );
}

/**
 * ET GENERELT KAMPBILDE — bildet ER flaten, kant til kant.
 *
 * Lå tidligere som en håndkopiert tvilling av `MatchEventRow`s radgeometri.
 * Nå deler den `EventNode` og `matchGrid` med alle andre rader, så det
 * fysisk ikke går an å få to ulike tidslinjer i samme scroll.
 */
function PhotoRow({
  photo,
  minute,
  grid,
  engagement,
  onPress,
}: {
  photo: MatchPhoto;
  minute: number;
  grid: MatchGrid;
  engagement?: React.ReactNode;
  onPress?: () => void;
}) {
  const known = minute !== Number.MAX_SAFE_INTEGER;

  return (
    <View style={styles.photoRow}>
      <Pressable
        onPress={onPress}
        style={({pressed}) => [pressed && styles.pressed]}>
        <MediaImage
          media={photo.media}
          variant="thumb"
          style={styles.photoImage}
          resizeMode="cover"
        />
      </Pressable>

      {/* Skrim slik at kritt, minutt og tekst holder seg lesbare uansett
          hva som er på bildet. */}
      <View style={styles.photoScrim} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="shotScrim" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor="#08140E" stopOpacity={0} />
              <Stop offset="0.46" stopColor="#08140E" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#08140E" stopOpacity={0.92} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shotScrim)" />
        </Svg>
      </View>
      <View style={styles.photoTopScrim} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="shotTop" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor="#08140E" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#08140E" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shotTop)" />
        </Svg>
      </View>

      <EventNode kind="photo" grid={grid} top={14} />
      <Text
        style={[
          styles.minute,
          {
            left: grid.minuteLeft,
            width: grid.minuteWidth,
            top: 14 + grid.minuteTop,
            fontSize: grid.minuteFontSize,
            color: matchColors.text,
          },
        ]}
        maxFontSizeMultiplier={grid.fontCap}>
        {known ? `${minute}′` : ''}
      </Text>

      <View
        style={[
          styles.photoBody,
          {paddingLeft: grid.contentLeft, paddingRight: grid.gutter},
        ]}>
        {photo.caption && (
          <Text
            style={[styles.photoCaption, {maxWidth: grid.measureMax}]}
            maxFontSizeMultiplier={grid.fontCap}>
            {photo.caption}
          </Text>
        )}
        <Text style={styles.photoBy} maxFontSizeMultiplier={grid.fontCap}>
          {photo.authorName}
        </Text>
        {engagement}
      </View>
    </View>
  );
}

/**
 * Kampens forløp som én kronologisk liste. Et bilde knyttet til en hendelse
 * henger på hendelsen; et generelt kampbilde er sitt eget innslag på det
 * minuttet det ble lagt ut.
 *
 * Bilder uten kjent kampstart (skal ikke skje på en startet kamp) legges sist
 * i stedet for å bli borte.
 */
export function MatchTimeline({
  matchEvents,
  photos,
  startedAt,
  newestFirst = false,
  nowMinute,
  authorFor,
  renderEngagement,
  onPressPhoto,
}: MatchTimelineProps) {
  const grid = useMatchGrid();

  const entries = useMemo<Entry[]>(() => {
    // Løpende stilling — kampens dramaturgi. Regnes klientside ved å telle
    // mål-radene i serverens kronologiske rekkefølge (ORDER BY sequence);
    // slutt-raden stemples med sluttresultatet. Mål uten teamSide (skal ikke
    // skje etter 00020) teller ikke — bedre å mangle et tall enn å lyve.
    const scoreByEventId = new Map<string, string>();
    let home = 0;
    let away = 0;
    for (const ev of matchEvents) {
      if (ev.type === 'mål' && ev.teamSide) {
        if (ev.teamSide === 'home') {
          home += 1;
        } else {
          away += 1;
        }
        scoreByEventId.set(ev.id, `${home}–${away}`);
      } else if (ev.type === 'slutt') {
        scoreByEventId.set(ev.id, `${home}–${away}`);
      }
    }

    const photosByEvent = new Map<string, MatchPhoto[]>();
    const general: MatchPhoto[] = [];

    for (const photo of photos) {
      if (photo.matchEventId) {
        const list = photosByEvent.get(photo.matchEventId);
        if (list) {
          list.push(photo);
        } else {
          photosByEvent.set(photo.matchEventId, [photo]);
        }
      } else {
        general.push(photo);
      }
    }

    // Hendelsene kommer allerede i rekkefølge (ORDER BY sequence), så
    // indeksen deres ER den sanne rekkefølgen innenfor samme minutt.
    const eventEntries = matchEvents.map((event, index) => ({
      sortMinute: event.minute,
      // Et bilde tatt i minutt N er nesten alltid av det som nettopp skjedde,
      // så hendelsen skal stå først når de deler minutt.
      sortRank: 0,
      sortIndex: index,
      entry: {
        kind: 'event' as const,
        key: event.id,
        event,
        photos: photosByEvent.get(event.id) ?? [],
        score: scoreByEventId.get(event.id),
      },
    }));

    const photoEntries = general.map((photo, index) => {
      const minute = minuteOf(photo, startedAt);
      return {
        sortMinute: minute,
        sortRank: 1,
        sortIndex: index,
        entry: {kind: 'photo' as const, key: photo.id, photo, minute},
      };
    });

    const merged = [...eventEntries, ...photoEntries].sort(
      (a, b) =>
        a.sortMinute - b.sortMinute ||
        a.sortRank - b.sortRank ||
        a.sortIndex - b.sortIndex,
    );

    const ordered = merged.map(m => m.entry);
    return newestFirst ? ordered.reverse() : ordered;
    // ⚠️ `nowMinute` hører IKKE hjemme i denne lista. Et tick-tall her ville
    // regnet hele stillings- og bildeflettingen på nytt hvert 30. sekund.
    // Retningsmarkøren leser minuttet utenfor memoen.
  }, [matchEvents, photos, startedAt, newestFirst]);

  return (
    <View>
      <View style={[styles.eyebrow, {paddingLeft: grid.minuteLeft}]}>
        <View
          pointerEvents="none"
          style={[styles.eyebrowDot, {left: grid.nodeCenter - 3.5}]}
        />
        <Text style={styles.eyebrowText} maxFontSizeMultiplier={grid.fontCap}>
          {newestFirst ? 'Det som skjer' : 'Kampens historie'}
        </Text>
      </View>

      {/* Krittlinja eies av denne wrapperen og rendres som FØRSTE barn:
          RN maler i render-rekkefølge, og negativ zIndex er upålitelig på
          Android. Alt som skal ligge oppå kommer etterpå. */}
      <View style={styles.thread}>
        <ChalkLine grid={grid} />

        <NowMarker
          grid={grid}
          newestFirst={newestFirst}
          nowMinute={nowMinute}
        />

        {entries.map(entry =>
          entry.kind === 'event' ? (
            <MatchEventRow
              key={entry.key}
              event={entry.event}
              grid={grid}
              photos={entry.photos}
              score={entry.score}
              author={
                entry.event.reportedBy
                  ? authorFor?.(entry.event.reportedBy)
                  : undefined
              }
              engagement={renderEngagement?.({event: entry.event})}
              onPressPhoto={onPressPhoto}
            />
          ) : (
            <PhotoRow
              key={entry.key}
              photo={entry.photo}
              minute={entry.minute}
              grid={grid}
              engagement={renderEngagement?.({photo: entry.photo})}
              onPress={
                onPressPhoto ? () => onPressPhoto(entry.photo) : undefined
              }
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    position: 'relative',
    paddingTop: 28,
    paddingBottom: 12,
    paddingRight: spacing.xl,
  },
  // Gullprikken markerer porten mellom pulsen og forløpet — og den er
  // punktet krittlinja starter fra.
  eyebrowDot: {
    position: 'absolute',
    bottom: 16,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.gold,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
  thread: {
    position: 'relative',
  },
  chalk: {
    position: 'absolute',
    top: 0,
    bottom: 6,
    zIndex: 0,
  },
  // --- Retningsmarkøren ---
  nowMarker: {
    position: 'relative',
    paddingTop: 2,
    paddingBottom: 10,
  },
  nowDot: {
    position: 'absolute',
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: NOW_DOT / 2,
    zIndex: 2,
  },
  nowDotLive: {
    backgroundColor: colors.heia,
    shadowColor: colors.heia,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.55,
    shadowRadius: 7,
    elevation: 4,
  },
  // Fasiten demper SLUTT-markøren med opacity alene — den bytter ALDRI farge.
  // Mint er markørens signatur; i krittfarge smelter den sammen med eyebrow-
  // teksten rett over. Ingen `elevation` her: på Android tegnes den utenfor
  // viewets opacity og gir en hardere skygge enn den dempede tilstanden skal ha.
  nowDotDone: {
    backgroundColor: colors.heia,
    shadowColor: colors.heia,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.55,
    shadowRadius: 7,
    opacity: 0.5,
  },
  nowText: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    letterSpacing: 1.75,
    textTransform: 'uppercase',
    color: colors.heia,
  },
  // --- Bilderaden ---
  photoRow: {
    position: 'relative',
    marginVertical: 8,
  },
  photoImage: {
    width: '100%',
    height: 300,
    backgroundColor: matchColors.timeline,
  },
  photoScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '74%',
  },
  photoTopScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 90,
  },
  photoBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 12,
  },
  photoCaption: {
    fontSize: 16.5,
    lineHeight: 23,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoBy: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.78)',
  },
  minute: {
    position: 'absolute',
    textAlign: 'right',
    fontFamily: fonts.display,
    color: matchColors.dim,
    letterSpacing: -0.1,
    zIndex: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
