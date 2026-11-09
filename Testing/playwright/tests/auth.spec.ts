import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { apiLogin, apiLogout, apiMe, uiLogin, uiLogout } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

const roleAccounts = [
  { name: 'reporter', account: accounts.reporter },
  { name: 'staff', account: accounts.staff },
  { name: 'admin', account: accounts.admin },
  { name: 'technician', account: accounts.technician },
  { name: 'super_admin', account: accounts.superadmin },
  { name: 'shop_manager', account: accounts.shopmanager },
] as const;

test.describe('Auth workflows', () => {
  test.describe.configure({ mode: 'serial' });

  test('UI login and logout for reporter @auth @ui', async ({ page }) => {
    test.info().annotations.push({ type: 'role', description: 'reporter' });
    await uiLogin(page, accounts.reporter);
    await expect(page).toHaveURL(/\/reporter|\/reports|\/$/);
    await uiLogout(page);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });

  for (const { name, account } of roleAccounts) {
    test(`API login/logout for ${name} @auth @api`, async ({ request }) => {
      test.info().annotations.push({ type: 'role', description: name });
      const user = await apiLogin(request, account);
      expect(user.email.toLowerCase()).toBe(account.email.toLowerCase());
      expect(user.role).toBe(account.role);
      const me = await apiMe(request);
      expect(me.email.toLowerCase()).toBe(account.email.toLowerCase());
      await apiLogout(request);
    });
  }

  test('Register reporter smoke @auth @register', async ({ page }) => {
    test.info().annotations.push({ type: 'flow', description: 'self-registration' });
    const tag = uniqueTag('reg');
    const email = `${tag}@fixflow.test`;

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Join your community/i })).toBeVisible();

    const reporterOption = page.locator('[data-role="reporter"]');
    await expect(reporterOption).toBeVisible({ timeout: 30_000 });
    await reporterOption.click();

    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Reporter');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(email);
    await page.getByLabel('Site ID').fill('1');
    await page.getByRole('button', { name: /Create reporter account/i }).click();

    // Either lands in reporter home, or shows post-create sign-in guidance.
    await expect(
      page.getByRole('heading', { name: /Your account is ready|My reports|Report/i }).or(
        page.getByText(/automatic sign-in did not finish|sign in/i),
      ),
    ).toBeVisible({ timeout: 45_000 });
  });

  test('Register technician smoke @auth @register', async ({ page }) => {
    test.info().annotations.push({ type: 'flow', description: 'technician self-registration' });
    const tag = uniqueTag('tech');
    const email = `${tag}@fixflow.test`;

    await page.goto('/register');
    const techOption = page.locator('[data-role="technician"]');
    await expect(techOption).toBeVisible({ timeout: 30_000 });
    await techOption.click();

    await page.getByLabel(/Legal first name/i).fill('E2E');
    await page.getByLabel(/Legal last name/i).fill('Technician');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(email);
    await page.getByLabel(/Contact phone/i).fill('+10000000000');
    await page.getByLabel(/Business or correspondence address/i).fill('1 Test Street');
    await page.getByRole('button', { name: /Create account & add trade/i }).click();

    await expect(
      page.getByRole('heading', { name: /Your account is ready|My workspace|Your trade/i }).or(
        page.getByText(/automatic sign-in did not finish|sign in/i),
      ),
    ).toBeVisible({ timeout: 45_000 });
  });
});
