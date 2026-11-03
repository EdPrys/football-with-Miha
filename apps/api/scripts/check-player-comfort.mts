// Run only against a disposable local database migrated from scratch; see docs/PLAYER_COMFORT.md.
import assert from 'node:assert/strict';
const testUrl = process.env.INTEGRATION_DATABASE_URL;
assert.ok(
  testUrl,
  'Set INTEGRATION_DATABASE_URL to a disposable local kopanka_comfort_test* database',
);
const parsed = new URL(testUrl);
assert.ok(
  ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
    parsed.pathname.startsWith('/kopanka_comfort_test'),
  'Refusing a nonlocal/non-test database',
);
process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET = 'local-comfort-integration-only';
process.env.NODE_ENV = 'test';
const { prisma } = await import('../../../packages/db/src/index.js');
const {
  createEvent,
  joinEvent,
  leaveEvent,
  setEventWaitlist,
  setGameReminder,
  sendGameReminders,
  updateOrganizerContacts,
} = await import('../../../packages/domain/src/index.js');
const { appRouter } = await import('../src/routers/index.js');
const suffix = `${Date.now()}@comfort.example.test`;
let venueId: string | undefined;
try {
  const organizer = await prisma.user.create({
    data: {
      name: 'Organizer',
      email: `organizer-${suffix}`,
      passwordHash: 'unused',
      role: 'MANAGER',
    },
  });
  const players = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      prisma.user.create({
        data: { name: `Player ${i}`, email: `player${i}-${suffix}`, passwordHash: 'unused' },
      }),
    ),
  );
  const venue = await prisma.venue.create({
    data: { name: 'Comfort test', cityId: 'kyiv', fields: { create: { name: 'Pitch' } } },
    include: { fields: true },
  });
  venueId = venue.id;
  const startAt = new Date(Date.now() + 3 * 3600_000);
  const event = await createEvent(prisma, {
    organizerId: organizer.id,
    fieldId: venue.fields[0]!.id,
    startAt,
    endAt: new Date(+startAt + 3600_000),
    numberOfTeams: 2,
    playersPerTeam: 2,
    organizerTelegram: '@kopanka_game',
  });
  const teams = await prisma.team.findMany({
    where: { eventId: event.id },
    orderBy: { name: 'asc' },
  });
  for (let i = 0; i < 4; i++)
    await joinEvent(prisma, {
      eventId: event.id,
      userId: players[i]!.id,
      position: i % 2 ? 'MID' : 'GK',
      teamId: teams[Math.floor(i / 2)]!.id,
    });
  for (const player of players.slice(4)) {
    await setEventWaitlist(prisma, event.id, player.id, true);
    await setEventWaitlist(prisma, event.id, player.id, true);
  }
  assert.equal(await prisma.eventWaitlist.count({ where: { eventId: event.id } }), 2);
  await assert.rejects(setEventWaitlist(prisma, event.id, players[0]!.id, true));
  await leaveEvent(prisma, { eventId: event.id, userId: players[1]!.id });
  assert.equal(await prisma.notification.count({ where: { type: 'SLOT_AVAILABLE' } }), 2);
  // Two players race for the one freed outfield place. Exactly one succeeds.
  const race = await Promise.allSettled(
    players
      .slice(4)
      .map((player) =>
        joinEvent(prisma, {
          eventId: event.id,
          userId: player.id,
          teamId: teams[0]!.id,
          position: 'MID',
        }),
      ),
  );
  assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    await prisma.eventParticipant.count({ where: { eventId: event.id, status: 'JOINED' } }),
    4,
  );
  const winnerIndex = race.findIndex((result) => result.status === 'fulfilled');
  const winner = players[4 + winnerIndex]!;
  assert.equal(
    await prisma.eventWaitlist.count({ where: { eventId: event.id, userId: winner.id } }),
    0,
  );
  await setGameReminder(prisma, event.id, winner.id, true);
  const other = players[4 + (1 - winnerIndex)]!;
  await assert.rejects(setGameReminder(prisma, event.id, other.id, true));
  // Run two schedulers concurrently at 30 minutes to kickoff. One alert, one claim.
  const now = new Date(+startAt - 30 * 60_000);
  const reminders = await Promise.all([
    sendGameReminders(prisma, now),
    sendGameReminders(prisma, now),
  ]);
  assert.equal(
    reminders.reduce((a, b) => a + b, 0),
    1,
  );
  assert.equal(
    await prisma.notification.count({ where: { type: 'EVENT_APPROACHING', userId: winner.id } }),
    1,
  );
  await setGameReminder(prisma, event.id, winner.id, false);
  await setGameReminder(prisma, event.id, winner.id, true);
  assert.equal(await sendGameReminders(prisma, now), 0);
  await assert.rejects(updateOrganizerContacts(prisma, event.id, other.id, null, 'different_user'));
  const publicCaller = appRouter.createCaller({ prisma, user: null });
  const publicDetail = await publicCaller.events.get({ id: event.id });
  assert.equal(publicDetail.organizerTelegram, 'kopanka_game');
  assert.ok(
    publicDetail.participants.every(
      (participant) => !('remindBeforeGame' in participant) && !('reminderSentAt' in participant),
    ),
  );
  const privateCaller = appRouter.createCaller({ prisma, user: winner });
  assert.equal(
    (await privateCaller.events.myState({ eventId: event.id })).participant?.remindBeforeGame,
    true,
  );
  console.log(
    'PASS: real PostgreSQL waitlist idempotency, vacancy notifications, concurrent last-slot joins, concurrent reminder deduplication, opt-in, contact ownership and API privacy',
  );
} finally {
  if (venueId) {
    const fields = await prisma.field.findMany({ where: { venueId }, select: { id: true } });
    await prisma.event.deleteMany({ where: { fieldId: { in: fields.map((field) => field.id) } } });
    await prisma.venue.delete({ where: { id: venueId } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } });
  await prisma.$disconnect();
}
