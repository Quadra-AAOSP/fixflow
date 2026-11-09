import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

test.describe('Cross-site isolation @cross-site', () => {
  test('site1 reporter cannot treat site2 report as their own', async ({ browser, baseURL }) => {
    test.info().annotations.push({ type: 'negative', description: 'site boundary' });

    // Create a public report as site2 reporter
    const site2 = await authenticatedContext(browser, accounts.reporter1Site2, baseURL);
    const description = `Site2 only ${uniqueTag('xsite')}`;
    const reportId = await createPublicReport(site2.page, description);
    await expect(site2.page.getByText(description)).toBeVisible();
    await site2.context.close();

    // Site1 reporter attempts to open / join / edit site2 report
    const site1 = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    await site1.page.goto(`/reports/${reportId}`);

    const alert = site1.page.getByRole('alert');
    const join = site1.page.getByRole('button', { name: /This issue affects me too/i });
    const edit = site1.page.getByRole('button', { name: /Edit report/i });
    const heading = site1.page.getByRole('heading', { name: new RegExp(`Report #${reportId}`) });

    // Expect denied access, missing join/edit, or redirected away from operating the foreign report.
    const denied =
      (await alert.count()) > 0 ||
      !(await heading.count()) ||
      ((await heading.count()) > 0 && (await join.count()) === 0 && (await edit.count()) === 0);

    expect(denied).toBeTruthy();

    if (await heading.count()) {
      await expect(join).toHaveCount(0);
      await expect(edit).toHaveCount(0);
      // Must not see creator-only confirm controls for a foreign site report.
      await expect(site1.page.getByRole('button', { name: /Confirm issue is fixed/i })).toHaveCount(0);
    }

    await site1.context.close();
  });

  test('site1 admin cannot open site2-only management as if it were local', async ({ browser, baseURL }) => {
    const admin1 = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin1.page.goto('/sites/2/subsites');

    // Either redirected / error, or page states the site is not available to this account.
    const unavailable = admin1.page.getByText(/not available to your account|invalid|Choose an accessible site/i);
    const heading = admin1.page.getByRole('heading', { name: /Buildings & locations/i });

    if (await unavailable.count()) {
      await expect(unavailable.first()).toBeVisible();
    } else if (await heading.count()) {
      // If the shell loads, management actions for site2 must not succeed for site1 admin.
      // Prefer asserting the site name is not operable — empty/error state is acceptable.
      await expect(admin1.page.getByText(/This site is not available|No buildings|Loading/i).or(unavailable)).toBeVisible();
    } else {
      await expect(admin1.page).not.toHaveURL(/\/sites\/2\/subsites/);
    }
    await admin1.context.close();
  });
});
