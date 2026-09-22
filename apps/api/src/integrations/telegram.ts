// Posts event announcements to a Telegram channel. Off by default: until
// TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are set (the channel launches after
// release), this is a silent no-op so local/dev never depends on it.
export async function postToTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error('Telegram post failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Telegram post failed:', err);
  }
}
