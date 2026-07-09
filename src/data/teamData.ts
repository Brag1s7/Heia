import type {
  Membership,
  Team,
  TeamSpace,
  User,
  UserRole,
} from '../shared/types';
import {teamSpaces, memberships, users, teams} from '../shared/mockData';

export function getMembersForTeamSpace(
  teamSpaceId: string,
): (User & {role: UserRole})[] {
  const mships = memberships.filter(m => m.teamSpaceId === teamSpaceId);
  return mships.map(m => {
    const user = users.find(u => u.id === m.userId)!;
    return {...user, role: m.role};
  });
}

export function getMembershipsForUser(
  userId: string,
): (Membership & {teamSpace: TeamSpace; team: Team})[] {
  return memberships
    .filter(m => m.userId === userId)
    .map(m => {
      const ts = teamSpaces.find(t => t.id === m.teamSpaceId)!;
      const team = teams.find(t => t.id === ts.teamId)!;
      return {...m, teamSpace: ts, team};
    });
}

export function getUserRoleInTeam(
  userId: string,
  teamSpaceId: string,
): UserRole | null {
  const m = memberships.find(
    ms => ms.userId === userId && ms.teamSpaceId === teamSpaceId,
  );
  return m?.role ?? null;
}

export function getTeamSpaceById(teamSpaceId: string): TeamSpace | null {
  return teamSpaces.find(ts => ts.id === teamSpaceId) ?? null;
}

export function getTeamForSpace(teamSpaceId: string): Team | null {
  const ts = teamSpaces.find(t => t.id === teamSpaceId);
  if (!ts) return null;
  return teams.find(t => t.id === ts.teamId) ?? null;
}

export function getMemberCount(teamSpaceId: string): number {
  return memberships.filter(m => m.teamSpaceId === teamSpaceId).length;
}

export function getAllTeams(): Team[] {
  return teams;
}

export function getTeamSpaceForTeam(teamId: string): TeamSpace | null {
  return teamSpaces.find(ts => ts.teamId === teamId) ?? null;
}

export function activateTeam(
  teamId: string,
  userId: string,
  role: UserRole,
): {teamSpace: TeamSpace; membership: Membership} {
  const team = teams.find(t => t.id === teamId)!;
  const now = new Date();

  const newTeamSpace: TeamSpace = {
    id: `ts${teamSpaces.length + 1}`,
    teamId,
    displayName: `${team.club} ${team.teamName}`,
    color: '#6366F1',
    inviteCode: `${team.teamName.replace(/\s/g, '')}${Date.now() % 1000}`,
    isActivated: true,
    activatedAt: now,
    createdAt: now,
  };
  teamSpaces.push(newTeamSpace);

  const newMembership: Membership = {
    id: `m${memberships.length + 1}`,
    userId,
    teamSpaceId: newTeamSpace.id,
    role,
    joinedAt: now,
  };
  memberships.push(newMembership);

  return {teamSpace: newTeamSpace, membership: newMembership};
}

export function joinTeamSpace(
  teamSpaceId: string,
  userId: string,
  role: UserRole,
): Membership {
  const existing = memberships.find(
    m => m.userId === userId && m.teamSpaceId === teamSpaceId,
  );
  if (existing) return existing;

  const now = new Date();
  const newMembership: Membership = {
    id: `m${memberships.length + 1}`,
    userId,
    teamSpaceId,
    role,
    joinedAt: now,
  };
  memberships.push(newMembership);
  return newMembership;
}
