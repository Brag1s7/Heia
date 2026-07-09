import type {Team, TeamSpace, Membership, User} from './types';

// ---------------------------------------------------------------------------
// Brukere (rolle er nå per membership, ikke per bruker)
// ---------------------------------------------------------------------------
export const users: User[] = [
  {id: 'u1', name: 'Marte Johansen'},
  {id: 'u2', name: 'Henrik Solvang'},
  {id: 'u3', name: 'Sofie Berg'},
  {id: 'u4', name: 'Erlend Haugen'},
  {id: 'u5', name: 'Ingrid Nordli'},
  {id: 'u6', name: 'Thomas Bakke'},
  {id: 'u7', name: 'Camilla Strand'},
  {id: 'u8', name: 'Andreas Vik'},
  {id: 'u9', name: 'Kristin Dale'},
  {id: 'u10', name: 'Lars Moen'},
  {id: 'u11', name: 'Hilde Lund'},
  {id: 'u12', name: 'Ole Martin Skår'},
  {id: 'u13', name: 'Ragnhild Fjeld'},
  {id: 'u14', name: 'Eirik Brekke'},
  {id: 'u15', name: 'Silje Aas'},
];

// ---------------------------------------------------------------------------
// Kanoniske lag (finnes i den virkelige verden)
// ---------------------------------------------------------------------------
export const teams: Team[] = [
  {
    id: 'team1',
    club: 'Fjellørn FK',
    teamName: 'G13',
    sport: 'fotball',
    ageGroup: 'Gutter 13 år',
  },
  {
    id: 'team2',
    club: 'Fjellørn FK',
    teamName: 'G10',
    sport: 'fotball',
    ageGroup: 'Gutter 10 år',
  },
  {
    id: 'team3',
    club: 'Lyn SK',
    teamName: 'J14',
    sport: 'fotball',
    ageGroup: 'Jenter 14 år',
  },
];

// ---------------------------------------------------------------------------
// Lagrom (Heia-rom — aktivert i appen)
// ---------------------------------------------------------------------------
export const teamSpaces: TeamSpace[] = [
  {
    id: 'ts1',
    teamId: 'team1',
    displayName: 'Fjellørn G13',
    color: '#2563EB',
    inviteCode: 'FJG13',
    isActivated: true,
    activatedAt: new Date('2025-08-15'),
    createdAt: new Date('2025-08-15'),
  },
  {
    id: 'ts2',
    teamId: 'team2',
    displayName: 'Fjellørn G10',
    color: '#DC2626',
    inviteCode: 'FJG10',
    isActivated: true,
    activatedAt: new Date('2025-09-01'),
    createdAt: new Date('2025-09-01'),
  },
];

// ---------------------------------------------------------------------------
// Medlemskap (kobling bruker ↔ lagrom, rolle per lag)
// ---------------------------------------------------------------------------
export const memberships: Membership[] = [
  // Marte — forelder i G13 og G10 (to barn)
  {
    id: 'm1',
    userId: 'u1',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-15'),
  },
  {
    id: 'm2',
    userId: 'u1',
    teamSpaceId: 'ts2',
    role: 'forelder',
    joinedAt: new Date('2025-09-01'),
  },
  // Henrik — trener i G13
  {
    id: 'm3',
    userId: 'u2',
    teamSpaceId: 'ts1',
    role: 'trener',
    joinedAt: new Date('2025-08-15'),
  },
  // Sofie — forelder i G13
  {
    id: 'm4',
    userId: 'u3',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-16'),
  },
  // Erlend — forelder i G13 og trener i G10
  {
    id: 'm5',
    userId: 'u4',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-16'),
  },
  {
    id: 'm6',
    userId: 'u4',
    teamSpaceId: 'ts2',
    role: 'trener',
    joinedAt: new Date('2025-09-01'),
  },
  // Resten — foreldre i G13
  {
    id: 'm7',
    userId: 'u5',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-17'),
  },
  {
    id: 'm8',
    userId: 'u6',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-17'),
  },
  {
    id: 'm9',
    userId: 'u7',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-18'),
  },
  {
    id: 'm10',
    userId: 'u8',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-18'),
  },
  {
    id: 'm11',
    userId: 'u9',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-19'),
  },
  {
    id: 'm12',
    userId: 'u10',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-19'),
  },
  {
    id: 'm13',
    userId: 'u11',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-20'),
  },
  {
    id: 'm14',
    userId: 'u12',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-20'),
  },
  {
    id: 'm15',
    userId: 'u13',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-21'),
  },
  {
    id: 'm16',
    userId: 'u14',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-21'),
  },
  {
    id: 'm17',
    userId: 'u15',
    teamSpaceId: 'ts1',
    role: 'forelder',
    joinedAt: new Date('2025-08-22'),
  },
  // Noen foreldre i G10 også
  {
    id: 'm18',
    userId: 'u3',
    teamSpaceId: 'ts2',
    role: 'forelder',
    joinedAt: new Date('2025-09-02'),
  },
  {
    id: 'm19',
    userId: 'u5',
    teamSpaceId: 'ts2',
    role: 'forelder',
    joinedAt: new Date('2025-09-02'),
  },
  {
    id: 'm20',
    userId: 'u7',
    teamSpaceId: 'ts2',
    role: 'forelder',
    joinedAt: new Date('2025-09-03'),
  },
  {
    id: 'm21',
    userId: 'u9',
    teamSpaceId: 'ts2',
    role: 'forelder',
    joinedAt: new Date('2025-09-03'),
  },
];
