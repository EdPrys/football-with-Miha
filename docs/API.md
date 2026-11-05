# API Kopanka

API — tRPC 11 поверх Fastify, вхідні дані перевіряє Zod 3, транспортний
серіалізатор — SuperJSON. Це RPC API, а не REST або GraphQL.

## Інтерактивна панель

Запустіть API та відкрийте http://localhost:4000/api-panel. Панель `trpc-ui`
будується з поточного `appRouter`: показує процедури, їхні описи, параметри,
дозволяє виконувати запити та переглядати відповіді. Нові процедури з'являються
автоматично після перезапуску API; описи додавайте через `.meta({ description })`,
пояснення полів — через Zod `.describe()`.

За замовчуванням панель доступна лише при `NODE_ENV=development` (це також
локальне значення за замовчуванням). `API_PANEL_ENABLED=true` вмикає її явно,
`false` вимикає в будь-якому середовищі. Коли вимкнена, `/api-panel` повертає 404.
Панель надсилає запити на `/trpc` того самого origin, тому працює за доменом
проксі без hardcoded localhost. Відповідь HTML кешується в процесі, не в браузері.

Це живі запити до БД поточного середовища. Панель не створює додаткових прав:
всі перевірки JWT, ролей і власника гри діють як у вебзастосунку. Сама сторінка
панелі не вимагає входу; якщо вмикаєте її на сервері, обмежуйте доступ до сторінки
на рівні приватного середовища/проксі. Для повсякденної роботи використовуйте
локальну або тестову БД.

## Авторизація

Виконайте `auth.register` або `auth.login` та скопіюйте `token` із відповіді.
У редакторі Headers панелі задайте:

```json
{ "Authorization": "Bearer <token>" }
```

Перевірте `auth.me`. Токен — JWT, стандартний строк дії 7 днів
(`JWT_EXPIRES_IN`). Після зміни ролі новий токен не потрібен: користувач і роль
читаються з БД у контексті кожного запиту. Для іншого акаунта замініть заголовок.
Панель має власні заголовки, вхід у вебзастосунок не авторизує її автоматично.

| Доступ    | Значення                                          |
| --------- | ------------------------------------------------- |
| Public    | Без токена                                        |
| Auth      | Будь-який користувач із валідним Bearer-токеном   |
| Manager   | MANAGER або ADMIN                                 |
| Admin     | Тільки ADMIN                                      |
| Organizer | Auth + перевірка власника конкретної гри в domain |

## SuperJSON і дати

У JSON-редакторі панелі дані кладуться всередину `json`. Дати позначаються в
`meta.values`, щоб бекенд отримав `Date`, а не рядок. Для типів на кшталт Date
використовуйте JSON-режим; якщо клієнтська валідація заважає, вимкніть
`Validate input on client` — серверна валідація залишається обов'язковою.

Приклад `events.create` (підставте реальний fieldId та майбутній час):

```json
{
  "json": {
    "fieldId": "<field-id-from-venues.list>",
    "startAt": "2030-06-01T15:00:00.000Z",
    "endAt": "2030-06-01T16:00:00.000Z",
    "numberOfTeams": 2,
    "playersPerTeam": 5,
    "invitedUserIds": []
  },
  "meta": { "values": { "startAt": ["Date"], "endAt": ["Date"] } }
}
```

Приклад `events.join`:

```json
{ "json": { "eventId": "<event-id>", "position": "MID" } }
```

## Процедури

Точні вхідні схеми дивіться в панелі або в `apps/api/src/routers/*.ts`.
Точні типи результатів експортуються як `AppRouterOutputs` із `@app/api`;
панель показує фактичну відповідь після виклику, не є повною OpenAPI-схемою відповідей.

| Router          | Queries                                            | Mutations                                                                                                                        | Доступ                                                                                                         |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `auth`          | `me`                                               | `register`, `login`                                                                                                              | register/login Public; me Auth                                                                                 |
| `cities`        | `list`                                             | —                                                                                                                                | Public                                                                                                         |
| `venues`        | `list`, `get`                                      | `create`, `addField`, `update`, `updateField`                                                                                    | Читання Public; створення Manager; редагування Admin                                                           |
| `events`        | `list`, `get`, `mine`, `repeatTemplate`, `myState` | `create`, `join`, `leave`, `start`, `finish`, `cancel`, `delete`, `balanceTeams`, `updateContacts`, `setWaitlist`, `setReminder` | list/get Public; mine/join/leave Auth; create Manager; repeatTemplate Manager + Organizer; керування Organizer |
| `players`       | `profile`, `matchHistory`, `inCity`, `teammates`   | `updateMySkills`                                                                                                                 | profile/history Public; inCity Manager; skills/teammates Auth                                                  |
| `users`         | `findByEmail`, `list`                              | `updateAvatar`, `updateCity`, `requestOrganizer`, `setRole`                                                                      | list/setRole Admin; решта Auth                                                                                 |
| `invitations`   | `candidates`, `received`                           | `send`, `sendMany`, `respond`                                                                                                    | Auth + перевірки учасників/стану в domain                                                                      |
| `ratings`       | `rateableTargets`                                  | `submit`                                                                                                                         | Auth, оцінювати можуть співучасники завершеної гри                                                             |
| `mvp`           | `status`                                           | `vote`                                                                                                                           | status Public; vote Auth + правила участі                                                                      |
| `notifications` | `mine`, `gameSubscriptions`                        | `markRead`, `markAllRead`, `subscribeCity`                                                                                       | Auth, тільки власні сповіщення та підписки                                                                     |

Основні відповіді: auth повертає `{ token, user }`; events.create — `{ id, invited }`;
events.join — `{ participantId, status, position }`; ratings.submit — `{ saved }`.

## Приклади HTTP без панелі

Публічний запит без аргументів:

```sh
curl 'http://localhost:4000/trpc/cities.list'
```

Вхід (використовуйте локальний тестовий акаунт):

```sh
curl 'http://localhost:4000/trpc/auth.login' \
  -H 'Content-Type: application/json' \
  --data '{"json":{"email":"developer@example.test","password":"LocalTest123"}}'
```

Захищений запит:

```sh
curl 'http://localhost:4000/trpc/auth.me' \
  -H 'Authorization: Bearer <token>'
```

SuperJSON-відповідь загорнута в `result.data`; для login токен знаходиться у
`result.data.json.token`. Для `query` з аргументами використовуйте GET із
URL-encoded `input`, для `mutation` — POST. Браузерні клієнти використовують
`httpBatchLink` і можуть об'єднувати операції; приклади вище — одиночні виклики.

## Помилки

| tRPC code               | Причина                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `UNAUTHORIZED`          | Немає користувача: відсутній, невалідний або прострочений токен |
| `FORBIDDEN`             | Недостатня роль або немає права на конкретну операцію           |
| `BAD_REQUEST`           | Zod-валідація, порушення бізнес-правил або недопустимий стан    |
| `NOT_FOUND`             | Гра, користувач чи майданчик не знайдені                        |
| `CONFLICT`              | Конфлікт, наприклад повторна участь або оцінка                  |
| `INTERNAL_SERVER_ERROR` | Неочікувана помилка; перевірте API logs                         |

`error.data.zodError` містить помилки полів, коли причиною є Zod.
Джерело відображення domain-помилок: `apps/api/src/trpc.ts`.

## Додавання операції

1. Бізнес-правило і його перевірки — в `packages/domain`, доступ до БД — через Prisma.
2. У router виберіть public/protected/manager/admin procedure, додайте Zod input,
   `.meta({ description })` з доступом і поведінкою та resolver.
3. Новий router підключіть у `apps/api/src/routers/index.ts`.
4. Запустіть typecheck і тести; перевірте операцію в панелі. При зміні груп
   операцій оновіть таблицю вище.

Пакет панелі: [trpc-ui](https://github.com/aidansunbury/trpc-ui).
Панель використовує вбудовану клієнтську збірку; Monaco JSON editor може
завантажувати ресурси з CDN, тому для повної роботи редактора може бути потрібен інтернет.

## Пошук, умови гри, повторення й підписки (2026-11-03)

- `events.list` приймає необов'язковий `cityId` разом з іншими фільтрами.
- `events.create`: `priceMinor?: number | null` — ціна з гравця в копійках UAH,
  ціле 0–100000000; null/відсутнє — невідомо, 0 — безкоштовно. `level`:
  BEGINNER, CASUAL, COMPETITIVE, ALL_LEVELS або null. `newcomerInfo`: текст до
  2000 символів або null; публічні інструкції від організатора. Оплат через API немає.
- `events.repeatTemplate({ eventId })`: Manager + перевірка organizerId. Повертає
  лише поле, комплекс/місто, дати, формат і умови. Це query, нову гру не створює.
  Web пропонує наступний майбутній тиждень за локальним часом браузера,
  після перевірки форма викликає звичайний create. Учасники/запрошення/результати
  джерела не копіюються; нові запрошення можна обрати явно.
- `notifications.gameSubscriptions()`: лише власні підписки з назвами міст.
- `notifications.subscribeCity({ cityId, subscribed })`: opt-in/відписка поточного
  користувача; повторний opt-in не створює дубль. Підписка постійна, на всі дати
  міста, не успадковує тимчасовий фільтр дат. Відписка не видаляє старі сповіщення.
- Створення гри та EVENT_CREATED для підписників міста виконуються однією
  транзакцією. Сам організатор не отримує сповіщення на власну гру.
  Payload: eventId, eventStartAt (ISO), cityName, venueName. Це не запрошення,
  не бронює місце й не записує користувача в гру. Зовнішньої доставки немає.
- `/login?next=<internal-path>` повертає після входу/реєстрації на локальний шлях;
  зовнішні, некоректні URL і циклічний `/login` відхиляються на користь `/profile`.

## Зручність для гравців (2026-11-03)

- `events.create` / `repeatTemplate`: додано необов'язкові публічні
  organizerPhone (7–15 цифр, дозволені форматувальні символи) та organizerTelegram
  (username, без URL; @ на вході необов'язковий). Відсутні контакти не виводяться з акаунта.
- `events.updateContacts({ eventId, organizerPhone, organizerTelegram })`: лише
  організатор конкретної гри; null/порожні значення очищують контакти. Обидва
  поля — заміна набору контактів, не partial patch.
- `events.myState({ eventId })`: Auth, тільки власні participant status,
  remindBeforeGame/reminderSentAt та waiting. Публічний `events.get` цих flags не містить.
- `events.setWaitlist({ eventId, waiting })`: Auth, явна згода на внутрішні
  SLOT_AVAILABLE для заповненої майбутньої гри; унікальність eventId/userId,
  opt-out доступний і після закриття гри. Учасник не може стати в лист очікування.
  Вихід гравця/додавання команди повідомляє всіх підписаних неучасників.
  Черга не резервує слот, не має FIFO-гарантії й не записує автоматично.
- `events.setReminder({ eventId, enabled })`: Auth, лише власна JOINED-участь.
  Opt-in можливий до початку UPCOMING-гри. Scheduler раз на 5 хвилин створює
  EVENT_APPROACHING, якщо до початку лишилося не більше години й більше нуля.
  Перемикання off/on після відправлення не скидає маркер. Вихід вимикає
  нагадування, повторний запис починається з вимкненого налаштування.
- Запис/вихід/лист очікування та reminder job узгоджені event row lock.
  Нагадування й sent marker атомарні; конкурентні scheduler replicas не дублюють доставку.
- Нові сповіщення мають payload eventId, eventStartAt (ISO). Канал — тільки
  внутрішній, без email/push. Деталі та відтворення перевірок: [PLAYER_COMFORT.md](PLAYER_COMFORT.md).

### З ким грав

`players.teammates({ page: 0 })` — авторизований користувач отримує лише свій
список партнерів і суперників. Обидва мають статус ATTENDED у спільній FINISHED
грі. Повертає `items` (id, name, avatarUrl, city.name, sharedMatches, stars) та
`hasMore`; по 24 гравці на сторінку, сортування за кількістю спільних матчів,
потім id. Email, контакти та приватні налаштування не повертаються.
Список обчислюється з історії, без запису дружби й окремої міграції.
`players.matchHistory` повертає лише ATTENDED-участь у завершених іграх;
скасовані записи й неявки не є зіграними матчами.

## Optional organizer outreach counts

`POST /internal/outreach/metrics` is separate from tRPC and absent unless
`OUTREACH_METRICS_TOKEN` (32+ characters) is set. A dedicated Bearer token and
`{ "campaign": "organizers_pilot__0123456789abcdef" }` return aggregate cohort
counts only; campaign must match `OUTREACH_CAMPAIGN_PREFIX` (default
`organizers_pilot`). No user/admin JWT, identities or message contents are used.
Responses are not cached. See [OUTREACH_AGENT.md](OUTREACH_AGENT.md).

Authenticated `auth.me`, `auth.login` and `auth.register` responses include one's
own `outreachCampaign` only for a valid Telegram/outreach signup campaign. This
field is not added to public player/event profiles; organizers use it when
sharing their game invitation so new players can be attributed to the same group.

## Password recovery

- `auth.passwordRecoveryAvailable`: public query, `{ available }` from configuration.
- `auth.requestPasswordReset({ email })`: public mutation; generic `{ ok: true }`
  regardless of account existence/email budget. May return SERVICE_UNAVAILABLE
  (mail not configured) or TOO_MANY_REQUESTS (IP budget).
- `auth.resetPassword({ token, password })`: public mutation; consumes the recovery
  token, changes password and revokes previous sessions; returns `{ ok: true }`.
  Invalid/expired/used tokens return BAD_REQUEST. No automatic login.

Setup, limits and delivery caveats: [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md).
