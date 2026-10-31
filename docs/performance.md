# Performance verification

Audit date: 2026-11-01 (Europe/Zagreb). Lighthouse 13.5.0, Chromium, Node.js 24. These are local simulated lab results, not PageSpeed Insights against the public domain or real-user Core Web Vitals.

## Production results

The current production build scores **99 performance** on mobile and **100 accessibility, best practices, and SEO**. First Contentful Paint is **1.4 seconds**, Largest Contentful Paint **1.8 seconds**, CLS **0.001**, and total blocking time **0 ms**.

Desktop scores **100 in all four categories**, with FCP **0.3 seconds**, LCP **0.4 seconds**, CLS **0.001**, and total blocking time **0 ms**. Analytics and the contact service were not configured for this audit. Re-run after enabling them and after deployment; scores vary by hardware, network, and run.

Reports from this verification are saved locally in:

- `reports/performance/after-mobile-fixes/mobile.html` and `mobile.json`
- `reports/performance/after-mobile-fixes/desktop.html` and `desktop.json`

The pre-change production baseline is in `reports/performance/before-mobile-fixes/`: mobile performance 98, FCP 1.8 seconds, LCP 2.1 seconds. The reports directory is ignored by Git; the workflow uploads its generated reports as artifacts.

## Development preview versus production preview

The supplied preview on port 4322 runs **Astro dev**, including Vite's development module graph and on-demand image transformations. Its initial mobile audit reproduced the reported problem: performance **67**, FCP **4.0 seconds**, and LCP **6.8 seconds**. The later development audit scored **65**, FCP **5.1 seconds**, and LCP **6.4 seconds**. Development performance is still poor under Lighthouse throttling; the production score must not be presented as the development server's score.

The two development audits are retained in `reports/performance/before-dev-mobile-fixes/` and `reports/performance/after-dev-mobile-fixes/`.

For a representative manual test, use `npm run build` followed by `npm run preview` and open the URL printed by that command. The production preview used for browser inspection is currently `http://localhost:4323/`. It serves built assets and has no Vite client. The audit script starts its own production server on port 4330.

## Changes and regression checks

- The initial fonts are preloaded, including the Manrope subset for Croatian characters.
- The portrait uses responsive AVIF images with WebP fallback and a high-priority natural image. Both portrait layers share the same cached image URLs.
- The logo batch starts after the initial page load and rendering frames, or immediately when a visitor jumps to Technologies. All logos and repeated copies still finish loading and decoding before the section appears or animates. Removing the initial 65 image preloads keeps them out of the critical request queue.
- Mobile navigation stays on one line, the Croatia label sits below the photograph, logo sizes and gaps accommodate at least four fully visible marks at 320px and five at 390px throughout the animation, and copyright is always the last footer row.

Browser checks cover widths from 320px to 2560px, both themes, portrait hover/touch behavior, keyboard navigation, accessibility, the no-JavaScript fallback, and delayed/failed logo loads. A blocked hero-image test verifies that logo downloads wait unless the visitor jumps directly to their section. A held decode on an offscreen loop copy verifies that successful downloads alone cannot reveal the section prematurely.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run build
npm run audit:performance
```

Build after the browser tests: the test server uses a fake GA measurement ID in its own build. A normal build restores the actual environment configuration for the audit and manual preview.

The audit script writes HTML and JSON reports under `reports/performance/` and closes its browser and server. It exits with failure below performance 90, accessibility 95, or SEO 95. To preserve a separate run:

```sh
AUDIT_REPORT_DIR=reports/performance/my-run npm run audit:performance
```

`.github/workflows/performance.yml` repeats the production audit on pushes, pull requests, and manual runs, using the configured public service identifiers from Actions variables, and attaches its reports to the workflow run.

After deployment, audit the actual HTTPS site:

```sh
AUDIT_URL=https://kristijan.lenkovic.com npm run audit:performance
```

Live DNS, TLS, hosting latency, and the production service configuration still need deployment-time verification. Real-user INP and Core Web Vitals require field data; a small personal site may not receive enough traffic to expose it.
