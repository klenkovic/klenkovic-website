import { once } from 'node:events';
import assert from 'node:assert/strict';
import { preview } from 'astro';
import { chromium, expect } from '@playwright/test';
import { createContactServer } from '../contact-service/server.mjs';

let previewServer, api, browser;
const deliveries = [];
try {
  previewServer = await preview({ server: { host: '127.0.0.1', port: 4332 }, logLevel: 'error' });
  const origin = `http://127.0.0.1:${previewServer.port}`;
  api = createContactServer({ siteOrigin: origin, hmacKey: 'TEST-ONLY-contact-flow-secret-1234567890', recipient: 'owner@example.test', sender: 'website@example.test', database: ':memory:', pow: { cost: 10, minCounter: 1, maxCounter: 2 } }, async mail => { deliveries.push(mail); return { accepted: ['owner@example.test'] }; });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const endpoint = `http://127.0.0.1:${api.address().port}/contact`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const unexpectedRequests = [];
  const allowedOrigins = new Set([origin, new URL(endpoint).origin]);
  page.on('request', request => {
    if (request.url().startsWith('http') && !allowedOrigins.has(new URL(request.url()).origin)) unexpectedRequests.push(request.url());
  });
  await page.goto(origin);
  // Activate the real widget against an ephemeral API, without credentials or SMTP delivery.
  await page.evaluate(endpoint => {
    const form = document.querySelector('#cv-form');
    form.action = endpoint; form.dataset.configured = 'true';
    form.querySelector('button[type="submit"]').disabled = false;
    const widget = document.createElement('altcha-widget');
    widget.setAttribute('name', 'altcha');
    widget.setAttribute('configuration', JSON.stringify({ humanInteractionSignature: false }));
    widget.setAttribute('challenge', endpoint.replace('/contact', '/challenge'));
    form.querySelector('button[type="submit"]').before(widget);
  }, endpoint);
  await page.getByRole('link', { name: 'Request my CV' }).first().click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Integration Test');
  await page.getByRole('textbox', { name: 'Your email' }).fill('test@example.test');
  await page.getByRole('textbox', { name: 'Opportunity' }).fill('Real browser proof-of-work verification.');
  await page.locator('altcha-widget').evaluate(async widget => { await customElements.whenDefined('altcha-widget'); await widget.verify(); });
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status')).toHaveText('Request received. Thank you — I’ll be in touch.');
  assert.equal(deliveries.length, 1);
  assert.match(deliveries[0].text, /Real browser proof-of-work verification/);
  assert.equal(deliveries[0].to, 'owner@example.test');
  assert.deepEqual(unexpectedRequests, []);
  console.log('Real browser + local CAPTCHA + contact API flow passed; no email sent.');
} finally {
  await browser?.close();
  if (api) await new Promise(resolve => api.close(resolve));
  await previewServer?.stop();
}
