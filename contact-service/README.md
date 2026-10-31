# Self-hosted contact service

Free software, with no subscription requirement: a small Node.js HTTP service, the MIT-licensed ALTCHA proof-of-work library/widget, and Nodemailer over SMTP. It does not use ALTCHA Cloud or Sentinel, third-party CAPTCHA verification, a commercial form relay, or a public recipient address.

You provide a host, HTTPS reverse proxy, and an SMTP server you are allowed to send through. An existing mail account/server works; running this software does not include hosting, SMTP infrastructure, or guaranteed inbox placement. SMTP providers may impose their own limits or charges.

## Configure

Copy `.env.example` to `.env` **inside this directory**. Keep it outside source control and published static files.

- `SITE_ORIGIN`: exact frontend origin, e.g. `https://kristijan.lenkovic.com`.
- `CONTACT_RECIPIENT`: your private destination mailbox.
- `MAIL_FROM`: a sender address authorized by the SMTP server, preferably a dedicated website sender.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: your mail-server settings. Port 465 uses implicit TLS; 587 requires STARTTLS. Certificate verification stays enabled.
- `ALTCHA_HMAC_KEY`: a random secret of at least 32 characters. Generate locally with `openssl rand -hex 32`, and store it privately. Never use the deterministic test fixtures as production keys.
- `DATABASE_PATH`: persistent SQLite file for single-use challenges and rate-limit counters. This service targets Node.js 24; its built-in SQLite API currently emits an experimental warning.
- `TRUST_PROXY`: leave `false` unless the service is reachable only through a trusted single reverse proxy which appends/overwrites `X-Forwarded-For`. When enabled, only the last forwarded address is used, never an arbitrary first address supplied by a visitor.

`SMTP_PASSWORD_FILE` and `ALTCHA_HMAC_KEY_FILE` can point to private mounted files instead of supplying secret values directly in the environment. Keep the signing key stable across restarts.

## Native Node.js deployment

```sh
cd contact-service
npm ci --omit=dev
npm start
```

Run as a dedicated unprivileged account, under your process manager. By default it binds to `127.0.0.1:8787`; do not expose plain HTTP directly to the public internet.

## Docker deployment

```sh
cd contact-service
cp .env.example .env
# Fill in private configuration before starting.
docker compose up --build -d
```

The included Compose configuration binds the API to host loopback, uses an unprivileged container, persists SQLite in a volume, and restarts after host reboots. Keep the database volume; replay/rate-limit state should survive container replacement. The image is provided but has not been built in this workspace unless explicitly noted in the session. Dependencies and the service itself are tested natively.

## HTTPS and frontend connection

Point an API hostname you control at your server. Example Caddy configuration on the same host:

```caddyfile
contact.kristijan.lenkovic.com {
    reverse_proxy 127.0.0.1:8787
}
```

Use your existing reverse proxy if preferred. Provide a valid certificate, pass the visitor's Origin header, and route `/contact`, `/challenge`, and `/healthz` to this service. Do not cache challenge responses. If forwarding under a path prefix, strip that prefix at the reverse proxy.

Set the frontend's public `PUBLIC_CONTACT_ENDPOINT` to `https://contact.kristijan.lenkovic.com/contact` in its local `.env` and GitHub Actions repository variables, then rebuild/deploy. The widget derives the sibling `/challenge` URL automatically. These are public endpoints; protection comes from server-verified proofs and rate limits, not from hiding endpoint URLs. GitHub Pages can keep hosting the static website.

## Request handling

1. A visitor opens the form. The locally bundled widget loads on demand.
2. Your API issues a signed five-minute challenge. The browser computes a proof of work.
3. The form sends JSON to `/contact`. Your server validates lengths, email syntax, origin, honeypot, rate limits, challenge signature, expiry, and solution.
4. SQLite atomically consumes each issued challenge once, preventing concurrent replay.
5. Nodemailer sends a plain-text message to the **fixed server-configured recipient**, with the visitor as Reply-To. It sends no acknowledgement email to the visitor, attachment, CV, or CV link.

The API reports success only after SMTP accepts the message. SMTP acceptance does not guarantee delivery to the inbox. On failure, the frontend keeps the form values and resets the proof so the visitor can retry. Form messages, email addresses, and CAPTCHA payloads are not written to application logs or to the service database. Your SMTP server and mailbox retain messages according to their own configuration.

Limits: 30 challenges and 5 contact attempts per network address per 15 minutes; 300 challenges, 120 contact attempts, and 20 delivered messages globally per hour. Network identifiers are HMAC-pseudonymized before being stored. PoW raises the cost of automated submissions; it does not prove that every sender is human. Add network-level abuse controls at your reverse proxy if needed. Use one service instance per SQLite database; horizontal scaling needs shared atomic storage.

## Verify before launch

```sh
npm ci
npm test
curl --fail http://127.0.0.1:8787/healthz
```

From the project root, `npm run test:contact-flow` (after a production build and installing Chromium) checks the real widget, real challenge verification, and HTTP flow against a mail stub. Tests never deliver actual email.

After deployment, submit one real request, verify its receipt and Reply-To behavior, test failed verification and an expired proof, and verify that logs/public build contain no private configuration. Confirm SPF/DKIM/DMARC and permitted sender settings with your mail-server configuration. Update the site's Privacy Policy to reflect the actual host, mail handling, and retention choices.
