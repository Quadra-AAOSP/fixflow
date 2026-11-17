import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

function futureTiming(): string {
  const date = new Date(Date.now() + 7 * 86400000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

test.beforeEach(() => {
  test.skip(process.env.ALLOW_WORKFLOW_WRITES !== 'true', 'Workflows that may write are opt-in');
});

test.describe('Marketplace publish → apply → offer → accept @marketplace', () => {
  test('admin publishes a job listing from an unassigned report', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Marketplace job ${uniqueTag('mkt')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);

    await expect(admin.page.getByRole('heading', { name: /Publish to the job marketplace/i })).toBeVisible();
    await admin.page.getByLabel(/Public job summary/i).fill('General plumbing repair in shared facility area.');
    await admin.page.getByLabel(/Broad location/i).fill('Campus north wing');
    await admin.page.getByLabel(/Expected timing/i).fill(futureTiming());
    await admin.page.getByLabel(/Pay amount/i).fill('100');
    await admin.page.getByLabel(/no private details/i).check();
    await admin.page.getByRole('button', { name: /Publish job listing/i }).click();
    await expect(admin.page.getByRole('status').filter({ hasText: /published/i })).toBeVisible();

    await admin.page.goto('/marketplace');
    await expect(admin.page.getByRole('heading', { name: /Job marketplace/i })).toBeVisible();
    await expect(admin.page.getByText(/General plumbing repair/i)).toBeVisible();
    await admin.context.close();
  });

  test('technician applies; admin offers; technician accepts when eligible', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Offer flow ${uniqueTag('offer')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);
    await admin.page.getByLabel(/Public job summary/i).fill(`Offer flow listing ${reportId}`);
    await admin.page.getByLabel(/Broad location/i).fill('Campus east');
    await admin.page.getByLabel(/Expected timing/i).fill(futureTiming());
    await admin.page.getByLabel(/Pay amount/i).fill('100');
    await admin.page.getByLabel(/no private details/i).check();
    await admin.page.getByRole('button', { name: /Publish job listing/i }).click();
    await expect(admin.page.getByRole('status').filter({ hasText: /published/i })).toBeVisible();
    await admin.context.close();

    const tech = await authenticatedContext(browser, accounts.technician2Site1, baseURL);
    await tech.page.goto('/marketplace');
    await expect(tech.page.getByRole('heading', { name: /Job marketplace/i })).toBeVisible();

    const listing = tech.page.locator('article').filter({ hasText: new RegExp(`Offer flow listing ${reportId}`) });
    await expect(listing).toBeVisible({ timeout: 30_000 });
    await listing.getByLabel(/Why are you suited to this job/i).fill('Matching trade and capacity this week.');
    await listing.getByRole('button', { name: /Apply for job/i }).click();
    await expect(listing.getByText(/Application status/i)).toBeVisible({ timeout: 30_000 });
    await tech.context.close();

    const admin2 = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin2.page.goto('/marketplace');
    const adminListing = admin2.page.locator('article').filter({ hasText: new RegExp(`Offer flow listing ${reportId}`) });
    await adminListing.getByRole('button', { name: /Refresh applicants/i }).click();
    await expect(admin2.page.getByText(/No applications yet|Active cases|Send offer/i).first()).toBeVisible({ timeout: 30_000 });

    await adminListing.getByLabel(/checked the qualifications/i).check();
    await adminListing.getByRole('button', { name: /Send offer/i }).click();
    await admin2.context.close();

    const tech2 = await authenticatedContext(browser, accounts.technician2Site1, baseURL);
    await tech2.page.goto('/marketplace');
    const offered = tech2.page.locator('article').filter({ hasText: new RegExp(`Offer flow listing ${reportId}`) });
    await offered.getByRole('button', { name: /Accept offer/i }).click();
    await expect(offered.getByRole('link', { name: /Open report/i })).toBeVisible({ timeout: 30_000 });
    await tech2.context.close();
  });
});
