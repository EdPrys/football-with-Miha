# Optional dedicated Railway worker; not part of the web/API deployment.
# Build context: repository root. Mount a private persistent volume at /data/outreach.
FROM node:22-slim
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY apps/outreach/package.json apps/outreach/
RUN pnpm install --frozen-lockfile
COPY packages/domain ./packages/domain
COPY apps/outreach ./apps/outreach
ENV NODE_ENV=production
ENV OUTREACH_DATA_DIR=/data/outreach
CMD ["pnpm", "--filter", "@app/outreach", "agent", "run"]
