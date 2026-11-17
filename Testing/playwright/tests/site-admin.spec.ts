import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

test.beforeEach(() => {
  test.skip(process.env.ALLOW_WORKFLOW_WRITES !== 'true', 'Workflows that may write are opt-in');
});

test.describe('Site admin configuration @site-admin', () => {
  test('site admin can read shared rules without editing them', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin.page.goto('/team?tab=rules');
    await expect(admin.page.getByRole('heading', { name: 'Site category' })).toBeVisible();
    await expect(admin.page.getByText(/managed by a super admin/i)).toBeVisible();
    await expect(admin.page.getByRole('button', { name: 'Add category' })).toHaveCount(0);
    await admin.context.close();
  });

  test('subsites / buildings management', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    expect(admin.user.siteId).toBeTruthy();
    await admin.page.goto(`/sites/${admin.user.siteId}/subsites`);
    await expect(admin.page.getByRole('heading', { name: /Buildings & locations/i })).toBeVisible({ timeout: 30_000 });

    const label = `E${Date.now().toString().slice(-4)}`;
    const name = `E2E Building ${uniqueTag('bldg')}`;
    await admin.page.getByLabel(/Short label/i).fill(label);
    await admin.page.getByLabel(/Building or location name/i).fill(name);
    await admin.page.getByRole('button', { name: /Add building/i }).click();
    await expect(admin.page.getByText(name, { exact: true })).toBeVisible({ timeout: 30_000 });
    await admin.context.close();
  });

  test('team access creates staff for the site', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin.page.goto('/team-access');
    await expect(admin.page.getByRole('heading', { name: /Team access/i })).toBeVisible();
    await expect(admin.page.getByText(/Create staff and site administrator accounts for your site/i)).toBeVisible();

    await admin.page.getByLabel(/^Role$/i).selectOption('staff');
    const tag = uniqueTag('sitestaff');
    const email = `${tag}@fixflow.test`;
    await admin.page.getByLabel(/First name/i).fill('Site');
    await admin.page.getByLabel(/Last name/i).fill('Staff');
    await admin.page.getByLabel(/Work email/i).fill(email);
    await admin.page.getByLabel(/Initial password/i).fill(email);
    await admin.page.getByRole('button', { name: /Create approved account/i }).click();
    await expect(admin.page.getByRole('status').filter({ hasText: /account created|can now sign in/i })).toBeVisible({ timeout: 30_000 });
    await admin.context.close();
  });
});
