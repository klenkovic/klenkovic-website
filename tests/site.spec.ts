import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('profile links are accessible and a portrait preview is visible while the image loads', async ({ page }) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if ((url.includes('/_image?') || url.includes('/_astro/kristijan.')) && /(?:avif|webp)/.test(url)) await imageGate;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const brand of ['GitHub', 'LinkedIn']) {
      const links = page.getByRole('link', { name: new RegExp(`Kristijan Lenković on ${brand}`) });
      await expect(links).toHaveCount(2);
      await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const frame = page.locator('.portrait-frame');
    const portrait = page.getByAltText('Portrait of Kristijan Lenković');
    await expect(frame).toHaveCSS('background-image', /data:image\/webp;base64/);
    expect(await portrait.evaluate((image: HTMLImageElement) => image.complete)).toBe(false);
    await expect(page.locator('link[rel="preload"][as="image"][type="image/avif"]')).toHaveCount(1);
    releaseImage();
    await expect(portrait).toHaveJSProperty('complete', true);
    expect(await portrait.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  } finally {
    releaseImage();
  }
});

test('cards reveal after entering the viewport and remain visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches('.impact-grid > article, .expertise-item')) {
        (window as any).cardRevealCount = ((window as any).cardRevealCount || 0) + 1;
        animation.pause();
      }
      return animation;
    };
  });
  await page.goto('/');
  await expect(page.locator('.theme-toggle')).toBeVisible();
  const card = page.locator('.impact-grid > article').first();
  await card.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 3, behavior: 'instant' }));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).cardRevealCount || 0)).toBe(0);
  await expect(card).toHaveCSS('opacity', '0');
  await card.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 160, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => (window as any).cardRevealCount || 0)).toBeGreaterThan(0);
  const initialCount = await page.evaluate(() => (window as any).cardRevealCount);
  const midpoint = await card.evaluate(element => {
    const animation = element.getAnimations()[0];
    animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    return { opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform };
  });
  expect(midpoint.opacity).toBeGreaterThan(0);
  expect(midpoint.opacity).toBeLessThan(1);
  expect(midpoint.transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  await page.evaluate(() => document.querySelectorAll('.impact-grid > article').forEach(element => element.getAnimations().forEach(animation => animation.finish())));
  await expect(card).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await card.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 160, behavior: 'instant' }));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).cardRevealCount)).toBe(initialCount);
  await expect(card).toHaveCSS('opacity', '1');
});

test('reduced motion keeps cards visible without a reveal animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const card = page.locator('.impact-grid > article').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCSS('opacity', '1');
  expect(await card.evaluate(element => element.getAnimations().length)).toBe(0);
});

test('enabling reduced motion reveals cards that have not entered yet', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const card = page.locator('#ai');
  await expect(card).toHaveCSS('opacity', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(card).toHaveCSS('opacity', '1');
  await expect(card).not.toHaveClass(/reveal-pending/);
});

test('themes follow the system, switch, and persist across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('system theme changes are followed until a preference is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('contact hides the recipient and cannot submit before setup', async ({ page }) => {
  await page.goto('/');
  expect(await page.content()).not.toContain('kristijan@lenkovic.com');
  expect(await page.locator('a[href^="mailto:"]').count()).toBe(0);
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  await expect(page.getByRole('button', { name: 'Send request' })).toBeDisabled();
  await expect(page.getByRole('status')).toHaveText('Contact form coming soon.');
});

test('form requires a CAPTCHA token and reports real server outcomes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Alex Morgan');
  await page.getByRole('textbox', { name: 'Your email' }).fill('alex@example.com');
  await page.getByRole('textbox', { name: 'Opportunity' }).fill('Engineering leadership role');
  // Mock configuration and server responses; no requests are delivered externally.
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('#cv-form')!;
    form.dataset.configured = 'true';
    form.action = 'https://contact.example.test/contact';
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = false;
  });
  const submit = page.getByRole('button', { name: 'Send request' });
  await submit.click();
  await expect(page.getByRole('status')).toHaveText('Please complete the spam check first.');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = 'altcha'; input.value = 'mock-token';
    document.querySelector('#cv-form')!.append(input);
  });
  await page.route('https://contact.example.test/contact', route => route.fulfill({ status: 400, body: '{}' }));
  await submit.click();
  await expect(page.getByRole('status')).toHaveText('Couldn’t send your request. Please try again.');
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Alex Morgan');
  await page.route('https://contact.example.test/contact', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await submit.click();
  await expect(page.getByRole('status')).toHaveText('Request received. Thank you — I’ll be in touch.');
});

test('dialog traps keyboard focus and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} page and request dialog pass accessibility checks`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: 'Request my CV' }).first().click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('page and dialog fit narrow and wide screens', async ({ page }) => {
  for (const width of [320, 390, 600, 768, 900, 901, 1024, 1100, 1101, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: width <= 600 ? 568 : 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    for (const [name, target] of [['Approach', '#expertise'], ['Experience', '#impact'], ['AI', '#ai'], ['Technologies', '#technologies'], ['Contact', '#contact']]) {
      const link = navigation.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toBeInViewport({ ratio: 1 });
      await expect(link).toHaveAttribute('href', target);
      await expect(page.locator(target)).toHaveCount(1);
    }
    if (width <= 600) {
      const rows = await navigation.locator('a').evaluateAll(links => links.map(link => Math.round(link.getBoundingClientRect().top)));
      expect(new Set(rows).size, `Navigation must remain on one line at ${width}px`).toBe(1);
      const portrait = await page.locator('.portrait-frame').boundingBox();
      const label = await page.locator('.location-tag').boundingBox();
      expect(label!.x).toBeGreaterThan(portrait!.x + portrait!.width);
      await expect(page.getByAltText('Portrait of Kristijan Lenković')).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 });
    }
    const portrait = await page.locator('.portrait-frame').boundingBox();
    expect(portrait!.x).toBeGreaterThanOrEqual(0);
    expect(portrait!.x + portrait!.width).toBeLessThanOrEqual(width);
    const proof = await page.locator('.proof-strip').boundingBox();
    const actions = await page.locator('.hero-actions').boundingBox();
    expect(proof!.y + proof!.height).toBeLessThanOrEqual(actions!.y);
    expect(await page.locator('.proof').evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth))).toBe(true);
    expect(await page.locator('.site-footer').evaluate(footer => {
      const copyright = footer.querySelector('p')!.getBoundingClientRect();
      return [...footer.children].filter(element => element.tagName !== 'P').every(element => element.getBoundingClientRect().bottom <= copyright.top);
    })).toBe(true);
    const bounds = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if (width === 2560) {
      expect(await page.locator('.expertise-item > p').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(20);
      for (const selector of ['.tags li', '.section-marker .eyebrow', '.footer-privacy', '.proof']) {
        expect(await page.locator(selector).first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(15);
      }
    }
    await page.getByRole('link', { name: 'Request my CV' }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Close CV request' })).toBeInViewport();
    await page.keyboard.press('Escape');
  }
});

test('static content works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByAltText('Portrait of Kristijan Lenković')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request my CV' }).first()).toHaveAttribute('href', '#contact');
  await expect(page.locator('.theme-toggle')).toBeHidden();
  const logo = page.locator('.technology-logo-art noscript img').first();
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox())!.width).toBeLessThanOrEqual(64);
  await context.close();
});
