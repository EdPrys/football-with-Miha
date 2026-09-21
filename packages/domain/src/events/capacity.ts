export interface EventFormat {
  numberOfTeams: number;
  playersPerTeam: number;
}

/** Total player capacity of an event = teams × players per team. Derived, never stored. */
export function eventCapacity(format: EventFormat): number {
  return format.numberOfTeams * format.playersPerTeam;
}
