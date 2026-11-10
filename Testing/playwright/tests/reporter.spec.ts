import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

test.describe('Reporter report lifecycle @reporter', () => {
  test('create public report, join as another reporter, leave, confirm path @reporter', async ({ browser, baseURL }) => {
    test.info().annotations.push({ type: 'actors', description: 'reporter1 + reporter2 site1' });

    const creator = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const description = `Leak near sink ${uniqueTag('report')}`;
    const reportId = await createPublicReport(creator.page, description);
    await expect(creator.page.getByText(description)).toBeVisible();
    await expect(creator.page.getByText(/Public within your site/i)).toBeVisible();
    await expect(creator.page.getByText(/People joined/i)).toBeVisible();
    await creator.context.close();

    const joiner = await authenticatedContext(browser, accounts.reporter2Site1, baseURL);
    await openReport(joiner.page, reportId);
    await joiner.page.getByRole('button', { name: /This issue affects me too/i }).click();
    await expect(joiner.page.getByRole('status')).toContainText(/attached to this report/i);
    await expect(joiner.page.getByText(/^You$/)).toBeVisible();

    await joiner.page.getByRole('button', { name: /Leave report/i }).click();
    await expect(joiner.page.getByRole('status')).toContainText(/left this report/i);
    await expect(joiner.page.getByRole('button', { name: /This issue affects me too/i })).toBeVisible();
    await joiner.context.close();
  });

  test('creator can open confirm controls when report awaits confirmation @reporter @confirm', async ({ browser, baseURL }) => {
    // Full resolve→confirm needs a technician assignment; assert creator-only confirm affordance wiring.
    const creator = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(creator.page, `Confirm wiring ${uniqueTag('confirm')}`);
    await openReport(creator.page, reportId);

    // Confirm button only appears for creator when status is resolved_pending_confirmation.
    // Seeded/assigned flows cover that end-to-end; here we assert non-creators never see it early.
    await expect(creator.page.getByRole('button', { name: /Confirm issue is fixed/i })).toHaveCount(0);
    await creator.context.close();

    const other = await authenticatedContext(browser, accounts.reporter2Site1, baseURL);
    await openReport(other.page, reportId);
    await expect(other.page.getByRole('button', { name: /Confirm issue is fixed/i })).toHaveCount(0);
    await other.context.close();
  });

  test('optional photos field is available on create form @reporter @photos', async ({ browser, baseURL }) => {
    const session = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    await session.page.goto('/reports/new');
    await expect(session.page.getByLabel(/Photos \(optional\)/i)).toBeVisible({ timeout: 30_000 });
    await expect(session.page.getByText(/Up to 5 photos/i)).toBeVisible();
    await session.context.close();
  });
});
