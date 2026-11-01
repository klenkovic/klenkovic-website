# Kristijan Lenković

Personal website built with Astro and published at [kristijan.lenkovic.com](https://kristijan.lenkovic.com/). GitHub Pages hosts the site; a Cloudflare Worker handles CV requests using Turnstile and SMTP2GO.

## Getting started

Requires Node.js 24.

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env` to configure the optional public settings. The contact form requires the Worker endpoint and Turnstile site key; its recipient and credentials are configured separately as Worker secrets.

## Checks

```sh
npm run check
npm run build
npx playwright install chromium
npm test
```

Pushes to `main` or `master` trigger the GitHub Pages workflow. GitHub Pages must use **GitHub Actions** as its publishing source.

## Documentation

- [Site maintenance, deployment, analytics and monitoring](docs/maintenance.md)
- [Contact Worker setup and operation](contact-worker/README.md)
- [Performance audits](docs/performance.md)
- [Third-party notices and licenses](THIRD_PARTY_NOTICES.md)

## License

The original project code is available under the [MIT License](LICENSE). Personal content, including the portrait, professional biography and personal branding, is excluded. Third-party assets remain subject to their own licenses and terms; see [third-party notices](THIRD_PARTY_NOTICES.md).
