# Performance verification

Audit date: 2026-10-31. Lighthouse 13.5.0, Chromium 156, Node.js 24, local production build served by Astro preview. This is a simulated lab audit, not Google PageSpeed Insights against the public domain and not real-user Core Web Vitals.

The mobile audit scored 99 for performance and 100 for accessibility, best practices, and SEO. LCP was 1.8 seconds, CLS 0.005, and total blocking time 0 ms.

The desktop audit scored 100 in all four categories. LCP was 0.4 seconds, CLS 0.001, and total blocking time 0 ms.

Scores vary by machine and run. These are the initial readings, not guarantees. No analytics or contact-service production configuration was enabled for this baseline. Re-run after enabling them. No code changes were needed to meet the performance budgets.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run build
npm run audit:performance
```

The script starts a local production preview, audits mobile and desktop, writes HTML and JSON reports to `reports/performance/`, and closes the browser and preview server. It exits with failure below performance 90, accessibility 95, or SEO 95. These thresholds catch material regressions without treating a fluctuating perfect score as a requirement.

`.github/workflows/performance.yml` repeats the audit on pushes, pull requests, and manual runs, and attaches reports to the workflow run. It uses the configured public service identifiers from Actions variables.

After deployment, audit the actual HTTPS site:

```sh
AUDIT_URL=https://kristijan.lenkovic.com npm run audit:performance
```

Also run https://pagespeed.web.dev/ with the live domain. LCP/CLS/TBT here are lab metrics; real-user INP and Core Web Vitals require field data, which a small personal site may not have enough traffic to expose.

At the time of this audit, `kristijan.lenkovic.com` did not resolve in DNS. Public PageSpeed Insights, live TLS checks, and real notification delivery remain launch-time verification.
