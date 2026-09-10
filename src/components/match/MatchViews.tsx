import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fonts, matchColors, radius, spacing} from '../../theme';
import {Avatar} from '../Avatar';
import {LiquidGlassSurface} from '../LiquidGlassSurface';
import {ReporterBar} from '../ReporterBar';
import {Ball} from '../icons';
import {MediaImage} from '../../lib/media/MediaImage';
import {avatarRef} from '../../lib/media/avatar';
import {matchPhotoA11yLabel} from '../../shared/matchCopy';
import {matchPhotoMinute} from '../../shared/matchPulse';
import {MONTHS_SHORT} from '../../shared/calendar';
import type {MatchPhoto} from '../../lib/api/feed';
import type {HeiaEventDetail, MatchEvent, User} from '../../shared/types';

/**
 * KAMPENS VISNINGER (runde 2, 2026-09-07): Referat · Hendelser · Bilder ·
 * Info — det som ligger under scorekortet og fanene.
 *
 * ---------------------------------------------------------------------------
 * ÉN POST, ÉN IDENTITET
 *
 * Visningene FILTRERER kampens innhold; de lager aldri parallelle innlegg.
 * Et mål er samme post med samme reaksjoner og tråd i Referat og Hendelser;
 * et bilde festet til et mål vises INNE i målkortet med sin egen tråd, og
 * som eget bilde i Bilder. Engasjementet rendres av skjermen
 * (`renderEngagement`) — den eier handlerne, rettighetene og a11y-tekstene.
 *
 * ---------------------------------------------------------------------------
 * KORTENE ER FEEDENS FROST, FORENKLET TIL ÉN FLATE
 *
 * `LiquidGlassSurface variant="card"` — det telefongodkjente kortmaterialet
 * fra Hjem, over kampens lyse grunn. Ingen plate inni, ingen ramme: meta,
 * tekst og handlingspiller rett på flaten. Mål får feedens kontekstkapsel
 * («⚽ MÅL · LAG»), målscorer og stillingen ETTER målet. Ingen gigantisk
 * MÅL!-overskrift på hvert kort — kapselen og tallet sier det.
 *
 * ⚠️ MÅL IMOT: kun Kommenter. P1 og 00072/00078 forbyr HEIA der. Å åpne det
 * er en egen funksjonell endring gjennom de riktige lagene, ikke noe UI-et
 * omgår.
 *
 * ⚠️ INGEN OPPDIKTEDE DATA. Hendelser viser bare det som er registrert;
 * ferskhet avledes av `createdAt`; sted/tid/reporter kommer fra hendelsen.
 */

type EngagementRenderer = (entry: {
  event?: MatchEvent;
  photo?: MatchPhoto;
}) => React.ReactNode;

/** Kortets faste radius — feedkortets. */
const CARD_RADIUS = radius.xl;

/** «Siste hendelse nå» / «for 3 min» / «for 2 t» — kun det dataene vet. */
export function lastEventLabel(
  matchEvents: MatchEvent[],
  nowMs: number | undefined,
): string | undefined {
  let latest = 0;
  for (const e of matchEvents) {
    const t = e.createdAt?.getTime() ?? 0;
    if (t > latest) latest = t;
  }
  if (!latest || !nowMs) return undefined;
  const sec = Math.max(0, Math.round((nowMs - latest) / 1000));
  if (sec < 60) return 'Siste hendelse nå';
  const min = Math.round(sec / 60);
  if (min < 60) return `Siste hendelse for ${min} min`;
  const h = Math.round(min / 60);
  return `Siste hendelse for ${h} t`;
}

/** «25. aug · 18:00» */
export function kickoffLabel(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
  return `${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]} · ${time}`;
}

// ---------------------------------------------------------------------------
// REFERAT
// ---------------------------------------------------------------------------

type ReferatEntry =
  | {
      kind: 'event';
      key: string;
      event: MatchEvent;
      photos: MatchPhoto[];
      score?: string;
    }
  | {kind: 'photo'; key: string; photo: MatchPhoto; minute: number};

/** Referatet: mål, reporterens meldinger og bilder. Porter og historiske
 * typer (bytte/kort) hører til Hendelser. */
function inReferat(event: MatchEvent): boolean {
  return event.type === 'mål' || event.type === 'melding';
}

/** Stillingen ETTER hvert mål, telt opp fra historikken (aldri justert). */
function scoreAfter(matchEvents: MatchEvent[]): Map<string, string> {
  const out = new Map<string, string>();
  const ordered = [...matchEvents].sort(
    (a, b) => a.minute - b.minute || eventStamp(a) - eventStamp(b),
  );
  let home = 0;
  let away = 0;
  for (const ev of ordered) {
    if (ev.type === 'mål') {
      if (ev.teamSide === 'home') home += 1;
      else away += 1;
      out.set(ev.id, `${home}–${away}`);
    } else if (ev.type === 'slutt' || ev.type === 'pause') {
      out.set(ev.id, `${home}–${away}`);
    }
  }
  return out;
}

function eventStamp(event: MatchEvent): number {
  return event.createdAt?.getTime() ?? 0;
}

interface MatchReferatProps {
  matchEvents: MatchEvent[];
  photos: MatchPhoto[];
  startedAt?: Date;
  /** Vårt lags korte navn i målkapselen. */
  teamName: string;
  opponent: string;
  authorFor: (userId: string) => User | undefined;
  renderEngagement?: EngagementRenderer;
  onPressPhoto: (photo: MatchPhoto) => void;
  /** Live: nyeste øverst. Ferdig kamp: forfra. */
  newestFirst?: boolean;
}

export function MatchReferat({
  matchEvents,
  photos,
  startedAt,
  teamName,
  opponent,
  authorFor,
  renderEngagement,
  onPressPhoto,
  newestFirst = false,
}: MatchReferatProps) {
  const entries = useMemo<ReferatEntry[]>(() => {
    const scores = scoreAfter(matchEvents);
    const photosByEvent = new Map<string, MatchPhoto[]>();
    const loose: MatchPhoto[] = [];
    for (const photo of photos) {
      if (photo.matchEventId) {
        const list = photosByEvent.get(photo.matchEventId);
        if (list) list.push(photo);
        else photosByEvent.set(photo.matchEventId, [photo]);
      } else {
        loose.push(photo);
      }
    }
    const rows = matchEvents.filter(inReferat).map((event, index) => ({
      sortMinute: event.minute,
      sortStamp: eventStamp(event),
      sortRank: 0,
      sortIndex: index,
      entry: {
        kind: 'event' as const,
        key: event.id,
        event,
        photos: photosByEvent.get(event.id) ?? [],
        score: scores.get(event.id),
      },
    }));
    const pics = loose.map((photo, index) => ({
      sortMinute: matchPhotoMinute(photo, startedAt),
      sortStamp: photo.createdAt?.getTime() ?? 0,
      sortRank: 1,
      sortIndex: index,
      entry: {
        kind: 'photo' as const,
        key: photo.id,
        photo,
        minute: matchPhotoMinute(photo, startedAt),
      },
    }));
    const merged = [...rows, ...pics].sort(
      (a, b) =>
        a.sortMinute - b.sortMinute ||
        a.sortStamp - b.sortStamp ||
        a.sortRank - b.sortRank ||
        a.sortIndex - b.sortIndex,
    );
    const ordered = merged.map(m => m.entry);
    return newestFirst ? ordered.reverse() : ordered;
  }, [matchEvents, photos, startedAt, newestFirst]);

  if (entries.length === 0) {
    return (
      <EmptyLine text="Ingen hendelser rapportert ennå. Mål, oppdateringer og bilder kommer her." />
    );
  }

  return (
    <View style={styles.list}>
      {entries.map(entry =>
        entry.kind === 'event' ? (
          <EventCard
            key={entry.key}
            event={entry.event}
            photos={entry.photos}
            score={entry.score}
            teamName={teamName}
            opponent={opponent}
            authorFor={authorFor}
            renderEngagement={renderEngagement}
            onPressPhoto={onPressPhoto}
          />
        ) : (
          <PhotoCard
            key={entry.key}
            photo={entry.photo}
            minute={entry.minute}
            renderEngagement={renderEngagement}
            onPressPhoto={onPressPhoto}
          />
        ),
      )}
    </View>
  );
}

function EmptyLine({text}: {text: string}) {
  return (
    <Text style={styles.empty} maxFontSizeMultiplier={1.6}>
      {text}
    </Text>
  );
}

/**
 * REFERATETS KORT — to trinn i SAMME lyse familie (Brage 2026-09-10).
 *
 * Begge er feedens frostkort, men med et grønt dypvann oppå glasset: mindre
 * pastell, mer kamp. `event` (mål, kort, slutt) ligger ett hakk dypere enn
 * reporterens tekstkort, så en hendelse ALDRI leser som et vanlig innlegg.
 * Ingen av dem blir mørke som heroen — siden skal fortsatt være lys.
 */
function Card({event, children}: {event?: boolean; children: React.ReactNode}) {
  return (
    <LiquidGlassSurface
      variant="card"
      cornerRadius={CARD_RADIUS}
      style={[styles.card, event ? styles.cardEvent : styles.cardText]}>
      {children}
    </LiquidGlassSurface>
  );
}

function Minute({minute}: {minute: number}) {
  return (
    <Text style={styles.minute} maxFontSizeMultiplier={1.4}>
      {minute}′
    </Text>
  );
}

function EventCard({
  event,
  photos,
  score,
  teamName,
  opponent,
  authorFor,
  renderEngagement,
  onPressPhoto,
}: {
  event: MatchEvent;
  photos: MatchPhoto[];
  score?: string;
  teamName: string;
  opponent: string;
  authorFor: (userId: string) => User | undefined;
  renderEngagement?: EngagementRenderer;
  onPressPhoto: (photo: MatchPhoto) => void;
}) {
  const goal = event.type === 'mål';
  const us = event.teamSide === 'home';
  const author = event.reportedBy ? authorFor(event.reportedBy) : undefined;

  return (
    <Card event={goal}>
      {goal ? (
        <>
          <View style={styles.meta}>
            <View style={[styles.capsule, !us && styles.capsuleThem]}>
              <Ball
                size={13}
                color={us ? colors.heia : matchColors.opponentInk}
                strokeWidth={2.4}
              />
              <Text
                style={[styles.capsuleText, !us && styles.capsuleTextThem]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}>
                Mål · {us ? teamName : opponent}
              </Text>
            </View>
            {/* ⚠️ ETIKETT, STILLING OG MINUTT HENGER SAMMEN (Brage
                2026-09-10: «1–0 skal ikke flyte alene langt ute til
                høyre»). Stillingen sto på en egen rad, i motsatt hjørne av
                målscoreren, med et tomrom imellom. Nå er de tre delene av
                SAMME setning: hvem scoret mot hvem, hva ble det, og når. */}
            <View style={styles.eventTail}>
              {score && (
                <Text
                  style={[styles.tally, !us && styles.tallyThem]}
                  maxFontSizeMultiplier={1.3}>
                  {score}
                </Text>
              )}
              <Minute minute={event.minute} />
            </View>
          </View>
          {/* Målscorer når den er kjent. Kapselen sier alt «Mål · lag» —
              ingen «Mål for oss» under. */}
          {event.player ? (
            <Text
              style={styles.scorer}
              maxFontSizeMultiplier={1.4}
              numberOfLines={2}>
              {event.player}
            </Text>
          ) : null}
          {/* Fotnoten på et korrigert mål (skive 8) — reporterens beskrivelse. */}
          {event.note && (
            <Text style={styles.desc} maxFontSizeMultiplier={1.6}>
              {event.note}
            </Text>
          )}
        </>
      ) : (
        <>
          <View style={styles.meta}>
            <Avatar
              name={author?.name ?? 'Reporter'}
              media={avatarRef(author?.avatarPath)}
              color={author?.color}
              size="sm"
              style={styles.avatar}
            />
            <Text
              style={styles.who}
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}>
              {author?.name ?? 'Reporteren'}
            </Text>
            <Text style={styles.role} maxFontSizeMultiplier={1.4}>
              · Reporter
            </Text>
            <Minute minute={event.minute} />
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.6}>
            {event.description}
          </Text>
        </>
      )}

      {renderEngagement?.({event})}

      {/* Bilder festet til øyeblikket: egen post, egen tråd — vises INNE i
          kortet med sine egne handlinger, tydelig merket. */}
      {photos.map(photo => (
        <View key={photo.id} style={styles.attached}>
          <PhotoImage
            photo={photo}
            minute={event.minute}
            onPress={onPressPhoto}
          />
          {photo.caption ? (
            <Text style={styles.caption} maxFontSizeMultiplier={1.6}>
              {photo.caption}
              <Text style={styles.captionBy}> · {photo.authorName}</Text>
            </Text>
          ) : (
            <Text style={styles.caption} maxFontSizeMultiplier={1.6}>
              <Text style={styles.captionBy}>Bilde · {photo.authorName}</Text>
            </Text>
          )}
          {renderEngagement && (
            <View style={styles.photoActs}>
              <Text style={styles.photoActsLabel} maxFontSizeMultiplier={1.4}>
                Bildet
              </Text>
              {renderEngagement({photo})}
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}

function PhotoCard({
  photo,
  minute,
  renderEngagement,
  onPressPhoto,
}: {
  photo: MatchPhoto;
  minute: number;
  renderEngagement?: EngagementRenderer;
  onPressPhoto: (photo: MatchPhoto) => void;
}) {
  return (
    <Card>
      <View style={styles.meta}>
        <Avatar
          name={photo.authorName}
          media={avatarRef(photo.authorAvatarPath)}
          size="sm"
          style={styles.avatar}
        />
        <Text style={styles.who} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {photo.authorName}
        </Text>
        <Text style={styles.role} maxFontSizeMultiplier={1.4}>
          · Bilde
        </Text>
        <Minute minute={minute} />
      </View>
      <PhotoImage photo={photo} minute={minute} onPress={onPressPhoto} />
      {photo.caption ? (
        <Text style={styles.caption} maxFontSizeMultiplier={1.6}>
          {photo.caption}
        </Text>
      ) : null}
      {renderEngagement?.({photo})}
    </Card>
  );
}

function PhotoImage({
  photo,
  minute,
  onPress,
}: {
  photo: MatchPhoto;
  minute: number;
  onPress: (photo: MatchPhoto) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(photo)}
      accessibilityRole="imagebutton"
      accessibilityLabel={matchPhotoA11yLabel({
        minute,
        authorName: photo.authorName,
        caption: photo.caption,
      })}
      style={({pressed}) => [styles.photo, pressed && styles.pressed]}>
      <MediaImage
        media={photo.media}
        variant="thumb"
        style={styles.photoImage}
        resizeMode="cover"
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HENDELSER — kompakt oversikt over det som er registrert
// ---------------------------------------------------------------------------

interface MatchEventsViewProps {
  matchEvents: MatchEvent[];
  teamName: string;
  opponent: string;
  newestFirst?: boolean;
}

function eventLine(
  event: MatchEvent,
  teamName: string,
  opponent: string,
): string {
  switch (event.type) {
    case 'avspark':
      return 'Avspark';
    case 'andre_omgang':
      return '2. omgang';
    case 'pause':
      return 'Pause';
    case 'slutt':
      return 'Slutt';
    case 'mål':
      return `Mål · ${
        event.player ?? (event.teamSide === 'home' ? teamName : opponent)
      }`;
    case 'bytte':
      return event.description;
    case 'kort':
      return event.description;
    case 'melding':
      return event.description;
  }
}

export function MatchEventsView({
  matchEvents,
  teamName,
  opponent,
  newestFirst = false,
}: MatchEventsViewProps) {
  const rows = useMemo(() => {
    const scores = scoreAfter(matchEvents);
    const list = matchEvents
      .filter(e => e.type !== 'melding')
      .slice()
      .sort((a, b) => a.minute - b.minute || eventStamp(a) - eventStamp(b));
    const ordered = newestFirst ? list.reverse() : list;
    return ordered.map(e => ({
      id: e.id,
      minute: e.minute,
      goal: e.type === 'mål',
      us: e.teamSide === 'home',
      label: eventLine(e, teamName, opponent),
      score: scores.get(e.id),
    }));
  }, [matchEvents, teamName, opponent, newestFirst]);

  if (rows.length === 0) {
    return <EmptyLine text="Ingen hendelser registrert ennå." />;
  }

  return (
    <View style={styles.list}>
      <Card>
        {rows.map((r, i) => (
          <View
            key={r.id}
            style={[styles.eventRow, i > 0 && styles.eventRowDivider]}
            accessible
            accessibilityLabel={`${r.minute} minutter: ${r.label}${
              r.score ? `, ${r.score}` : ''
            }`}>
            <Text style={styles.eventMinute} maxFontSizeMultiplier={1.4}>
              {r.minute}′
            </Text>
            {r.goal && (
              <Ball
                size={15}
                color={r.us ? colors.heiaInk : colors.textTertiary}
                strokeWidth={2.2}
              />
            )}
            <Text
              style={[styles.eventLabel, r.goal && styles.eventLabelGoal]}
              numberOfLines={2}
              maxFontSizeMultiplier={1.5}>
              {r.label}
            </Text>
            {r.score && (
              <Text style={styles.eventScore} maxFontSizeMultiplier={1.3}>
                {r.score}
              </Text>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BILDER
// ---------------------------------------------------------------------------

export function MatchPhotosView({
  photos,
  onPressPhoto,
}: {
  photos: MatchPhoto[];
  onPressPhoto: (photo: MatchPhoto) => void;
}) {
  if (photos.length === 0) {
    return <EmptyLine text="Ingen bilder fra kampen ennå." />;
  }
  return (
    <View style={styles.grid}>
      {photos.map(photo => (
        <Pressable
          key={photo.id}
          onPress={() => onPressPhoto(photo)}
          accessibilityRole="imagebutton"
          accessibilityLabel={matchPhotoA11yLabel({
            minute: 0,
            authorName: photo.authorName,
            caption: photo.caption,
          })}
          style={({pressed}) => [styles.gridCell, pressed && styles.pressed]}>
          <MediaImage
            media={photo.media}
            variant="thumb"
            style={styles.gridImage}
            resizeMode="cover"
          />
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// INFO — tid, sted, reporter, praktisk
// ---------------------------------------------------------------------------

interface MatchInfoViewProps {
  event: HeiaEventDetail;
  reporter?: User;
  isAdmin: boolean;
  isReporter?: boolean;
  onChangeReporter?: () => void;
  onEdit?: () => void;
}

export function MatchInfoView({
  event,
  reporter,
  isAdmin,
  isReporter = false,
  onChangeReporter,
  onEdit,
}: MatchInfoViewProps) {
  const coming = event.attendees?.coming ?? [];
  return (
    <View style={styles.list}>
      <Card>
        <InfoRow label="Tid" value={kickoffLabel(event.startTime)} />
        {event.location ? (
          <InfoRow label="Sted" value={event.location} />
        ) : null}
        {event.description ? (
          <InfoRow label="Om kampen" value={event.description} />
        ) : null}
      </Card>
      <Card>
        <Text style={styles.infoLabel} maxFontSizeMultiplier={1.4}>
          Reporter
        </Text>
        {onChangeReporter ? (
          <ReporterBar
            reporter={reporter}
            isAdmin={isAdmin}
            isMe={isReporter}
            onChangeReporter={onChangeReporter}
          />
        ) : (
          <Text style={styles.infoValue} maxFontSizeMultiplier={1.6}>
            {reporter?.name ?? 'Ingen kampreporter'}
          </Text>
        )}
      </Card>
      {coming.length > 0 && (
        <Card>
          <InfoRow
            label={`Påmeldt · ${coming.length}`}
            value={coming.map(a => a.childName ?? a.name).join(', ')}
          />
        </Card>
      )}
      {isAdmin && onEdit && (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Rediger kampen"
          style={({pressed}) => [styles.edit, pressed && styles.pressed]}>
          <Text style={styles.editLabel} maxFontSizeMultiplier={1.4}>
            Rediger kampen
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
      <Text style={styles.infoValue} maxFontSizeMultiplier={1.6}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  empty: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    fontSize: 15,
    lineHeight: 21,
    color: colors.heiaDeep,
    opacity: 0.8,
  },
  card: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 14,
  },
  /** Reporterens tekstkort: lyst og sosialt, men med grønt dypvann. */
  cardText: {
    backgroundColor: 'rgba(6, 68, 50, 0.08)',
  },
  /** Hendelsen (mål/kort/slutt): ett hakk dypere — den er ikke et innlegg. */
  cardEvent: {
    backgroundColor: 'rgba(6, 68, 50, 0.16)',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  who: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  role: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  /** Stilling + minutt som ÉN gruppe til høyre i etikettraden. */
  eventTail: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  minute: {
    marginLeft: 'auto',
    fontFamily: fonts.display,
    fontSize: 13.5,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 13,
    backgroundColor: colors.heiaDeep,
    flexShrink: 1,
  },
  capsuleThem: {
    backgroundColor: matchColors.opponent,
  },
  capsuleText: {
    fontFamily: fonts.display,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.heia,
    flexShrink: 1,
  },
  capsuleTextThem: {
    color: matchColors.opponentInk,
  },
  scorer: {
    marginTop: 8,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  // Stillingen bor nå I etikettraden, ikke på egen linje — derfor mindre.
  tally: {
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: -0.5,
    color: colors.heiaInk,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  tallyThem: {
    color: colors.textSecondary,
  },
  desc: {
    marginTop: 4,
    fontSize: 15.5,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  body: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  attached: {
    marginTop: spacing.md,
  },
  photo: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 57, 46, 0.12)',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  pressed: {
    opacity: 0.85,
  },
  caption: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  captionBy: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  photoActs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoActsLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Hendelser
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  eventRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(8, 57, 46, 0.14)',
  },
  eventMinute: {
    width: 36,
    fontFamily: fonts.display,
    fontSize: 13.5,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  eventLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  eventLabelGoal: {
    fontWeight: '700',
  },
  eventScore: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // Bilder
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  gridCell: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 57, 46, 0.12)',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  // Info
  infoRow: {
    paddingVertical: 6,
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  edit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  editLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
