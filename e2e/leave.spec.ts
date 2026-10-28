import { expect, test } from '@playwright/test';
import { login } from './login';

// Leaving the hall and coming back must not hit the error page
test('leave the hall and come back', async ({ page, context, baseURL }) => {
  await login(context, baseURL!.replace(/\/$/, ''), 'visitor@connecta.local');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack?.split('\n').slice(0, 6).join('\n')}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 400)));
  await page.goto('e/senior-design-2026/hall');
  if (page.url().includes('/join')) await page.getByRole('button', { name: 'Enter the hall' }).click();
  await expect(page.getByText('● Connected')).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /^Senior Design Showcase/ }).click();
    await page.getByRole('menuitem', { name: 'Leave the hall' }).click();
    const leave = page.getByRole('button', { name: /^(Leave|Skip)$/ });
    await leave.click();
    await page.waitForURL(/\/e\/senior-design-2026$/);
    await page.waitForTimeout(1000);
    await expect(page.getByText('That didn’t work')).toHaveCount(0);
    await page.getByRole('button', { name: 'Visit the exhibition' }).or(page.getByRole('button', { name: 'Join' })).first().click();
    await expect(page.getByText('● Connected')).toBeVisible({ timeout: 30_000 });
  }
  expect(errors.filter((e) => !e.includes('Failed to load resource'))).toEqual([]);
});
