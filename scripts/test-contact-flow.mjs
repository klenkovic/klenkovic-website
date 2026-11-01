import assert from 'node:assert/strict';
import { preview } from 'astro';
import { chromium, expect } from '@playwright/test';
import { handleRequest } from '../contact-worker/worker.mjs';

let previewServer, browser;
const deliveries = [];
let verified = 0, scriptLoads = 0, resets = 0;
const endpoint = 'https://contact.example.test/contact';
try {
  previewServer = await preview({ server: { host: '127.0.0.1', port: 4332 }, logLevel: 'error' });
  const origin = `http://127.0.0.1:${previewServer.port}`;
  const env = {
    SITE_ORIGIN: origin, SMTP2GO_API_KEY: 'test-only', TURNSTILE_SECRET_KEY: 'test-only',
    MAIL_FROM: 'website@example.test', CONTACT_RECIPIENT: 'owner@example.test',
    REQUEST_LIMITER: { limit: async () => ({ success: true }) }, SEND_LIMITER: { limit: async () => ({ success: true }) },
  };
  const usedTokens = new Set();
  const upstream = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.includes('siteverify')) {
      verified++;
      const success = !usedTokens.has(body.response) && body.response.startsWith('mock-token-');
      usedTokens.add(body.response);
      return Response.json({ success, hostname: '127.0.0.1', action: 'cv_request' });
    }
    deliveries.push(body);
    return Response.json({ data: { succeeded: 1, failed: 0, failures: [] } });
  };
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(`${origin}/`, async route => {
    const response = await route.fetch();
    let html = await response.text();
    html = html.replace(/<form id="cv-form"[^>]*>/, `<form id="cv-form" action="${endpoint}" method="POST" data-configured="true">`);
    html = html.replace(/<button type="submit"[^>]*>/, '<div class="captcha-container" data-turnstile-sitekey="test-sitekey"></div><button type="submit" class="button button-primary">');
    await route.fulfill({ response, body: html });
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => {
    scriptLoads++;
    return route.fulfill({ contentType: 'application/javascript', body: `
      let sequence = 0, token;
      window.turnstile = {
        ready(callback) { callback(); },
        render(container, options) {
          if (options.action !== 'cv_request') throw new Error('Missing action');
          token = document.createElement('input'); token.type = 'hidden'; token.name = 'cf-turnstile-response';
          container.append(token); token.value = 'mock-token-' + ++sequence;
          return 'test-widget';
        },
        reset() { token.value = 'mock-token-' + ++sequence; window.widgetResets = (window.widgetResets || 0) + 1; }
      };` });
  });
  await page.route(endpoint, async route => {
    const req = route.request();
    const headers = new Headers(req.headers());
    headers.set('Origin', origin);
    headers.set('CF-Connecting-IP', '192.0.2.1');
    const response = await handleRequest(new Request(endpoint, {
      method: req.method(), headers,
      ...(req.method() === 'POST' ? { body: req.postData() } : {}),
    }), env, upstream);
    const body = await response.text();
    if (response.status >= 400) console.error('Mock contact response:', response.status, body);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body });
  });
  await page.goto(origin);
  assert.equal(scriptLoads, 0, 'Turnstile must not load before the form opens');
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  await expect(page.locator('[name="cf-turnstile-response"]')).toHaveValue(/^mock-token-/);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Integration Test');
  await page.getByRole('textbox', { name: 'Your email' }).fill('test@example.test');
  // Minimal request: both company and message are optional.
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status')).toHaveText('Request received. Thank you — I’ll reply personally with my CV.');
  assert.equal(deliveries.length, 1);
  assert.equal(verified, 1);
  assert.deepEqual(deliveries[0].to, ['owner@example.test']);
  assert.deepEqual(deliveries[0].custom_headers, [{ header: 'Reply-To', value: 'test@example.test' }]);
  assert.match(deliveries[0].text_body, /Please send me your CV/);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('');
  await expect(page.locator('[name="cf-turnstile-response"]')).toHaveValue(/^mock-token-/);
  await page.getByRole('button', { name: 'Close CV request' }).click();
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  assert.equal(scriptLoads, 1, 'Reopening must reuse the loaded widget API');
  await expect(page.locator('[name="cf-turnstile-response"]')).toHaveValue(/^mock-token-/);
  resets = await page.evaluate(() => window.widgetResets);
  assert.ok(resets >= 2);
  console.log('Browser → Worker → mocked Turnstile/SMTP2GO passed; no email sent.');
} finally {
  await browser?.close();
  await previewServer?.stop();
}
