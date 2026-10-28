import { expect, test, type Page } from '@playwright/test';
import { login } from './login';

const SLUG = 'senior-design-2026';
const BOOTH = 'Mapping urban heat with open satellite data';

async function enterHall(page: Page) {
  await page.goto(`e/${SLUG}/hall`);
  if (page.url().includes('/join')) await page.getByRole('button', { name: 'Enter the hall' }).click();
  await expect(page.getByText('● Connected')).toBeVisible({ timeout: 30_000 });
}

test('a visitor and a presenter meet in a booth', async ({ browser, baseURL }) => {
  const base = baseURL!.replace(/\/$/, '');
  const visitorCtx = await browser.newContext();
  const presenterCtx = await browser.newContext();
  await login(visitorCtx, base, 'visitor@connecta.local');
  await login(presenterCtx, base, 'mika@connecta.local');
  const visitor = await visitorCtx.newPage();
  const presenter = await presenterCtx.newPage();
  const errors: string[] = [];
  for (const p of [visitor, presenter]) p.on('pageerror', (e) => errors.push(e.message));

  await enterHall(visitor);
  await visitor.getByRole('button', { name: 'All booths' }).click();
  await visitor.getByText(BOOTH).click();
  await expect(visitor.getByText('In this booth')).toBeVisible();

  await enterHall(presenter);
  await presenter.getByRole('button', { name: 'All booths' }).click();
  await presenter.getByText(BOOTH).click();
  // only the booth's own presenters get camera / screen share, and only inside their booth
  await expect(presenter.getByRole('button', { name: 'Share screen' })).toBeVisible();
  await expect(visitor.getByRole('button', { name: 'Share screen' })).toHaveCount(0);
  await expect(visitor.getByText(/Live · 2/)).toBeVisible();

  // nearby chat reaches the other person in the booth
  await visitor.getByRole('button', { name: 'Chat' }).click();
  await visitor.getByLabel('Your message').fill('Hello team!');
  await visitor.getByLabel('Your message').press('Enter');
  await presenter.getByRole('button', { name: 'Chat' }).click();
  await expect(presenter.getByText('Hello team!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every Admin page renders', async ({ page, context, baseURL }) => {
  await login(context, baseURL!.replace(/\/$/, ''), 'admin@connecta.local');
  for (const [path, heading] of [
    ['', 'Overview'],
    ['/projects', 'Projects & hall'],
    ['/people', 'People & roles'],
    ['/judging', 'Judging'],
    ['/moderation', 'Moderation'],
    ['/settings', 'Settings'],
    ['/analytics', 'Event report'],
  ]) {
    await page.goto(`manage/${SLUG}${path}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});
