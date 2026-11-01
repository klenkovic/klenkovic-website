import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSite } from '../scripts/check-uptime.mjs';

const origin = 'https://kristijan.lenkovic.com';
const pages = {
  '/': ['text/html', '<title>Kristijan Lenković - Software Engineer & Engineering Leader</title>'],
  '/privacy/': ['text/html', '<h1>Privacy</h1>'],
  '/favicon.svg': ['image/svg+xml', '<svg></svg>'],
  '/sitemap.xml': ['application/xml', `<loc>${origin}/</loc>`],
};
const healthyFetch = async url => {
  const [type, body] = pages[url.pathname];
  return new Response(body, { headers: { 'content-type': type } });
};
test('checks all public entry points', async () => {
  assert.equal(await checkSite(origin, healthyFetch), 4);
});
test('rejects an HTTP error', async () => {
  await assert.rejects(checkSite(origin, async () => new Response('Unavailable', { status: 503 })), /HTTP 503/);
});
test('rejects a generic successful response with wrong content', async () => {
  await assert.rejects(checkSite(origin, async () => new Response('Parking page', { headers: { 'content-type': 'text/html' } })), /expected page content missing/);
});
test('rejects redirects to another origin', async () => {
  await assert.rejects(checkSite(origin, async () => ({ status: 200, url: 'https://example.com' })), /unexpected origin/);
});
test('rejects an unexpected content type', async () => {
  await assert.rejects(checkSite(origin, async () => new Response('Kristijan Lenković', { headers: { 'content-type': 'application/json' } })), /content type/);
});
test('reports network and TLS failures', async () => {
  await assert.rejects(checkSite(origin, async () => { throw new Error('TLS verification failed'); }), /TLS verification failed/);
});
