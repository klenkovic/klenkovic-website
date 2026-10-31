import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('profile icons are accessible and the portrait reveals natural color with a reduced-motion fallback', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  for (const brand of ['GitHub', 'LinkedIn']) {
    const link = page.getByRole('link', { name: new RegExp(`Kristijan Lenković on ${brand}`) }).first();
    await expect(page.getByRole('link', { name: new RegExp(`Kristijan Lenković on ${brand}`) })).toHaveCount(2);
    await expect(link.locator('img')).toBeAttached();
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  const naturalPortrait = page.getByAltText('Portrait of Kristijan Lenković');
  await expect(naturalPortrait).toHaveCSS('filter', 'none');
  const tint = page.locator('.portrait-tint');
  await expect(tint).toHaveCSS('background-color', 'rgb(241, 131, 131)');
  await expect(page.locator('.portrait-frame')).toHaveClass(/is-color-ready/);
  const hoverCapable = await page.evaluate(() => matchMedia('(hover: hover)').matches);
  if (hoverCapable) {
    await expect(tint).toHaveCSS('opacity', '1');
    await page.locator('.portrait-frame').hover();
    await expect(tint).toHaveCSS('opacity', '0');
    await page.mouse.move(0, 0);
    await expect(tint).toHaveCSS('opacity', '1');
    await page.locator('.portrait-frame').hover();
    await expect(tint).toHaveCSS('opacity', '0');
  } else {
    await expect(tint).toHaveCSS('opacity', '0');
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(tint).toHaveCSS('background-color', 'rgb(246, 216, 207)');
  expect(await tint.locator('img').evaluate(element => getComputedStyle(element).filter)).not.toContain('grayscale');
  if (hoverCapable) {
    await page.mouse.move(0, 0);
    await expect(tint).toHaveCSS('opacity', '1');
    await page.locator('.portrait-frame').hover();
    await expect(tint).toHaveCSS('opacity', '0');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(tint).toHaveCSS('animation-name', 'none');
  await expect(tint).toHaveCSS('transition-duration', '0s');
  await expect(tint).toHaveCSS('opacity', '0');
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
    await page.setViewportSize({ width, height: 900 });
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
  await context.close();
});
