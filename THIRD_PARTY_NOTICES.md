# Fonts and visual assets

The website uses two self-hosted, unmodified variable font families:

- **Manrope**, version 5.3.0 of the Fontsource package. Copyright 2019 The Manrope Project Authors. Licensed under SIL Open Font License 1.1. Full notice: [Manrope OFL](public/licenses/manrope-OFL.txt). Upstream: https://github.com/sharanda/manrope
- **DM Sans**, version 5.3.0 of the Fontsource package. Copyright 2014 The DM Sans Project Authors. Licensed under SIL Open Font License 1.1. Full notice: [DM Sans OFL](public/licenses/dm-sans-OFL.txt). Upstream: https://github.com/googlefonts/dm-fonts

Both licenses permit use and embedding in commercial websites without a font license fee, subject to their terms. Full notices are copied from the installed packages and included in the published site under `/licenses/`.

The layout, styles, KL monogram, decorative linework, and interface icon markup were authored in this project. No third-party website template or commercial icon/font package is used. Common visual conventions and simple geometric symbols are not claimed to be globally exclusive.

The portrait was supplied by Kristijan Lenković. This notice does not change its ownership or grant others permission to reuse it.

## Professional profile icons

The GitHub and LinkedIn brand SVGs are from Font Awesome Free 6.7.2, Copyright 2024 Fonticons, Inc. SVG icon artwork is licensed under CC BY 4.0; its attribution comments are retained in the SVG files. The full distribution notice ships in [Font Awesome Free license](public/licenses/font-awesome-free-LICENSE.txt). Source: https://github.com/FortAwesome/Font-Awesome/tree/6.x/svgs/brands . License: https://fontawesome.com/license/free . No icon font is loaded. Brand names and marks remain trademarks of their respective owners; these links identify personal profiles and do not imply endorsement.

## Contact request services

The form loads Cloudflare Turnstile only when the contact dialog opens. A Cloudflare Worker validates submissions and sends notifications using SMTP2GO's HTTPS API. Zoho hosts the receiving mailbox. These are hosted services subject to their providers' terms; no SMTP2GO SDK, CAPTCHA package, or mail server library is bundled. Credentials and mail addresses are configured privately in the Worker.

## Technology logos

Language, framework, platform, and database SVGs are unmodified assets from [Devicon](https://github.com/devicons/devicon), pinned to revision `32fe1d3b3f36ad11f90ab94f7db59738139c2bf6`. Copyright (c) 2015 konpa; the MIT notice ships at [Devicon MIT license](public/licenses/devicon-MIT.txt). AWS service icons are unmodified 64px SVGs from the official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) July 31, 2026 package. They remain subject to AWS's asset usage terms and trademark rights, rather than the Devicon license.

All technology logos are self-hosted under `public/technologies/`. [Asset provenance](public/licenses/technology-sources.json) records each upstream path and the AWS package URL. The marks identify technologies from Kristijan's experience; they do not imply certification, partnership, or endorsement by their respective owners. No external icon CDN, icon font, paid asset package, or runtime API is used.

Additional unmodified vendor artwork:

- **Grafana Alloy**: `alloy_icon_orange.svg` from the official [Grafana Alloy repository](https://github.com/grafana/alloy), revision `872d1b44bc37d929fc1d1a8485bec2da2a269808`. Apache 2.0; [full license](public/licenses/grafana-alloy-Apache-2.0.txt).
- **Bitwarden**: product icon from the official [Bitwarden brand repository](https://github.com/bitwarden/brand), revision `a354b22f62a9c5fc52daf1ae28468f8fbcd83d9f`, under the vendor's [brand guidelines](https://bitwarden.com/brand/).
- **Passbolt**: `icon-without-badge.svg` from the official [Passbolt styleguide](https://github.com/passbolt/passbolt_styleguide), revision `e9e4182c787f34f80ea42713e56dcbf21db58d23`. Copyright 2026 Passbolt SA. AGPL 3.0; [full license](public/licenses/passbolt-styleguide-AGPL-3.0.txt). The linked pinned SVG source in the provenance manifest is the complete, unmodified source for this asset. Passbolt's name and logo remain subject to its [trademark guidelines](https://www.passbolt.com/credits/trademark-guidelines).

Claude (star), Claude Code (mascot), OpenAI Codex, Ansible, Visual Studio Code, GitHub, Bitbucket, Jira, and Confluence use the same pinned Devicon source and MIT notice above. AWS Global Accelerator uses the same official AWS package and vendor terms as the other AWS service marks.

The **ChatGPT** knot mark is the unmodified `openai.svg` from [Simple Icons 13.0.0](https://github.com/simple-icons/simple-icons/tree/13.0.0), distributed under CC0 1.0; [full notice](public/licenses/simple-icons-CC0-1.0.txt). It identifies ChatGPT as a tool used, with OpenAI retaining ownership of its trademarks under the [OpenAI brand guidelines](https://openai.com/brand/). The pinned SVG URL is recorded in the asset provenance manifest.
