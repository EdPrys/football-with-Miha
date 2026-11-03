/** Full application journey with synthetic accounts and real HTTP/tRPC/auth/Postgres.
 * Only the transport socket is replaced by Fastify.inject; resolvers and DB are real.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import superjson from 'superjson';
import jwt from 'jsonwebtoken';
import type { AppRouter } from '../src/routers/index.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
assert.ok(
  databaseUrl,
  'Set INTEGRATION_DATABASE_URL to a disposable local kopanka_journey_test* database',
);
const database = new URL(databaseUrl);
assert.ok(
  ['localhost', '127.0.0.1'].includes(database.hostname) &&
    database.pathname.startsWith('/kopanka_journey_test'),
  'Refusing to run against a nonlocal/non-test database',
);
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'local-full-journey-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_CHAT_ID = '';
for (const key of [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'PUBLIC_API_URL',
])
  process.env[key] = '';
const { prisma } = await import('../../../packages/db/src/index.js');
const { buildServer } = await import('../src/server.js');
const { sendGameReminders, finishOverdueEvents, resolveDueMvps } =
  await import('../../../packages/domain/src/index.js');
const app = buildServer();
app.log.level = 'silent';
const started = Date.now();
let httpRequests = 0,
  expectedErrors = 0,
  gamesCreated = 0;
const steps: { name: string; status: 'passed' | 'failed'; milliseconds: number; error?: string }[] =
  [];
const password = 'KopankaTest123';
const privateValues = [password];
function redact(message: string) {
  return privateValues.reduce(
    (text, value) => (value ? text.split(value).join('[redacted]') : text),
    message,
  );
}
function client(token?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://kopanka.test/trpc',
        transformer: superjson,
        headers: () => (token ? { authorization: `Bearer ${token}` } : {}),
        fetch: async (url, options) => {
          httpRequests++;
          const target = new URL(String(url));
          const headers = Object.fromEntries(new Headers(options?.headers));
          assert.ok(!options?.body || typeof options.body === 'string', 'Unexpected non-JSON body');
          const method = options?.method?.toUpperCase() ?? 'GET';
          assert.ok(method === 'GET' || method === 'POST', 'Unexpected RPC HTTP method');
          const response = await app.inject({
            method,
            url: target.pathname + target.search,
            headers,
            payload: options?.body as string | undefined,
          });
          const resultHeaders = new Headers();
          for (const [name, value] of Object.entries(response.headers))
            if (value !== undefined)
              resultHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
          return new Response(new Uint8Array(response.rawPayload), {
            status: response.statusCode,
            headers: resultHeaders,
          });
        },
      }),
    ],
  });
}
async function denied(operation: Promise<unknown>, code: string | string[]) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof TRPCClientError, 'Expected a serialized tRPC error');
    const actual = (error as TRPCClientError<AppRouter>).data?.code;
    assert.ok(
      (Array.isArray(code) ? code : [code]).includes(actual ?? ''),
      `Expected ${code}, got ${actual}: ${redact(error.message)}`,
    );
    expectedErrors++;
    return true;
  });
}
async function check(name: string, run: () => Promise<void>) {
  const before = Date.now();
  try {
    await run();
    steps.push({ name, status: 'passed', milliseconds: Date.now() - before });
    console.log(`PASS ${steps.length}: ${name}`);
  } catch (error) {
    steps.push({
      name,
      status: 'failed',
      milliseconds: Date.now() - before,
      error: redact(error instanceof Error ? error.message : String(error)),
    });
    throw error;
  }
}
const suffix = `${Date.now()}@journey.example.test`;
const guest = client();
type Actor = { id: string; email: string; token: string; api: ReturnType<typeof client> };
let organizer: Actor;
let admin: Actor;
const players: Actor[] = [];
let eventId = '',
  fieldId = '',
  venueId = '',
  repeatedId = '';
let winner: Actor, waiting: Actor;
const kickoff = new Date(Date.now() + 3 * 3600_000);
const baseGame = () => ({
  fieldId,
  startAt: kickoff,
  endAt: new Date(+kickoff + 3600_000),
  numberOfTeams: 2,
  playersPerTeam: 2,
});
let teamA = '',
  teamB = '';
let failed = false;
let ownsFixtures = false;
let actorsCreated = 0;
async function register(label: string): Promise<Actor> {
  const email = `${label}-${suffix}`;
  const result = await guest.auth.register.mutate({ name: label, email, password });
  actorsCreated++;
  privateValues.push(result.token);
  assert.equal(result.user.role, 'PLAYER');
  assert.equal('passwordHash' in result.user, false);
  return { id: result.user.id, email, token: result.token, api: client(result.token) };
}
async function create(data: Parameters<typeof organizer.api.events.create.mutate>[0]) {
  const result = await organizer.api.events.create.mutate(data);
  gamesCreated++;
  return result;
}
try {
  // This script is deliberately scoped to a freshly migrated empty test database.
  assert.equal(await prisma.user.count(), 0, 'Use a fresh empty test DB (not an earlier preview)');
  ownsFixtures = true;
  await check(
    'Register 12 players, organizer and admin with real password hashing; login and JWT',
    async () => {
      organizer = await register('organizer');
      for (let i = 0; i < 12; i++) players.push(await register(`player${i + 1}`));
      admin = await register('admin');
      const login = await guest.auth.login.mutate({ email: players[0]!.email, password });
      privateValues.push(login.token);
      assert.equal((await client(login.token).auth.me.query()).user.id, players[0]!.id);
      await organizer.api.users.requestOrganizer.mutate();
      assert.equal((await organizer.api.auth.me.query()).user.role, 'MANAGER');
      // ADMIN is never self-service: only this isolated test fixture elevates its admin.
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      assert.equal((await admin.api.auth.me.query()).user.role, 'ADMIN');
    },
  );
  await check(
    'Reject wrong credentials, duplicate email, invalid/expired token and role escalation',
    async () => {
      await denied(
        guest.auth.login.mutate({ email: players[0]!.email, password: 'WrongPassword123' }),
        'BAD_REQUEST',
      );
      await denied(
        guest.auth.register.mutate({ name: 'duplicate', email: players[0]!.email, password }),
        'CONFLICT',
      );
      await denied(client('invalid').auth.me.query(), 'UNAUTHORIZED');
      const expired = jwt.sign({ sub: players[0]!.id }, process.env.JWT_SECRET!, {
        expiresIn: -10,
      });
      privateValues.push(expired);
      await denied(client(expired).auth.me.query(), 'UNAUTHORIZED');
      await denied(
        players[0]!.api.users.setRole.mutate({ userId: players[0]!.id, role: 'ADMIN' }),
        'FORBIDDEN',
      );
      await denied(guest.events.myState.query({ eventId: 'unknown' }), 'UNAUTHORIZED');
    },
  );
  await check('Set city, avatar and six self-assessed skills; validate profile', async () => {
    const cities = await guest.cities.list.query();
    assert.ok(cities.some((city) => city.id === 'kyiv'));
    await players[11]!.api.users.updateCity.mutate({ cityId: 'odesa' });
    await players[0]!.api.users.updateAvatar.mutate({
      avatarUrl: 'https://example.test/avatar.png',
    });
    await players[0]!.api.players.updateMySkills.mutate({
      PACE: 75,
      DRIBBLING: 65,
      PASSING: 80,
      SHOOTING: 70,
      DEFENDING: 60,
      PHYSICAL: 85,
    });
    const profile = await guest.players.profile.query({ userId: players[0]!.id });
    assert.equal(profile.skills.length, 6);
    assert.equal(profile.skills.find((skill) => skill.skill === 'PACE')?.value, 75);
    await denied(
      players[0]!.api.players.updateMySkills.mutate({
        PACE: 101,
        DRIBBLING: 65,
        PASSING: 80,
        SHOOTING: 70,
        DEFENDING: 60,
        PHYSICAL: 85,
      }),
      'BAD_REQUEST',
    );
  });
  await check(
    'Create venue/field via organizer API and city subscriptions with explicit opt-in',
    async () => {
      venueId = (
        await organizer.api.venues.create.mutate({
          name: 'Тестове поле (синтетичний прогін)',
          cityId: 'kyiv',
          address: 'Тестова адреса, не місце реальної гри',
        })
      ).id;
      fieldId = (
        await organizer.api.venues.addField.mutate({
          venueId,
          name: 'Тестове поле 1',
          environment: 'INDOOR',
          capacity: null,
        })
      ).id;
      await admin.api.venues.update.mutate({ id: venueId, hasChangingRooms: true });
      await players[10]!.api.notifications.subscribeCity.mutate({
        cityId: 'kyiv',
        subscribed: true,
      });
      await players[10]!.api.notifications.subscribeCity.mutate({
        cityId: 'kyiv',
        subscribed: true,
      });
      await players[11]!.api.notifications.subscribeCity.mutate({
        cityId: 'odesa',
        subscribed: true,
      });
      assert.equal((await players[10]!.api.notifications.gameSubscriptions.query()).length, 1);
      await denied(
        players[0]!.api.venues.create.mutate({ name: 'Not allowed', cityId: 'kyiv' }),
        'FORBIDDEN',
      );
    },
  );
  await check(
    'Create a priced game with contacts and invitations; verify discovery and city alerts',
    async () => {
      await denied(guest.events.create.mutate(baseGame()), 'UNAUTHORIZED');
      await denied(players[0]!.api.events.create.mutate(baseGame()), 'FORBIDDEN');
      const result = await create({
        ...baseGame(),
        priceMinor: 15000,
        level: 'BEGINNER',
        newcomerInfo: 'Тест: зустріч біля входу',
        organizerPhone: '+380000000000',
        organizerTelegram: '@kopanka_test',
        invitedUserIds: [players[0]!.id, players[1]!.id],
      });
      eventId = result.id;
      assert.equal(result.invited, 2);
      const detail = await guest.events.get.query({ id: eventId });
      assert.equal(detail.priceMinor, 15000);
      assert.equal(detail.organizerTelegram, 'kopanka_test');
      assert.ok(detail.startAt instanceof Date);
      [teamA, teamB] = detail.teams.map((team) => team.id);
      assert.ok(
        (await guest.events.list.query({ cityId: 'kyiv' })).some((event) => event.id === eventId),
      );
      assert.equal((await guest.events.list.query({ cityId: 'odesa' })).length, 0);
      assert.equal(
        (await players[10]!.api.notifications.mine.query()).notifications.filter(
          (item) => item.type === 'EVENT_CREATED',
        ).length,
        1,
      );
      assert.equal(
        (await players[11]!.api.notifications.mine.query()).notifications.filter(
          (item) => item.type === 'EVENT_CREATED',
        ).length,
        0,
      );
      await denied(
        players[0]!.api.events.updateContacts.mutate({
          eventId,
          organizerTelegram: 'someone_else',
        }),
        'FORBIDDEN',
      );
      await organizer.api.events.updateContacts.mutate({
        eventId,
        organizerTelegram: 'kopanka_updated',
        organizerPhone: null,
      });
      assert.equal((await guest.events.get.query({ id: eventId })).organizerPhone, null);
    },
  );
  await check('Accept/decline invitations without auto-joining and notify organizer', async () => {
    const invite = (await players[0]!.api.invitations.received.query()).find(
      (item) => item.eventId === eventId,
    )!;
    await denied(
      players[1]!.api.invitations.respond.mutate({ invitationId: invite.id, accept: true }),
      'FORBIDDEN',
    );
    await players[0]!.api.invitations.respond.mutate({ invitationId: invite.id, accept: true });
    assert.equal((await guest.events.get.query({ id: eventId })).joinedCount, 0);
    const other = (await players[1]!.api.invitations.received.query())[0]!;
    await players[1]!.api.invitations.respond.mutate({ invitationId: other.id, accept: false });
    assert.ok(
      (await organizer.api.notifications.mine.query()).notifications.some(
        (item) => item.type === 'INVITATION_ACCEPTED',
      ),
    );
  });
  await check(
    'Fill 2 teams; reject duplicate participation, second keeper and full-game join',
    async () => {
      await players[0]!.api.events.join.mutate({ eventId, teamId: teamA, position: 'GK' });
      await denied(
        players[1]!.api.events.join.mutate({ eventId, teamId: teamA, position: 'GK' }),
        'BAD_REQUEST',
      );
      await players[1]!.api.events.join.mutate({ eventId, teamId: teamA, position: 'MID' });
      await players[2]!.api.events.join.mutate({ eventId, teamId: teamB, position: 'GK' });
      await players[3]!.api.events.join.mutate({ eventId, teamId: teamB, position: 'MID' });
      await denied(players[0]!.api.events.join.mutate({ eventId, position: 'GK' }), 'CONFLICT');
      await denied(players[4]!.api.events.join.mutate({ eventId, position: 'MID' }), 'BAD_REQUEST');
      assert.equal((await guest.events.get.query({ id: eventId })).availableSlots, 0);
    },
  );
  await check(
    'Waitlist opt-in, vacancy alerts and concurrent race for the last place',
    async () => {
      for (const actor of players.slice(4, 6)) {
        await actor.api.events.setWaitlist.mutate({ eventId, waiting: true });
        await actor.api.events.setWaitlist.mutate({ eventId, waiting: true });
      }
      assert.equal(await prisma.eventWaitlist.count({ where: { eventId } }), 2);
      await players[1]!.api.events.leave.mutate({ eventId });
      for (const actor of players.slice(4, 6))
        assert.ok(
          (await actor.api.notifications.mine.query()).notifications.some(
            (item) => item.type === 'SLOT_AVAILABLE',
          ),
        );
      const results = await Promise.allSettled(
        players
          .slice(4, 6)
          .map((actor) =>
            actor.api.events.join.mutate({ eventId, teamId: teamA, position: 'MID' }),
          ),
      );
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const index = results.findIndex((result) => result.status === 'fulfilled');
      winner = players[4 + index]!;
      waiting = players[4 + 1 - index]!;
      assert.equal((await winner.api.events.myState.query({ eventId })).waiting, false);
      assert.equal((await waiting.api.events.myState.query({ eventId })).waiting, true);
      assert.equal((await guest.events.get.query({ id: eventId })).joinedCount, 4);
    },
  );
  await check('Grow full game through Team C/Team D and enforce the 4-team limit', async () => {
    await waiting.api.events.join.mutate({ eventId, position: 'GK', newTeam: true });
    let game = await guest.events.get.query({ id: eventId });
    const teamC = game.teams.find((team) => team.name === 'Team C')!;
    await players[6]!.api.events.join.mutate({ eventId, teamId: teamC.id, position: 'MID' });
    await players[7]!.api.events.join.mutate({ eventId, position: 'GK', newTeam: true });
    game = await guest.events.get.query({ id: eventId });
    const teamD = game.teams.find((team) => team.name === 'Team D')!;
    await players[8]!.api.events.join.mutate({ eventId, teamId: teamD.id, position: 'MID' });
    await denied(
      players[9]!.api.events.join.mutate({ eventId, position: 'MID', newTeam: true }),
      'BAD_REQUEST',
    );
    game = await guest.events.get.query({ id: eventId });
    assert.equal(game.numberOfTeams, 4);
    assert.equal(game.joinedCount, 8);
  });
  await check(
    'Opt-in reminders; concurrent schedulers, deduplication and private preference visibility',
    async () => {
      await winner.api.events.setReminder.mutate({ eventId, enabled: true });
      await denied(
        players[9]!.api.events.setReminder.mutate({ eventId, enabled: true }),
        'FORBIDDEN',
      );
      const now = new Date(+kickoff - 30 * 60_000);
      const counts = await Promise.all([
        sendGameReminders(prisma, now),
        sendGameReminders(prisma, now),
      ]);
      assert.equal(
        counts.reduce((sum, count) => sum + count, 0),
        1,
      );
      assert.equal(
        (await winner.api.notifications.mine.query()).notifications.filter(
          (item) => item.type === 'EVENT_APPROACHING',
        ).length,
        1,
      );
      await winner.api.events.setReminder.mutate({ eventId, enabled: false });
      await winner.api.events.setReminder.mutate({ eventId, enabled: true });
      assert.equal(await sendGameReminders(prisma, now), 0);
      const game = await guest.events.get.query({ id: eventId });
      assert.ok(game.participants.every((participant) => !('remindBeforeGame' in participant)));
    },
  );
  await check('Balance teams and reject leaving within an hour of kickoff', async () => {
    await denied(players[2]!.api.events.balanceTeams.mutate({ eventId }), 'FORBIDDEN');
    await organizer.api.events.balanceTeams.mutate({ eventId });
    const game = await guest.events.get.query({ id: eventId });
    for (const team of game.teams) {
      const members = game.participants.filter((player) => player.teamId === team.id);
      assert.equal(members.length, 2);
      assert.equal(members.filter((player) => player.preferredPosition === 'GK').length, 1);
    }
    await prisma.event.update({
      where: { id: eventId },
      data: { startAt: new Date(Date.now() + 30 * 60_000) },
    });
    await denied(players[3]!.api.events.leave.mutate({ eventId }), 'BAD_REQUEST');
    await prisma.event.update({ where: { id: eventId }, data: { startAt: kickoff } });
  });
  await check(
    'Repeat from an owned settings-only template without copying people or results',
    async () => {
      const template = await organizer.api.events.repeatTemplate.query({ eventId });
      assert.equal('participants' in template, false);
      assert.equal(template.organizerTelegram, 'kopanka_updated');
      await denied(players[0]!.api.events.repeatTemplate.query({ eventId }), 'FORBIDDEN');
      const result = await create({
        fieldId: template.fieldId,
        startAt: new Date(+template.startAt + 7 * 86400_000),
        endAt: new Date(+template.endAt + 7 * 86400_000),
        numberOfTeams: template.numberOfTeams,
        playersPerTeam: template.playersPerTeam,
        priceMinor: template.priceMinor,
        level: template.level,
        newcomerInfo: template.newcomerInfo,
      });
      repeatedId = result.id;
      const repeated = await guest.events.get.query({ id: repeatedId });
      assert.equal(repeated.joinedCount, 0);
      assert.equal(repeated.status, 'UPCOMING');
      assert.equal(repeated.priceMinor, 15000);
      assert.equal(await prisma.invitation.count({ where: { eventId: repeatedId } }), 0);
      assert.equal(await prisma.rating.count({ where: { eventId: repeatedId } }), 0);
    },
  );
  await check('Organizer lifecycle and rating-available notifications', async () => {
    await denied(players[0]!.api.events.start.mutate({ eventId }), 'FORBIDDEN');
    await denied(organizer.api.events.delete.mutate({ eventId }), 'BAD_REQUEST');
    await denied(organizer.api.events.finish.mutate({ eventId }), 'BAD_REQUEST');
    await organizer.api.events.start.mutate({ eventId });
    await organizer.api.events.finish.mutate({ eventId });
    const finished = await guest.events.get.query({ id: eventId });
    assert.equal(finished.status, 'FINISHED');
    assert.ok(finished.ratingClosesAt instanceof Date);
    assert.ok(finished.participants.every((participant) => participant.status === 'ATTENDED'));
    assert.ok(
      (await players[0]!.api.notifications.mine.query()).notifications.some(
        (item) => item.type === 'RATING_AVAILABLE',
      ),
    );
    await denied(players[9]!.api.events.join.mutate({ eventId, position: 'MID' }), 'BAD_REQUEST');
    await denied(
      players[9]!.api.events.setWaitlist.mutate({ eventId, waiting: true }),
      'BAD_REQUEST',
    );
  });
  await check(
    'Peer ratings, self/outsider/duplicate guards, atomic batches and zero-star skip',
    async () => {
      const targets = await players[0]!.api.ratings.rateableTargets.query({ eventId });
      assert.equal(targets.targets.length, 7);
      assert.equal(
        (
          await players[0]!.api.ratings.submit.mutate({
            eventId,
            ratings: [
              { rateeId: players[2]!.id, stars: 5 },
              { rateeId: players[3]!.id, stars: 4 },
            ],
          })
        ).saved,
        2,
      );
      await denied(
        players[0]!.api.ratings.submit.mutate({
          eventId,
          ratings: [{ rateeId: players[2]!.id, stars: 4 }],
        }),
        'CONFLICT',
      );
      await denied(
        players[0]!.api.ratings.submit.mutate({
          eventId,
          ratings: [{ rateeId: players[0]!.id, stars: 5 }],
        }),
        'FORBIDDEN',
      );
      await denied(
        players[11]!.api.ratings.submit.mutate({
          eventId,
          ratings: [{ rateeId: players[0]!.id, stars: 5 }],
        }),
        'FORBIDDEN',
      );
      const before = await prisma.rating.count({ where: { eventId } });
      await denied(
        players[2]!.api.ratings.submit.mutate({
          eventId,
          ratings: [
            { rateeId: players[0]!.id, stars: 4 },
            { rateeId: players[11]!.id, stars: 5 },
          ],
        }),
        'FORBIDDEN',
      );
      assert.equal(await prisma.rating.count({ where: { eventId } }), before);
      assert.equal(
        (
          await players[2]!.api.ratings.submit.mutate({
            eventId,
            ratings: [{ rateeId: players[0]!.id, stars: 0 }],
          })
        ).saved,
        0,
      );
      await players[2]!.api.ratings.submit.mutate({
        eventId,
        ratings: [{ rateeId: players[0]!.id, stars: 4 }],
      });
      await players[3]!.api.ratings.submit.mutate({
        eventId,
        ratings: [{ rateeId: players[0]!.id, stars: 5 }],
      });
      const profile = await guest.players.profile.query({ userId: players[0]!.id });
      assert.deepEqual(profile.stars, { average: 4.5, count: 2 });
      assert.equal(profile.skills.find((skill) => skill.skill === 'PACE')?.value, 75);
    },
  );
  await check(
    'MVP voting, concurrent resolution, winner award and updated profile/history',
    async () => {
      await denied(
        players[0]!.api.mvp.vote.mutate({ eventId, nomineeId: players[0]!.id }),
        'FORBIDDEN',
      );
      await denied(
        players[11]!.api.mvp.vote.mutate({ eventId, nomineeId: players[0]!.id }),
        'FORBIDDEN',
      );
      await players[0]!.api.mvp.vote.mutate({ eventId, nomineeId: players[2]!.id });
      await denied(
        players[0]!.api.mvp.vote.mutate({ eventId, nomineeId: players[3]!.id }),
        'CONFLICT',
      );
      const attendees = (await guest.events.get.query({ id: eventId })).participants;
      await Promise.all(
        attendees
          .filter((participant) => participant.userId !== players[0]!.id)
          .map((participant) =>
            players
              .find((actor) => actor.id === participant.userId)!
              .api.mvp.vote.mutate({ eventId, nomineeId: players[0]!.id }),
          ),
      );
      const status = await guest.mvp.status.query({ eventId });
      assert.equal(status.resolved, true);
      assert.equal(status.winners.length, 1);
      assert.equal(status.winners[0]!.userId, players[0]!.id);
      assert.equal(status.winners[0]!.votes, 7);
      const profile = await guest.players.profile.query({ userId: players[0]!.id });
      assert.equal(profile.mvpCount, 1);
      assert.equal(profile.matchesPlayed, 1);
      assert.ok(
        (await guest.players.matchHistory.query({ userId: players[0]!.id })).some(
          (match) => match.eventId === eventId,
        ),
      );
      assert.equal(
        (await players[0]!.api.notifications.mine.query()).notifications.filter(
          (item) => item.type === 'MVP_AWARDED',
        ).length,
        1,
      );
    },
  );
  await check('Expired rating window and notification read markers', async () => {
    const original = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    await prisma.event.update({
      where: { id: eventId },
      data: { finishedAt: new Date(Date.now() - 25 * 3600_000) },
    });
    assert.equal(
      (await players[2]!.api.ratings.rateableTargets.query({ eventId })).targets.length,
      0,
    );
    await denied(
      players[2]!.api.ratings.submit.mutate({
        eventId,
        ratings: [{ rateeId: players[3]!.id, stars: 5 }],
      }),
      'BAD_REQUEST',
    );
    await prisma.event.update({
      where: { id: eventId },
      data: { finishedAt: original.finishedAt },
    });
    await players[0]!.api.notifications.markAllRead.mutate();
    assert.equal((await players[0]!.api.notifications.mine.query()).unreadCount, 0);
  });
  await check(
    'Cancellation, empty-game deletion, cascade cleanup and city unsubscribe',
    async () => {
      const cancelled = await create({ ...baseGame(), invitedUserIds: [players[9]!.id] });
      const detail = await guest.events.get.query({ id: cancelled.id });
      await players[9]!.api.events.join.mutate({
        eventId: cancelled.id,
        teamId: detail.teams[0]!.id,
        position: 'MID',
      });
      await organizer.api.events.cancel.mutate({ eventId: cancelled.id });
      assert.equal((await guest.events.get.query({ id: cancelled.id })).status, 'CANCELLED');
      await denied(
        players[10]!.api.events.join.mutate({ eventId: cancelled.id, position: 'MID' }),
        'BAD_REQUEST',
      );
      assert.ok(
        (await players[9]!.api.notifications.mine.query()).notifications.some(
          (item) => item.type === 'EVENT_CANCELLED',
        ),
      );
      const empty = await create({ ...baseGame(), invitedUserIds: [players[11]!.id] });
      await organizer.api.events.delete.mutate({ eventId: empty.id });
      await denied(guest.events.get.query({ id: empty.id }), 'NOT_FOUND');
      assert.equal(await prisma.invitation.count({ where: { eventId: empty.id } }), 0);
      assert.equal(
        await prisma.notification.count({
          where: { payload: { path: ['eventId'], equals: empty.id } },
        }),
        0,
      );
      await players[10]!.api.notifications.subscribeCity.mutate({
        cityId: 'kyiv',
        subscribed: false,
      });
      assert.equal((await players[10]!.api.notifications.gameSubscriptions.query()).length, 0);
    },
  );
  await check(
    'Overdue-game scheduler finishes populated games, cancels empty games and resolves expired MVP',
    async () => {
      const start = new Date(+kickoff + 20 * 86400_000),
        end = new Date(+start + 3600_000);
      const populated = await create({ ...baseGame(), startAt: start, endAt: end });
      const empty = await create({ ...baseGame(), startAt: start, endAt: end });
      await players[9]!.api.events.join.mutate({ eventId: populated.id, position: 'MID' });
      const result = await finishOverdueEvents(prisma, new Date(+end + 61 * 60_000));
      assert.ok(result.finished.includes(populated.id));
      assert.ok(result.cancelled.includes(empty.id));
      const repeat = await finishOverdueEvents(prisma, new Date(+end + 61 * 60_000));
      assert.equal(repeat.finished.length + repeat.cancelled.length, 0);
      await prisma.event.update({
        where: { id: populated.id },
        data: { finishedAt: new Date(Date.now() - 25 * 3600_000) },
      });
      assert.ok((await resolveDueMvps(prisma)).includes(populated.id));
      assert.equal((await guest.mvp.status.query({ eventId: populated.id })).resolved, true);
    },
  );
} catch (error) {
  failed = true;
  console.error('FAILED:', redact(error instanceof Error ? error.message : String(error)));
} finally {
  await app.close();
  // This dedicated DB was required empty at startup and is disposable. Keep no synthetic users by default.
  if (ownsFixtures && process.env.KEEP_E2E_FIXTURES !== 'true') {
    await prisma.notification.deleteMany();
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.user.deleteMany();
  }
  const report = {
    generatedAt: new Date().toISOString(),
    status: failed ? 'failed' : 'passed',
    scope:
      'Real tRPC HTTP batching/SuperJSON/JWT/Argon2/PostgreSQL; synthetic accounts, no browser UI automation',
    actors: actorsCreated,
    httpRequests,
    expectedErrors,
    gamesCreated,
    milliseconds: Date.now() - started,
    externalIntegrations: 'disabled',
    fixturesKept: process.env.KEEP_E2E_FIXTURES === 'true',
    steps,
  };
  await writeFile(
    new URL('../../../docs/FULL_JOURNEY_RESULT.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  await prisma.$disconnect();
  console.log(
    `RESULT: ${report.status}; ${steps.filter((step) => step.status === 'passed').length} stages; ${httpRequests} HTTP requests; ${expectedErrors} expected error cases`,
  );
}
if (failed) process.exitCode = 1;
