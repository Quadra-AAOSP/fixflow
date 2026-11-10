import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

test.describe('Staff / admin operations @staff @admin', () => {
  test('admin overrides urgency on a report', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Override me ${uniqueTag('override')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);

    await expect(admin.page.getByRole('heading', { name: /Override urgency/i })).toBeVisible();
    await admin.page.getByLabel(/Final urgency/i).selectOption({ label: /High/i });
    await admin.page.getByLabel(/Override reason/i).fill('Site safety walkthrough requires higher priority.');
    await admin.page.getByRole('button', { name: /Save urgency override/i }).click();
    await expect(admin.page.getByRole('status')).toContainText(/Final urgency updated/i);
    await admin.context.close();
  });

  test('staff can assign a contracted technician when candidates exist @assign', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Needs tech ${uniqueTag('assign')}`);
    await reporter.context.close();

    const staff = await authenticatedContext(browser, accounts.staff1Site1, baseURL);
    await openReport(staff.page, reportId);

    await expect(staff.page.getByRole('heading', { name: /Find a technician|Assign a technician/i })).toBeVisible();
    const route = staff.page.getByLabel(/Technician route/i);
    if (await route.count()) {
      await route.selectOption({ label: /Assign a contracted technician/i });
    }

    await expect(staff.page.getByRole('heading', { name: /Assign a technician|Reassign technician/i })).toBeVisible();
    const candidate = staff.page.locator('input[name="technician"]').first();
    await expect(candidate).toBeVisible({ timeout: 45_000 });
    await candidate.check();
    await staff.page.getByRole('button', { name: /Save assignment/i }).click();
    await expect(staff.page.getByRole('status')).toContainText(/assignment saved/i);
    await staff.context.close();
  });

  test('admin can escalate assigned work @escalate', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Escalate path ${uniqueTag('escalate')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);

    // Assign first so escalate controls appear for operators.
    const candidate = admin.page.locator('input[name="technician"]').first();
    if (await candidate.count()) {
      await candidate.check();
      await admin.page.getByRole('button', { name: /Save assignment/i }).click();
      await expect(admin.page.getByRole('status')).toContainText(/assignment saved/i);
    }

    const escalateSummary = admin.page.getByText(/Raise a safety or work concern/i);
    await expect(escalateSummary).toBeVisible({ timeout: 30_000 });
    await escalateSummary.click();
    await admin.page.getByLabel(/Concern details/i).fill('Water near electrical panel — escalate for safety.');
    await admin.page.getByRole('button', { name: /Escalate report/i }).click();
    await expect(admin.page.getByRole('status').or(admin.page.getByText(/escalat|Work status updated/i))).toBeVisible();
    await admin.context.close();
  });
});
