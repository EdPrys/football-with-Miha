# Architecture

## Monorepo layout

```
apps/
  api/     Fastify + tRPC server        (@app/api)
  web/     Next.js                      (@app/web)
  (mobile/ React Native — future)
packages/
  db/      Prisma schema + client       (@app/db)
  domain/  pure business logic          (@app/domain)
```

## Request flow (per operation)

```
Client (web/mobile, typed tRPC client)
        │  typed call, zod-validated input
        ▼
tRPC procedure (apps/api)      ← thin: auth + input validation only
        │
        ▼
Domain service (packages/domain)  ← invariants, state machines, aggregation
        │
        ▼
Prisma repository (packages/db)   ← persistence
        │
        ▼
PostgreSQL
```

## Type sharing

- `@app/db` exports the Prisma client and generated enums/types.
- `@app/api` composes the tRPC `AppRouter` and exports its **type** (`export type { AppRouter }`).
- `@app/web` imports `type { AppRouter }` → fully typed client, zero codegen.
- React Native later imports the same `AppRouter` type.

## State machines (owned by @app/domain)

- **Event**: UPCOMING → IN_PROGRESS → FINISHED; UPCOMING/IN_PROGRESS → CANCELLED.
- **Participant**: JOINED → CANCELLED | ATTENDED | NO_SHOW.
- **Invitation**: PENDING → ACCEPTED | DECLINED.
  Allowed transitions are centralized; procedures never hand-check statuses.

## Why not NestJS / Next full-stack

Domain is tangled CRUD (real invariants + state machines) but not microservices — Fastify keeps it light. A **standalone typed API** is kept (instead of Next full-stack) because a **React Native** app is planned and needs the same contract. tRPC gives end-to-end types to every TS client without codegen.
