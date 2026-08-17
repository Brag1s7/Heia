import {useQuery} from '@tanstack/react-query';
import {queryClient} from './queryClient';
import {queryKeys} from './keys';
// Direkte fil-import, ikke api-barrelen: comments.ts (i barrelen) importerer
// denne modulen tilbake, og barrel-veien ville gitt en importsirkel.
import {getTeamMembers, type TeamMember} from '../api/members';

/**
 * Medlemslisten endrer seg sjelden (noen inn/ut per sesong) men leses
 * fra mange flater — den mest åpenbare staleTime-gevinsten i B2.
 */
const MEMBERS_STALE_MS = 5 * 60_000;

/** Lagets medlemmer via query-cachen — for skjermene. */
export function useTeamMembers(teamSpaceId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members(teamSpaceId ?? ''),
    queryFn: () => getTeamMembers(teamSpaceId as string),
    staleTime: MEMBERS_STALE_MS,
    enabled: !!teamSpaceId,
  });
}

/**
 * Samme cache, imperativt — for api-laget (comments.ts' medlems-map) og
 * andre ikke-React-kallsteder. `ensureQueryData` deduper parallelle kall
 * (getFeedPost + getComments åpner kommentartråden med to samtidige
 * medlemshentinger i dag) og gjenbruker ferske data.
 */
export function fetchTeamMembersCached(
  teamSpaceId: string,
): Promise<TeamMember[]> {
  return queryClient.ensureQueryData({
    queryKey: queryKeys.members(teamSpaceId),
    queryFn: () => getTeamMembers(teamSpaceId),
    staleTime: MEMBERS_STALE_MS,
  });
}

/** Etter medlemsmutasjoner (rollebytte, fjerning) — tving fersk henting. */
export function invalidateTeamMembers(teamSpaceId: string): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.members(teamSpaceId),
  });
}
