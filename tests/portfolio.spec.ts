import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CV_PATH = '/GustavoMesquita-QAEngineer-CV.pdf';
const EMAIL = 'gustavogmmg@hotmail.com';
const SECTION_ORDER = ['about', 'projects', 'case-study', 'experience', 'skills', 'contact'];

async function setLang(page: Page, lang: 'en' | 'pt') {
  await page.getByRole('button', { name: lang.toUpperCase(), exact: true }).click();
}

test.describe('portfolio', () => {
  test('loads with no console errors and no failed requests', async ({ page }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} (${m.location().url})`); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} ${r.status()}`); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle('Gustavo Mesquita · Senior QA Automation Engineer');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I automate quality, and I put AI to work doing it.');
    expect(errors, 'console errors').toEqual([]);
    expect(failed, 'failed requests').toEqual([]);
  });

  test('EN is the default and the PT toggle translates the page and persists', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('link', { name: 'Contact', exact: true })).toBeVisible();

    await setLang(page, 'pt');
    await expect(html).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eu automatizo qualidade, e coloco a IA pra trabalhar nisso.');
    await expect(page.getByRole('heading', { name: 'Bora testar algo juntos.' })).toBeVisible();
    await expect(page.locator('a[data-cv]').first()).toHaveText('Baixar CV');

    await page.reload();
    await expect(html).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eu automatizo qualidade, e coloco a IA pra trabalhar nisso.');

    await setLang(page, 'en');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I automate quality, and I put AI to work doing it.');
  });

  test('every translatable string exists in both languages', async ({ page }) => {
    await page.goto('/');
    const missing = await page.evaluate(() => {
      const dict = (window as unknown as { __I18N__: Record<string, Record<string, string>> }).__I18N__;
      const keys = new Set<string>();
      document.querySelectorAll('[data-i18n],[data-i18n-aria],[data-i18n-alt]').forEach((el) => {
        for (const attr of ['data-i18n', 'data-i18n-aria', 'data-i18n-alt']) {
          const k = el.getAttribute(attr);
          if (k) keys.add(k);
        }
      });
      ['theme.toLight', 'theme.toDark', 'copied', 'copyFail'].forEach((k) => keys.add(k));
      type Item = string | { key?: string; en?: string; pt?: string };
      const rows = (window as unknown as { __SKILLS__: { cat: string; primary?: Item[]; also?: Item[] }[] }).__SKILLS__;
      keys.add('skills.primary').add('skills.also');
      for (const row of rows) {
        keys.add(`skills.${row.cat}`);
        [...(row.primary ?? []), ...(row.also ?? [])].forEach((item, i) => {
          if (typeof item === 'string') return;
          if (item.key) keys.add(item.key);
          else ['en', 'pt'].forEach((l) => { if (!item[l as 'en' | 'pt']) keys.add(`__missing ${row.cat}[${i}].${l}`); });
        });
      }
      const missingKeys = [...keys].flatMap((k) => ['en', 'pt'].filter((l) => !dict[l][k]).map((l) => `${l}:${k}`));
      const onlyIn = (a: string, b: string) => Object.keys(dict[a]).filter((k) => !(k in dict[b])).map((k) => `only ${a}:${k}`);
      return [...missingKeys, ...onlyIn('en', 'pt'), ...onlyIn('pt', 'en')];
    });
    expect(missing).toEqual([]);
  });

  test('every number in a translated string is the same in EN and PT', async ({ page }) => {
    await page.goto('/');
    const diffs = await page.evaluate(() => {
      const dict = (window as unknown as { __I18N__: Record<string, Record<string, string>> }).__I18N__;
      // Digits glued to a letter (a11y) are words, not numbers.
      // PT writes decimals with a comma (2,5) where EN uses a dot (2.5): compare them as the same number.
      const nums = (t: string) => (t.match(/(?<![A-Za-z\d])\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort().join(' ');
      return Object.keys(dict.en).filter((k) => !/\.when$/.test(k) && nums(dict.en[k]) !== nums(dict.pt[k]))
        .map((k) => `${k}: "${nums(dict.en[k])}" vs "${nums(dict.pt[k])}"`);
    });
    expect(diffs).toEqual([]);
  });

  test('theme toggle switches the theme and persists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(darkBg);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  });

  test('first visit is dark even when the OS prefers light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(15, 28, 23)');
  });

  test('external links have a valid href and open with rel="noopener"', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('a[href^="http"]').evaluateAll((els) =>
      els.map((a) => ({ href: a.getAttribute('href') ?? '', rel: a.getAttribute('rel') ?? '', target: a.getAttribute('target') ?? '' })),
    );
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(() => new URL(link.href), link.href).not.toThrow();
      expect(new URL(link.href).protocol, link.href).toBe('https:');
      expect(link.target, link.href).toBe('_blank');
      expect(link.rel.split(/\s+/), link.href).toContain('noopener');
    }
  });

  test('CV buttons point to a PDF that answers 200', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[data-cv]').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual([CV_PATH, CV_PATH]);
    await expect(page.locator('a[data-cv]').first()).toHaveAttribute('download', '');
    const res = await request.get(CV_PATH);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test(`${EMAIL} is the only e-mail on the page`, async ({ page }) => {
    await page.goto('/');
    const found = (await page.content()).match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
    expect(found.length).toBeGreaterThan(0);
    expect([...new Set(found)]).toEqual([EMAIL]);
    await expect(page.locator('a[href^="mailto:"]')).toHaveAttribute('href', `mailto:${EMAIL}`);
  });

  test('hero has the CV and contact CTAs and the availability line', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('.hero');
    await expect(hero.getByRole('link', { name: 'Download CV' })).toHaveAttribute('href', CV_PATH);
    await expect(hero.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', '#contact');
    await expect(hero).toContainText('Open to remote roles · overlap with US/EU hours');
    await setLang(page, 'pt');
    await expect(hero.getByRole('link', { name: 'Fale comigo' })).toBeVisible();
    await expect(hero).toContainText('Aberto a vagas remotas');
  });

  test('every in-page anchor points to an existing section', async ({ page }) => {
    await page.goto('/');
    const missing = await page.locator('a[href^="#"]').evaluateAll((els) =>
      els.map((a) => a.getAttribute('href')!).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    );
    expect(missing).toEqual([]);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Case study' })).toHaveAttribute('href', '#case-study');
  });

  test('sections and the menu follow the same order, with one entry for the case study', async ({ page }) => {
    await page.goto('/');
    const sections = await page.locator('main > section[id]').evaluateAll((els) => els.map((e) => e.id));
    expect(sections).toEqual(SECTION_ORDER);
    const navHrefs = await page.getByRole('navigation').getByRole('link').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(navHrefs).toEqual(SECTION_ORDER.map((id) => `#${id}`));
    await expect(page.locator('.brand')).toHaveText('Gustavo Mesquita');
  });

  test('the old #ai anchor lands on the case study', async ({ page }) => {
    await page.goto('/#ai');
    await expect(page.locator('#case-study #ai')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Case study: AI in the QA flow' })).toBeInViewport();
  });

  test('the case study tells the AI flow once', async ({ page }) => {
    await page.goto('/');
    const caseStudy = page.locator('#case-study');
    await expect(caseStudy.locator('ol.flow > li')).toHaveCount(6);
    await expect(caseStudy).toContainText('Details anonymized due to NDA.');
    for (const h of ['Context', 'Problem', 'Approach', 'Result']) {
      await expect(caseStudy.getByRole('heading', { name: h, exact: true })).toBeVisible();
    }
    await expect(caseStudy.getByRole('heading', { name: "What I'd do next" })).toHaveCount(0);
    await expect(caseStudy.locator('.excerpt')).toBeVisible();
    await expect(caseStudy).toContainText('2h → 5min');
    // test.fixme is explained once in prose (the SKILL.md excerpt is the proof, not a repeat).
    const prose = await page.locator('main').evaluate((m) => {
      const clone = m.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('pre, code').forEach((c) => c.remove());
      return clone.innerText;
    });
    expect(prose.match(/test\.fixme/g) ?? []).toHaveLength(1);
  });

  test('the first stat uses the same numbers as the Playwright card', async ({ page }) => {
    await page.goto('/');
    const stat = page.locator('.impact li').first();
    await expect(stat.locator('strong')).toHaveText('124 tests');
    await expect(stat).toContainText('across Chromium, Firefox and WebKit · CI in ~2.5 min');
    await expect(page.locator('.featured .result')).toContainText('124 tests');
    await expect(page.locator('.featured .result')).toContainText('about 2.5 min');
  });

  for (const lang of ['en', 'pt'] as const) {
    test(`no TODO or "coming soon" text is visible (${lang})`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', lang === 'pt' ? 'pt-BR' : 'en');
      const text = await page.locator('body').innerText();
      // "TODO" is case-sensitive: Portuguese has the word "todo" ("todo dia").
      expect(text).not.toMatch(/TODO/);
      expect(text).not.toMatch(/coming soon|em breve/i);
      const dictHits = await page.evaluate((l) => {
        const dict = (window as unknown as { __I18N__: Record<string, Record<string, string>> }).__I18N__;
        return Object.entries(dict[l]).filter(([, v]) => /TODO/.test(v) || /coming soon|em breve/i.test(v)).map(([k]) => k);
      }, lang);
      expect(dictHits).toEqual([]);
    });
  }

  test('toolbox is one table: Primary tools highlighted, the rest neutral, context rows aligned', async ({ page }) => {
    await page.goto('/');
    const skills = page.locator('#skills');
    await expect(skills.locator('.legend')).toContainText('Primary');
    await expect(skills.locator('.legend')).toContainText('Also experienced with');
    await expect(skills.locator('table.toolbox')).toHaveCount(1);
    const primary = skills.locator('.tags-primary li');
    for (const t of ['Playwright', 'TypeScript', 'Maestro', 'Claude Code', 'Playwright MCP', 'Postman', 'Proxyman', 'GitHub Actions', 'Jira',
      'Appium', 'Cypress', 'JavaScript', 'BrowserStack']) {
      await expect(primary.getByText(t, { exact: true })).toBeVisible();
    }
    const others = skills.locator('ul.tags:not(.tags-primary) li');
    await expect(others.getByText('Python (working knowledge)')).toBeVisible();
    await expect(others.getByText('Java (basic)')).toBeVisible();
    await expect(others.getByText('Selenium', { exact: true })).toBeVisible();
    for (const row of ['Domains', 'Languages (spoken)']) {
      await expect(skills.getByRole('rowheader', { name: row })).toBeVisible();
    }
    await setLang(page, 'pt');
    await expect(skills.locator('.legend')).toContainText('Principais');
    await expect(skills.locator('.legend')).toContainText('Também tenho experiência com');
    await expect(others.getByText('Python (conhecimento prático)')).toBeVisible();
    await expect(others.getByText('Java (básico)')).toBeVisible();
    await expect(skills.getByRole('rowheader', { name: 'Domínios' })).toBeVisible();
  });

  test('project cards have no media slots and the Playwright card links the example bug reports', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#projects figure, #projects img')).toHaveCount(0);
    await expect(page.locator('.featured').getByRole('link', { name: 'See AI bug reports' })).toHaveAttribute('href', /docs\/examples\/bug-reports$/);
    await expect(page.locator('#projects .intro')).toContainText('under NDA');
  });

  test('education has its own heading in the experience timeline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#experience').getByRole('heading', { name: 'Education' })).toBeVisible();
    await setLang(page, 'pt');
    await expect(page.locator('#experience').getByRole('heading', { name: 'Formação' })).toBeVisible();
  });

  test('no phone number anywhere on the page', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).not.toMatch(/tel:|\+55|99800/);
  });

  test('copy e-mail button shows feedback in both languages', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const status = page.locator('#copy-status');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(status).toHaveText('Copied');
    await expect(status).toHaveText('', { timeout: 4000 });

    await setLang(page, 'pt');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(status).toHaveText('Copiado');
  });

  test('no horizontal scroll at the default viewport and at 375px and 360px', async ({ page }) => {
    await page.goto('/');
    const size = page.viewportSize()!;
    for (const width of [size.width, 375, 360]) {
      await page.setViewportSize({ width, height: size.height });
      for (const lang of ['en', 'pt'] as const) {
        await setLang(page, lang);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${width}px ${lang}`).toBeLessThanOrEqual(0);
      }
    }
  });

  for (const lang of ['en', 'pt'] as const) {
    for (const theme of ['dark', 'light'] as const) {
      test(`axe finds no WCAG A/AA violations (${lang}, ${theme})`, async ({ page }) => {
        await page.addInitScript(([l, t]) => { localStorage.setItem('lang', l); localStorage.setItem('theme', t); }, [lang, theme]);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', lang === 'pt' ? 'pt-BR' : 'en');
        await expect(page.locator('#terminal')).toHaveAttribute('data-state', 'done');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }

  test.describe('reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('terminal is shown in its final state right away', async ({ page }) => {
      await page.goto('/');
      const term = page.locator('#terminal');
      await expect(term).toHaveAttribute('data-state', 'done');
      await expect(term).toContainText('$ npx playwright test');
      await expect(term).toContainText('51 passed  1 failed');
      await expect(page.locator('#bug-card')).toBeVisible();
      await expect(page.locator('#bug-card')).toContainText('Sort by price returns wrong order');
    });
  });

  test('terminal animates once, stops in its final state, and replay runs it again', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/', { waitUntil: 'commit' });
    const term = page.locator('#terminal');
    const card = page.locator('#bug-card');
    await expect(term).toHaveAttribute('data-state', 'done', { timeout: 20_000 });
    await expect(card).toBeVisible();

    await page.getByRole('button', { name: 'replay' }).click();
    await expect(term).toHaveAttribute('data-state', 'running');
    await expect(card).toBeHidden();
    await expect(term).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
    await expect(card).toBeVisible();
    await expect(term).toContainText('draft written: Jira-ready bug report');
  });
});
