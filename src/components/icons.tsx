import React from 'react';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {colors} from '../theme';

/**
 * Appens ikonsett — Lucide (stroke 2, runde ender), samlet på ETT sted så
 * skjermene aldri importerer lucide direkte. Vil du ha et nytt ikon: legg det
 * til her, ikke i skjermen.
 */
export {
  /**
   * ⚠️ NYTT IKON — og grunnen er IKKE «prototypen tegnet det sånn».
   *
   * Kampknappens hviletilstand («KAMP», skive 10) trengte en glyf som betyr
   * KAMPEN. `Ball` kunne ikke brukes: den er reservert for MÅL og ingenting
   * annet (skive 1), og en ball på en knapp som bare åpner Sesongen ville
   * lovet et mål. Heia hadde ingen annen kandidat. `Activity` er samme
   * Lucide-familie som resten av settet — pulslinja, som er nettopp det
   * kampen er i Heia.
   */
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Bell,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  HandHeart,
  House,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Maximize2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Phone,
  Play,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Trophy,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';

interface BallIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Fotball — finnes ikke i Lucide, så den er tegnet etter artifactens path
 * (A v2), i samme strektykkelse og med samme runde ender som resten.
 */
export function Ball({
  size = 24,
  color = colors.textPrimary,
  strokeWidth = 1.8,
}: BallIconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} {...common} />
      <Path d="M12 8.4 8.8 10.7l1.2 3.8h4l1.2-3.8z" {...common} />
      <Path
        d="M12 3.5v4.9M4 9.8l4.8 1M20 9.8l-4.8 1M7.2 19.2l2.8-3.4M16.8 19.2l-2.8-3.4"
        {...common}
      />
    </Svg>
  );
}

interface BookingCardProps {
  size?: number;
  color?: string;
}

/**
 * Dommerkort — et kort er en FYLT flate, og Lucide har bare stroke-rektangler.
 * Lett helning så det leses som kortet dommeren løfter; mørk kant gir
 * definisjon mot myke gule flater (gull på solskinn måler ellers svakt).
 */
export function BookingCard({
  size = 24,
  color = colors.gold,
}: BookingCardProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={7.6}
        y={4.8}
        width={9.2}
        height={14.4}
        rx={2}
        fill={color}
        stroke={colors.goldInk}
        strokeWidth={1}
        transform="rotate(8 12 12)"
      />
    </Svg>
  );
}

/**
 * Avspark og pause som FYLTE glyfer — kampforløpets krittlinje.
 *
 * Fasiten (docs/prototypes/kampskjerm/index.html, `icoPlay`/`icoPause`) tegner
 * begge med `fill="currentColor" stroke="none"`. På en 27 pt node med 15 pt
 * ikon forsvinner en 2 pt outline-trekant nesten helt, mens ballen og
 * kameraet ved siden av leser tydelig.
 *
 * De delte Lucide-eksportene `Play`/`Pause` står bevisst URØRT: de brukes av
 * reporterknappene og av klubbetalingsloggen, der outline er riktig — én fylt
 * glyf blant fire outline-søsken ville sett ut som en feil.
 *
 * `strokeWidth` godtas og ignoreres, så de har samme propsignatur som resten
 * og kan gjenbrukes der en ikonkomponent forventes.
 */
export function PlaySolid({
  size = 24,
  color = colors.textPrimary,
}: BallIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.2 19 12 7 19.8z" fill={color} />
    </Svg>
  );
}

export function PauseSolid({
  size = 24,
  color = colors.textPrimary,
}: BallIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6.5} y={4.5} width={3.6} height={15} rx={1.2} fill={color} />
      <Rect x={13.9} y={4.5} width={3.6} height={15} rx={1.2} fill={color} />
    </Svg>
  );
}
