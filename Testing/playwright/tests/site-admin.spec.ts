import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

test.describe('Site admin configuration @site-admin', () => {
  test('site rules page can add a category', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin.page.goto('/site-rules');
    await expect(admin.page.getByRole('heading', { name: /Site rules/i })).toBeVisible();

    await admin.page.getByRole('button', { name: /Add category/i }).click();
    const category = `e2e_${uniqueTag('rule').replace(/-/g, '_').slice(0, 40)}`;
    await admin.page.getByLabel(/Site type/i).first().selectOption({ label: /School/i });
    await admin.page.getByLabel(/Category code/i).fill(category);
    await admin.page.getByLabel(/Urgency weight/i).fill('1');
    await admin.page.getByLabel(/Sort order/i).fill('99');
    await admin.page.getByRole('button', { name: /Save rule/i }).click();
    await expect(admin.page.getByText(category)).toBeVisible({ timeout: 30_000 });
    await admin.context.close();
  });

  test('subsites / buildings management', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    // Site ID 1 is the primary seeded site for admin1.site1
    await admin.page.goto('/sites/1/subsites');
    await expect(admin.page.getByRole('heading', { name: /Buildings & locations/i })).toBeVisible({ timeout: 30_000 });

    const label = `E${Date.now().toString().slice(-4)}`;
    const name = `E2E Building ${uniqueTag('bldg')}`;
    await admin.page.getByLabel(/Short label/i).fill(label);
    await admin.page.getByLabel(/Building or location name/i).fill(name);
    await admin.page.getByRole('button', { name: /Add building/i }).click();
    await expect(admin.page.getByText(name)).toBeVisible({ timeout: 30_000 });
    await admin.context.close();
  });

  test('team access creates staff for the site', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin.page.goto('/team-access');
    await expect(admin.page.getByRole('heading', { name: /Team access/i })).toBeVisible();
    await expect(admin.page.getByText(/Create staff accounts for your site/i)).toBeVisible();

    await admin.page.getByLabel(/^Role$/i).selectOption({ label: /Staff/i });
    const tag = uniqueTag('sitestaff');
    const email = `${tag}@fixflow.test`;
    await admin.page.getByLabel(/First name/i).fill('Site');
    await admin.page.getByLabel(/Last name/i).fill('Staff');
    await admin.page.getByLabel(/Work email/i).fill(email);
    await admin.page.getByLabel(/Initial password/i).fill(email);
    await admin.page.getByRole('button', { name: /Create approved account/i }).click();
    await expect(admin.page.getByRole('status')).toContainText(/account created|can now sign in/i, { timeout: 30_000 });
    await admin.context.close();
  });
});
