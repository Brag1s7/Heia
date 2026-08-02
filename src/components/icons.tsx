import React from 'react';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {colors} from '../theme';

/**
 * Appens ikonsett — Lucide (stroke 2, runde ender), samlet på ETT sted så
 * skjermene aldri importerer lucide direkte. Vil du ha et nytt ikon: legg det
 * til her, ikke i skjermen.
 */
export {
  ArrowLeftRight,
  Bell,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  HandHeart,
  House,
  Image as ImageIcon,
  Info,
  LogOut,
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
  UserPlus,
  Users,
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
