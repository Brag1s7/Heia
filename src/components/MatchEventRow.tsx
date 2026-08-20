import React, {useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors, matchColors, radius, spacing, fonts} from '../theme';
import {swellCap} from '../shared/teamColors';
import {matchEventA11yLabel, matchPhotoA11yLabel} from '../shared/matchCopy';
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
 *   BILDE            i innholdskolonnen som all annen tekst (telefontest
 *                    2026-08-20 — se kommentaren nede ved bilderaden)
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
 * RADENS FAKTISKE HØYDE, I PUNKTER.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ HVORFOR IKKE BARE `height="100%"` (telefontest 2026-08-20, skive 3)
 *
 * Flatene i en rad — målswellen og skiferstripa — er svg-er i en
 * `absoluteFill`-beholder. Beholderen strekker seg korrekt over hele raden;
 * det gjør RNs layout alltid. Men `<Rect height="100%">` inne i svg-en
 * regnes mot svg-ens EGEN oppmålte lerretstørrelse, og den henger igjen på
 * verdien fra første layout. En målrad UTEN bilde er ~83 pt; med bilde er
 * den tre ganger så høy — og da ble swellen stående igjen på den første
 * høyden.
 *
 * Resultatet var nøyaktig den feilen skive 2.2 trodde den hadde lukket:
 * lagets lys rakk ikke ned til bildet, og bildet hang løsrevet under et mål
 * som visuelt sluttet midtveis. Den gangen var årsaken gradientens
 * rotasjon, og den rettelsen var riktig — men den var ikke HELE årsaken.
 *
 * BEVISET LÅ I SAMME SKJERMBILDE: måltenningen (`styles.ignition`) er en
 * vanlig `View` med `top: 0, bottom: 0`, og den gikk hele veien ned forbi
 * bildet. Samme rad, samme beholder — den ene brukte RNs layout, den andre
 * en prosent inne i svg. Bare den ene var feil.
 *
 * Derfor måles høyden her og sendes inn som PUNKTER. Ingen prosent noe sted
 * i flatene. Samme mønster som `ArenaSurface` alt bruker, og prisen er den
 * samme: én frame uten flaten før målingen lander.
 */
function useRowHeight(): {
  height: number;
  onLayout: (e: LayoutChangeEvent) => void;
} {
  const [height, setHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    // Terskel, ikke likhet: en ren `setState` per layout-hendelse ville
    // gitt en render-løkke på subpiksel-drift.
    setHeight(prev => (Math.abs(prev - next) > 0.5 ? next : prev));
  };
  return {height, onLayout};
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
  const h = useRowHeight();

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={h.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {h.height > 0 && (
        <Svg width={w} height={h.height}>
          <Defs>
            {/* ⚠️ KLIPP, IKKE OVERMALING (telefontest 2026-08-20).
                Kuppelen ble før laget ved å male grunnfargen (#123325) tilbake
                over de firkantede hjørnene. Det virket så lenge raden lå på en
                flat, mørk egen flate — men fra skive 2 ligger den på GRUNNEN,
                og da var overmalingen en ugjennomsiktig plate i feil farge som
                KUTTET KRITTLINJA i de øverste 34 punktene av hver målrad.
                Nå klippes hele swellen til formen sin i stedet. Ingen opasitet
                legges noe sted, og linja går uavbrutt gjennom.
                Bunnen er radens MÅLTE høyde — se `useRowHeight`. Den sto før
                på et vilkårlig dypt tall fordi høyden ikke var kjent her. */}
            <ClipPath id="swellClip">
              <Path d={`${curve} L ${w} ${h.height} L 0 ${h.height} Z`} />
            </ClipPath>
            {/* ⚠️ HELT HORISONTAL (`y2="0%"`). Med `y2="30%"` roterte
                gradienten når raden ble høy — og en målrad MED BILDE er tre
                ganger så høy som en uten. Da rakk lagets lys aldri ned til
                bildet, og bildet ble hengende løsrevet under et mål som
                sluttet midtveis. Feiringen skal dekke hele øyeblikket.
                ⚠️ Den rettelsen var riktig, men ikke hele årsaken — flaten
                var også prosenthøy. Se `useRowHeight`. */}
            <LinearGradient id="swellTeam" x1="0%" y1="0%" x2="100%" y2="0%">
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

          <G clipPath="url(#swellClip)">
            <Rect
              x="0"
              y="0"
              width={w}
              height={h.height}
              fill="url(#swellTeam)"
            />
            <Rect
              x="0"
              y="0"
              width={w}
              height={h.height}
              fill="url(#swellMint)"
            />
          </G>

          {/* Lyskanten på kuppelen — kritt, ikke ramme. */}
          <Path
            d={curve}
            stroke={matchColors.chalk}
            strokeWidth={1}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

/**
 * MÅL IMOT — dempet skiferstripe som toner ut mot høyre. Informasjon, ikke
 * feiring, og aldri coral.
 *
 * ⚠️ Måler høyden av samme grunn som swellen: et mål imot MED bilde er like
 * høyt som et mål for oss med bilde, og en prosenthøyde ville stoppet på
 * samme sted.
 */
function AgainstStripe({grid}: {grid: MatchGrid}) {
  const h = useRowHeight();

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={h.onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {h.height > 0 && (
        <Svg width={grid.width} height={h.height}>
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
          <Rect
            x="0"
            y="0"
            width={grid.width}
            height={h.height}
            fill="url(#againstFade)"
          />
        </Svg>
      )}
    </View>
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

  // ÉN HENDELSE = ÉTT STOPP I VOICEOVER. Setningen bygges i matchCopy, ikke
  // her: rekkefølgen MINUTT → HVA → HVEM → DETALJ er en regel som skal kunne
  // testes, ikke en tilfeldig sammensetning av JSX-tekster.
  const a11yLabel = matchEventA11yLabel(event, {
    score,
    authorName: author?.name,
  });

  return (
    <View
      style={[
        styles.outer,
        {paddingBottom: padBottom},
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
      {isGoalThem && <AgainstStripe grid={grid} />}

      {/* ⚠️ REPORTERENS STEMME HAR INGEN FLATE I DET HELE TATT.
          Prototypen legger et «ekstremt svakt» grønt lys bak teksten. På
          telefon med ekte data leste det som en synlig rektangulær grønn
          boks — nøyaktig det den frosne retningen forbyr («ingen boks,
          ramme, skygge eller sidestrek»). Gradienten toner ut mot HØYRE,
          men aldri opp eller ned, så kantene står. Fjernet (Brage,
          telefontest 2026-08-20): teksten står rett på grunnen. Noden og
          minuttet bærer skillet, og to på rad skilles av luft. */}

      {/* ⚠️ HVORFOR EN INNER-WRAPPER, OG IKKE `accessible` PÅ HELE RADEN:
          en `accessible`-beholder svelger alt inni seg — bildet og
          engasjement-sloten ville sluttet å være egne stopp, altså umulige å
          trykke med VoiceOver. Wrapperen dekker derfor nøyaktig øyeblikkets
          TEKST (node + minutt + innhold), mens bildet og HEIA/kommentarer
          ligger utenfor som egne elementer.

          GEOMETRIEN ER URØRT: radens paddinger flyttet fra ytterboksen til
          denne (bunnpaddingen ble igjen ute, så luften under et bilde er den
          samme som før), og absolutt posisjonering måles fra samme kant.
          `zIndex: 2` fordi måltenningen ligger på 1 og ellers ville malt seg
          over noden på Android. */}
      <View
        accessible
        accessibilityLabel={a11yLabel}
        style={[
          styles.inner,
          {
            paddingLeft: grid.contentLeft,
            paddingRight: grid.gutter,
            paddingTop: padTop,
          },
        ]}>
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
              <Text
                style={styles.gateLabel}
                maxFontSizeMultiplier={grid.fontCap}>
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
        </View>
      </View>

      {/* HEIA + kommentarer. Ligger UTENFOR den samlede labelen med vilje —
          de er handlinger med egne labels og egen state, ikke en del av
          setningen om hva som skjedde. */}
      {engagement && (
        <View
          style={{paddingLeft: grid.contentLeft, paddingRight: grid.gutter}}>
          {engagement}
        </View>
      )}

      {/* ⚠️ BILDET LIGGER I INNHOLDSKOLONNEN, IKKE KANT TIL KANT.
          Den frosne retningen sa «bildet ER flaten». På telefon med ekte
          data ble det feil (Brage, telefontest 2026-08-20): et fullbredt,
          lyst rektangel kutter den grønne verdenen i to og drar blikket bort
          fra kampen — nettopp motsatt av at ingenting skal konkurrere med
          stillingen. Grunnen til at det så riktig ut FØR skive 2 er at
          bildet den gang lå på en flat, mørk egen flate; nå ligger det på en
          verden det bryter.
          Samme prinsipp som skive 1.1 satte: prototypen er fasit for
          identitet og hierarki, ikke piksel for piksel når det fungerer
          dårligere med ekte data.
          Bildet står derfor i den samme kolonnen som all annen tekst, med
          node og minutt i skinna ved siden av — som hver eneste andre rad. */}
      {photos?.map(photo => (
        <Pressable
          key={photo.id}
          onPress={onPressPhoto ? () => onPressPhoto(photo) : undefined}
          accessibilityRole="imagebutton"
          accessibilityLabel={matchPhotoA11yLabel({
            minute: event.minute,
            authorName: photo.authorName,
            caption: photo.caption,
          })}
          style={({pressed}) => [
            styles.photo,
            {paddingLeft: grid.contentLeft, paddingRight: grid.gutter},
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
              style={styles.photoCaption}
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
  // Ytterboksen bærer flatene (swell, tenning, skiferstripe) og bildet.
  outer: {
    position: 'relative',
    // Bevisst UTEN overflow:'hidden'. Swellens firkantede hjørner klippes av
    // svg-en som maler grunnen tilbake over dem, så klippingen trengs ikke —
    // og på iOS spiser overflow:'hidden' skyggen, altså nodens mint-glød.
  },
  // Innerboksen bærer griddet og er øyeblikkets ENE stopp for skjermleser.
  inner: {
    position: 'relative',
    zIndex: 2,
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
    // Forholdstall, ikke fast høyde: kolonnen er smalere enn skjermen og
    // varierer med enhet og tekststørrelse, så 200 pt ville vært nesten
    // kvadratisk på én telefon og en stripe på en annen.
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    // Uten dette får ikke radiusen tak i selve bildet på Android.
    overflow: 'hidden',
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
