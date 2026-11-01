const MAX_BODY_BYTES = 12 * 1024;
const emailPattern = /^[^\s<>@,;:"\\\[\]\x00-\x1f\x7f]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new HttpError(413, 'Your request is too large.');
  if (!request.body) throw new HttpError(400, 'Please check your form details.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'Your request is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new HttpError(400, 'Please check your form details.'); }
}

// Dependencies can be replaced in tests; deployed requests always use real fetch.
export async function handleRequest(request, env, fetchService = fetch) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  try {
    const path = new URL(request.url).pathname;
    if (path !== '/contact') throw new HttpError(404, 'Not found.');
    const site = new URL(env.SITE_ORIGIN);
    if (site.origin !== env.SITE_ORIGIN) throw new Error('Invalid configuration');
    if (request.headers.get('Origin') !== site.origin) throw new HttpError(403, 'Please send your request from the website.');
    headers['Access-Control-Allow-Origin'] = site.origin;
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'POST';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Max-Age'] = '600';
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Please check your form details.');
    if (!env.SMTP2GO_API_KEY || !env.TURNSTILE_SECRET_KEY || !emailPattern.test(env.MAIL_FROM) || !emailPattern.test(env.CONTACT_RECIPIENT) || !env.REQUEST_LIMITER || !env.SEND_LIMITER) throw new Error('Missing configuration');
    // Official Turnstile test secrets must never be accepted on the public site.
    if (!['localhost', '127.0.0.1'].includes(site.hostname) && /^[123]x0{20,}/.test(env.TURNSTILE_SECRET_KEY)) throw new Error('Test configuration');
    const client = request.headers.get('CF-Connecting-IP');
    if (!client) throw new HttpError(403, 'Couldn’t verify your request.');
    if (!(await env.REQUEST_LIMITER.limit({ key: client })).success) {
      headers['Retry-After'] = '60';
      throw new HttpError(429, 'Too many requests. Please wait a minute and try again.');
    }
    const data = await readBody(request);
    const field = (key, max, required = true) => {
      if (data[key] === undefined && !required) return '';
      if (typeof data[key] !== 'string') throw new HttpError(400, 'Please check your form details.');
      const value = data[key].trim();
      if ((required && !value) || value.length > max) throw new HttpError(400, 'Please check your form details.');
      return value;
    };
    if (field('_gotcha', 200, false)) throw new HttpError(400, 'Couldn’t verify your request.');
    const name = field('name', 100), email = field('email', 200);
    const company = field('company', 150, false), message = field('message', 2000, false);
    if (!emailPattern.test(email) || /[\r\n\x00]/.test(name + company) || /\x00/.test(message)) throw new HttpError(400, 'Please check your form details.');
    const token = field('cf-turnstile-response', 2048);
    const verification = await fetchService('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!verification.ok) throw new Error('Verification unavailable');
    const proof = await verification.json();
    if (!proof.success || proof.hostname !== site.hostname || proof.action !== 'cv_request') throw new HttpError(400, 'The spam check expired or failed. Please complete it again.');
    // Approximate per-location limits; the provider key can enforce a shared sending limit.
    if (!(await env.SEND_LIMITER.limit({ key: 'contact' })).success) {
      headers['Retry-After'] = '60';
      throw new HttpError(429, 'Too many requests. Please wait a minute and try again.');
    }
    const delivery = await fetchService('https://api.smtp2go.com/v3/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': env.SMTP2GO_API_KEY },
      body: JSON.stringify({
        sender: env.MAIL_FROM, to: [env.CONTACT_RECIPIENT], subject: 'Website CV request',
        text_body: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'Not provided'}\n\n${message || 'Please send me your CV.'}`,
        custom_headers: [{ header: 'Reply-To', value: email }], fastaccept: false,
      }), signal: AbortSignal.timeout(12000),
    });
    const result = await delivery.json();
    // SMTP2GO can return HTTP 200 with processing errors. Require one accepted recipient.
    if (!delivery.ok || result.data?.error || result.data?.error_code || result.data?.succeeded !== 1 || result.data?.failed !== 0 || (result.data?.failures?.length ?? 0) > 0) throw new Error('Delivery not accepted');
    return reply(200, { ok: true });
  } catch (error) {
    if (error instanceof HttpError) return reply(error.status, { ok: false, message: error.message });
    // Never log provider responses, headers, addresses, form content, or secrets.
    console.error('Contact request could not be processed.');
    return reply(503, { ok: false, message: 'Couldn’t confirm your request was sent. Please try again later or contact me on LinkedIn.' });
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
