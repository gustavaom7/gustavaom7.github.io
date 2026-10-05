# gustavaom7.github.io

[![Site tests](https://github.com/gustavaom7/gustavaom7.github.io/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/gustavaom7/gustavaom7.github.io/actions/workflows/tests.yml)

Personal portfolio of Gustavo Mesquita, Senior QA Automation Engineer (SDET): https://gustavaom7.github.io

One static `index.html` (inline CSS and JS, no build), EN/PT and dark/light toggles, served by GitHub Pages from `main`.

## Tests

The site has its own Playwright suite (`tests/portfolio.spec.ts`), run on every push and PR on a desktop and an iPhone 12 project:
console errors and failed requests, language and theme toggles with persistence, external links, the CV download,
the copy-email feedback, horizontal overflow, axe-core WCAG A/AA in both themes, and the terminal animation with and without reduced motion.

```bash
npm ci
npx playwright install chromium
npm test            # serves the folder locally on :4173
npm run test:live   # runs the same suite against the published site
```
