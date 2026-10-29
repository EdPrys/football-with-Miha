import type {
  EventParticipant,
  EventStatus,
  ParticipantStatus,
  Position,
  PrismaClient,
} from '@app/db';
import { DomainError } from '../errors.js';
import { canAddTeam, eventCapacity, MAX_TEAMS } from './capacity.js';
import { teamNames } from './team-names.js';

const ACTIVE_STATUSES: ParticipantStatus[] = ['JOINED', 'ATTENDED'];

/** Every team has exactly one goalkeeper slot; everyone else is an outfield player. */
export const GOALKEEPERS_PER_TEAM = 1;
/** Position stored for outfield players now that lines (DEF/MID/FWD) aren't picked. */
export const OUTFIELD_POSITION: Position = 'MID';

interface LockedEvent {
  id: string;
  status: EventStatus;
  numberOfTeams: number;
  playersPerTeam: number;
}

export interface JoinGuardContext {
  status: EventStatus;
  capacity: number;
  activeCount: number; // active participants NOT counting this user
  alreadyActive: boolean; // this user already holds an active slot
}

/** Pure invariant check for joining an event. Throws on violation. */
export function assertJoinable(ctx: JoinGuardContext): void {
  if (ctx.alreadyActive) {
    throw new DomainError('CONFLICT', 'You have already joined this event');
  }
  if (ctx.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Event is not open for joining');
  }
  if (ctx.activeCount >= ctx.capacity) {
    throw new DomainError('INVALID_STATE', 'Event is full');
  }
}

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Adds the next team ("Team C", "Team D") to a full game and returns its id.
 * Runs under the event row lock, so two players can't open two teams at once.
 */
async function openNextTeam(tx: Tx, event: LockedEvent, userId: string): Promise<string> {
  if (event.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Event is not open for joining');
  }
  const activeCount = await tx.eventParticipant.count({
    where: { eventId: event.id, status: { in: ACTIVE_STATUSES }, userId: { not: userId } },
  });
  if (event.numberOfTeams >= MAX_TEAMS) {
    throw new DomainError('INVALID_STATE', 'This game already has the maximum number of teams');
  }
  if (!canAddTeam(event, activeCount)) {
    throw new DomainError('INVALID_STATE', 'There are still free places in the current teams');
  }
  const name = teamNames(event.numberOfTeams + 1).at(-1)!;
  const team = await tx.team.create({ data: { eventId: event.id, name } });
  await tx.event.update({
    where: { id: event.id },
    data: { numberOfTeams: event.numberOfTeams + 1 },
  });
  return team.id;
}

export interface JoinInput {
  eventId: string;
  userId: string;
  position: Position;
  teamId?: string | null; // pick a specific team's slot on the pitch
  newTeam?: boolean; // every slot is taken: open the next team and join it
}

/**
 * Join an event atomically. When a teamId is given (picking a slot on the pitch)
 * we also validate the team belongs to the event and isn't already full.
 * A user who previously left re-activates their existing row.
 *
 * `SELECT ... FOR UPDATE` locks the event row for the transaction's
 * duration, serializing concurrent joins to the same event. Without it,
 * two requests racing for the last slot would both read the same
 * capacity/team-full COUNT under Postgres's default Read Committed
 * isolation and both pass — overbooking the event or a team.
 */
export async function joinEvent(prisma: PrismaClient, input: JoinInput): Promise<EventParticipant> {
  return prisma.$transaction(async (tx) => {
    const [event] = await tx.$queryRaw<LockedEvent[]>`
      SELECT id, status, "numberOfTeams", "playersPerTeam"
      FROM "Event" WHERE id = ${input.eventId} FOR UPDATE
    `;
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

    let teamId = input.teamId ?? null;
    if (input.newTeam) {
      teamId = await openNextTeam(tx, event, input.userId);
      event.numberOfTeams += 1;
    } else if (teamId != null) {
      const team = await tx.team.findFirst({
        where: { id: teamId, eventId: input.eventId },
        select: { id: true },
      });
      if (!team) throw new DomainError('VALIDATION', 'Team does not belong to this event');

      const teamCount = await tx.eventParticipant.count({
        where: {
          eventId: input.eventId,
          teamId,
          status: { in: ACTIVE_STATUSES },
          userId: { not: input.userId },
        },
      });
      if (teamCount >= event.playersPerTeam) {
        throw new DomainError('INVALID_STATE', 'This team is full');
      }

      if (input.position === 'GK') {
        const keepers = await tx.eventParticipant.count({
          where: {
            eventId: input.eventId,
            teamId,
            preferredPosition: 'GK',
            status: { in: ACTIVE_STATUSES },
            userId: { not: input.userId },
          },
        });
        if (keepers >= GOALKEEPERS_PER_TEAM) {
          throw new DomainError('INVALID_STATE', 'This team already has a goalkeeper');
        }
      }
    }

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
    });
    const alreadyActive = !!existing && ACTIVE_STATUSES.includes(existing.status);

    const activeCount = await tx.eventParticipant.count({
      where: {
        eventId: input.eventId,
        status: { in: ACTIVE_STATUSES },
        userId: { not: input.userId },
      },
    });

    assertJoinable({
      status: event.status,
      capacity: eventCapacity(event),
      activeCount,
      alreadyActive,
    });

    const data = {
      status: 'JOINED' as const,
      preferredPosition: input.position,
      teamId,
    };

    if (existing) {
      return tx.eventParticipant.update({ where: { id: existing.id }, data });
    }
    return tx.eventParticipant.create({
      data: { eventId: input.eventId, userId: input.userId, ...data },
    });
  });
}
