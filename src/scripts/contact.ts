import { trackAnalyticsEvent } from './analytics';

type Turnstile = {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

let apiPromise: Promise<Turnstile> | undefined;
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error('Spam check unavailable')); };
    const timeout = window.setTimeout(fail, 12000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      if (!window.turnstile) return fail();
      window.turnstile.ready(() => { clearTimeout(timeout); resolve(window.turnstile!); });
    };
    document.head.append(script);
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}

const dialog = document.querySelector<HTMLDialogElement>('#cv-dialog');
const form = document.querySelector<HTMLFormElement>('#cv-form');
let requestOpener: HTMLElement | null = null;
let widgetId: string | undefined;
let rendering: Promise<void> | undefined;

if (dialog && form) {
  const status = form.querySelector<HTMLElement>('#form-status')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const container = form.querySelector<HTMLElement>('[data-turnstile-sitekey]');
  const prepareCheck = async () => {
    if (!container || widgetId !== undefined) return;
    if (rendering) return rendering;
    rendering = (async () => {
      try {
        const api = await loadTurnstile();
        widgetId = api.render(container, {
          sitekey: container.dataset.turnstileSitekey,
          action: 'cv_request', theme: document.documentElement.dataset.theme || 'auto', size: 'flexible',
          'expired-callback': () => { status.textContent = 'The spam check expired. Please complete it again.'; if (widgetId !== undefined) api.reset(widgetId); },
          'error-callback': () => { status.textContent = 'The spam check couldn’t load. Please reopen the form to try again, or message me on LinkedIn.'; },
        });
      } catch { status.textContent = 'The spam check couldn’t load. Please reopen the form to try again, or message me on LinkedIn.'; }
      finally { rendering = undefined; }
    })();
    return rendering;
  };
  document.querySelectorAll<HTMLAnchorElement>('[data-cv-request]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      requestOpener = link;
      dialog.showModal();
      if (widgetId !== undefined) window.turnstile?.reset(widgetId);
      void prepareCheck();
      trackAnalyticsEvent('cv_request_open');
    });
  });
  dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => requestOpener?.focus());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, textarea, iframe')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || form.dataset.configured !== 'true' || !form.reportValidity()) return;
    const fields = new FormData(form);
    if (!String(fields.get('cf-turnstile-response') || '').trim()) {
      status.textContent = 'Please complete the spam check first.';
      return;
    }
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: JSON.stringify(Object.fromEntries(fields.entries())),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        status.textContent = response.status === 429 ? 'Too many requests. Please wait a minute and try again, or message me on LinkedIn.' : 'Couldn’t confirm your request was sent. Please try again later or message me on LinkedIn.';
        return;
      }
      trackAnalyticsEvent('generate_lead');
      form.reset();
      status.textContent = 'Request received. Thank you — I’ll reply personally with my CV.';
    } catch {
      status.textContent = 'Couldn’t confirm your request was sent. Please try again later or message me on LinkedIn.';
    } finally {
      // Clear consumed tokens even if the widget did not load (e.g. a stale cached page).
      form.querySelectorAll<HTMLInputElement>('[name="cf-turnstile-response"]').forEach(input => { input.value = ''; });
      if (widgetId !== undefined) window.turnstile?.reset(widgetId);
      submit.disabled = false;
    }
  });
}
