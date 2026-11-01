# Site maintenance

## Content and assets

- Edit `src/data/site.ts` and `src/pages/index.astro` for site copy and profile links, and `src/styles/global.css` for styling.
- Edit `src/data/technologies.ts` for the technology list. Add SVGs under `public/technologies/` and record their sources and licenses in `THIRD_PARTY_NOTICES.md` and `public/licenses/technology-sources.json`.
- The social preview is `public/social-card.png`. After changing `assets/social-card.svg` or the portrait, regenerate it with `node scripts/social-card.mjs` and check the text and image description.
- The portrait preview is `src/assets/kristijan-preview.webp`. After changing the portrait, regenerate it with:

  ```sh
  node --input-type=module -e "import sharp from 'sharp'; await sharp('src/assets/kristijan.jpg').rotate().resize({width:160,height:200,withoutEnlargement:true}).webp({quality:50}).toFile('src/assets/kristijan-preview.webp')"
  ```

Keep the CV and other private information out of the repository and public assets. The CV is sent manually after a request.

## Deployment and search

GitHub Pages uses the **GitHub Actions** publishing source. `.github/workflows/deploy.yml` builds and publishes `dist/` on pushes to `main` or `master`, and can also be run manually. In Pages settings, set the custom domain to `kristijan.lenkovic.com` and enable HTTPS when available. Its DNS CNAME points to `klenkovic.github.io`.

The homepage includes search and sharing metadata. `public/robots.txt` points to `public/sitemap.xml`; update the sitemap when public pages change. Submit `https://kristijan.lenkovic.com/sitemap.xml` in Google Search Console and use URL inspection to check indexing.

## Contact form

The frontend uses the public build variables `PUBLIC_CONTACT_ENDPOINT` and `PUBLIC_TURNSTILE_SITE_KEY`. Set them in a local `.env` and in GitHub Actions repository variables; the form is unavailable if either is missing. Worker credentials and the recipient belong in Worker secrets, not frontend variables. See the [Worker guide](../contact-worker/README.md) for deployment, limits, verification and rollback.

## Optional analytics

Analytics is disabled when `PUBLIC_GA_MEASUREMENT_ID` is absent. To enable it:

1. Create a Google Analytics 4 property and web stream for the site, and copy its `G-…` measurement ID.
2. Turn off Enhanced Measurement in the stream. Keep Google Signals, advertising personalization, ads linking and user-provided data collection disabled. The site sends its own events.
3. Set `PUBLIC_GA_MEASUREMENT_ID` in a local `.env` and as a GitHub Actions repository variable, then rebuild and deploy.
4. On the live site, accept analytics and check Realtime for `page_view`, `cv_request_open`, and, after a successful form submission, `generate_lead`. Mark `generate_lead` as a key event if desired. Verify that declining and withdrawing consent stop collection.

The site loads analytics only after consent, remembers the choice for up to 180 days, and excludes form answers, URL queries and fragments from the events it sends. Analytics counts consenting visitors only. See [Google Analytics setup](https://support.google.com/analytics/answer/9304153) and [Google consent mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic).

## Performance and uptime

See [performance.md](performance.md) for audit commands and interpretation. The performance workflow runs tests and Lighthouse and uploads reports.

The optional `Website uptime` workflow checks the live homepage and selected assets. To enable it, turn on GitHub Issues, set the repository Actions variable `UPTIME_MONITOR_ENABLED` to `true`, and enable the desired issue and Actions notifications. Run the workflow manually to verify access and notifications. Run `npm run test:uptime` for its mocked checks. Scheduled runs are best-effort and can be delayed or disabled after repository inactivity; monitor the workflow if relying on it.
