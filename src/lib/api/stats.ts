import {supabase} from '../supabase';

/** 1 = vår (jan–jun), 2 = høst (jul–des). */
export type SeasonHalf = 1 | 2;

/** Et halvår i sesongvelgeren, f.eks. {year: 2026, half: 2, label: 'Høst 2026'}. */
export interface SeasonRef {
  year: number;
  half: SeasonHalf;
  label: string;
}

/** En turnering i velgeren — sidestilt med halvårene. */
export interface TournamentRef {
  id: string;
  title: string;
}

/** Hva sesongflaten viser: et halvår eller én turnering. */
export type SeasonView =
  | {kind: 'half'; year: number; half: SeasonHalf}
  | {kind: 'tournament'; id: string};

export interface SeasonMatch {
  eventId: string;
  title: string;
  opponent: string;
  /** Alltid oss/dem, uavhengig av isHome — samme tolkning som mapEventRow. */
  home: number;
  away: number;
  isHome: boolean;
  startTime: Date;
  /** Turneringens navn når kampen ble spilt i en — grupperer listen. */
  tournament?: string;
}

export interface SeasonStats {
  /** Satt i halvårsvisning; fraværende når en turnering vises. */
  seasonYear?: number;
  seasonHalf?: SeasonHalf;
  /** «Vårsesongen 2026» eller turneringens navn — heroens egen etikett. */
  seasonLabel: string;
  /** Satt når en turnering vises. */
  tournament?: TournamentRef;
  /** Halvår med spilte kamper + inneværende, nyeste først (velgerlisten). */
  seasons: SeasonRef[];
  /** Alle lagets turneringer, nyeste først (velgerlisten). */
  tournaments: TournamentRef[];
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Ferdigspilte kamper i halvåret, nyeste først. */
  matches: SeasonMatch[];
}

/**
 * Sesongtallene via `get_season_stats` (SECURITY DEFINER). Én RPC fordi
 * totalene og resultatlisten må telle nøyaktig de samme kampene — to
 * klientspørringer kunne kommet ut av synk med hverandre.
 *
 * Sesong = vår (jan–jun) eller høst (jul–des). Halvår er sport-nøytralt og
 * krever null oppsett: fotball teller kalenderåret som vår + høst, og
 * hallidrettenes 26/27-sesong ER en høstdel + en vårdel. Uten `season`
 * svarer serveren med inneværende halvår.
 *
 * Ingen toppscorere — LÅST (bruker, 2026-07-30): ingen spillerstatistikk før
 * en strukturert spillerstall finnes.
 */
export async function getSeasonStats(
  teamSpaceId: string,
  view?: SeasonView,
): Promise<SeasonStats> {
  const {data, error} = await supabase.rpc('get_season_stats', {
    space_id: teamSpaceId,
    p_year: view?.kind === 'half' ? view.year : null,
    p_half: view?.kind === 'half' ? view.half : null,
    p_tournament: view?.kind === 'tournament' ? view.id : null,
  });

  if (error) {
    throw error;
  }

  const raw = (data ?? {}) as any;

  return {
    seasonYear: raw.season_year != null ? Number(raw.season_year) : undefined,
    seasonHalf:
      raw.season_half != null
        ? ((Number(raw.season_half) === 2 ? 2 : 1) as SeasonHalf)
        : undefined,
    seasonLabel: String(raw.season_label ?? 'Sesongen'),
    tournament: raw.tournament
      ? {id: String(raw.tournament.id), title: String(raw.tournament.title)}
      : undefined,
    seasons: ((raw.seasons ?? []) as any[]).map(s => ({
      year: Number(s.year),
      half: (Number(s.half) === 2 ? 2 : 1) as SeasonHalf,
      label: String(s.label),
    })),
    tournaments: ((raw.tournaments ?? []) as any[]).map(t => ({
      id: String(t.id),
      title: String(t.title),
    })),
    played: Number(raw.played ?? 0),
    wins: Number(raw.wins ?? 0),
    draws: Number(raw.draws ?? 0),
    losses: Number(raw.losses ?? 0),
    goalsFor: Number(raw.goals_for ?? 0),
    goalsAgainst: Number(raw.goals_against ?? 0),
    matches: ((raw.matches ?? []) as any[]).map(m => ({
      eventId: m.event_id as string,
      title: (m.title as string) ?? '',
      opponent: (m.opponent as string) ?? 'motstanderen',
      home: Number(m.home ?? 0),
      away: Number(m.away ?? 0),
      isHome: Boolean(m.is_home),
      startTime: new Date(m.start_time),
      tournament: (m.tournament as string | null) ?? undefined,
    })),
  };
}
