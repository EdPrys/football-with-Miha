# Container image for @app/admin-web (Railway). Build context = repo root:
#   docker build -f apps/admin-web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... .
FROM node:22-slim

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

# Install deps first (better layer caching). The web app imports the AppRouter
# type from @app/api, so the api + its workspace deps must be present too.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/admin-web/package.json apps/admin-web/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @app/admin-web...

COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/admin-web ./apps/admin-web
RUN pnpm --filter @app/db exec prisma generate

# Inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @app/admin-web build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "cd apps/admin-web && exec node_modules/.bin/next start -p ${PORT:-3000}"]
