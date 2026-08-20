import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, matchColors, spacing, fonts} from '../theme';
import {swellCap} from '../shared/teamColors';
import {MediaImage} from '../lib/media/MediaImage';
import {avatarRef} from '../lib/media/avatar';
import {Avatar} from './Avatar';
import {EventNode, nodeKindFor} from './EventNode';
import {useActiveTeam} from '../context';
import type {MatchGrid} from '../shared/matchGridGeometry';
import type {MatchPhoto} from '../lib/api/feed';
import type {MatchEvent, User} from '../shared/types';

/**
 * ÉN HENDELSE I KAMPFORLØPET — hendelsesgriddet (designretning FROSSET
 * 2026-08-20, docs/prototypes/kampskjerm/index.html er fasit).
 *
 * ---------------------------------------------------------------------------
 * GRIDDET: ikonnode → minutt → innhold, i FASTE kolonner.
 *
 * Minuttet står ALLTID i samme kolonne — aldri over overskriften ett sted og
 * etter navnet et annet. Det er dét som gjør at man kan sveipe nedover og
 * bare lese 34′ · 31′ · 29′ · 25′. Avstanden er kompakt og kronologisk, ikke
 * proporsjonal med tid: tidslinja er en fortelling, ikke en akse.
 *
 * Node og minutt posisjoneres ABSOLUTT, aldri i en flex-kolonne. En
 * flex-basert justering flytter seg når linjehøyden vokser, og da vandrer
 * minuttet oppover kolonnen ved stor tekst. Tallene kommer fra
 * `matchGridGeometry.ts` og er voktet av `__tests__/matchGrid.test.ts`.
 *
 * ---------------------------------------------------------------------------
 * FLATENE HAR INGEN RAMME, SKYGGE ELLER KORTRADIUS.
 *
 * Skillet kommer av LYS og LUFT. Fire uttrykk, alle rett på stadiongrunnen:
 *
 *   MÅL FOR OSS      lagfarget swell med buet, opplyst overkant
 *   MÅL IMOT         dempet skiferstripe — ingen feiring, ingen HEIA
 *   REPORTERSTEMMEN  tekst rett på grunnen, ekstremt svakt lys bak.
 *                    Ingen boks. To på rad skilles av luft, node og minutt.
 *   BILDE            bildet ER flaten, kant til kant
 *   RYTMEMARKØR      avspark/pause/omgang/slutt — krittstrek + etikett
 */

interface MatchEventRowProps {
  event: MatchEvent;
  grid: MatchGrid;
  /** Bilder som hører til nettopp dette øyeblikket. */
  photos?: MatchPhoto[];
  /** Stillingen etter øyeblikket («2–1») — settes på mål og slutt. */
  score?: string;
  /** Reporteren bak en oppdatering. Noden sier HVA, avataren sier HVEM. */
  author?: User;
  /**
   * HEIA + kommentarer for dette øyeblikket.
   *
   * Slot, ikke innhold: engasjementet henger på den KANONISKE feed-posten
   * (`feed_posts.match_event_id`), og den koblingen bygges i sin egen skive.
   * Griddet reserverer plassen nå så raden ikke må omskrives da — og så
   * luften mellom hendelsene stemmer allerede på telefontesten.
   */
  engagement?: React.ReactNode;
  onPressPhoto?: (photo: MatchPhoto) => void;
}

/** Rytmemarkørene er kampens gater, ikke hendelser man leser. */
function isGate(event: MatchEvent): boolean {
  return (
    event.type === 'avspark' ||
    event.type === 'andre_omgang' ||
    event.type === 'pause' ||
    event.type === 'slutt'
  );
}

function gateLabel(event: MatchEvent, score?: string): string {
  const base =
    event.type === 'avspark'
      ? 'Avspark'
      : event.type === 'andre_omgang'
        ? '2. omgang'
        : event.type === 'pause'
          ? 'Pause'
          : 'Slutt';
  return score ? `${base} · ${score}` : base;
}

/**
 * MÅLSWELLEN — grunnen løftes der et mål ligger. Ingen kort, ingen ramme.
 *
 * ⚠️ FEIRINGENS KJERNE ER ALLTID MINT/KREM MED MØRKT BLEKK. Lagfargen er en
 * STRÅLE i ytterkanten, klemt så den aldri havner under tekst. Det er hele
 * grunnen til at et rødt lag aldri blir brunt her.
 *
 * Den buede overkanten kan ikke uttrykkes i RN: prototypens
 * `border-radius: 46% 46% 0 0 / 34px 34px 0 0` er en elliptisk radius, og RN
 * har verken det eller inset-skygge. Den tegnes derfor i svg — og de firkantede
 * hjørnene «klippes» ved å male grunnfargen tilbake over dem, som er den
 * eneste måten å kutte en kurve i RN uten en maskepakke.
 */
function GoalSwell({grid, teamColor}: {grid: MatchGrid; teamColor: string}) {
  const w = grid.width;
  const dome = 34;
  // VAKTEN. Uten kort å gjemme seg bak står teksten rett på det lagfargede
  // lyset, så styrken må avledes av lagfargen — aldri hardkodes. Et lyst lag
  // (gult, lyseblått) klemmes langt ned; et mørkt lag får full stråle.
  const cap = swellCap(teamColor);
  // Kuppelen: flat ved kantene, løftet på midten. Samme grunne bue som
  // prototypens elliptiske radius gir.
  const curve = `M0 ${dome} C ${w * 0.14} 0, ${w * 0.86} 0, ${w} ${dome}`;

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="swellTeam" x1="0%" y1="0%" x2="100%" y2="30%">
              <Stop offset="0" stopColor={teamColor} stopOpacity={cap.peak} />
              <Stop offset="0.56" stopColor={teamColor} stopOpacity={0} />
            </LinearGradient>
            {/* Fasiten legger BEGGE gradientene i ett lag og multipliserer
                hele laget med swell-peaken. Her er de to lag, så peaken må
                ganges inn i mint-radialen også — ellers lyser den ~1.8x for
                sterkt og feiringen blir grell i stedet for varm. */}
            <RadialGradient id="swellMint" cx="4%" cy="46%" rx="126%" ry="118%">
              <Stop
                offset="0"
                stopColor={colors.heia}
                stopOpacity={0.34 * cap.peak}
              />
              <Stop offset="0.6" stopColor={colors.heia} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#swellTeam)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#swellMint)" />
        </Svg>
      </View>

      {/* Kuppelen + lyskanten på overkanten. Ligger øverst i raden med fast
          høyde, så pathen kan regnes i faktiske punkter. */}
      <View
        style={[styles.swellDome, {height: dome}]}
        pointerEvents="none">
        <Svg width={w} height={dome}>
          {/* Maler grunnen tilbake over de firkantede hjørnene. */}
          <Path
            d={`${curve} L ${w} 0 L 0 0 Z`}
            fill={matchColors.timeline}
          />
          <Path
            d={curve}
            stroke={matchColors.chalk}
            strokeWidth={1}
            fill="none"
          />
        </Svg>
      </View>
    </>
  );
}

export function MatchEventRow({
  event,
  grid,
  photos,
  score,
  author,
  engagement,
  onPressPhoto,
}: MatchEventRowProps) {
  const {activeTeamSpace} = useActiveTeam();
  const teamColor = activeTeamSpace?.color || colors.heiaInk;

  const kind = nodeKindFor(event.type, event.teamSide);
  const isGoalUs = kind === 'goalUs';
  const isGoalThem = kind === 'goalThem';
  const isVoice = event.type === 'melding';
  const gate = isGate(event);

  // Radens toppluft avgjør hvor noden og minuttet lander — begge sitter på
  // den første innholdslinja, og prototypen gir hver flate sin egen luft.
  const padTop = isGoalUs ? 24 : isVoice ? 12 : 15;
  const padBottom = isGoalUs ? 18 : isVoice ? 12 : 15;

  const minuteStyle = {
    left: grid.minuteLeft,
    width: grid.minuteWidth,
    top: padTop + grid.minuteTop,
    fontSize: grid.minuteFontSize,
  };

  return (
    <View
      style={[
        styles.row,
        {
          paddingLeft: grid.contentLeft,
          paddingRight: grid.gutter,
          paddingTop: padTop,
          paddingBottom: padBottom,
        },
        // Luften rundt flaten. To oppdateringer på rad skilles av LUFT, node
        // og minutt — aldri av bokser.
        isGoalUs
          ? styles.spacedGoal
          : isVoice
            ? styles.spacedVoice
            : isGoalThem
              ? styles.spacedAgainst
              : null,
      ]}>
      {isGoalUs && <GoalSwell grid={grid} teamColor={teamColor} />}

      {/* MÅL-TENNINGEN: den samme krittlinja tennes i mint — samme x, samme
          bredde. Ingen hendelse får sin egen ekstra vertikale linje.
          Den ligger HER, inne i målraden, i stedet for som et eget lag i
          MatchTimeline: da trengs ingen måling av radhøyder, og tenningen
          dekker nøyaktig målets utstrekning. Noden maler over den. */}
      {isGoalUs && (
        <View
          pointerEvents="none"
          style={[
            styles.ignition,
            {left: grid.threadLeft, width: grid.threadWidth},
          ]}
        />
      )}

      {/* Mål imot: dempet skiferstripe som toner ut mot høyre. Informasjon,
          ikke feiring — og aldri coral. */}
      {isGoalThem && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="againstFade" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop
                  offset="0"
                  stopColor={matchColors.opponent}
                  stopOpacity={0.42}
                />
                <Stop
                  offset="0.72"
                  stopColor={matchColors.opponent}
                  stopOpacity={0}
                />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#againstFade)" />
          </Svg>
        </View>
      )}

      {/* ⚠️ REPORTERENS STEMME HAR INGEN FLATE I DET HELE TATT.
          Prototypen legger et «ekstremt svakt» grønt lys bak teksten. På
          telefon med ekte data leste det som en synlig rektangulær grønn
          boks — nøyaktig det den frosne retningen forbyr («ingen boks,
          ramme, skygge eller sidestrek»). Gradienten toner ut mot HØYRE,
          men aldri opp eller ned, så kantene står. Fjernet (Brage,
          telefontest 2026-08-20): teksten står rett på grunnen. Noden og
          minuttet bærer skillet, og to på rad skilles av luft. */}

      <EventNode kind={kind} grid={grid} top={padTop} />

      <Text
        style={[styles.minute, minuteStyle]}
        maxFontSizeMultiplier={grid.fontCap}
        allowFontScaling>
        {event.minute}′
      </Text>

      <View style={styles.content}>
        {isGoalUs ? (
          <>
            <View
              style={[
                styles.goalHead,
                grid.goalStacked && styles.goalHeadStacked,
              ]}>
              <Text
                style={[styles.goalWord, {fontSize: grid.goalFont}]}
                maxFontSizeMultiplier={grid.fontCap}
                numberOfLines={1}
                adjustsFontSizeToFit>
                MÅL!
              </Text>
              {score && (
                <Text
                  style={[styles.goalTally, {fontSize: grid.goalFont * 0.87}]}
                  maxFontSizeMultiplier={grid.fontCap}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {score}
                </Text>
              )}
            </View>
            {/* ⚠️ KUN DET BRUKEREN FAKTISK SKREV.
                `event.description` er SYNTETISK for mål — `describeMatchEvent`
                (lib/api/events.ts) stemper alltid «Mål for oss» / «Mål for
                <motstander>», og legger reporterens frie tekst i `player`
                i stedet (`player: description || undefined`). Rendret vi
                begge, sto det «Mål for oss» under hvert eneste MÅL! uten at
                noen hadde skrevet det. MÅL! + stillingen sier det allerede.
                Mål IMOT beholder sin `description` — der ER etiketten
                innholdet, og raden har ingen annen tekst. */}
            {event.player && (
              <Text
                style={[styles.goalWho, {maxWidth: grid.measureMax}]}
                maxFontSizeMultiplier={grid.fontCap}>
                {event.player}
              </Text>
            )}
          </>
        ) : isGoalThem ? (
          <View style={styles.againstRow}>
            <Text
              style={styles.againstText}
              maxFontSizeMultiplier={grid.fontCap}>
              {event.description}
            </Text>
            {score && (
              <Text
                style={styles.againstTally}
                maxFontSizeMultiplier={grid.fontCap}>
                {score}
              </Text>
            )}
          </View>
        ) : isVoice ? (
          <>
            <View style={styles.voiceTop}>
              {author && (
                <Avatar
                  size="sm"
                  name={author.name}
                  media={avatarRef(author.avatarPath)}
                  color={author.avatarColor}
                  style={styles.voiceAvatar}
                />
              )}
              <Text
                style={styles.voiceName}
                maxFontSizeMultiplier={grid.fontCap}
                numberOfLines={1}>
                {author
                  ? `${author.name.split(' ')[0]} oppdaterer`
                  : 'Oppdatering'}
              </Text>
            </View>
            <Text
              style={[styles.voiceText, {maxWidth: grid.measureMax}]}
              maxFontSizeMultiplier={grid.fontCap}>
              {event.description}
            </Text>
          </>
        ) : gate ? (
          // Krittstrek + etikett + krittstrek. Kampens gater leses som rytme,
          // ikke som hendelser.
          <View style={styles.gateRow}>
            <View style={styles.gateLine} />
            <Text style={styles.gateLabel} maxFontSizeMultiplier={grid.fontCap}>
              {gateLabel(event, score)}
            </Text>
            <View style={styles.gateLine} />
          </View>
        ) : (
          // bytte / kort — kun historiske data, aldri rapportert fra appen.
          <Text style={styles.plainText} maxFontSizeMultiplier={grid.fontCap}>
            {event.description}
          </Text>
        )}

        {engagement}
      </View>

      {/* Bildet ER flaten — kant til kant, aldri en innfelt blokk i
          innholdskolonnen. Derfor ligger det UTENFOR `content`, som bærer
          radens 82 pt venstremarg. */}
      {photos?.map(photo => (
        <Pressable
          key={photo.id}
          onPress={onPressPhoto ? () => onPressPhoto(photo) : undefined}
          style={({pressed}) => [
            styles.photo,
            // Bryter ut av radens padding. Negative marginer er det eneste
            // RN har for «kant til kant» inne i en padded forelder.
            {marginLeft: -grid.contentLeft, marginRight: -grid.gutter},
            pressed && styles.pressed,
          ]}>
          {/* Thumb i forløpet (B2): raden er en forhåndsvisning — trykket
              åpner galleriet, som laster display. */}
          <MediaImage
            media={photo.media}
            variant="thumb"
            style={styles.photoImage}
            resizeMode="cover"
          />
          {photo.caption && (
            <Text
              style={[
                styles.photoCaption,
                {paddingLeft: grid.contentLeft, paddingRight: grid.gutter},
              ]}
              maxFontSizeMultiplier={grid.fontCap}>
              {photo.caption}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    // Bevisst UTEN overflow:'hidden'. Swellens firkantede hjørner klippes av
    // svg-en som maler grunnen tilbake over dem, så klippingen trengs ikke —
    // og på iOS spiser overflow:'hidden' skyggen, altså nodens mint-glød.
  },
  spacedGoal: {
    marginTop: 8,
    marginBottom: 8,
  },
  spacedVoice: {
    marginTop: 12,
  },
  spacedAgainst: {
    marginTop: 4,
    marginBottom: 4,
  },
  swellDome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  ignition: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.heia,
    opacity: 0.85,
    zIndex: 1,
  },
  minute: {
    position: 'absolute',
    textAlign: 'right',
    fontFamily: fonts.display,
    color: matchColors.dim,
    letterSpacing: -0.1,
    zIndex: 2,
  },
  content: {
    position: 'relative',
  },
  // --- Mål for oss ---
  goalHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  goalHeadStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  goalWord: {
    fontFamily: fonts.display,
    color: matchColors.text,
    letterSpacing: -2,
  },
  goalTally: {
    fontFamily: fonts.display,
    color: colors.heia,
    letterSpacing: -1.8,
  },
  goalWho: {
    marginTop: 9,
    fontSize: 17,
    fontWeight: '700',
    color: matchColors.text,
  },
  // --- Mål imot ---
  againstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  againstText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: matchColors.dim,
  },
  againstTally: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: matchColors.text,
    opacity: 0.8,
  },
  // --- Reporterens stemme ---
  voiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  voiceAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    // Gullringen ER noden for stemmen — avataren sitter på linja.
    borderWidth: 1.5,
    borderColor: 'rgba(255, 197, 61, 0.55)',
  },
  voiceName: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: '800',
    color: matchColors.text,
    letterSpacing: 0.1,
  },
  voiceText: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 24,
    color: matchColors.text,
  },
  // --- Rytmemarkør ---
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gateLine: {
    flex: 1,
    height: 1,
    backgroundColor: matchColors.chalkFaint,
  },
  gateLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: matchColors.dim,
  },
  plainText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: matchColors.dim,
  },
  // --- Bilde på et øyeblikk ---
  photo: {
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  photoImage: {
    width: '100%',
    height: 200,
    // Laste-platen må være GRUNNEN, ikke colors.background — den ville
    // blinket hvitt på den mørke flaten mens thumben dekodes.
    backgroundColor: matchColors.timeline,
  },
  photoCaption: {
    marginTop: 6,
    fontSize: 14.5,
    lineHeight: 21,
    color: matchColors.dim,
  },
});
