import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route(/https:\/\/.*google-analytics\.com\/.*/, route => route.abort());
});

test('Google stays blocked until consent, declined choice persists, and consent can be withdrawn', async ({ page }) => {
  const tags: string[] = [];
  page.on('request', request => { if (request.url().includes('googletagmanager.com')) tags.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Analytics preferences' })).toBeVisible();
  expect(tags).toEqual([]);
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.reload();
  expect(tags).toEqual([]);
  await expect(page.locator('#analytics-consent')).toBeHidden();
  await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => tags.length).toBe(1);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-TEST12345'])).toBe(false);
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  const events = await page.evaluate(() => ((window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer || []).map(item => Array.from(item)));
  expect(events.filter(item => item[0] === 'event').map(item => item[1])).toEqual(['page_view', 'cv_request_open']);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.cookie = '_ga=test; path=/'; });
  await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.waitForLoadState('load');
  expect(tags).toHaveLength(1);
  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
});

test('analytics uses a clean URL and consent controls pass accessibility checks', async ({ page }) => {
  await page.goto('/?email=private@example.com#private-message');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  const queue = await page.evaluate(() => ((window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer || []).map(item => Array.from(item)));
  expect(JSON.stringify(queue)).not.toContain('private@example.com');
  expect(JSON.stringify(queue)).not.toContain('private-message');
  const config = queue.find(item => item[0] === 'config')?.[2] as Record<string, unknown>;
  expect(config.allow_google_signals).toBe(false);
  expect(config.allow_ad_personalization_signals).toBe(false);
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analytics preferences', exact: true })).toBeVisible();
});
