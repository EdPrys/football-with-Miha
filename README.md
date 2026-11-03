# Kopanka ⚽

Платформа аматорського футболу: знайти або створити гру → приєднатися й обрати
позицію → зіграти → оцінити партнерів → переглянути профіль.

Працюють API, вебзастосунок гравців та окрема адмінпанель. Мобільний застосунок
ще не реалізовано. Документація звірена з кодом 2026-11-03.

## Перший запуск

Потрібні Node.js 22 (Docker images використовують 22), pnpm 9.15.0 і Docker Compose.
Усі команди нижче виконуються з кореня репозиторію.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
# Prisma CLI читає env біля свого пакета; використовуємо ту саму конфігурацію.
# Для нового checkout, де packages/db/.env ще відсутній:
ln -s ../../.env packages/db/.env
pnpm db:up
pnpm db:generate
pnpm --filter @app/db migrate:deploy
pnpm db:seed
```

Не перезаписуйте наявні `.env`: перевірте, що DATABASE_URL вказує на локальну БД.
Міграції додають міста; seed імпортує перевірений каталог майданчиків і полів;
демокористувачів, паролів і матчів не створює. Зареєструйте власний тестовий акаунт.

Next.js читає власні env-файли, тому створіть їх окремо:

```sh
printf '%s\n' 'NEXT_PUBLIC_API_URL=http://localhost:4000' > apps/web/.env.local
printf '%s\n' 'NEXT_PUBLIC_API_URL=http://localhost:4000' > apps/admin-web/.env.local
pnpm dev
```

Для frontend обов'язковий лише `NEXT_PUBLIC_API_URL=http://localhost:4000`.
Секрети API в frontend env не потрібні; жоден секрет не повинен мати префікс
`NEXT_PUBLIC_`. API dev/start завантажують кореневий `.env`.

| Сервіс                  | Локальна адреса                 | Пакет            |
| ----------------------- | ------------------------------- | ---------------- |
| Вебзастосунок           | http://localhost:3000           | `@app/web`       |
| Адмінпанель             | http://localhost:3001           | `@app/admin-web` |
| API health              | http://localhost:4000/health    | `@app/api`       |
| Інтерактивна API-панель | http://localhost:4000/api-panel | `@app/api`       |
| tRPC transport          | http://localhost:4000/trpc      | `@app/api`       |

## Перший сценарій

1. Відкрийте `/api-panel`, виконайте `auth.register` або `auth.login`.
2. Додайте в Headers `Authorization: Bearer <token>`, перевірте `auth.me`.
3. Виконайте `users.requestOrganizer` — зараз роль MANAGER надається автоматично.
4. Через `venues.list` оберіть поле; створіть майбутню гру через `events.create`.
5. Приєднайтеся через `events.join`. Для перевірки взаємних оцінок потрібні два акаунти.
6. Організатор виконує `events.start`, потім `events.finish`; учасники можуть
   оцінювати співучасників і голосувати за MVP протягом 24 годин.

Дати та приклади запитів: [API.md](docs/API.md). Новий акаунт має роль PLAYER.
Для локальної адмінпанелі змініть роль свого тестового користувача на ADMIN
через `pnpm db:studio`; seed не створює адміністратора.

## Пошук і повторні ігри

На головній можна обрати місто; за відсутності ігор — підписатися на нові.
Підписки працюють лише всередині Kopanka для всіх дат міста, керування —
у сповіщеннях. Організатор вказує ціну, рівень та інструкції при створенні гри,
може відкрити її повторення на наступний майбутній тиждень. Повторення потребує
підтвердження форми й не копіює учасників. Кнопка «Запросити друга» поширює
посилання; після входу за цим посиланням гравець повертається до гри.

Потрібна міграція `20261103120000_game_discovery` (`pnpm --filter @app/db migrate:deploy`).

## Структура й документація

```text
apps/api          Fastify 5 + tRPC 11 + Zod 3 + SuperJSON
apps/web          Next.js 16 + React 19: інтерфейс гравців та організаторів
apps/admin-web    Next.js: керування користувачами й каталогом
packages/domain   бізнес-правила та їхні тести
packages/db       Prisma 6: схема, міграції, каталог
```

- [API: панель, авторизація, процедури й приклади](docs/API.md)
- [Архітектура, модель даних та місця змін](docs/ARCHITECTURE.md)
- [Деплой, змінні середовища й діагностика](docs/DEPLOYMENT.md)
- [Повний прогін із синтетичними гравцями](docs/FULL_JOURNEY.md)
- [Звіт про зручність гравців і перевірки](docs/PLAYER_COMFORT.md)
- [Сценарій тестування на телефонах](docs/USABILITY_TEST.md)
- [Поточні правила продукту](docs/PRODUCT_PLAN.md)
- [Навички, зірки та MVP](docs/SKILLS.md)
- [Перевірений каталог майданчиків](data/venues/README.md)
- [Незавершені задачі та перевірки](docs/BACKLOG.md)
- [Інструкції для внесення змін](CLAUDE.md)

## Перевірки та розробка

```sh
pnpm typecheck
pnpm test
pnpm build                 # frontend production builds
pnpm --filter @app/api dev # лише API
pnpm db:migrate            # створити локальну міграцію після зміни schema.prisma
pnpm db:studio
```

Commit містить зміни схеми разом із міграцією. На сервері застосовуйте
`migrate:deploy`, а не `migrate:dev`. Тести API/domain використовують підміни
репозиторіїв; вони не замінюють перевірку реального сценарію з PostgreSQL.
