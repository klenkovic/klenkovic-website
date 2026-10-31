import { createServer } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';
import { createChallenge, randomInt, verifySolution } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const digest = value => createHash('sha256').update(value).digest('hex');
const emailPattern = /^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/;

export function createContactServer(config, sendMail) {
  if (!config.hmacKey || config.hmacKey.length < 32) throw new Error('ALTCHA_HMAC_KEY must contain at least 32 characters.');
  const origin = new URL(config.siteOrigin).origin;
  if (!emailPattern.test(config.recipient) || !emailPattern.test(config.sender)) throw new Error('Configure valid private sender and recipient addresses.');
  if (config.database !== ':memory:') mkdirSync(dirname(config.database), { recursive: true });
  const db = new DatabaseSync(config.database);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);');
  const pow = config.pow || { cost: 5000, minCounter: 100, maxCounter: 500 };
  function limit(key, maximum, windowSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare('INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').get(key, now + windowSeconds, now, now);
    if (row.count > maximum) throw new HttpError(429, 'Too many requests. Please try again later.');
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const respond = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/healthz' && req.method === 'GET') return respond(200, { ok: true });
      if (req.headers.origin !== origin) throw new HttpError(403, 'Origin not allowed.');
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      const forwarded = config.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim() : '';
      const ip = forwarded || req.socket.remoteAddress || 'unknown';
      const client = createHmac('sha256', config.hmacKey).update(ip).digest('hex');
      const now = Math.floor(Date.now() / 1000);
      db.prepare('DELETE FROM challenges WHERE expires<=?').run(now);
      db.prepare('DELETE FROM limits WHERE expires<=?').run(now);
      if (path === '/challenge' && req.method === 'GET') {
        limit('challenge:global', 300, 3600);
        limit(`challenge:${client}`, 30, 900);
        const challenge = await createChallenge({ algorithm: 'PBKDF2/SHA-256', cost: pow.cost, counter: randomInt(pow.minCounter, pow.maxCounter), deriveKey, hmacSignatureSecret: config.hmacKey, expiresAt: now + 300 });
        const payload = JSON.stringify(challenge);
        db.prepare('INSERT INTO challenges(id,payload,expires) VALUES(?,?,?)').run(digest(payload), payload, now + 300);
        return respond(200, challenge);
      }
      if (path !== '/contact') throw new HttpError(404, 'Not found.');
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      limit('contact:global', 120, 3600);
      limit(`contact:${client}`, 5, 900);
      if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
      if (Number(req.headers['content-length']) > 16384) throw new HttpError(413, 'Request too large.');
      let raw = '';
      for await (const chunk of req) { raw += chunk.toString('utf8'); if (Buffer.byteLength(raw) > 16384) throw new HttpError(413, 'Request too large.'); }
      let data;
      try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Invalid request.');
      if (data._gotcha) throw new HttpError(400, 'Invalid request.');
      const field = (name, max, required = true) => {
        const value = typeof data[name] === 'string' ? data[name].trim() : '';
        if ((required && !value) || value.length > max) throw new HttpError(400, 'Please check your form details.');
        return value;
      };
      const name = field('name', 100), email = field('email', 200), company = field('company', 150, false), message = field('message', 2000);
      if (!emailPattern.test(email) || /[\r\n]/.test(name + company)) throw new HttpError(400, 'Please check your form details.');
      const token = field('altcha', 8000);
      let proof;
      try { proof = JSON.parse(Buffer.from(token, 'base64').toString('utf8')); } catch { throw new HttpError(400, 'Please complete a new spam check.'); }
      const id = digest(JSON.stringify(proof?.challenge) || '');
      // Atomic, persistent, single-use consumption prevents concurrent replay.
      // Only server-issued challenge parameters reach the verification library.
      const issued = db.prepare('DELETE FROM challenges WHERE id=? AND expires>? RETURNING payload').get(id, now);
      if (!issued) throw new HttpError(400, 'Please complete a new spam check.');
      let result;
      try { result = await verifySolution({ challenge: JSON.parse(issued.payload), solution: proof.solution, deriveKey, hmacSignatureSecret: config.hmacKey }); } catch { throw new HttpError(400, 'Please complete a new spam check.'); }
      if (!result.verified) throw new HttpError(400, 'Please complete a new spam check.');
      limit('mail:global', 20, 3600);
      try {
        const info = await sendMail({ from: config.sender, to: config.recipient, replyTo: { name, address: email }, subject: 'Website contact / CV request', text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'Not provided'}\n\n${message}`, disableFileAccess: true, disableUrlAccess: true });
        if (info?.rejected?.length || (Array.isArray(info?.accepted) && !info.accepted.length)) throw new Error('Mail rejected');
      } catch { throw new HttpError(502, 'Could not deliver the request. Please try again.'); }
      return respond(200, { ok: true });
    } catch (error) {
      // Do not log messages, email addresses, secrets, or submitted CAPTCHA payloads.
      if (!(error instanceof HttpError)) console.error('Contact service: internal error');
      if (!res.destroyed && !res.writableEnded) respond(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Service unavailable. Please try again.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const cleanup = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM challenges WHERE expires<=?').run(now);
    db.prepare('DELETE FROM limits WHERE expires<=?').run(now);
  }, 60000);
  cleanup.unref();
  server.on('close', () => { clearInterval(cleanup); db.close(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = key => process.env[`${key}_FILE`] ? readFileSync(process.env[`${key}_FILE`], 'utf8').trim() : process.env[key];
  for (const key of ['SITE_ORIGIN', 'CONTACT_RECIPIENT', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT']) if (!process.env[key]) throw new Error(`Missing ${key}`);
  const smtpPort = Number(process.env.SMTP_PORT);
  if (![465, 587].includes(smtpPort)) throw new Error('Use SMTP TLS on port 465 or STARTTLS on port 587.');
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: smtpPort, secure: smtpPort === 465, requireTLS: true, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: secret('SMTP_PASSWORD') } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  const server = createContactServer({ siteOrigin: process.env.SITE_ORIGIN, hmacKey: secret('ALTCHA_HMAC_KEY'), recipient: process.env.CONTACT_RECIPIENT, sender: process.env.MAIL_FROM, database: process.env.DATABASE_PATH || './data/contact.sqlite', trustProxy: process.env.TRUST_PROXY === 'true' }, mail => transport.sendMail(mail));
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('Contact service listening.'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
