type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};
const analyticsWindow = window as AnalyticsWindow;
const panel = document.querySelector<HTMLElement>('#analytics-consent');
const measurementId = panel?.dataset.measurementId;
const storageKey = 'analytics-consent-v1';
let accepted = false;
let loaded = false;

function savedChoice(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return saved && Date.now() < saved.expires ? saved.choice : null;
  } catch { return null; }
}

function startAnalytics() {
  if (!measurementId || loaded) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = false;
  loaded = true;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.gtag = function (..._args: unknown[]) { analyticsWindow.dataLayer!.push(arguments); };
  analyticsWindow.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  analyticsWindow.gtag('consent', 'update', { analytics_storage: 'granted' });
  analyticsWindow.gtag('js', new Date());
  let referrer = '';
  try { referrer = new URL(document.referrer).origin; } catch { /* No referrer. */ }
  analyticsWindow.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 180 * 86400,
    page_location: `${location.origin}${location.pathname}`,
    page_referrer: referrer,
  });
  analyticsWindow.gtag('event', 'page_view', { send_to: measurementId });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

export function trackAnalyticsEvent(name: 'cv_request_open' | 'generate_lead') {
  if (accepted && measurementId) analyticsWindow.gtag?.('event', name, { send_to: measurementId });
}

function clearAnalyticsCookies() {
  const hostname = location.hostname.split('.');
  const domains = ['', ...hostname.map((_, index) => `.${hostname.slice(index).join('.')}`)];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}; SameSite=Lax`;
    }
  }
}

if (panel && measurementId) {
  accepted = savedChoice() === 'granted';
  panel.hidden = savedChoice() !== null;
  if (accepted) startAnalytics();
  document.querySelectorAll<HTMLButtonElement>('[data-analytics-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      panel.hidden = false;
      panel.querySelector<HTMLButtonElement>('button')?.focus();
    });
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-analytics-choice]').forEach(button => {
    button.addEventListener('click', () => {
      accepted = button.dataset.analyticsChoice === 'granted';
      try { localStorage.setItem(storageKey, JSON.stringify({ choice: accepted ? 'granted' : 'denied', expires: Date.now() + 180 * 86400000 })); } catch {}
      panel.hidden = true;
      if (accepted) startAnalytics();
      else {
        // Stop an already loaded tag and reload without it; do not send denied-consent pings.
        (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
        clearAnalyticsCookies();
        if (loaded) location.reload();
      }
    });
  });
}
