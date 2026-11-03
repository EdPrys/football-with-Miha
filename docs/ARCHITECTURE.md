# Архітектура Kopanka

Оновлено 2026-11-03. Модульний monorepo: API, два web-клієнти, спільні
бізнес-правила й PostgreSQL. React Native ще не реалізований.

## Пакети

| Шлях              | Відповідальність                                                            |
| ----------------- | --------------------------------------------------------------------------- |
| `apps/api`        | Fastify, tRPC routers, JWT context, Zod validation, інтеграції та scheduler |
| `apps/web`        | Next.js: гравці й організатори, пошук, матчі, профілі, рейтинги             |
| `apps/admin-web`  | Next.js: користувачі, ролі, редагування каталогу                            |
| `packages/domain` | Правила гри, участі, запрошень, рейтингів, MVP, ролей                       |
| `packages/db`     | Prisma schema/client, migrations, seed перевіреного каталогу                |

## Шлях запиту

```text
Web/Admin → tRPC /trpc → createContext (Bearer JWT → User із БД)
  → procedure: доступ за роллю + Zod input
  → domain: бізнес-інваріанти й перевірка власника/учасника
  → Prisma → PostgreSQL
```

Бізнес-операції з інваріантами реалізуються в domain; прості читання й частина
CRUD зараз виконують Prisma-запити прямо в routers. Окремого повного repository
layer немає. Domain приймає залежність від сховища, що дозволяє тестувати правила
без реальної БД. Не переносіть правила доступу лише у frontend.

Точка входу API: `src/index.ts`; HTTP routes: `src/server.ts`; склад router:
`src/routers/index.ts`; middleware доступу й domain errors: `src/trpc.ts`.
`buildServer()` не запускає listen або scheduler, тому доступний для HTTP tests.
Панель `/api-panel` читає той самий router та описи `.meta()`.

Клієнти імпортують типи `AppRouter`, `AppRouterInputs`, `AppRouterOutputs` із
`@app/api`. Кодогенерація не потрібна. SuperJSON передає Date та інші значення
без втрати типу; звичайний ISO string не замінює Date у вхідній Zod-схемі.

## Модель даних

Авторитетна схема: `packages/db/prisma/schema.prisma`.

- `User` має роль, місто, профіль, участі, запрошення, оцінки та сповіщення.
- `PlayerProfile` має шість `PlayerSkill`: самооцінка 1–100, 0 означає не заповнено.
- `City → Venue → Field → Event`: місто, комплекс, конкретне поле, гра.
  Характеристики комплексу й поля nullable, невідомі значення не вигадуються.
- `Event → Team`; `EventParticipant` зв'язує гру й користувача, зберігає команду,
  позицію та статус. Місткість гри обчислюється як кількість команд × гравці в команді.
- `Invitation`: запрошення конкретного користувача на гру.
- `Rating`: незмінна оцінка одного співучасника іншим за конкретну гру.
  Унікальність: `(eventId, raterId, rateeId)`. Навички від зірок не змінюються.
- `MvpVote`: один голос гравця за матч; `EventMvp`: визначені переможці.
- `RoleRequest`: історія запитів на роль організатора.
- `Notification`: внутрішні сповіщення користувача. `CityGameSubscription` має
  унікальний ключ userId/cityId; створення гри записує EVENT_CREATED для
  підписників того самого міста в одній транзакції, окрім організатора.
- `Event.priceMinor` — необов'язкова ціна з гравця в копійках UAH, `level` —
  GameLevel, `newcomerInfo` — публічні інструкції. Невідомі дані залишаються null.
  Повторення читає обмежений шаблон власної гри й використовує звичайний create.

## Стани, ролі й час

Event: `UPCOMING → IN_PROGRESS → FINISHED`; UPCOMING/IN_PROGRESS також можуть
перейти в CANCELLED. FINISHED і CANCELLED — кінцеві стани.
Participant: JOINED, CANCELLED, ATTENDED, NO_SHOW. Invitation: PENDING, ACCEPTED,
DECLINED. Правила переходів і операцій — у відповідних domain modules.

Ролі успадковують можливості: PLAYER < MANAGER < ADMIN. Усі можуть грати;
MANAGER/ADMIN створюють ігри та майданчики; ADMIN керує ролями й редагує каталог.
Керування конкретною грою перевіряє її organizerId, сама роль ADMIN не є підміною
перевірки власника. `users.requestOrganizer` зараз автоматично схвалює MANAGER.

Час у БД зберігається як UTC. Вікно зірок і MVP — 24 години від `finishedAt`.
Telegram показує час у Europe/Kyiv. Щоп'ять хвилин in-process scheduler закриває
прострочені ігри й вирішує прострочені MVP-голосування; він запускається з API index.

## Інтеграції

JWT auth, Argon2 password hashing; Telegram-публікації ігор (необов'язково);
S3-сумісне сховище аватарів (інакше inline); GA4/Meta Pixel та UTM у web.
Платежів і зовнішнього бронювання полів немає.

Конфігурація й мережа: [DEPLOYMENT.md](DEPLOYMENT.md).
Бізнес-правила: [PRODUCT_PLAN.md](PRODUCT_PLAN.md), [SKILLS.md](SKILLS.md).
