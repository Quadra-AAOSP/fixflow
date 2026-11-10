import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

test.describe('Super admin platform ops @super_admin', () => {
  test('site applications review page is reachable', async ({ browser, baseURL }) => {
    const session = await authenticatedContext(browser, accounts.superadmin1, baseURL);
    await session.page.goto('/site-applications');
    await expect(session.page.getByRole('heading', { name: /Site applications/i })).toBeVisible();
    await expect(session.page.getByText(/Review organization authority|proposed administrator/i)).toBeVisible();
    await expect(session.page.getByLabel(/Decision reason/i)).toBeVisible();
    await session.context.close();
  });

  test('technician verification decide UI', async ({ browser, baseURL }) => {
    const session = await authenticatedContext(browser, accounts.superadmin1, baseURL);
    await session.page.goto('/technician-verifications');
    await expect(session.page.getByRole('heading', { name: /Technician verification/i })).toBeVisible();
    await expect(session.page.getByText(/manual checks|Applications/i).first()).toBeVisible();

    const firstApp = session.page.locator('li button').first();
    if (await firstApp.count()) {
      await firstApp.click();
      await expect(session.page.getByRole('heading', { name: /Manual review/i })).toBeVisible();
      await expect(session.page.getByLabel(/Identity manually checked/i)).toBeVisible();
      await expect(session.page.getByLabel(/Decision reason/i)).toBeVisible();
      await expect(session.page.getByRole('button', { name: /Approve verification|Reject|Suspend|Return to review/i }).first()).toBeVisible();
    } else {
      await expect(session.page.getByText(/No applications to review/i)).toBeVisible();
    }
    await session.context.close();
  });

  test('team provision creates staff account form @team', async ({ browser, baseURL }) => {
    const session = await authenticatedContext(browser, accounts.superadmin1, baseURL);
    await session.page.goto('/team-access');
    await expect(session.page.getByRole('heading', { name: /Team access/i })).toBeVisible();
    await expect(session.page.getByText(/Create approved site-administrator, staff, and shop-manager/i)).toBeVisible();

    await session.page.getByLabel(/^Role$/i).selectOption({ label: /Staff/i });
    const site = session.page.getByLabel(/^Site$/i);
    await expect(site).toBeVisible();
    await site.selectOption({ index: 1 });

    const tag = uniqueTag('staff');
    const email = `${tag}@fixflow.test`;
    await session.page.getByLabel(/First name/i).fill('Provisioned');
    await session.page.getByLabel(/Last name/i).fill('Staff');
    await session.page.getByLabel(/Work email/i).fill(email);
    await session.page.getByLabel(/Initial password/i).fill(email);

    await session.page.getByRole('button', { name: /Create approved account/i }).click();
    await expect(session.page.getByRole('status')).toContainText(/account created|can now sign in/i, { timeout: 30_000 });
    await session.context.close();
  });
});
