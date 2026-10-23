import { TRPCClientError } from '@trpc/client';

// API messages are English; players see Ukrainian. Unknown messages fall back
// to a generic text per error code, so a raw code like BAD_REQUEST never leaks.
const MESSAGES: Record<string, string> = {
  'Email is already registered': 'Цей email вже зареєстрований. Спробуй увійти.',
  'Invalid email or password': 'Невірний email або пароль',
  'Password must be at least 8 characters': 'Пароль має містити щонайменше 8 символів',
  'Password must contain a letter': 'Пароль має містити хоча б одну літеру',
  'Password must contain a digit': 'Пароль має містити хоча б одну цифру',
  'Already invited': 'Цього гравця вже запрошено',
  'This person already joined the event': 'Цей гравець вже в грі',
  'You already rated this player for this event': 'Ти вже оцінив цього гравця за цю гру',
  'You have already joined this event': 'Ти вже записаний на цю гру',
  'Only the organizer can manage this event': 'Керувати грою може лише організатор',
  'Only the organizer or a participant can invite others':
    'Запрошувати можуть лише організатор або учасники гри',
  'This invitation is not yours': 'Це запрошення не для тебе',
  'You can only rate players who attended the same match':
    'Оцінювати можна лише гравців, з якими ти грав у цьому матчі',
  'You cannot rate yourself': 'Не можна оцінювати самого себе',
  "You can't leave less than 1 hour before kick-off":
    'Не можна покинути гру менш ніж за годину до початку',
  'Can only invite to an upcoming event': 'Запрошувати можна лише на майбутні ігри',
  'Cannot leave an event that has started or ended':
    'Не можна покинути гру, яка вже почалась або завершилась',
  'Event is full': 'Усі місця вже зайняті',
  'Event is not open for joining': 'Запис на цю гру закритий',
  'Field is not active': 'Це поле зараз недоступне',
  'Ratings open only after the event is finished': 'Оцінювати можна лише після завершення гри',
  'This invitation was already answered': 'На це запрошення вже відповіли',
  'This team is full': 'У цій команді вже немає місць',
  'Event not found': 'Гру не знайдено',
  'Field not found': 'Поле не знайдено',
  'Invitation not found': 'Запрошення не знайдено',
  'Player not found': 'Гравця не знайдено',
  'User not found': 'Користувача не знайдено',
  'Venue not found': 'Майданчик не знайдено',
  'You already have organizer rights': 'Ти вже організатор',
  'Your request is already under review': 'Твій запит уже розглядається',
  'You are not an active participant': 'Ти не записаний на цю гру',
  'Team does not belong to this event': 'Ця команда не з цієї гри',
  'You cannot invite yourself': 'Не можна запросити самого себе',
  'endAt must be after startAt': 'Кінець гри має бути пізніше за початок',
  'playersPerTeam must be between 2 and 11': 'Формат гри — від 2 на 2 до 11 на 11',
  'This team already has a goalkeeper': 'У цій команді вже є воротар',
  'startAt must be in the future': 'Час початку має бути в майбутньому',
};

const FIELD_ERRORS: Record<string, string> = {
  email: 'Введи коректний email',
  name: "Введи ім'я",
  password: 'Введи пароль',
  avatarUrl: 'Не вдалося зберегти зображення',
};

const BY_CODE: Record<string, string> = {
  BAD_REQUEST: 'Перевір введені дані',
  UNAUTHORIZED: 'Увійди в акаунт, щоб продовжити',
  FORBIDDEN: 'Недостатньо прав для цієї дії',
  NOT_FOUND: 'Не знайдено',
  CONFLICT: 'Такий запис уже існує',
  PAYLOAD_TOO_LARGE: 'Файл завеликий',
  TOO_MANY_REQUESTS: 'Забагато спроб, спробуй трохи пізніше',
};

const FALLBACK = 'Щось пішло не так. Спробуй ще раз.';

function translate(message: string): string | undefined {
  if (MESSAGES[message]) return MESSAGES[message];
  // assertValidPassword joins several violations with "; ".
  const parts = message.split('; ');
  if (parts.length > 1 && parts.every((p) => MESSAGES[p])) {
    return parts.map((p) => MESSAGES[p]).join('. ');
  }
  if (/^An event needs at least \d+ teams$/.test(message)) {
    return `Потрібно щонайменше ${message.match(/\d+/)![0]} команди`;
  }
  if (message.startsWith('Cannot change event from'))
    return 'Цю дію зараз не можна виконати для гри';
  if (message.startsWith('Requires ')) return BY_CODE.FORBIDDEN;
  return undefined;
}

/** Turn any mutation/query error into a short Ukrainian sentence for a toast. */
export function errorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    const data = error.data as
      { code?: string; zodError?: Record<string, string[] | undefined> | null } | undefined;

    const fields = data?.zodError ? Object.keys(data.zodError) : [];
    if (fields.length > 0) {
      return fields.map((f) => FIELD_ERRORS[f] ?? BY_CODE.BAD_REQUEST).join('. ');
    }

    const translated = translate(error.message);
    if (translated) return translated;

    // No response at all: server down, offline or blocked by CORS.
    if (!data) return "Немає зв'язку з сервером. Перевір інтернет і спробуй ще раз.";

    return (data.code && BY_CODE[data.code]) || FALLBACK;
  }
  return FALLBACK;
}
