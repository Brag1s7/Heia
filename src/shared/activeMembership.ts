// ============================================================
// activeMembership — deterministisk valg blant flere medlemsrader.
//
// En bruker kan ha FLERE rader i samme lag: én rad per barn
// (managed_child_id, rolle 'forelder') og eventuelt én personlig
// rad (managed_child_id NULL — trener/lagleder/admin/spiller/
// supporter). CHECK-constrainten i 00007 garanterer at barne-
// rader aldri bærer adminrolle, så personens FAKTISKE rolle i
// laget bor alltid på den personlige raden når den finnes.
//
// Før denne modulen plukket TeamContext og ProfilScreen «første
// rad» (array-rekkefølgen fra PostgREST uten ORDER BY) — dermed
// var activeRole, og all isTeamAdmin-gating i appen, tilfeldig
// mellom app-starter for en trener som også er forelder.
//
// Ren modul uten imports (feedPaging-mønsteret): strukturell
// type så både EnrichedMembership og testfixturer passer.
// ============================================================

export interface MembershipRowLike {
  teamSpaceId: string;
  managedChildId?: string | null;
}

/**
 * Raden som representerer personen selv i laget: den personlige
 * raden når den finnes, ellers første barne-rad (stabil gitt at
 * kilden er sortert — getUserMemberships sorterer på joined_at, id).
 */
export function pickPrimaryMembership<T extends MembershipRowLike>(
  memberships: readonly T[],
  teamSpaceId: string | null,
): T | null {
  if (!teamSpaceId) {
    return null;
  }
  let firstInTeam: T | null = null;
  for (const m of memberships) {
    if (m.teamSpaceId !== teamSpaceId) {
      continue;
    }
    if (m.managedChildId == null) {
      return m;
    }
    if (firstInTeam === null) {
      firstInTeam = m;
    }
  }
  return firstInTeam;
}

/**
 * Én rad per lag til listeflater («Dine lag»): primærraden per
 * teamSpaceId, i lagenes første-forekomst-rekkefølge. Uten denne
 * så en forelder med to barn samme lagkort to ganger.
 */
export function uniqueTeamMemberships<T extends MembershipRowLike>(
  memberships: readonly T[],
): T[] {
  const seen: string[] = [];
  for (const m of memberships) {
    if (!seen.includes(m.teamSpaceId)) {
      seen.push(m.teamSpaceId);
    }
  }
  const out: T[] = [];
  for (const teamSpaceId of seen) {
    const primary = pickPrimaryMembership(memberships, teamSpaceId);
    if (primary !== null) {
      out.push(primary);
    }
  }
  return out;
}
