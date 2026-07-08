import type {
  Team,
  TeamSpace,
  Membership,
  HeiaEvent,
  User,
  FeedItem,
  MatchEvent,
} from './types';

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

// ---------------------------------------------------------------------------
// Hjelpefunksjon for datoer relative til "nå"
// ---------------------------------------------------------------------------
function daysFromNow(days: number, hour: number, minute: number = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Live kamp-hendelser (G13)
// ---------------------------------------------------------------------------
export const liveMatchEvents: MatchEvent[] = [
  {
    id: 'me1',
    matchId: 'e2',
    type: 'avspark',
    minute: 0,
    description: 'Kampen er i gang!',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 11, 0),
  },
  {
    id: 'me2',
    matchId: 'e2',
    type: 'mål',
    minute: 8,
    player: 'Erlend H.',
    description: 'Erlend H. scorer på en flott heading! 1-0 til Fjellørn!',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 11, 8),
  },
  {
    id: 'me3',
    matchId: 'e2',
    type: 'mål',
    minute: 23,
    player: 'Oliver K.',
    description: 'Lyn utligner med et langskudd. 1-1.',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 11, 23),
  },
  {
    id: 'me4',
    matchId: 'e2',
    type: 'pause',
    minute: 30,
    description: 'Pause. Stillingen er 1-1.',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 11, 30),
  },
  {
    id: 'me5',
    matchId: 'e2',
    type: 'andre_omgang',
    minute: 30,
    description: 'Andre omgang er i gang!',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 11, 45),
  },
  {
    id: 'me6',
    matchId: 'e2',
    type: 'mål',
    minute: 52,
    player: 'Sofie B. jr.',
    description: 'MÅL! Sofie B. jr. med et kremmål! 2-1 til Fjellørn!',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 12, 7),
  },
  {
    id: 'me7',
    matchId: 'e2',
    type: 'bytte',
    minute: 55,
    player: 'Thomas B.',
    description: 'Bytte: Thomas B. inn for Magnus L.',
    reportedBy: 'u2',
    createdAt: daysFromNow(0, 12, 10),
  },
];

// ---------------------------------------------------------------------------
// Hendelser — G13 (ts1)
// ---------------------------------------------------------------------------
const eventsTs1: HeiaEvent[] = [
  {
    id: 'e1',
    teamSpaceId: 'ts1',
    type: 'trening',
    title: 'Trening',
    startTime: daysFromNow(1, 17, 0),
    endTime: daysFromNow(1, 18, 30),
    location: 'Nadderud kunstgress',
    description: 'Vanlig trening. Husk leggskinn og vannflaske!',
    rsvp: {
      coming: 10,
      notComing: 2,
      pending: 3,
      myStatus: 'venter',
    },
  },
  {
    id: 'e2',
    teamSpaceId: 'ts1',
    type: 'kamp',
    title: 'Kamp vs. Lyn G13',
    startTime: daysFromNow(0, 11, 0),
    endTime: daysFromNow(0, 12, 30),
    location: 'Bislett stadion, bane 2',
    description:
      'Seriekamp! Oppmøte senest 10:30. Ta med begge draktsett (hvit + blå).',
    opponent: 'Lyn G13',
    matchStatus: 'live',
    score: {home: 2, away: 1},
    matchEvents: liveMatchEvents,
    reporterId: 'u2',
    rsvp: {
      coming: 12,
      notComing: 1,
      pending: 2,
      myStatus: 'venter',
    },
  },
  {
    id: 'e3',
    teamSpaceId: 'ts1',
    type: 'sosialt',
    title: 'Lagkveld med pizza',
    startTime: daysFromNow(8, 18, 0),
    endTime: daysFromNow(8, 20, 0),
    location: 'Klubbhuset',
    description:
      'Sesongavslutning! Pizza og brus. Foreldre er velkomne. Ta med godt humør!',
    rsvp: {
      coming: 8,
      notComing: 0,
      pending: 7,
      myStatus: 'venter',
    },
  },
];

// ---------------------------------------------------------------------------
// Hendelser — G10 (ts2)
// ---------------------------------------------------------------------------
const eventsTs2: HeiaEvent[] = [
  {
    id: 'e4',
    teamSpaceId: 'ts2',
    type: 'trening',
    title: 'Trening',
    startTime: daysFromNow(2, 16, 0),
    endTime: daysFromNow(2, 17, 30),
    location: 'Fjellørn kunstgress',
    description: 'Fokus på teknikk og ballkontroll. Husk drikkeflaske!',
    rsvp: {
      coming: 7,
      notComing: 1,
      pending: 2,
      myStatus: 'venter',
    },
  },
  {
    id: 'e5',
    teamSpaceId: 'ts2',
    type: 'kamp',
    title: 'Kamp vs. Stabæk G10',
    startTime: daysFromNow(5, 10, 0),
    endTime: daysFromNow(5, 11, 30),
    location: 'Nadderud stadion',
    description: 'Treningskamp. Alle spiller minst en omgang.',
    opponent: 'Stabæk G10',
    matchStatus: 'upcoming',
    rsvp: {
      coming: 8,
      notComing: 0,
      pending: 2,
      myStatus: 'venter',
    },
  },
];

export const events: HeiaEvent[] = [...eventsTs1, ...eventsTs2];

// ---------------------------------------------------------------------------
// RSVP-lister for event-detalj
// ---------------------------------------------------------------------------
export const eventAttendees: Record<
  string,
  {coming: User[]; notComing: User[]; pending: User[]}
> = {
  e1: {
    coming: users.filter(u =>
      ['u1', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u2'].includes(
        u.id,
      ),
    ),
    notComing: users.filter(u => ['u11', 'u12'].includes(u.id)),
    pending: users.filter(u => ['u13', 'u14', 'u15'].includes(u.id)),
  },
  e2: {
    coming: users.filter(u =>
      [
        'u2',
        'u3',
        'u4',
        'u5',
        'u6',
        'u7',
        'u8',
        'u9',
        'u10',
        'u11',
        'u13',
        'u14',
      ].includes(u.id),
    ),
    notComing: users.filter(u => ['u12'].includes(u.id)),
    pending: users.filter(u => ['u1', 'u15'].includes(u.id)),
  },
  e4: {
    coming: users.filter(u =>
      ['u1', 'u3', 'u4', 'u5', 'u7', 'u9'].includes(u.id),
    ),
    notComing: users.filter(u => ['u1'].includes(u.id)),
    pending: users.filter(u => ['u3', 'u5'].includes(u.id)),
  },
};

// ---------------------------------------------------------------------------
// Feed — G13 (ts1)
// ---------------------------------------------------------------------------
const feedTs1: FeedItem[] = [
  {
    id: 'f_me6',
    teamSpaceId: 'ts1',
    type: 'match_event',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(0, 12, 7),
    content: 'MÅL! Sofie B. jr. med et kremmål! 2-1 til Fjellørn!',
    matchEvent: liveMatchEvents[5],
    eventId: 'e2',
  },
  {
    id: 'f_me4',
    teamSpaceId: 'ts1',
    type: 'match_event',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(0, 11, 30),
    content: 'Pause. Stillingen er 1-1.',
    matchEvent: liveMatchEvents[3],
    eventId: 'e2',
  },
  {
    id: 'f_me2',
    teamSpaceId: 'ts1',
    type: 'match_event',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(0, 11, 8),
    content: 'Erlend H. scorer på en flott heading! 1-0 til Fjellørn!',
    matchEvent: liveMatchEvents[1],
    eventId: 'e2',
  },
  {
    id: 'f1',
    teamSpaceId: 'ts1',
    type: 'melding',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(0, 9, 15),
    content:
      'Hei alle sammen! Husk trening i morgen kl 17. Vi jobber med pasninger og avslutninger. Ta med vannflaske!',
  },
  {
    id: 'f2',
    teamSpaceId: 'ts1',
    type: 'bilde',
    author: {...users[2], role: 'forelder'},
    createdAt: daysFromNow(-1, 18, 45),
    content: 'For en kamp i dag! Gutta ga alt. Stolt lagmamma her!',
    imageUrl: 'https://picsum.photos/seed/heia1/400/300',
  },
  {
    id: 'f3',
    teamSpaceId: 'ts1',
    type: 'paaminnelse',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(-2, 20, 0),
    content:
      'Påminnelse: Seriekamp mot Lyn på lørdag! Oppmøte 10:30 på Bislett. Hvem kan kjøre?',
  },
  {
    id: 'f4',
    teamSpaceId: 'ts1',
    type: 'melding',
    author: {...users[3], role: 'forelder'},
    createdAt: daysFromNow(-3, 12, 30),
    content:
      'Noen som vil dele på kjøring til kampen? Har plass til 3 i bilen.',
  },
  {
    id: 'f5',
    teamSpaceId: 'ts1',
    type: 'resultat',
    author: {...users[1], role: 'trener'},
    createdAt: daysFromNow(-5, 14, 0),
    content:
      'Fjellørn G13 3 - 1 Grei G13. Fantastisk innsats av hele laget! Erlend med to mål og Sofie junior med et kremmål.',
  },
];

// ---------------------------------------------------------------------------
// Feed — G10 (ts2)
// ---------------------------------------------------------------------------
const feedTs2: FeedItem[] = [
  {
    id: 'f6',
    teamSpaceId: 'ts2',
    type: 'melding',
    author: {...users[3], role: 'trener'},
    createdAt: daysFromNow(0, 8, 0),
    content:
      'God morgen! Trening på onsdag er flyttet til kl 16:00 pga. banebytte. Spread the word!',
  },
  {
    id: 'f7',
    teamSpaceId: 'ts2',
    type: 'paaminnelse',
    author: {...users[3], role: 'trener'},
    createdAt: daysFromNow(-1, 19, 0),
    content:
      'Husk treningskamp mot Stabæk neste helg! Alle som kan spille, meld dere på.',
  },
  {
    id: 'f8',
    teamSpaceId: 'ts2',
    type: 'bilde',
    author: {...users[0], role: 'forelder'},
    createdAt: daysFromNow(-2, 17, 30),
    content: 'Ny drakt til gutta! Ser tøffe ut 🔴',
    imageUrl: 'https://picsum.photos/seed/heia2/400/300',
  },
];

export const feedItems: FeedItem[] = [...feedTs1, ...feedTs2];

