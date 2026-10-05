import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CV_PATH = '/GustavoMesquita-QAEngineer-CV.pdf';

async function setLang(page: Page, lang: 'en' | 'pt') {
  await page.getByRole('button', { name: lang.toUpperCase(), exact: true }).click();
}

test.describe('portfolio', () => {
  test('loads with no console errors and no failed requests', async ({ page }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
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
      return [...keys].flatMap((k) => ['en', 'pt'].filter((l) => !dict[l][k]).map((l) => `${l}:${k}`));
    });
    expect(missing).toEqual([]);
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

  test('first visit follows prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
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

  test('no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    for (const lang of ['en', 'pt'] as const) {
      await setLang(page, lang);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, lang).toBeLessThanOrEqual(0);
    }
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`axe finds no WCAG A/AA violations in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('#terminal')).toHaveAttribute('data-state', 'done');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
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
