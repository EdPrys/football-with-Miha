import { afterEach, describe, expect, it, vi } from 'vitest';
import { passwordMailConfig, passwordResetUrl, sendPasswordResetEmail } from './password-mail.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('password recovery email', () => {
  it('requires complete credentials and a trusted HTTPS application origin', () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'Kopanka <test@example.com>');
    vi.stubEnv('NODE_ENV', 'production');
    for (const appUrl of [
      '',
      'invalid',
      'http://kopanka.pro',
      'https://user:pass@kopanka.pro',
      'javascript:alert(1)',
    ]) {
      vi.stubEnv('APP_URL', appUrl);
      expect(passwordMailConfig()).toBeNull();
    }
    vi.stubEnv('APP_URL', 'https://kopanka.pro/ignored-path');
    expect(passwordMailConfig()?.appUrl).toBe('https://kopanka.pro');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(passwordMailConfig()).toBeNull();
  });

  it('permits HTTP only for local non-production development', () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'test@example.com');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('NODE_ENV', 'development');
    expect(passwordMailConfig()).not.toBeNull();
    vi.stubEnv('NODE_ENV', 'production');
    expect(passwordMailConfig()).toBeNull();
  });

  it('keeps recovery tokens out of URL queries and uses a fixed provider endpoint', async () => {
    const token = 'a'.repeat(64);
    const link = new URL(passwordResetUrl('https://kopanka.pro', token));
    expect(link.pathname).toBe('/reset-password');
    expect(link.search).toBe('');
    expect(new URLSearchParams(link.hash.slice(1)).get('token')).toBe(token);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"email1"}'));
    vi.stubGlobal('fetch', fetchMock);
    await sendPasswordResetEmail(
      { apiKey: 'test-key', from: 'test@example.com', appUrl: 'https://kopanka.pro' },
      'player@example.com',
      token,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toEqual(['player@example.com']);
    expect(body.text).toContain(link.toString());
    expect(body.text).toContain('30 хвилин');
  });

  it('does not expose provider bodies containing recipient or token details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private-recipient-and-token', { status: 429 })),
    );
    await expect(
      sendPasswordResetEmail(
        { apiKey: 'test-key', from: 'test@example.com', appUrl: 'https://kopanka.pro' },
        'player@example.com',
        'secret',
      ),
    ).rejects.toThrow('Password recovery email rejected (429)');
  });
});
