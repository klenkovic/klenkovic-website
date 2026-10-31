import { trackAnalyticsEvent } from './analytics';

const root = document.documentElement;
const themeToggle = document.querySelector<HTMLButtonElement>('.theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: light)');

function syncThemeLabel() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  themeToggle?.setAttribute('aria-label', `Switch to ${next} theme`);
  themeToggle?.setAttribute('title', `Switch to ${next} theme`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'light' ? '#faf6f4' : '#18171c');
}

if (themeToggle) {
  themeToggle.hidden = false;
  syncThemeLabel();
  themeToggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* The switch still works without storage. */ }
    syncThemeLabel();
  });
}

systemTheme.addEventListener('change', (event) => {
  let saved;
  try { saved = localStorage.getItem('theme'); } catch {}
  if (saved !== 'dark' && saved !== 'light') {
    root.dataset.theme = event.matches ? 'light' : 'dark';
    syncThemeLabel();
  }
});

const dialog = document.querySelector<HTMLDialogElement>('#cv-dialog');
const form = document.querySelector<HTMLFormElement>('#cv-form');
let requestOpener: HTMLElement | null = null;

if (dialog && form) {
  document.querySelectorAll<HTMLAnchorElement>('[data-cv-request]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      requestOpener = link;
      dialog.showModal();
      if (form.querySelector('altcha-widget')) {
        void import('altcha').catch(() => {
          const status = document.querySelector<HTMLElement>('#form-status');
          if (status) status.textContent = 'The spam check couldn’t load. Please reload and try again.';
        });
      }
      trackAnalyticsEvent('cv_request_open');
    });
  });

  dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => requestOpener?.focus());
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, textarea')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector<HTMLElement>('#form-status');
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!status || !submit || form.dataset.configured !== 'true' || !form.reportValidity()) return;
    const fields = new FormData(form);
    if (!String(fields.get('altcha') || '').trim()) {
      status.textContent = 'Please complete the spam check first.';
      return;
    }
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: JSON.stringify(Object.fromEntries(fields.entries())), headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Submission failed');
      trackAnalyticsEvent('generate_lead');
      form.reset();
      status.textContent = 'Request received. Thank you — I’ll be in touch.';
    } catch {
      status.textContent = 'Couldn’t send your request. Please try again.';
    } finally {
      form.querySelector('altcha-widget')?.reset();
      submit.disabled = false;
    }
  });
}

// Enable the color reveal after decode. CSS smoothly follows hover/focus on desktop,
// while touch devices reveal on entry. No animation-name changes or restart jumps.
const portraitImage = document.querySelector<HTMLImageElement>('.portrait-frame > img');
const portraitFrame = document.querySelector<HTMLElement>('.portrait-frame');
if (portraitImage && portraitFrame) {
  void portraitImage.decode().catch(() => {}).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => portraitFrame.classList.add('is-color-ready')));
  });
}
