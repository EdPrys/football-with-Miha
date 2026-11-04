# Деплой і діагностика

Репозиторій містить Dockerfile для трьох окремих сервісів. Build context —
корінь monorepo, а не папка застосунку. PostgreSQL — окремий сервіс.
Ця інструкція описує конфігурацію коду; вона не підтверджує стан конкретного
деплою в Railway. Production працює в Railway project `football`; перелік
сервісів і адреси див. у [DEPLOY.md](../DEPLOY.md).

| Сервіс | Dockerfile                  | Типовий порт контейнера    |
| ------ | --------------------------- | -------------------------- |
| API    | `apps/api/Dockerfile`       | 4000                       |
| Web    | `apps/web/Dockerfile`       | 3000                       |
| Admin  | `apps/admin-web/Dockerfile` | 3000 (локальний dev: 3001) |

API слухає `0.0.0.0` на `PORT`, якщо заданий, інакше `API_PORT` (4000).
Web/Admin Docker CMD використовує `PORT`, інакше 3000. `EXPOSE` — метадані,
він не змінює порт процесу. У Railway target port публічного домену має збігатися з фактичним портом
процесу. Значення `PORT` і порт домену перевіряйте в налаштуваннях сервісу.

## Змінні середовища

| Змінна                                                                                                     | Де / призначення                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                             | API: PostgreSQL connection string; також Prisma migrations/seed                          |
| `JWT_SECRET`                                                                                               | API: приватний випадковий секрет, не значення з прикладу                                 |
| `JWT_EXPIRES_IN`                                                                                           | API: строк JWT, за замовчуванням 7d                                                      |
| `NODE_ENV`                                                                                                 | У Dockerfile production; локально development                                            |
| `PORT`, `API_PORT`                                                                                         | Runtime-порт; пріоритет описаний вище                                                    |
| `WEB_ORIGIN`                                                                                               | API: дозволені web/admin origins через кому, без шляхів                                  |
| `API_PANEL_ENABLED`                                                                                        | API: true/false; у production панель за замовчуванням вимкнена                           |
| `NEXT_PUBLIC_API_URL`                                                                                      | Web/Admin: публічна базова адреса API без `/trpc`; build argument                        |
| `NEXT_PUBLIC_SITE_URL`                                                                                     | Web: канонічний URL сайту; build argument                                                |
| `APP_URL`                                                                                                  | API: URL web для посилань у Telegram                                                     |
| `PUBLIC_API_URL`                                                                                           | API: публічна базова адреса для посилань на аватари                                      |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`                                                                   | API: необов'язкові; без обох публікація не працює                                        |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | API: необов'язкове S3-сумісне сховище аватарів; див. `.env.example` та avatar-storage.ts |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`                                                           | Web: необов'язкова аналітика; build arguments                                            |

Змінні `NEXT_PUBLIC_*` вбудовуються у frontend під час build. Зміна лише runtime
variables не змінить адресу API в уже зібраному клієнті — потрібен rebuild.
Frontend викликає API з браузера: внутрішнє Docker-ім'я не підходить як
`NEXT_PUBLIC_API_URL`. Для HTTPS frontend використовуйте HTTPS API.

## Послідовність

1. Підготуйте PostgreSQL та змінні API. Зберігайте секрети у змінних відповідного сервісу Railway.
2. Зберіть і запустіть API. Його Docker CMD спочатку виконує `prisma migrate deploy`;
   помилка міграцій зупиняє запуск. Міграції не виконують seed автоматично.
3. За потреби імпортуйте каталог: `pnpm --filter @app/db seed` у контейнері API
   із налаштованим DATABASE_URL. Не запускайте dev migrations на робочій БД.
4. Перевірте публічний `/health`: має повернути `{"status":"ok"}`.
   Цей endpoint перевіряє HTTP-процес, не доступність PostgreSQL.
5. Зберіть Web/Admin з потрібним `NEXT_PUBLIC_API_URL`, налаштуйте домени та порти.
6. Перевірте реальний сценарій входу, читання каталогу і роботи з грою.

Панель можна ввімкнути в тестовому API через `API_PANEL_ENABLED=true` і restart.
Вона працює з даними саме цього API. Деталі доступу: [API.md](API.md).

## 404 / 502 / CORS

```sh
# Перевірка ззовні: використовуйте домен сервісу, а не лише IP.
curl -i --connect-timeout 10 'https://<api-domain>/health'
# У терміналі контейнера API (підставте фактичний порт):
node -e 'fetch("http://127.0.0.1:4000/health").then(async r => console.log(r.status, await r.text()))'
```

- **404 за IP:** проксі міг отримати запит без домену, для якого є маршрут.
  Перевірте домен. На API маршрут `/` також не визначений; використовуйте `/health`.
- **502 за доменом:** перевірте runtime/deployment logs, порт процесу й проксі,
  стан сервісу в Railway. Успішний ping цього не перевіряє.
- **Помилка міграції:** перевірте DATABASE_URL, доступність БД та migration logs.
- **Працює curl, але браузер блокує API:** перевірте `WEB_ORIGIN`, публічний API URL
  у frontend bundle та HTTPS. Налаштування CORS не виправляє недоступний контейнер.
- **404 на `/api-panel`:** перевірте NODE_ENV та API_PANEL_ENABLED саме в API,
  не у Web/Admin; після зміни потрібен restart.

## Гілки та CI

Production-сервіси мають явно відстежувати `main`; GitHub default branch — `dev`.
Задачі йдуть через PR у `dev`, релізи — PR `dev → main`. CI перевіряє обидва
frontend, API/domain тести та ізольований PostgreSQL-сценарій. Див.
[DEVELOPMENT.md](DEVELOPMENT.md). Workflow не змінює налаштування Railway
і не створює staging; його branch, деплой-тригери й результат треба перевірити окремо.
