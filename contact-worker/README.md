# Cloudflare contact Worker

The static GitHub Pages site sends JSON to this Worker. It validates Cloudflare Turnstile, then calls SMTP2GO's HTTPS API to notify the privately configured Zoho mailbox. CVs are shared manually. No database, SMTP connection, or mail-routing changes are needed.

## Deployment status

Code and local tests do not mean the service is deployed. Cloudflare authentication, production secrets, a Turnstile widget, real delivery verification, and a rebuilt frontend with both public settings are required. Keep the form disabled until real delivery is verified. LinkedIn remains available in the dialog.

## Cloudflare setup (Free plan)

1. Authenticate Wrangler (`npx wrangler login`) or supply a scoped `CLOUDFLARE_API_TOKEN` privately. Creating the Worker requires Workers Admin at the account scope; attaching its custom domain requires Workers Routes Edit scoped to the lenkovic.com zone. Managing the Turnstile widget through the API requires Turnstile Sites Edit. Do not enable a paid Workers plan or use temporary preview accounts.
2. Create a managed Turnstile widget for `kristijan.lenkovic.com`. Pre-clearance is unnecessary. Keep its secret private; its sitekey is public.
3. Review `wrangler.jsonc`. `SITE_ORIGIN` must match the site's exact origin. The Worker uses the custom domain `contact.kristijan.lenkovic.com`; Cloudflare manages its DNS record and certificate. Do not enable Cloudflare Email Routing; Zoho keeps the existing MX records.
4. Configure the following Worker secrets, using interactive stdin or the dashboard (never command-line literal values or public build variables):

```sh
npx wrangler secret put SMTP2GO_API_KEY --config contact-worker/wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config contact-worker/wrangler.jsonc
npx wrangler secret put MAIL_FROM --config contact-worker/wrangler.jsonc
npx wrangler secret put CONTACT_RECIPIENT --config contact-worker/wrangler.jsonc
```

Use the existing verified SMTP2GO sender and desired Zoho destination. Both can be the same mailbox. The recipient is fixed server-side; submitted `to`/`sender` fields are ignored. The visitor's validated email is used only as Reply-To. No mail addresses or real keys belong in tracked configuration.

5. Run `npm run contact:deploy`. If secrets were set before the first deployment, Wrangler may create an initial Worker; the deployment installs the actual code. Requests fail closed until every required secret and rate-limiter binding exists.
6. Set `PUBLIC_CONTACT_ENDPOINT` to `https://contact.kristijan.lenkovic.com/contact` and `PUBLIC_TURNSTILE_SITE_KEY` to the production widget sitekey. Set them in a local ignored `.env` and GitHub repository Actions variables. `.github/workflows/deploy.yml` includes both. The static frontend has no private credentials.

For CI Worker deployment, use a scoped Cloudflare token as a GitHub Actions secret and a separate job restricted to trusted pushes. The repository intentionally does not deploy the Worker from pull requests or copy private secrets into build artifacts. The existing contact workflow validates and bundles the Worker without credentials.

## SMTP2GO configuration

The existing verified domain can be reused. SMTP2GO's API key is separate from an SMTP username/password; SMTP server/port settings are not used. Prefer a key restricted to `/email/send` and dedicated to this website. If the supplied key is shared, changing its permissions or limits affects its other clients, so do not alter it automatically.

Consider a provider-enforced key limit such as 20 notifications per hour, with quota notifications enabled, to preserve the shared allowance. Worker rate limiting is approximate and per Cloudflare location; it is not a strict worldwide quota. Disable open/click tracking for the website key. Free-plan allowances are account-wide and shared with existing SMTP sends: currently 1,000 emails/month, 200/day; 25/hour applies without a verified sender domain. Daily excess can queue; monthly excess is rejected and not queued. Free-plan sending history is five days, which does not guarantee all provider data is erased then. No paid overage or automatic upgrade is required.

## Request handling and privacy

- POST JSON only, exact Origin allowlist, no credentialed CORS; origin checks are not authentication and cannot stop direct scripted requests.
- 12 KiB actual streamed body limit, bounded strings, email validation, header-injection checks and honeypot.
- Required Turnstile validation with the expected hostname and `cv_request` action; tokens are short-lived and single-use. There is no test bypass in production.
- Up to five attempts per IP per minute and three send attempts per minute per Cloudflare location, using Worker rate-limit bindings. Shared corporate/mobile IPs may share that allowance. No application IP database is maintained.
- Plain text only; fixed subject, sender and recipient; no uploads, external attachments, CV links, autoresponders, or email tracking in application code.
- The Worker awaits SMTP2GO and checks `succeeded`, `failed`, `failures`, and provider error fields, because HTTP 200 can contain failures. Success means accepted, not guaranteed inbox placement.
- Timeouts and delivery errors produce a generic failure. Never blindly retry an ambiguous send: SMTP2GO may have accepted the first one. A manual retry can duplicate a request; strict exactly-once delivery would require more infrastructure.
- No message persistence and no app logs containing fields, headers, API errors or credentials. Workers observability is disabled in the checked-in configuration. Cloudflare, SMTP2GO, and Zoho still process data under their policies, and the mailbox retains received messages.

## Verification

```sh
npm run test:contact
npm run contact:check
npm run build
npm run test:contact-flow
npm test
```

The Node tests exercise the handler with upstream APIs mocked, including HTTP-200 provider errors, oversized streams, invalid proofs, origin checks, rate limits, and timeouts. The browser integration checks lazy widget loading, optional fields, the actual handler, private recipient routing, Reply-To, and widget reset with mocked upstreams. Neither test sends email or proves live Turnstile/inbox delivery. `contact:check` bundles the Worker using Wrangler's configuration/schema validation.

Before enabling the production form:

1. Build with the production public settings. Use a local untracked smoke page served from the production hostname if testing before a site release; never embed the Turnstile secret in that page.
2. Submit a real request through Turnstile. Confirm the notification reaches Zoho, including spam-folder checks. Confirm Reply addresses the submitter and normal business email still works.
3. Verify SMTP2GO shows accepted/delivered status and check failures while the free reporting window is available.
4. Check an expired/invalid token and a rejected upstream send; confirm the form keeps its text, shows failure, and permits a fresh challenge. Do not exhaust the shared production quota to test limits; use mocks.
5. Search `dist/` for private addresses and credentials without printing the credentials. Publish the static site only after these checks pass.

The Free Workers account limit currently totals 100,000 requests/day across Workers; bot traffic and OPTIONS count too. CPU allowance is 10 ms per invocation, with network waits excluded; verify CPU metrics once deployed. An exhausted Worker or SMTP2GO quota stops requests; the frontend keeps form text and offers LinkedIn. This version has no durable queue, so it cannot retain unaccepted requests through outages.

## Local development and rollback

Copy `.dev.vars.example` to `.dev.vars`, fill it privately, and use `npm run contact:dev`. Turnstile's official test keys are only suitable for localhost; the handler rejects known dummy secret keys on public origins. Use a localhost origin matching the frontend and validate token hostname/action just as in production. Automated tests use injected upstreams rather than real credentials.

For rollback, restore a previous Worker version in Cloudflare. To disable submissions, clear one of the frontend public contact settings and rebuild; LinkedIn remains available. To stop upstream sending immediately, disable the website's dedicated API key, without affecting shared SMTP credentials. If the key is shared, disable the Worker instead. No MX or Zoho changes are needed.

References: [SMTP2GO API](https://developers.smtp2go.com/reference/send-standard-email), [free plan](https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan), [Cloudflare Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Worker rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
