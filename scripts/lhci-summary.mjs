// Writes the median Lighthouse scores of the last `lhci autorun` as a Markdown table (for the CI job summary).
import { readFileSync } from 'node:fs';

const runs = JSON.parse(readFileSync('lhci-report/manifest.json', 'utf8'));
const rep = runs.find((r) => r.isRepresentativeRun) ?? runs[0];
const rows = Object.entries(rep.summary).map(([cat, score]) => `| ${cat} | ${Math.round(score * 100)} |`);
console.log(['### Lighthouse (median of 3 runs, desktop)', '', '| Category | Score |', '|---|---|', ...rows].join('\n'));
