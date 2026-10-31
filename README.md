# Kristijan Lenković

Static Astro site for kristijan.lenkovic.com. Node.js 24.

```sh
npm ci
npm run dev
npm run check
npm run build
npx playwright install chromium
npm test
```

## Self-hosted contact service — required before launch

The form posts to your own Node.js service. ALTCHA's MIT-licensed widget and verification library supply local proof-of-work spam protection; Nodemailer delivers a plain-text request through your SMTP server. No subscription, hosted form provider, CAPTCHA account, paid ALTCHA Cloud/Sentinel product, or automatic CV delivery is involved.

See [contact-service/README.md](contact-service/README.md) for Docker/native deployment, private configuration, HTTPS reverse proxying, and SMTP setup. After hosting it, set `PUBLIC_CONTACT_ENDPOINT` to its public `/contact` URL in `.env` and in GitHub repository Actions variables. Rebuild the static site. Only this URL is public; your mailbox, SMTP credentials, and CAPTCHA signing key stay on the server.

Until configured, the form remains disabled. Local hosting/SMTP still need to be available; free software does not include a free server or mail-delivery infrastructure. Requests are manually reviewed and answered. There is no public CV file.

Verification:

```sh
npm --prefix contact-service ci
npm --prefix contact-service test
npm run build
node scripts/test-contact-flow.mjs
```

The last command runs a real browser, real local proof-of-work challenge, and the actual HTTP handler using a mail stub. It sends no email. A real SMTP delivery test remains necessary after deployment.

## Deploy

Push to GitHub. Select GitHub Actions in Settings → Pages. Set the custom domain to `kristijan.lenkovic.com`, then create a DNS CNAME for `kristijan` pointing to your GitHub account’s `<username>.github.io` hostname. Enable HTTPS once provisioning completes. The workflow builds and publishes `dist/` from `main` or `master`.

## Editing and SEO

Public copy: `src/data/site.ts` and `src/pages/index.astro`. Colors: `src/styles/global.css`. Fonts are self-hosted; the portrait is optimized at build time. The page includes a canonical URL, unique title and description, ProfilePage/Person JSON-LD, Open Graph metadata, a social image, sitemap, robots.txt, semantic headings, and crawlable HTML.

After launch, verify the domain in Google Search Console and submit `https://kristijan.lenkovic.com/sitemap.xml`. Rankings are not guaranteed by technical SEO. Keep profile claims accurate; AI content describes tooling use and exploration rather than inventing AI product delivery experience.

Keep the private CV outside this repository. Never put it in public assets or attach its URL to the frontend.

## Google Analytics 4 — setup

Analytics stays off until a valid `PUBLIC_GA_MEASUREMENT_ID` is configured. No Google script loads before consent. Accept and Decline have equal prominence; visitors can change their choice through the footer. Declining after acceptance clears accessible GA cookies and reloads without the tag. Choices and GA cookie lifetime are set to 180 days.

1. Sign in at https://analytics.google.com/ and create an Analytics account and GA4 property for this website.
2. Choose a Web data stream with URL `https://kristijan.lenkovic.com` and copy its measurement ID (`G-…`). No API key or Google Tag Manager account is needed.
3. **Turn off Enhanced Measurement** in the web stream settings. This implementation explicitly sends its own events and cleans page URLs. Automatic form interaction/page-history tracking is unnecessary and can create duplicate events or expose URL details. Keep Google Signals, ads linking, user-provided data collection, and advertising personalization off. Do not add another Analytics snippet through a plugin.
4. Add `PUBLIC_GA_MEASUREMENT_ID=G-YOURID` to local `.env`, and add the same public identifier as a GitHub repository Actions variable. Rebuild and deploy. Do not use the test ID from the browser test configuration.
5. Open the live site, accept analytics, and check GA4 Realtime for `page_view`. Open the CV dialog for `cv_request_open`. Submit a valid request after the self-hosted contact service is configured for `generate_lead`. Mark `generate_lead` as a **key event** in GA4; a form open is intent, not a completed lead.
6. Verify that declining loads no Google tag and that withdrawing consent stops subsequent collection. Browser tests mock Google: receipt by your real GA property still needs this live check. Review the privacy page and choose the appropriate data retention settings before launch.

No form fields or message text are passed to analytics. The URL passed to GA omits query strings/fragments, and the referrer is reduced to its origin. This intentionally sacrifices query-based campaign attribution, including UTM parameters, to avoid accidental personal data collection. Reports cover consenting visitors only; blockers also affect totals. Analytics does not increase search rankings.

References: [GA4 account/property/stream setup](https://support.google.com/analytics/answer/9304153), [basic consent mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic), [recommended lead event](https://support.google.com/analytics/answer/9267735).

## Marketing priorities

- Verify Google Search Console and submit the sitemap after launch; inspect the homepage indexing status.
- Add the domain to your LinkedIn profile, GitHub profile, CV, and email signature. Add public profile links to this site only after confirming their exact URLs and desired visibility.
- Add one or two short, approved outcome statements: team development, platform transformation, or improvements to engineering practices. Prefer evidence over more adjectives. No client details or unsupported metrics.
- Keep one primary conversion: a conversation/CV request. Track successful requests, then judge their quality manually. Traffic volume alone is not the goal.
- Existing Open Graph image and metadata provide the sharing preview. Check the live preview when sharing.
- Paid ads, retargeting pixels, pop-ups, session recordings, and a newsletter add little value for this low-maintenance recruiter-focused site.

## Design and font licensing

The visual design is implemented directly in Astro and CSS, with a personal geometric KL monogram used in the header, portrait seal, contact section, and favicon. No premade website theme is installed. Shared geometry, typography, and the red/plum palette give the site a consistent identity; global exclusivity of simple shapes cannot be guaranteed.

Manrope (headings) and DM Sans (body) are free, open-source fonts under SIL OFL 1.1. They are self-hosted and require no Google Fonts network requests, subscription, or commercial font license purchase. Full copyright and license texts ship in `public/licenses/` and therefore in `dist/licenses/`. See `THIRD_PARTY_NOTICES.md` for provenance.

## Impact, opportunities, and professional profiles

`src/data/site.ts` contains the compact outcome statements, target opportunities (CTO / Head of Engineering / technology leadership), and LinkedIn/GitHub URLs. Both profile URLs were read from the supplied CV; the LinkedIn URL was also confirmed in chat. Links open in a new tab without passing a referrer, and are included in Person `sameAs` structured data. The target-role line describes relevant opportunities, not a current CTO title or a claim of immediate availability.

## Performance and uptime

See `docs/performance.md` for the local production audit, its limits, reproduction steps, and the live-domain check to perform after launch. Run `npm run audit:performance` after a production build. Reports are saved locally in `reports/performance/` and uploaded by the performance workflow.

The optional `.github/workflows/uptime.yml` checks the homepage, privacy page, favicon, and sitemap around every 15 minutes, with three attempts before reporting an outage. It validates TLS, HTTP status, content type, expected page text, and redirect origin. On failure, it opens one GitHub issue; when checks recover, it comments and closes that issue. No email address or third-party monitoring secret is embedded.

To activate after the domain is live:

1. Push the code to GitHub, enable Issues, and allow the uptime workflow's `issues: write` permission.
2. Create an Actions repository variable named `UPTIME_MONITOR_ENABLED` with value `true`.
3. Enable GitHub Actions failure notifications for your account. Watch the repository with issue notifications enabled to receive outage/recovery updates.
4. Manually run “Website uptime” and verify successful checks and your notification settings. Run `npm run test:uptime` for failure-mode tests; these mock responses and do not create GitHub issues.

Monitoring is **not active** until those steps are completed. GitHub schedules are best-effort, can be delayed, and scheduled workflows in public repositories can be disabled after 60 days without repository activity. This optional workflow is useful initially but does not satisfy decade-long unattended monitoring. For that goal, configure a dedicated external HTTPS monitor for `https://kristijan.lenkovic.com/` with a `Kristijan Lenković` keyword check, an outage email notification, and recovery notifications; that requires a monitoring-service account and its own end-to-end alert test.

References: [GitHub schedule limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

## Security positioning and portrait motion

Public copy leads with engineering experience and team-building, then backs it with concrete outcomes from the CV. Security and cloud work support the broader engineering story. Avoid standards-heavy positioning and keyword lists. The team-growth figure appears once in the public copy. AI is described as a practical engineering tool, with human review and accountability. Avoid unsupported claims about certifications, vulnerability-free products, or AI product delivery.

The original portrait stays unmodified. A decorative duplicate uses CSS blending to produce a red monochrome overlay, then fades away to reveal the natural photo. The browser reuses the same optimized image files for both layers. The photo decodes before the effect is enabled. On desktop it rests in a red tint, transitions to natural color on hover or keyboard focus, and smoothly returns to red on mouse-out. Touch devices reveal natural color on entry; reduced-motion settings show natural color immediately. Without JavaScript, the natural photo is shown. GitHub/LinkedIn icons appear in both the header and footer as local SVGs with accessible link labels and retained license notices.

## Readable typography

Text sizes use rem-based, fluid tokens instead of tiny fixed labels. Body text scales from 16px on small screens to 20px at a 2560px-wide viewport. Secondary text is at least 14px and grows toward 16px; navigation, buttons, and form controls use a separate 16–18px scale. The content container expands to 1720px on larger screens. Skill tags wrap, cards reflow, and the decorative vertical portrait text has been removed. Browser checks cover layout through 2560×1440 and enforce the larger high-resolution typography.

## Employer-facing story

The headline establishes delivery and team-building. The introduction states what the employer gains. The approach section pairs each desired outcome with the work Kristijan brings: product delivery, leadership capacity, secure foundations, and time saved through automation. Past achievements provide evidence rather than repeating the promise. The contact invitation starts with the employer’s next challenge. Keep claims grounded in the CV; avoid superiority claims, guaranteed business results, jargon inventories, or repeating the team-growth metric.

## Section navigation and technical scope

The header links to Approach, Experience, the AI approach card, Technologies, and Contact. All links remain visible on phones, with section navigation below the identity/social row. The employer-facing benefits remain the main message; supporting tags identify cloud platforms, Kubernetes, DevSecOps, CI/CD, and software supply-chain security. “AI, with judgment” describes AI-assisted implementation and testing with human review, decisions, and accountability.

## Technology logo wall

Edit `src/data/technologies.ts` to change the selection and row order. The five rows cover languages/development tools, application engineering/collaboration, platforms/delivery, cloud/data/security, and AWS services. They use CV technologies and user-requested additions, including Claude Code and OpenAI Codex; placement does not indicate proficiency. Add the corresponding local SVG to `public/technologies/` and record its license/source in `THIRD_PARTY_NOTICES.md` and `public/licenses/technology-sources.json`.

Odd rows move right; even rows move left. Hover pauses that row, raises the logo, and shows its full name. A tap holds the name until focus moves away. Keyboard focus switches a row to a stable, horizontally scrollable strip. The pause button stops all rows. Repeated copies are hidden from assistive technology and skipped by Tab. Reduced-motion preferences and visitors without JavaScript get static, horizontally scrollable original logos. Animation pauses while the section is offscreen. Logos keep their brand colors; a small white backing preserves dark marks in both themes.

Rows are compact (104px desktop / 88px mobile). In browsers with the Popover API, names appear in the top layer to avoid clipping; older browsers retain extra tooltip space. The page head preloads every distinct logo asset, with eager image loading as a fallback. With JavaScript enabled, the whole section's content stays hidden until every rendered logo image has loaded and decoded, including repeated offscreen copies. The section keeps its layout space while loading and animations stay paused. If an asset fails, no partial wall is shown; a retry control is offered. Preloads and image requests use low fetch priority so the hero portrait takes precedence.
