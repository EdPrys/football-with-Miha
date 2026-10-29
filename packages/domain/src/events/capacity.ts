export interface EventFormat {
  numberOfTeams: number;
  playersPerTeam: number;
}

/** Total player capacity of an event = teams × players per team. Derived, never stored. */
export function eventCapacity(format: EventFormat): number {
  return format.numberOfTeams * format.playersPerTeam;
}

/** A full game grows one team at a time up to this many (e.g. for rotation). */
export const MAX_TEAMS = 4;

/** Whether the next player can open a new team because every slot is taken. */
export function canAddTeam(event: EventFormat & { status: string }, activeCount: number): boolean {
  return (
    event.status === 'UPCOMING' &&
    event.numberOfTeams < MAX_TEAMS &&
    activeCount >= eventCapacity(event)
  );
}
