# CLAUDE.md — Football App (project instructions)

Guidance for code generation in this repo. Read before writing code.

## What this is

A **football pickup-game social platform** (not just field booking). The MVP proves one loop:

`register → set own skills → find/create event → join → pick position → play → give stars (optional, 24h) → view profile`

Build the MVP around this loop. Do NOT build future features (payments, AI matchmaking, detailed positions, chat, recommendations) unless explicitly asked. See `docs/PRODUCT_PLAN.md`.

## Stack (locked)

- **Monorepo**: pnpm workspaces. `apps/*` + `packages/*`.
- **Backend**: `apps/api` — **Fastify + tRPC**, standalone server. NOT NestJS.
- **DB**: PostgreSQL via **Prisma** in `packages/db`. Postgres runs in Docker (`docker compose up -d`).
- **Domain**: `packages/domain` — pure, framework-free business logic. Skill aggregation, invariants, state machines live here.
- **Web**: `apps/web` — Next.js, imports the tRPC `AppRouter` type for end-to-end type safety.
- **Mobile**: React Native (future) — the reason we have a standalone typed API instead of Next full-stack.

## Architecture rules

1. **Domain logic never lives in tRPC procedures or route handlers.** Procedures validate input (zod) → call a `packages/domain` service → persist via Prisma → return. Keep procedures thin.
2. **Skills are self-assessed; peers give stars.** Players set their six skills 1–100 themselves (`skills/self.ts`). After a game co-players may give each other one 1–5 star score; the shown rating is an isolated, swappable aggregation (`ratings/stars.ts` → `starAggregator`, plain average now). See `docs/SKILLS.md`.
3. **Invariants are enforced in the domain layer**, not the UI: can't join a full/cancelled/finished event, can't join twice, can't rate yourself / non-participants, one rating per (event, rater, ratee), rating only within 24h after the game is finished (`Event.finishedAt`). An unfinished game can be deleted only while it has no active participants (`deleteEvent`, also removes its Telegram post). A full game grows by one team per extra player up to `MAX_TEAMS` = 4 (`joinEvent` with `newTeam`). Organizers can rebalance teams by stars before kick-off (`events/balance.ts`).
4. **State machines** for Event, Participant, Invitation status transitions — centralize allowed transitions in domain, don't scatter status checks. Games still open 1h after `endAt` are closed by `finishOverdueEvents` (run every 5 min from `apps/api/src/jobs/scheduler.ts`): finished like the button, or cancelled if nobody joined.
5. **Shared types come from packages** (`@app/db` Prisma types, `@app/domain` enums/DTOs). Don't redefine enums per app.
6. Develop **vertically** (full loop first), not entity-by-entity.

## Roles & access

Single `User.role` enum, ordered `PLAYER < MANAGER < ADMIN` (higher inherits lower). **Everyone can play** regardless of role — a role only adds staff abilities.

- **PLAYER**: join events, pick position, play, rate.
- **MANAGER** ("організатор"): + create events and Venues/Fields/halls (also a player). Players can't create places, so the catalogue isn't spammed with empty venues.
- **ADMIN**: + manage users (also a player).

A player becomes MANAGER by pressing "Стати організатором" (`users.requestOrganizer` → `requestOrganizerRole` in `packages/domain/src/users/role-request.ts`). Each request is stored as a `RoleRequest`; while `AUTO_APPROVE_ORGANIZER` is true it is approved immediately. ADMIN is never self-service.

Enforce in `apps/api/src/trpc.ts` via `protectedProcedure` / `managerProcedure` / `adminProcedure` (built on `roleAtLeast` from `@app/domain`). `events.create` and venue/field creation = manager+, user/role management = admin.

Frontends: `apps/web` (players), `apps/admin-web` (admin — user role mgmt + venue/field CRUD), React Native mobile (future).

## Package names

- `@app/db` — Prisma client + schema (`packages/db`)
- `@app/domain` — business logic (`packages/domain`)
- `@app/api` — Fastify + tRPC server (`apps/api`)
- `@app/web` — Next.js (`apps/web`)

## Common commands

```bash
pnpm db:up        # start Postgres (docker)
pnpm db:migrate   # run prisma migrate dev
pnpm db:seed      # verified venues/fields; no demo users
pnpm db:studio    # prisma studio
pnpm dev          # run all apps in parallel
pnpm typecheck    # typecheck all packages
```

## Conventions

- TypeScript strict everywhere. ESM modules.
- Validation: **zod** at the tRPC boundary; domain functions assume validated input.
- Enums (EventStatus, ParticipantStatus, InvitationStatus, Position, SkillType, NotificationType) are defined in the Prisma schema and re-exported from `@app/db`.
- Money/time: store timestamps as UTC. Event capacity = `numberOfTeams * playersPerTeam` (derived, never stored redundantly).
- Auth: JWT (access token), password hashed with argon2/bcrypt.

## Current status and documentation

Backend loop, player/organizer web and admin web are implemented. React Native
is future work. Do not use the former foundation-only roadmap as implementation status.

- Start and onboard: `README.md`.
- Live tRPC explorer: API `/api-panel`, see `docs/API.md`. Add `.meta({ description })`
  to procedures, document access and side effects. Production panel is opt-in via
  `API_PANEL_ENABLED=true`; normal API authorization still applies.
- Deployment and env/ports: `docs/DEPLOYMENT.md`.
- Current business rules: `docs/PRODUCT_PLAN.md`, `docs/SKILLS.md`.
- Data model and request flow: `docs/ARCHITECTURE.md`.

Update these docs with behavior/config changes. Prisma seed imports the verified
catalogue only; never document default admin credentials that do not exist.

## Acquisition flow (2026-11-03)

Game details: optional UAH kopecks `priceMinor` (null unknown, 0 free), GameLevel,
and public newcomerInfo. The creation form explicitly offers a payment checkbox:
unchecked creates a free game (`priceMinor: 0`); checked requires a positive UAH
amount. Existing/API null prices remain unknown. Never infer missing game level. City-specific
new-game subscriptions are explicit opt-in and in-app only; createEvent writes
the game and subscriber notifications in one transaction. Repeat templates are
organizer-owned queries; create a separate game after review, without copying
participants/invitations/results. Auth `next` paths must stay internal.

## Player comfort (2026-11-03)

Event contacts are public and explicitly supplied by the organizer. Slot alerts
require opt-in; waitlisting is not a reservation or auto-join. Join, leave,
waitlist and reminder operations lock Event before participant changes. Reminders
are off by default and in-app only; preserve sent markers on off/on and never
expose private reminder flags in public event participants. `.ics` export is a
snapshot without automatic calendar updates. Browser drafts are account/source
scoped, never persist passwords. See docs/PLAYER_COMFORT.md and USABILITY_TEST.md;
real-user/visual testing has not been completed.

## Branches and releases

Read `AGENTS.md` and `docs/DEVELOPMENT.md`. Tasks branch from `dev` and merge
through PRs into `dev`; releases go `dev → main` using a merge commit, then
`main → dev` for history synchronization. Never push directly to protected branches.

## Organizer outreach (2026-11-04)

`apps/outreach` is a separate, offline-preparable Telegram account worker, not the
existing announcement bot. It has no production DB access and does not run in
`pnpm dev`. Policy/state transitions live in `packages/domain/src/outreach`.
Default mode is dry-run; initial contacts require approved candidates from
configured source groups. Never retry uncertain delivery automatically or erase
opt-out records; model output cannot choose recipients or execute tools.
Keep copy short (3–5 sentences for the basic path); drive organizer game creation
and registration/joining of their existing group. Template replies avoid model
calls; persist prepared replies and reported token usage across restarts. Optional
count-only metrics use a separate capability token and opaque cohort campaigns;
never infer the Telegram person's identity or activation from cohort counts.
Pilots have at most seven active conversations and ten initial-contact attempts.
Idle conversations wait after 48h without reminders. A drained pilot creates private
JSON/Markdown snapshots and awaits recorded owner review plus explicit next-cycle
start; restarts/resume must not bypass this gate or reset suppression/daily quotas.
Account connection, model configuration, pilot city/sources and live verification
are still pending. See `docs/OUTREACH_AGENT.md`.
