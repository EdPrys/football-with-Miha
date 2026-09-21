# Container image for the API (alternative to the Render native build).
# Build context = repo root:  docker build -f apps/api/Dockerfile -t football-api .
FROM node:22-slim

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

# Install deps first (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# App source
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @app/db exec prisma generate

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @app/db exec prisma migrate deploy && pnpm --filter @app/api exec tsx src/index.ts"]
