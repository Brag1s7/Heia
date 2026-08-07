import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, typography, spacing, radius, fonts} from '../theme';
import {Button} from './Button';
import {parseTime} from '../shared/eventForm';

/**
 * Klokkeslettvelgeren: to hjul i et kompakt ark (Brage 2026-08-07, runde 2).
 *
 * Runde 1 var et utfoldbart rutenett — 24 timeceller og 12 minuttceller i
 * skjemaet. Det ble avvist PÅ TELEFONEN: «mer som et kontrollpanel enn Heia».
 * Riktig avvisning. Et klokkeslett er ÉN verdi, og et rutenett med 36 flater
 * gjør et lite valg til en oppgave.
 *
 * ⚠️ Hjulene ligger i et ARK, ikke i skjemaet. Det er hele grunnen til at de
 * kan være hjul i det hele tatt: to vertikale scrollflater rett inne i
 * `NewEventScreen`s egen `ScrollView` er nøyaktig den nøstede scrollen
 * kalenderskiva brukte fem runder på å bli kvitt. I en modal finnes ingen
 * ytre scroll å slåss med.
 *
 * ### Hvorfor dette er like jevnt som en systemvelger
 * Det som avgjør flyten er IKKE JavaScript:
 *  - `snapToInterval` + `decelerationRate="fast"` er native UIScrollView-
 *    egenskaper. Både utrullingen og snap-målet regnes ut i
 *    `scrollViewWillEndDragging:withVelocity:targetContentOffset:` på native
 *    side — samme mekanikk som iOS' egen picker.
 *  - Dimmingen av nabverdiene drives av `Animated.event` med
 *    `useNativeDriver: true`, altså på UI-tråden. Ingen bro, ingen JS-frame.
 *  - Det eneste JS-arbeidet er ett `onMomentumScrollEnd` per gest, og det
 *    ligger utenfor flyten.
 * Presisjonen er eksakt: snap garanterer at offset hviler på et multiplum av
 * `ITEM_HEIGHT`, så `Math.round(y / ITEM_HEIGHT)` aldri kan bomme.
 *
 * ⛔ **Det vi IKKE får er det haptiske tikket.** iOS' picker gir ett hakk per
 * verdi. Ekte haptikk krever en native modul, og `Vibration.vibrate()` er på
 * iOS en ~400 ms hørbar alarmbrumming — ikke et tikk (låst funn, se
 * STATUS-HANDOFF). Hjulet er stille. Det er den ENESTE målbare forskjellen.
 *
 * ⛔ **`ScrollView`, ikke `FlatList`.** Med 24 og 12 elementer er
 * virtualisering ren overhead, og vindusberegningen kan gi tomme celler under
 * en rask fling. Alt rendres én gang.
 */

/** Radhøyden, og dermed snap-intervallet. 44 pt = Apples minste trykkflate. */
const ITEM_HEIGHT = 44;
/** Alltid fem synlige rader: valgt i midten, to dempede på hver side. */
const VISIBLE = 5;
const VIEWPORT = ITEM_HEIGHT * VISIBLE;
/** Så første og siste verdi også kan stå i midten. */
const PAD = (VIEWPORT - ITEM_HEIGHT) / 2;

const HOURS = Array.from({length: 24}, (_, i) => i);
const MINUTE_STEP = 5;
const MINUTES = Array.from({length: 60 / MINUTE_STEP}, (_, i) => i * MINUTE_STEP);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Nærmeste verdi hjulet faktisk kan vise.
 *
 * Et arrangement lagret med det gamle tekstfeltet kan ha 18:07, og hjulet går
 * i fem minutters steg. Vi runder til visning — men verdien lagres først når
 * noen trykker «Ferdig», så «Avbryt» lar 18:07 stå urørt.
 */
function snapMinute(minutes: number): number {
  return Math.min(60 - MINUTE_STEP, Math.round(minutes / MINUTE_STEP) * MINUTE_STEP);
}

interface TimeSheetProps {
  visible: boolean;
  /** Klokkeslettet som skal stå valgt når arket åpnes. «HH:MM». */
  value: string;
  onCancel: () => void;
  onDone: (next: string) => void;
}

export function TimeSheet({visible, value, onCancel, onDone}: TimeSheetProps) {
  const insets = useSafeAreaInsets();

  // Utkast, ikke sannhet: arket endrer ingenting før «Ferdig».
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);

  // Hjulene remonteres for hver åpning. Det er med vilje: startposisjonen
  // settes med `contentOffset`, som iOS bare leser ved opprettelse — et
  // `scrollTo` i en effekt ville krevd at layouten var ferdig, og det er
  // nettopp den timingen som gjør slike velgere flakete.
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseTime(value) ?? {hours: 18, minutes: 0};
    setHour(parsed.hours);
    setMinute(snapMinute(parsed.minutes));
    setMountKey(k => k + 1);
  }, [visible, value]);

  const handleDone = useCallback(() => {
    onDone(`${pad(hour)}:${pad(minute)}`);
  }, [onDone, hour, minute]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Lukk klokkeslettvelgeren"
      />
      <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.lg}]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Klokkeslett</Text>

        <View style={styles.wheels}>
          {/* Båndet ligger UNDER hjulene og fanger ingen trykk. Det er én
              flate, ikke to, så kolonet i midten står i samme mintfelt. */}
          <View pointerEvents="none" style={styles.band} />

          <Wheel
            key={`h-${mountKey}`}
            items={HOURS}
            value={hour}
            onChange={setHour}
            format={pad}
            accessibilityLabel="Time"
            unit="Klokken"
          />
          <Text style={styles.colon}>:</Text>
          <Wheel
            key={`m-${mountKey}`}
            items={MINUTES}
            value={minute}
            onChange={setMinute}
            format={pad}
            accessibilityLabel="Minutt"
            unit="Minutt"
          />
        </View>

        <View style={styles.actions}>
          <Button
            title="Avbryt"
            variant="secondary"
            onPress={onCancel}
            style={styles.action}
          />
          <Button
            title="Ferdig"
            variant="primary"
            onPress={handleDone}
            style={styles.action}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ett hjul
// ---------------------------------------------------------------------------
interface WheelProps {
  items: number[];
  value: number;
  onChange: (next: number) => void;
  format: (n: number) => string;
  accessibilityLabel: string;
  /** Ordet som leses opp foran verdien. */
  unit: string;
}

function Wheel({
  items,
  value,
  onChange,
  format,
  accessibilityLabel,
  unit,
}: WheelProps) {
  const initialIndex = Math.max(0, items.indexOf(value));

  // Drives natively. Hele dimmingen henger på denne ene verdien, så ingen
  // render kjøres mens hjulet er i bevegelse.
  const scrollY = useRef(
    new Animated.Value(initialIndex * ITEM_HEIGHT),
  ).current;

  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);

  /**
   * Verdiene er TRYKKBARE, ikke bare rullbare.
   *
   * ⚠️ Uten dette var hjulet en regresjon for VoiceOver: en scrollflate med
   * ren tekst har ingen mål å aktivere, så en skjermleserbruker kunne ikke
   * velge et klokkeslett i det hele tatt. Rutenettet det erstattet hadde ekte
   * knapper. Nå har hjulet det også — og alle andre får en snarvei: se
   * verdien to hakk unna, trykk på den, i stedet for å dra.
   */
  const tap = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({y: index * ITEM_HEIGHT, animated: true});
      if (items[index] !== value) {
        onChange(items[index]);
      }
    },
    [items, value, onChange],
  );

  const commit = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
      const index = Math.min(items.length - 1, Math.max(0, Math.round(raw)));
      if (items[index] !== value) {
        onChange(items[index]);
      }
    },
    [items, value, onChange],
  );

  return (
    <View style={styles.wheel}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        // Native snap: fysikken og snap-målet regnes ut på native side.
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        // iOS leser denne ved opprettelse — derfor remonteres hjulet per
        // åpning i stedet for at vi jager layouten med `scrollTo`.
        contentOffset={{x: 0, y: initialIndex * ITEM_HEIGHT}}
        contentContainerStyle={styles.wheelContent}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        // Begge: en langsom slipp gir ikke alltid momentum, men snap-målet er
        // det samme i begge tilfeller, så kallet er idempotent.
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}
        accessibilityLabel={accessibilityLabel}>
        {items.map((item, index) => {
          // Falloffen: to hakk ut på hver side. Interpolasjonen kjøres på
          // UI-tråden, så den koster ingenting per frame.
          const distance = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
          ];
          const opacity = scrollY.interpolate({
            inputRange: distance,
            outputRange: [0.28, 0.6, 1, 0.6, 0.28],
            extrapolate: 'clamp',
          });
          const scale = scrollY.interpolate({
            inputRange: distance,
            outputRange: [0.82, 0.92, 1, 0.92, 0.82],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={item}
              style={[styles.item, {opacity, transform: [{scale}]}]}>
              <Pressable
                onPress={() => tap(index)}
                accessibilityRole="button"
                accessibilityState={{selected: item === value}}
                accessibilityLabel={`${unit} ${item}`}
                style={styles.itemTouch}>
                <Text
                  style={[
                    styles.itemText,
                    // Fargen bytter på COMMIT, ikke per frame — den henger på
                    // `value`, ikke på scrollposisjonen.
                    item === value && styles.itemTextSelected,
                  ]}
                  allowFontScaling={false}>
                  {format(item)}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  // ---- Hjulene ----
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: VIEWPORT,
  },
  // Mintbåndet som markerer midten. Ligger bak hjulene og er én sammenhengende
  // flate, så kolonet står i samme felt som tallene.
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_HEIGHT,
    backgroundColor: colors.heiaSoft,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.heia,
  },
  wheel: {
    width: 92,
    height: VIEWPORT,
  },
  wheelContent: {
    paddingVertical: PAD,
  },
  item: {
    height: ITEM_HEIGHT,
  },
  // Hele raden er trykkflaten — 44 pt høy, full hjulbredde.
  itemTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Skjermens tall — displayfonten, aldri fontWeight (låst A v2-regel).
  // `allowFontScaling` er AV her: hjulets rader har fast høyde fordi snap
  // krever det, og forstørret skrift ville sprengt raden i stedet for å
  // vokse den. Verdiene leses uansett opp av VoiceOver.
  itemText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.textPrimary,
  },
  itemTextSelected: {
    color: colors.heiaInk,
  },
  colon: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.heiaInk,
    paddingHorizontal: spacing.xs,
  },

  // ---- Handlingene ----
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  action: {
    flex: 1,
  },
});
