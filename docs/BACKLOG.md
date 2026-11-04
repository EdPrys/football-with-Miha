# Backlog and verification

Updated 2026-11-03. Code existence and production verification are separate.

## Completed: acquisition and return flow (2026-11-03)

Implemented the five improvements agreed on 2026-11-02:

- [x] Login/register links on the game preserve a validated internal `next` path.
- [x] Organizers enter optional price (UAH per player), playing level and newcomer
      instructions while creating a game. Unknown values stay unknown; zero price means free.
- [x] “Invite a friend” uses native sharing or copies a direct game link, with a
      manual copy fallback when clipboard access is unavailable.
- [x] Organizers can open a settings-only repeat template with the next future
      weekly date in their browser timezone. They review it and explicitly create
      a new game; participants, invitations and results are not copied.
- [x] Empty discovery results offer an explicit city subscription. Notifications
      are persistent, in-app only, for newly created games on all dates in that city.
      Subscription management/unsubscribe is in Notifications. No email/push delivery.

Migration: `20261103120000_game_discovery`. Deployment must apply it before
running the new API (the API Docker CMD already runs migrate deploy).

Broader marketing direction remains a one-city pilot with recurring organizers,
real games and measurement of first participation and return. City, live game
supply, budget, monetization and production analytics remain unconfirmed.
Paid campaigns are not authorized by this work. See `MARKETING_PILOT.md`.

## Player comfort (2026-11-03)

Implemented contacts/directions, clear participation state, calendar export,
opt-in in-app reminders, slot alerts, remembered search and recoverable drafts.
Local technical validation is recorded in `PLAYER_COMFORT.md`. A full synthetic-player
HTTP/API journey also passed: see `FULL_JOURNEY.md` and `FULL_JOURNEY_RESULT.json`.

Still pending: visual iOS/Android checks, calendar imports on actual devices and
sessions with real players. The Mac UI automation service could not start;
no real-user findings have been claimed. Protocol: `USABILITY_TEST.md`.
Production deployment and delivery remain separately unverified.

## Production checks

- Verify Telegram bot/channel variables and posting permissions in the intended deployment.
  Posting, stored message id, deletion of an empty game's post and Europe/Kyiv formatting
  are implemented. Do not treat the former timezone task as missing code.
- Verify GA4/Meta events and UTM registration attribution end to end before advertising.
  See `MARKETING_PILOT.md`; no campaign launch is recorded there.
- Confirm actual service ports, domains and health in the intended Coolify deployment;
  the reported 502 needs runtime/container logs. See `DEPLOYMENT.md`.
- Smoke-test the complete two-player flow against a dedicated test database.

## Product decisions

- Decide whether Telegram posts should be edited as places fill or games are cancelled.
  Deleting an empty game already requests deletion of its stored Telegram post.
- Choose city, live matches, budget and channel for the first marketing test.
- Review automatic approval of organizer role before changing access policy.

## Developer onboarding

API explorer and setup/API/architecture/deployment documentation are now in the
repository. Keep procedure metadata and docs synchronized with implementation.
No React Native app, payment or external field-booking integration is implemented.

## Co-player profiles (2026-11-04)

Implemented automatic own-profile co-player list from mutual ATTENDED participation
in FINISHED games, paginated with shared counts, and public `/players/[id]` profile
with stats, self-assessed skills and played-match links. No schema migration.
Domain/API regression tests cover identity scoping, pagination and attendance filters.
Production deployment and phone checks remain unverified; local Docker was unavailable
for a fresh PostgreSQL integration run.
