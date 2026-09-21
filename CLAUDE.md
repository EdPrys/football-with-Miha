# CLAUDE.md — Football App (project instructions)

Guidance for code generation in this repo. Read before writing code.

## What this is

A **football pickup-game social platform** (not just field booking). The MVP proves one loop:

`register → find/create event → join → pick position → play → rate players → skills recalculated → view profile`

Build the MVP around this loop. Do NOT build future features (payments, AI team balancing, detailed positions, chat, recommendations) unless explicitly asked. See `docs/PRODUCT_PLAN.md`.

## Stack (locked)

- **Monorepo**: pnpm workspaces. `apps/*` + `packages/*`.
- **Backend**: `apps/api` — **Fastify + tRPC**, standalone server. NOT NestJS.
- **DB**: PostgreSQL via **Prisma** in `packages/db`. Postgres runs in Docker (`docker compose up -d`).
- **Domain**: `packages/domain` — pure, framework-free business logic. Skill aggregation, invariants, state machines live here.
- **Web**: `apps/web` — Next.js, imports the tRPC `AppRouter` type for end-to-end type safety.
- **Mobile**: React Native (future) — the reason we have a standalone typed API instead of Next full-stack.

## Architecture rules

1. **Domain logic never lives in tRPC procedures or route handlers.** Procedures validate input (zod) → call a `packages/domain` service → persist via Prisma → return. Keep procedures thin.
2. **Skill aggregation is an isolated, swappable service** (`packages/domain/src/skills/`). The current algorithm is a plain average; it must be replaceable (Bayesian, weighted, recency) without touching callers. See `docs/SKILLS.md`.
3. **Invariants are enforced in the domain layer**, not the UI: can't join a full/cancelled/finished event, can't join twice, can't rate yourself / non-participants, one rating per (event, rater, ratee).
4. **State machines** for Event, Participant, Invitation status transitions — centralize allowed transitions in domain, don't scatter status checks.
5. **Shared types come from packages** (`@app/db` Prisma types, `@app/domain` enums/DTOs). Don't redefine enums per app.
6. Develop **vertically** (full loop first), not entity-by-entity.

## Roles & access

Single `User.role` enum, ordered `PLAYER < MANAGER < ADMIN` (higher inherits lower). **Everyone can play** regardless of role — a role only adds staff abilities.

- **PLAYER**: join events, pick position, play, rate.
- **MANAGER**: + create events (also a player).
- **ADMIN**: + manage users, create Venues/Fields/halls (also a player). Only admins create places, so the catalogue isn't spammed with empty venues.

Enforce in `apps/api/src/trpc.ts` via `protectedProcedure` / `managerProcedure` / `adminProcedure` (built on `roleAtLeast` from `@app/domain`). `events.create` = manager+, venue/field creation = admin.

Planned frontends: `apps/web` (players), `apps/admin-web` (admin — user mgmt + venue/field CRUD, future), React Native mobile (future).

## Package names

- `@app/db` — Prisma client + schema (`packages/db`)
- `@app/domain` — business logic (`packages/domain`)
- `@app/api` — Fastify + tRPC server (`apps/api`)
- `@app/web` — Next.js (`apps/web`)

## Common commands

```bash
pnpm db:up        # start Postgres (docker)
pnpm db:migrate   # run prisma migrate dev
pnpm db:seed      # seed venues/fields/dev users
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

## Roadmap (vertical slices)

0. Foundation — monorepo, Postgres, Prisma schema, migration ← current
1. Auth (register/login)
2. Venue/Field + Create Event
3. Discover + Join (invariants)
4. Event management (teams, start/finish)
5. Rating (after FINISHED)
6. Skills aggregation + Profile
