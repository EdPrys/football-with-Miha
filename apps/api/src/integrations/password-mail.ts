import { PASSWORD_RESET_MINUTES } from '@app/domain';

export function passwordMailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !from || !appUrl) return null;
  try {
    const url = new URL(appUrl);
    if (url.username || url.password) return null;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production')
    )
      return null;
    return { apiKey, from, appUrl: url.origin };
  } catch {
    return null;
  }
}

/** Token goes in the fragment: it never reaches the frontend HTTP access log. */
export function passwordResetUrl(appUrl: string, token: string): string {
  const url = new URL('/reset-password', appUrl);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function sendPasswordResetEmail(
  config: NonNullable<ReturnType<typeof passwordMailConfig>>,
  email: string,
  token: string,
): Promise<void> {
  const url = passwordResetUrl(config.appUrl, token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: 'Відновлення пароля Kopanka',
      text: `Щоб встановити новий пароль Kopanka, відкрий посилання:\n\n${url}\n\nПосилання діє ${PASSWORD_RESET_MINUTES} хвилин і лише один раз. Якщо ти не просив відновлення, проігноруй цей лист — пароль не зміниться.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // Do not include provider response bodies: they can contain recipient details.
  if (!response.ok) throw new Error(`Password recovery email rejected (${response.status})`);
}
