// Ad measurement: GA4 + Meta Pixel (each loads only when its env id is set)
// and remembering which ad/link brought the visitor, sent along on signup.

type Tracker = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Tracker;
    fbq?: Tracker;
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export type AnalyticsEvent = 'sign_up' | 'login' | 'join_event' | 'create_event';

// Meta optimizes ads for its standard events, so map ours onto them where one fits.
const META_EVENT: Record<AnalyticsEvent, { name: string; custom: boolean } | null> = {
  sign_up: { name: 'CompleteRegistration', custom: false },
  join_event: { name: 'Schedule', custom: false },
  create_event: { name: 'CreateGame', custom: true },
  login: null,
};

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event);
  const meta = META_EVENT[event];
  if (meta) window.fbq?.(meta.custom ? 'trackCustom' : 'track', meta.name);
}

export function trackPageView(): void {
  window.fbq?.('track', 'PageView');
}

export type Attribution = { source: string; medium?: string; campaign?: string };

const KEY = 'kp_attribution';

/** Remember where the visitor came from; the latest ad click wins. */
export function captureAttribution(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    let found: Attribution | null = null;
    const source = q.get('utm_source');
    if (source) {
      found = {
        source,
        medium: q.get('utm_medium') ?? undefined,
        campaign: q.get('utm_campaign') ?? undefined,
      };
    } else if (q.get('fbclid')) {
      found = { source: 'facebook', medium: 'click' };
    } else if (q.get('gclid')) {
      found = { source: 'google', medium: 'cpc' };
    } else if (!localStorage.getItem(KEY) && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host !== window.location.hostname) found = { source: host, medium: 'referral' };
    }
    if (found) localStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    /* ignore */
  }
}

export function getAttribution(): Attribution | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : undefined;
  } catch {
    return undefined;
  }
}
