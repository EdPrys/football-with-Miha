# Прогін із тестовими гравцями

Дата: 2026-11-03. Результат: **пройшов**.
Машинний звіт: [FULL_JOURNEY_RESULT.json](FULL_JOURNEY_RESULT.json).

Створено **14 синтетичних акаунтів**: 12 гравців, організатор та адміністратор.
Виконано **18 етапів, 154 HTTP-запити, 35 очікуваних відмов**, створено 6 ігор.
Неочікуваних помилок за цими сценаріями не виявлено. Дані прибрані після прогону.
Це не доводить відсутності будь-яких помилок поза перевіреними сценаріями.

## Як перевірено

Скрипт `apps/api/scripts/check-full-journey.mts` використовує реальний tRPC client,
HTTP batching і SuperJSON. HTTP-запити проходять через Fastify.inject, справжні
маршрути, JWT context, Argon2 та окрему PostgreSQL-базу з усіма міграціями з нуля.
TCP/TLS, браузер і reverse proxy в цей прогін не входять. Domain та БД не замокані;
синтетичними є акаунти, майданчик та ігри.

Організатор отримує MANAGER через звичайний requestOrganizer. Адміністратор —
ізольована bootstrap fixture: його роль задається напряму в тестовій БД,
бо самостійного отримання ADMIN в продукті немає. Для перевірки часових вікон
використані тестові дати, параметр now у job та зміна дат тільки тестової гри;
реальні години/дні очікування не проходили.

Telegram і S3 примусово вимкнені до завантаження застосунку. Аватар перевірявся
як збереження посилання, без завантаження зображення з зовнішнього сервера.
Жодних повідомлень реальним користувачам не надсилали. Паролі й JWT не записані
у звіт; звіт містить лише підсумки та назви перевірок.

## Покриті сценарії

| Етап                                                                                      | Результат                      |
| ----------------------------------------------------------------------------------------- | ------------------------------ |
| Реєстрація, вхід, профіль, JWT та зміна ролі організатора                                 | Пройшов                        |
| Неправильний пароль, дубль email, невалідний/прострочений JWT, заборонене підвищення ролі | Відхилено як очікувалось       |
| Місто, аватар-посилання, шість навичок, валідація значень                                 | Пройшов                        |
| Створення комплексу/поля, доступи Manager/Admin, підписки за містом                       | Пройшов                        |
| Гра з ціною, рівнем, контактами та запрошеннями, фільтрація міст, міські сповіщення       | Пройшов                        |
| Прийняття/відхилення запрошення без автоматичного запису                                  | Пройшов                        |
| Заповнення команд, відмова другому воротарю, повторному й зайвому учаснику                | Пройшов                        |
| Лист очікування, звільнення місця, сповіщення, два конкурентні претенденти                | Лише один зайняв останнє місце |
| Розширення до Team C/D і обмеження в 4 команди                                            | Пройшов                        |
| Добровільне нагадування, два паралельні scheduler, повторний opt-in, приватність flags    | Одне нагадування без дубля     |
| Балансування команд, один воротар у команді, заборона виходу менш ніж за годину           | Пройшов                        |
| Повторення гри без копіювання учасників, запрошень і результатів                          | Пройшов                        |
| Керування лише організатором, початок/завершення, ATTENDED і rating-available             | Пройшов                        |
| Зірки: самооцінювання/сторонній/дубль заборонені; atomic batch; 0 пропускається           | Пройшов                        |
| MVP: голоси, паралельне завершення, один переможець, нагорода, профіль та історія         | Пройшов                        |
| Закриття рейтингу через 24 години, прочитання сповіщень                                   | Пройшов                        |
| Скасування, видалення порожньої гри, очищення залежностей та відписка                     | Пройшов                        |
| Автозавершення/скасування прострочених ігор, повторний job, закриття MVP без голосів      | Пройшов                        |

## Як повторити

З кореня репозиторію, при запущеному локальному Postgres:

```sh
docker exec football-postgres createdb -U football kopanka_journey_test
DATABASE_URL='postgresql://football:football@localhost:5432/kopanka_journey_test?schema=public' pnpm --filter @app/db migrate:deploy
INTEGRATION_DATABASE_URL='postgresql://football:football@localhost:5432/kopanka_journey_test?schema=public' pnpm test:journey
# Видаляйте лише створену вище тимчасову тестову БД.
docker exec football-postgres dropdb -U football kopanka_journey_test
```

Скрипт приймає лише localhost/127.0.0.1 і назву БД `kopanka_journey_test*`.
Він вимагає порожню таблицю User при старті; якщо це не так, не очищує її.
За замовчуванням після прогону очищує власну одноразову тестову БД від
сповіщень, ігор, майданчиків та акаунтів. `KEEP_E2E_FIXTURES=true` залишає
синтетичні дані для ручного огляду; після цього повторний прогін потребує
нової порожньої БД. Цю змінну не слід використовувати для робочої БД.

## Що ще не перевірено цим прогоном

- Натискання, верстка, клавіатура, навігація та відновлення форм у живому браузері.
- Реальний імпорт календаря, системне sharing-меню, дозволи clipboard на телефонах.
- Production-домен, TLS/CORS за проксі, робочі Telegram/S3/GA4/Meta інтеграції.
- Реальна присутність на матчі: ATTENDED зараз встановлюється завершенням гри,
  це не незалежна перевірка явки.
- Зручність для живих користувачів: [USABILITY_TEST.md](USABILITY_TEST.md).

Календарні дані, безпечний auth return path і browser-storage helpers додатково
перевірені unit tests. Ці тести не замінюють натискань у браузері. Сервіс керування
інтерфейсом Mac у цій сесії недоступний, тому візуальний E2E не заявляється.

## Outreach activation extension (2026-11-04)

The journey now verifies a real Telegram/outreach signup cohort against
PostgreSQL: one organizer, two registered players (including one who leaves),
game creation, actual joining/attendance and repeat-game counts through the
read-only capability endpoint. It also checks that attribution is visible only
in self-auth responses and absent from public profiles. Telegram and model
providers remain disabled; the test creates no real messages.

Set `JOURNEY_REPORT_PATH` to write an isolated run report outside
`docs/FULL_JOURNEY_RESULT.json` when preserving that historical report.

## Password recovery extension (2026-11-05)

Journey now covers recovery through the real API/database: identical known/unknown
responses, case-insensitive recipient matching, cooldown, expiry, replacement,
concurrent single-use consumption, password verification and revocation of current
and legacy sessions. Only the provider HTTP call is mocked; no live email is sent.
Use `JOURNEY_REPORT_PATH` to preserve the historical report. See PASSWORD_RECOVERY.md.
