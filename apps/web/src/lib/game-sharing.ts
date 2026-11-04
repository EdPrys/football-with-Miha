const campaignPattern = /^[a-z0-9_]{1,100}__[a-f0-9]{16}$/;
export function sharedGameUrl(origin: string, eventId: string, campaign?: string | null): string {
  const url = new URL(`/events/${encodeURIComponent(eventId)}`, origin);
  if (campaign && campaignPattern.test(campaign)) {
    url.searchParams.set('utm_source', 'telegram');
    url.searchParams.set('utm_medium', 'outreach');
    url.searchParams.set('utm_campaign', campaign);
  }
  return url.href;
}
export function playerInvitation(url: string): string {
  return `На наступну гру записуємось у Kopanka: ${url}\nЗареєструйтесь і займіть місце в команді — так усі бачитимуть склад.`;
}
