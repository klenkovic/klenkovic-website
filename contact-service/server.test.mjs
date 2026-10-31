import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { createContactServer } from './server.mjs';

const origin = 'https://site.example.test';
async function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'contact-test-'));
  const database = join(dir, 'test.sqlite');
  const mails = [];
  const server = createContactServer({ siteOrigin: origin, hmacKey: 'TEST-ONLY-not-a-production-secret-123456789', recipient: 'owner@example.test', sender: 'website@example.test', database, pow: { cost: 10, minCounter: 1, maxCounter: 2 } }, async mail => { if (options.mailFails) throw new Error('private SMTP credentials must never leak'); mails.push(mail); return { accepted: ['owner@example.test'] }; });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, init = {}) => fetch(base + path, { ...init, headers: { Origin: origin, ...init.headers } });
  const challenge = async () => (await request('/challenge')).json();
  const proof = async () => { const value = await challenge(); const solution = await solveChallenge({ challenge: value, deriveKey }); return Buffer.from(JSON.stringify({ challenge: value, solution })).toString('base64'); };
  const post = data => request('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Alex', email: 'alex@example.test', company: 'Example', message: 'An engineering leadership opportunity.', ...data }) });
  return { base, request, proof, post, mails, database };
}

test('valid proof delivers plain text to the fixed recipient, never a visitor-selected address', async t => {
  const f = await fixture(t); const response = await f.post({ altcha: await f.proof(), to: 'attacker@example.test' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(f.mails.length, 1); assert.equal(f.mails[0].to, 'owner@example.test');
  assert.equal(f.mails[0].replyTo.address, 'alex@example.test'); assert.equal(f.mails[0].subject, 'Website contact / CV request');
  assert.equal(f.mails[0].html, undefined); assert.equal(f.mails[0].attachments, undefined);
});
test('missing and forged proofs do not deliver', async t => {
  const f = await fixture(t);
  assert.equal((await f.post({})).status, 400);
  assert.equal((await f.post({ altcha: Buffer.from(JSON.stringify({ challenge: { fake: true }, solution: {} })).toString('base64') })).status, 400);
  assert.equal(f.mails.length, 0);
});
test('a proof can be consumed only once, including concurrent requests', async t => {
  const f = await fixture(t); const altcha = await f.proof();
  const statuses = await Promise.all([f.post({ altcha }), f.post({ altcha })]).then(values => values.map(r => r.status).sort());
  assert.deepEqual(statuses, [200, 400]); assert.equal(f.mails.length, 1);
});
test('expired challenges cannot be used', async t => {
  const f = await fixture(t); const altcha = await f.proof();
  const db = new DatabaseSync(f.database); db.exec('UPDATE challenges SET expires=0'); db.close();
  assert.equal((await f.post({ altcha })).status, 400); assert.equal(f.mails.length, 0);
});
test('unapproved origins and direct requests without an origin are rejected', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/challenge', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(f.base + '/challenge')).status, 403);
  const response = await f.request('/contact', { method: 'OPTIONS' });
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), origin);
});
test('bad fields, header injection, oversized bodies and honeypots are rejected', async t => {
  const f = await fixture(t);
  for (const data of [{ name: ' ' }, { email: 'x\r\nBcc:y@evil.test' }, { company: 'A\r\nB' }, { _gotcha: 'bot' }]) assert.equal((await f.post(data)).status, 400);
  assert.equal((await f.post({ message: 'x'.repeat(17000) })).status, 413); assert.equal(f.mails.length, 0);
});
test('SMTP failure does not claim success or disclose private error details', async t => {
  const f = await fixture(t, { mailFails: true }); const response = await f.post({ altcha: await f.proof() });
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /credentials|owner@|SMTP/);
});
test('rate limits repeated attempts and ignores forged forwarding headers by default', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) await f.post({});
  const response = await f.request('/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' }, body: '{}' });
  assert.equal(response.status, 429);
});
test('health response contains no recipient or secret configuration', async t => {
  const f = await fixture(t); const response = await fetch(f.base + '/healthz'); assert.deepEqual(await response.json(), { ok: true });
});
