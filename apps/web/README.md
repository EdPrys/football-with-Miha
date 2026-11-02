# Kopanka Web

Next.js застосунок гравців та організаторів. Запуск із кореня monorepo:

```sh
pnpm --filter @app/web dev
```

Адреса: http://localhost:3000. У `apps/web/.env.local` задайте
`NEXT_PUBLIC_API_URL=http://localhost:4000`. API та PostgreSQL запускаються окремо.

Повна інструкція: [README](../../README.md).
API-панель: http://localhost:4000/api-panel; [опис API](../../docs/API.md).
Build/deploy і build-time variables: [DEPLOYMENT](../../docs/DEPLOYMENT.md).
