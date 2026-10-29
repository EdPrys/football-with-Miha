// Posts event announcements to the Telegram channel (@kopankapro in prod).
// Without TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID every call is a silent no-op,
// so local/dev never depends on it.
export async function postToTelegram(text: string): Promise<number | null> {
  const result = await callTelegram('sendMessage', { text, parse_mode: 'HTML' });
  return (result as { message_id?: number } | null)?.message_id ?? null;
}

/** Takes a channel post down (e.g. its game was deleted). */
export async function deleteTelegramMessage(messageId: number): Promise<void> {
  await callTelegram('deleteMessage', { message_id: messageId });
}

/** Calls the Bot API for the configured channel; logs and swallows failures. */
async function callTelegram(method: string, params: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, ...params }),
    });
    if (!res.ok) {
      console.error(`Telegram ${method} failed:`, res.status, await res.text());
      return null;
    }
    return ((await res.json()) as { result?: unknown }).result ?? null;
  } catch (err) {
    console.error(`Telegram ${method} failed:`, err);
    return null;
  }
}
