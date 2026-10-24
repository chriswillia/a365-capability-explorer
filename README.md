# Control Plane Compass

**Map any agent use case to Microsoft Agent 365.**

Live site: <https://chriswillia.github.io/control-plane-compass/>

> Independent project, not an official Microsoft site. Microsoft product names are trademarks of the Microsoft group of companies.

Control Plane Compass helps people who design, build and govern AI agents answer six questions within ten minutes: what Microsoft Agent 365 offers today, which capabilities apply to a given agent and why, where each one acts, who owns it and when it matters, what is already in place, and what would change the answer.

## Status

Preview. The first phase of a staged build is live: the capability catalog (26 capabilities from the Microsoft Agent 365 service description), an overview, and a capabilities table, with all editorial content marked as draft. The explorer, patterns, learn hub, use case diagnostic, readouts and workshop kit follow. The site asks search engines not to index it until launch.

## How to use

Open the site, read the overview, and browse the capabilities. The Executive | Technical switch moves between outcomes in plain language and the detail behind them: consoles, official wording and dependencies.

## Run it locally

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # unit and component tests
npm run test:e2e     # builds for both base paths, then runs Playwright and axe
```

## How to contribute

Content is data: capabilities, sources and all interface copy are YAML files in `content/`, so you can fix or add content without touching code. See [how to update content](docs/HOW-TO-UPDATE.md). For code, see the [architecture notes](docs/ARCHITECTURE.md). Use the issue tracker for corrections and ideas.

## Hosting

The site is a public GitHub Pages project site, built and deployed by GitHub Actions on every push to `main`. A published change can take up to about ten minutes to appear.

Visibility: public from the first deploy, with a `noindex` tag until launch. A privately published Pages site needs an organization on GitHub Enterprise Cloud, and an enterprise that uses Enterprise Managed Users can only publish privately. See GitHub's documentation on [changing the visibility of a Pages site](https://docs.github.com/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).

## Privacy

Everything runs in your browser. The site sends nothing you enter to anyone and uses no cookies or analytics. GitHub Pages logs visitor IP addresses for security purposes. See the Privacy page on the site.

## Disclaimer

Guidance tool for planning conversations. Not an official Microsoft licensing determination. Confirm with the Microsoft Agent 365 service description, the Microsoft Product Terms and your Microsoft account team.

## License

No license has been chosen yet, so all rights are reserved until one is added.
