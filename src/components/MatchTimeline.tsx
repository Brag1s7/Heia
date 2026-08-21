import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {colors, matchColors, radius, spacing, fonts} from '../theme';
import {MediaImage} from '../lib/media/MediaImage';
import {EventNode} from './EventNode';
import {MatchEventRow} from './MatchEventRow';
import {
  useMatchGrid,
  NOW_DOT,
  type MatchGrid,
} from '../shared/matchGridGeometry';
import {matchPhotoA11yLabel} from '../shared/matchCopy';
import {matchPhotoMinute} from '../shared/matchPulse';
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
  /**
   * Hver rad melder fra hvor den ligger, målt fra forløpets egen topp.
   *
   * ⚠️ MÅLT, IKKE REGNET. Radhøyden varierer med bilde, tekstlengde og
   * tekststørrelse — samme grunn som 3.1 måtte måle radhøyden i stedet for
   * å gjette den. Pulsens «Vis i historien» ruller hit.
   */
  onRowLayout?: (key: string, y: number) => void;
  /**
   * Forløpet ligger rett på kampens grunn (skive 2), ikke på en egen mørk
   * flate. Da må det FJERDE ROMMET tegnes her: et scrim som senker grunnen
   * fra ~L*26 til L*18.5. Uten det er «kampforløp» og «puls» samme tone, og
   * den frosne retningen sier at rommene skilles av tone og lys.
   */
  ground?: boolean;
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
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.chalk, {left: grid.threadLeft, width: grid.threadWidth}]}>
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
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
      <Text
        style={styles.nowText}
        maxFontSizeMultiplier={grid.fontCap}
        // Retningen er hele poenget med markøren, og den er usynlig for en
        // skjermleser: «NÅ · 81′» sier ingenting om at lista går bakover.
        accessibilityLabel={
          live
            ? `Nå, ${nowMinute ?? 0} minutter spilt. Nyeste øverst.`
            : 'Kampen er slutt. Forløpet leses forfra.'
        }>
        {live ? `NÅ · ${nowMinute ?? 0}′` : 'SLUTT'}
      </Text>
    </View>
  );
}

/**
 * ET GENERELT KAMPBILDE — én rad som alle andre.
 *
 * ⚠️ VAR KANT TIL KANT MED TEKSTEN OPPÅ BILDET. Den frosne retningen sa
 * «bildet ER flaten». På telefon med ekte data ble det feil (Brage,
 * telefontest 2026-08-20): et fullbredt, lyst rektangel kutter den grønne
 * verdenen i to, og et bilde midt i kampforløpet drar blikket bort fra
 * kampen. På den flate, mørke egen-flaten fra skive 1 fungerte det; på
 * grunnen gjør det ikke det.
 *
 * Nå: node og minutt i skinna, bildet i innholdskolonnen, teksten UNDER
 * bildet i stedet for oppå. Det gjør også at de to skrimene forsvant — de
 * fantes bare for å holde tekst lesbar over et vilkårlig fotografi.
 *
 * Raden deler `EventNode` og `matchGrid` med alle andre rader, så det fysisk
 * ikke går an å få to ulike tidslinjer i samme scroll.
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
  // Samme toppluft som de nøytrale radene i MatchEventRow, så noden og
  // minuttet lander på nøyaktig samme høyde over sitt innhold.
  const padTop = 15;

  return (
    <View style={[styles.photoRow, {paddingBottom: padTop}]}>
      <View
        style={[
          styles.photoInner,
          {
            paddingLeft: grid.contentLeft,
            paddingRight: grid.gutter,
            paddingTop: padTop,
          },
        ]}>
        <EventNode kind="photo" grid={grid} top={padTop} />
        <Text
          style={[
            styles.minute,
            {
              left: grid.minuteLeft,
              width: grid.minuteWidth,
              top: padTop + grid.minuteTop,
              fontSize: grid.minuteFontSize,
            },
          ]}
          maxFontSizeMultiplier={grid.fontCap}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          {known ? `${minute}′` : ''}
        </Text>

        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          // Bildet ER raden, så det er også radens ene stopp: minuttet,
          // fotografen og teksten leses HER. De synlige kopiene under er
          // skjult, ellers ville VoiceOver lest det samme fire ganger.
          accessibilityLabel={matchPhotoA11yLabel({
            minute: known ? minute : undefined,
            authorName: photo.authorName,
            caption: photo.caption,
          })}
          style={({pressed}) => [pressed && styles.pressed]}>
          <MediaImage
            media={photo.media}
            variant="thumb"
            style={styles.photoImage}
            resizeMode="cover"
          />
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {photo.caption ? (
              <Text
                style={[styles.photoCaption, {maxWidth: grid.measureMax}]}
                maxFontSizeMultiplier={grid.fontCap}>
                {photo.caption}
              </Text>
            ) : null}
            <Text style={styles.photoBy} maxFontSizeMultiplier={grid.fontCap}>
              {photo.authorName}
            </Text>
          </View>
        </Pressable>

        {/* Engasjementet er handlinger med egne labels — utenfor det skjulte. */}
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
  onRowLayout,
  ground = false,
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
      const minute = matchPhotoMinute(photo, startedAt);
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
    <View style={styles.root}>
      {/* DET FJERDE ROMMET. Ikke en flate med egen farge — et scrim som
          senker den samme grunnen. Derfor ligger det her og ikke som en
          `backgroundColor` på skjermen: en farge ville vært en boks, og
          bokser er nettopp det retningen forbyr. */}
      {ground && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="roomFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0" stopColor="#081B13" stopOpacity={0.5} />
                <Stop offset="0.18" stopColor="#081B13" stopOpacity={0.34} />
                <Stop offset="0.46" stopColor="#081B13" stopOpacity={0.24} />
                <Stop offset="1" stopColor="#081B13" stopOpacity={0.2} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#roomFade)"
            />
          </Svg>
        </View>
      )}

      <View style={[styles.eyebrow, {paddingLeft: grid.minuteLeft}]}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.eyebrowDot, {left: grid.nodeCenter - 3.5}]}
        />
        <Text
          style={styles.eyebrowText}
          accessibilityRole="header"
          maxFontSizeMultiplier={grid.fontCap}>
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

        {entries.map(entry => (
          <View
            key={entry.key}
            onLayout={
              onRowLayout
                ? e => onRowLayout(entry.key, e.nativeEvent.layout.y)
                : undefined
            }>
            {entry.kind === 'event' ? (
              <MatchEventRow
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
                photo={entry.photo}
                minute={entry.minute}
                grid={grid}
                engagement={renderEngagement?.({photo: entry.photo})}
                onPress={
                  onPressPhoto ? () => onPressPhoto(entry.photo) : undefined
                }
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
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
  },
  // Bærer griddet: node og minutt posisjoneres absolutt fra DENNE kanten,
  // som ligger på samme x som alle andre raders ytterkant.
  photoInner: {
    position: 'relative',
    zIndex: 2,
  },
  photoImage: {
    width: '100%',
    // Forholdstall, ikke fast høyde — kolonnen varierer med enhet og
    // tekststørrelse. Samme forhold som bildet på en hendelse, så to bilder
    // rett etter hverandre ikke får hver sin form.
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: matchColors.timeline,
  },
  // Teksten står nå UNDER bildet, på grunnen — ikke i hvitt oppå et
  // vilkårlig fotografi. Derfor kampverdenens eget blekk.
  photoCaption: {
    marginTop: 9,
    fontSize: 16,
    lineHeight: 23,
    color: matchColors.text,
  },
  photoBy: {
    marginTop: 5,
    fontSize: 12.5,
    fontWeight: '700',
    color: matchColors.dim,
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
