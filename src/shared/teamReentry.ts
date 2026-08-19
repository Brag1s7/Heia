// ============================================================
// teamReentry — §3a/b-portene i «forlat lag»-modellen, sett fra
// appen (docs/FORLAT-LAG-DORMANT-2026-08.md — FROSSET 2026-08-19).
//
// Serveren håndhever portene (join_team_space v4, 00067) — dette
// er UX-siden: gitt brukerens EGNE medlemsrader i et lag (egne
// rader i alle statuser er lesbare, 00066), utled hva join-flaten
// skal tilby FØR knappen trykkes. Reglene:
//
//   * SISTE EPISODE AVGJØR (§3b): nyeste rad (høyeste joinedAt,
//     id som tiebreak; rader uten joinedAt sist) — 'removed' med
//     leftReason 'removed' → avvist; 'left' → inn.
//   * GJENÅPNINGSMYNDIGHET (§3f-2): nyeste PERSONLIGE rad
//     (managedChildId null) hadde lagadminrolle og leftReason
//     'left'. Barne-rader gir aldri gjenåpningsmyndighet.
//   * Legacy-rader (før 00067) har leftReason null og backfilles
//     til 'removed' i basen — null behandles derfor som 'removed'.
//
// Ren modul uten imports (feedPaging-/activeMembership-mønsteret):
// strukturelle typer så både API-rader og testfixturer passer.
// ============================================================

export interface MembershipHistoryRow {
  id: string;
  status: 'invited' | 'active' | 'inactive' | 'removed';
  role: string;
  managedChildId: string | null;
  /** ISO-tidspunkt eller null (invited-rader fikk aldri joinedAt). */
  joinedAt: string | null;
  leftReason: 'left' | 'removed' | null;
}

export interface ReentryAssessment {
  /** Brukeren har en levende rad i laget — portene gjelder ikke. */
  resident: boolean;
  /** Siste episode var en fjerning → koden virker aldri (§3b). */
  blockedRemoved: boolean;
  /** Siste episode var en frivillig utmelding → inn, også i låst lag. */
  leftVoluntarily: boolean;
  /** Rollen «Gjenåpne laget» gjeninnsetter, eller null uten myndighet. */
  reopenRole: string | null;
}

const ADMIN_ROLES = ['trener', 'lagleder', 'admin'];

/** Nyeste rad etter §3b-regelen: joinedAt DESC NULLS LAST, id DESC. */
export function latestEpisode<T extends MembershipHistoryRow>(
  rows: readonly T[],
): T | null {
  let latest: T | null = null;
  for (const row of rows) {
    if (latest === null) {
      latest = row;
      continue;
    }
    const a = row.joinedAt;
    const b = latest.joinedAt;
    if (a !== null && b === null) {
      latest = row;
    } else if ((a === null) === (b === null)) {
      if (a !== null && b !== null && a !== b) {
        if (a > b) {
          latest = row;
        }
      } else if (row.id > latest.id) {
        latest = row;
      }
    }
  }
  return latest;
}

export function assessReentry(
  rows: readonly MembershipHistoryRow[],
): ReentryAssessment {
  const resident = rows.some(
    r => r.status === 'active' || r.status === 'invited',
  );

  const last = latestEpisode(rows);
  const lastEnded = !resident && last !== null && last.status === 'removed';
  // null = legacy-rad fra før 00067 → fjernet (backfill-beslutningen §3c).
  const blockedRemoved =
    lastEnded && (last.leftReason ?? 'removed') === 'removed';
  const leftVoluntarily = lastEnded && last.leftReason === 'left';

  const personal = latestEpisode(rows.filter(r => r.managedChildId == null));
  const reopenRole =
    !resident &&
    !blockedRemoved &&
    personal !== null &&
    personal.status === 'removed' &&
    personal.leftReason === 'left' &&
    ADMIN_ROLES.includes(personal.role)
      ? personal.role
      : null;

  return {resident, blockedRemoved, leftVoluntarily, reopenRole};
}
