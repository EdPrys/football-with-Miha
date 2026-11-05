import { describe, expect, it } from 'vitest';
import { playerInvitation, sharedGameUrl } from './game-sharing';
describe('organizer group invitations', () => {
  it('preserves an opaque acquisition campaign for player registration', () => {
    const url = new URL(
      sharedGameUrl('https://kopanka.pro', 'event1', 'organizers_pilot__0123456789abcdef'),
    );
    expect(url.pathname).toBe('/events/event1');
    expect(url.searchParams.get('utm_source')).toBe('telegram');
    expect(url.searchParams.get('utm_campaign')).toBe('organizers_pilot__0123456789abcdef');
    const invitation = playerInvitation(url.href);
    expect(invitation).toContain('Зареєструйтесь');
    expect(invitation).toContain('місце в команді');
    expect(invitation).toContain(url.href);
  });
  it('leaves ordinary shares unchanged and rejects invalid campaign data', () => {
    expect(sharedGameUrl('https://kopanka.pro', 'event1')).toBe(
      'https://kopanka.pro/events/event1',
    );
    expect(sharedGameUrl('https://kopanka.pro', 'event1', 'user@example.com')).toBe(
      'https://kopanka.pro/events/event1',
    );
  });
});
