import { expect, type Page } from '@playwright/test';

/** Unique suffix so parallel runs do not collide on shared demo data. */
export function uniqueTag(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export async function gotoNav(page: Page, name: string | RegExp): Promise<void> {
  const nav = page.getByRole('navigation', { name: /Main navigation/i });
  const link = nav.getByRole('link', { name });
  if (await link.count()) {
    await link.first().click();
    return;
  }
  // Overflow "More" menu for secondary links
  const more = nav.getByText(/^More$/i);
  if (await more.count()) {
    await more.first().click();
    await nav.getByRole('link', { name }).first().click();
  }
}

export async function createPublicReport(page: Page, description: string, options?: {
  category?: RegExp | string;
  urgency?: RegExp | string;
}): Promise<string> {
  await page.goto('/reports/new');
  await expect(page.getByRole('heading', { name: /Report an issue/i })).toBeVisible();

  const building = page.getByLabel(/Building or location/i);
  await expect(building).toBeVisible({ timeout: 30_000 });
  const optionsCount = await building.locator('option:not([disabled])').count();
  expect(optionsCount, 'seed site needs at least one building').toBeGreaterThan(0);
  await building.selectOption({ index: 1 });

  await page.getByLabel(/What happened/i).fill(description);

  const category = page.getByLabel(/^Category$/i);
  await category.selectOption({ index: 1 });
  if (options?.category) {
    await category.selectOption({ label: options.category });
  }

  const urgency = page.getByLabel(/Your urgency/i);
  await urgency.selectOption({ label: options?.urgency ?? /Medium/i });

  const visibility = page.getByLabel(/Report visibility/i);
  await visibility.selectOption({ label: /Public within your site/i });

  await page.getByRole('button', { name: /Submit report/i }).click();
  await expect(page).toHaveURL(/\/reports\/\d+/);
  const match = page.url().match(/\/reports\/(\d+)/);
  expect(match).toBeTruthy();
  return match![1];
}

export async function openReport(page: Page, reportId: string | number): Promise<void> {
  await page.goto(`/reports/${reportId}`);
  await expect(page.getByRole('heading', { name: new RegExp(`Report #${reportId}`) })).toBeVisible({ timeout: 30_000 });
}

export async function expectForbiddenOrRedirect(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const url = page.url();
  const blocked =
    !url.includes(path) ||
    (await page.getByRole('alert').count()) > 0 ||
    (await page.getByText(/not available|cannot|forbidden|access/i).count()) > 0;
  expect(blocked || !url.includes(path.split('?')[0])).toBeTruthy();
}
