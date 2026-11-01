import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleRequest } from './worker.mjs';

export const origin = 'https://portfolio.example.test';
export function fixture() {
  const calls = [];
  const env = {
    SITE_ORIGIN: origin, SMTP2GO_API_KEY: 'test-only-api-key', TURNSTILE_SECRET_KEY: 'test-only-turnstile-secret',
    MAIL_FROM: 'website@example.test', CONTACT_RECIPIENT: 'owner@example.test',
    REQUEST_LIMITER: { limit: async () => ({ success: true }) }, SEND_LIMITER: { limit: async () => ({ success: true }) },
  };
  const fetchService = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (url.includes('siteverify')) return Response.json({ success: true, hostname: new URL(env.SITE_ORIGIN).hostname, action: 'cv_request' });
    return Response.json({ request_id: 'test-id', data: { succeeded: 1, failed: 0, failures: [] } });
  };
  return { env, fetchService, calls };
}
export const fields = { name: 'Alex Morgan', email: 'alex@example.test', company: '', message: '', _gotcha: '', 'cf-turnstile-response': 'single-use-token' };
const request = (data = fields, options = {}) => new Request(`${origin}/contact`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(data), ...options,
});

test('sends only to the private recipient, supports a minimal CV request and Reply-To', async () => {
  const { env, fetchService, calls } = fixture();
  const response = await handleRequest(request({ ...fields, to: 'attacker@example.test', sender: 'attacker@example.test' }), env, fetchService);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.secret, env.TURNSTILE_SECRET_KEY);
  assert.equal(calls[1].init.headers['X-Smtp2go-Api-Key'], env.SMTP2GO_API_KEY);
  assert.deepEqual(calls[1].body.to, [env.CONTACT_RECIPIENT]);
  assert.equal(calls[1].body.sender, env.MAIL_FROM);
  assert.deepEqual(calls[1].body.custom_headers, [{ header: 'Reply-To', value: fields.email }]);
  assert.match(calls[1].body.text_body, /Please send me your CV/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('entrypoint accepts Cloudflare execution context without treating it as fetch', async () => {
  const response = await worker.fetch(new Request(`${origin}/contact`, { method: 'OPTIONS', headers: { Origin: origin } }), fixture().env, {});
  assert.equal(response.status, 204);
});

test('origin and method checks never invoke upstreams', async () => {
  const { env, fetchService, calls } = fixture();
  for (const req of [request(fields, { headers: { Origin: 'https://evil.example' } }), new Request(`${origin}/contact`), new Request(`${origin}/challenge`)]) {
    const response = await handleRequest(req, env, fetchService);
    assert.ok([403, 404].includes(response.status));
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const response = await handleRequest(new Request(`${origin}/contact`, { headers: { Origin: origin } }), env, fetchService);
  assert.equal(response.status, 405);
  assert.equal(calls.length, 0);
});

test('rejects malformed, oversized, injected, missing-token and honeypot submissions', async () => {
  for (const data of [null, [], { ...fields, name: '' }, { ...fields, name: 1 }, { ...fields, name: 'a\r\nBcc: bad' }, { ...fields, email: 'bad\r\n@example.test' }, { ...fields, email: 'a,b@example.test' }, { ...fields, email: 'a\x00@example.test' }, { ...fields, _gotcha: 'bot' }, { ...fields, 'cf-turnstile-response': '' }, { ...fields, message: 'x'.repeat(2001) }]) {
    const { env, fetchService, calls } = fixture();
    assert.equal((await handleRequest(request(data), env, fetchService)).status, 400);
    assert.equal(calls.length, 0);
  }
  const { env, fetchService, calls } = fixture();
  assert.equal((await handleRequest(request(fields, { body: '{invalid' }), env, fetchService)).status, 400);
  assert.equal((await handleRequest(request(fields, { body: 'x'.repeat(13000) }), env, fetchService)).status, 413);
  assert.equal((await handleRequest(request(fields, { headers: { Origin: origin, 'Content-Type': 'text/plain' } }), env, fetchService)).status, 415);
  assert.equal(calls.length, 0);
});

test('rejects an oversized streaming request without a Content-Length', async () => {
  const { env, fetchService, calls } = fixture();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(13000)); controller.close(); } });
  const req = request(fields, { body, duplex: 'half' });
  assert.equal(req.headers.get('Content-Length'), null);
  assert.equal((await handleRequest(req, env, fetchService)).status, 413);
  assert.equal(calls.length, 0);
});

test('rejects expired/replayed tokens and mismatched hostname or action before sending', async () => {
  for (const proof of [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, { success: true, hostname: 'evil.example', action: 'cv_request' }, { success: true, hostname: new URL(origin).hostname, action: 'login' }]) {
    let count = 0;
    const response = await handleRequest(request(), fixture().env, async () => { count++; return Response.json(proof); });
    assert.equal(response.status, 400);
    assert.equal(count, 1);
  }
});

test('request and send limits fail closed with retry instructions', async () => {
  for (const binding of ['REQUEST_LIMITER', 'SEND_LIMITER']) {
    const { env, fetchService, calls } = fixture();
    env[binding] = { limit: async () => ({ success: false }) };
    const response = await handleRequest(request(), env, fetchService);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(calls.some(call => call.url.includes('smtp2go')), false);
  }
});

test('preflight allows only the configured site and POST content type', async () => {
  const { env, fetchService, calls } = fixture();
  const req = new Request(`${origin}/contact`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  const response = await handleRequest(req, env, fetchService);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal(calls.length, 0);
});

test('missing secrets/bindings and production dummy keys cannot send', async () => {
  for (const key of ['SMTP2GO_API_KEY', 'TURNSTILE_SECRET_KEY', 'MAIL_FROM', 'CONTACT_RECIPIENT', 'REQUEST_LIMITER', 'SEND_LIMITER']) {
    const { env, fetchService, calls } = fixture();
    delete env[key];
    assert.equal((await handleRequest(request(), env, fetchService)).status, 503);
    assert.equal(calls.length, 0);
  }
  const { env, fetchService, calls } = fixture();
  env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
  assert.equal((await handleRequest(request(), env, fetchService)).status, 503);
  assert.equal(calls.length, 0);
});

test('HTTP 200 provider errors, quota rejections, malformed replies and timeouts are never success', async () => {
  for (const outcome of [Response.json({ data: { succeeded: 0, failed: 1, failures: ['private-provider-detail'] } }), Response.json({ data: { error: 'private-provider-detail' } }), Response.json({ data: { succeeded: 1, failed: 1 } }), Response.json({ error: 'quota' }, { status: 429 }), new Response('not-json'), new Error('private-provider-detail')]) {
    const { env, fetchService, calls } = fixture();
    const response = await handleRequest(request(), env, async (url, init) => {
      if (url.includes('siteverify')) return fetchService(url, init);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    });
    assert.equal(response.status, 503);
    const text = await response.text();
    for (const value of [env.SMTP2GO_API_KEY, env.CONTACT_RECIPIENT, env.MAIL_FROM, 'private-provider-detail']) assert.ok(!text.includes(value));
    assert.equal(calls.length, 1); // no blind retry of a potentially accepted email
  }
});
