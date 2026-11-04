# Deployment — Railway

Production runs in Railway project `football`: API, player web, admin web and PostgreSQL.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment variables and diagnostics,
and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the branch and release workflow.

## Services

All four services run in one Railway project, deployed from Dockerfiles
(build context = repo root, selected per service via `RAILWAY_DOCKERFILE_PATH`):

| Service     | Dockerfile                  | URL                                              |
| ----------- | --------------------------- | ------------------------------------------------ |
| `Postgres`  | Railway template            | internal                                         |
| `api`       | `apps/api/Dockerfile`       | https://api-production-0de2.up.railway.app       |
| `web`       | `apps/web/Dockerfile`       | https://web-production-273dc.up.railway.app      |
| `admin-web` | `apps/admin-web/Dockerfile` | https://admin-web-production-ba29.up.railway.app |

**Auto-deploy:** every service is connected to GitHub `EdPrys/football-with-Miha`
(`main`). A push redeploys only the services whose watch paths changed:

- `api` — `apps/api/**` + shared (`packages/**`, root `package.json`, lockfile, workspace, `tsconfig.base.json`, `.dockerignore`)
- `web` — `apps/web/**`, `apps/api/**` + shared
- `admin-web` — `apps/admin-web/**`, `apps/api/**` + shared

Docs-only pushes deploy nothing. Manual deploy from local (CLI: `npm i -g @railway/cli`,
`railway login`, `railway link`): `railway up --service <api|web|admin-web> --detach`.
`NEXT_PUBLIC_API_URL` is baked into web/admin at build time.

API env: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET`, `PORT=4000`,
`WEB_ORIGIN` (web + admin URLs), `APP_URL` (web URL, used in Telegram posts),
optional `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`. Web/admin env: `PORT=3000`,
`NEXT_PUBLIC_API_URL`. Migrations run on API start (`prisma migrate deploy`).

## CI and releases

Task PRs target `dev`; release PRs go from `dev` to `main` with a merge commit.
Production services track `main`. CI checks branch policy, types, unit/API tests,
an isolated PostgreSQL journey, and production builds of both frontends.
After release, sync `main` back into `dev` through a merge-commit PR.
A successful CI run does not confirm a successful Railway deployment: check the
service deployment logs, public API `/health`, and login/join flow.
