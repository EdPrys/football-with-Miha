# Football App ⚽

A football **pickup-game social platform** — find or organize casual matches, join,
play, rate the players you played with, and build a skill profile from those ratings.

> MVP in progress. See [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md),
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SKILLS.md`](docs/SKILLS.md),
> and [`CLAUDE.md`](CLAUDE.md).

## The core loop

```
register → find/create event → join + pick position → play →
organizer finishes → rate players → skills recomputed → view profile
```

## Stack

pnpm monorepo · **Fastify + tRPC + Prisma + PostgreSQL** (API) · Next.js web (planned) ·
React Native mobile (planned) · shared domain logic & types in workspace packages.

```
apps/api        Fastify + tRPC server (exports AppRouter type)
packages/db     Prisma schema + client
packages/domain pure business logic (invariants, state machines, skill aggregation)
```

## Roles

`PLAYER < MANAGER < ADMIN` — everyone can play; managers create events; admins
create venues/fields and manage users. A separate admin web app is planned.

## Getting started

```bash
corepack enable                 # provides pnpm
pnpm install
pnpm db:up                      # Postgres via Docker
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # seed venues/fields
pnpm --filter @app/api start    # run the API on :4000
pnpm test                       # run all tests
```

## Status

Backend MVP loop complete (auth, events, roles, join/leave, management,
ratings, skills, profiles) with 30+ unit tests. Web/mobile UIs next.
