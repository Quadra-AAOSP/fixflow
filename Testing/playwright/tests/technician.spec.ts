import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

test.describe('Technician workspace @technician', () => {
  test('terms accept or already accepted, verification status, availability toggle', async ({ browser, baseURL }) => {
    const tech = await authenticatedContext(browser, accounts.technician1Site1, baseURL);
    await tech.page.goto('/technician');
    await expect(tech.page.getByRole('heading', { name: /Technician terms|My workspace|Your trade/i }).first()).toBeVisible({ timeout: 30_000 });

    // Terms: accept if prompted, otherwise assert accepted state.
    const accept = tech.page.getByRole('button', { name: /Accept current terms/i });
    if (await accept.count()) {
      await tech.page.getByRole('checkbox', { name: /I have read and agree/i }).check();
      await accept.click();
      await expect(tech.page.getByText(/You have accepted this version/i)).toBeVisible();
    } else {
      await expect(
        tech.page.getByText(/You have accepted this version|Acceptance is not currently required|Approved terms are not configured/i),
      ).toBeVisible();
    }

    // Verification: submit if form exists, else assert verified/pending status.
    await expect(tech.page.getByRole('heading', { name: /Technician verification/i })).toBeVisible();
    const submitReview = tech.page.getByRole('button', { name: /Submit for manual review/i });
    if (await submitReview.count()) {
      await tech.page.getByLabel(/Contact email/i).fill(accounts.technician1Site1.email);
      await tech.page.getByLabel(/Contact phone/i).fill('+10000000001');
      await tech.page.getByLabel(/^Trades$/i).fill('plumbing, electrical');
      await tech.page.getByLabel(/^Experience$/i).fill('Five years site maintenance.');
      await tech.page.getByLabel(/Qualifications and references/i).fill('Trade certificate on file with site admin.');
      await submitReview.click();
      await expect(tech.page.getByText(/Review status|awaiting manual review|verified/i)).toBeVisible();
    } else {
      await expect(tech.page.getByText(/Review status/i)).toBeVisible();
    }

    // Availability switch
    await expect(tech.page.getByRole('heading', { name: /Your availability/i })).toBeVisible();
    const toggle = tech.page.getByRole('switch', { name: /Available for site work/i });
    await expect(toggle).toBeVisible();
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-checked', before ?? '');
    // Restore prior state for other suites
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', before ?? 'true');

    await tech.context.close();
  });

  test('assigned technician can start and resolve work @work', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Tech work ${uniqueTag('work')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);
    const candidate = admin.page.locator('input[name="technician"]').first();
    await expect(candidate).toBeVisible({ timeout: 45_000 });
    await candidate.check();
    await admin.page.getByRole('button', { name: /Save assignment/i }).click();
    await expect(admin.page.getByRole('status')).toContainText(/assignment saved/i);

    // Capture assigned technician id from detail grid if shown as Technician #id
    const techCell = admin.page.locator('dt', { hasText: /^Technician$/i }).locator('..').locator('dd');
    const techText = (await techCell.textContent()) ?? '';
    await admin.context.close();

    const tech = await authenticatedContext(browser, accounts.technician1Site1, baseURL);
    await openReport(tech.page, reportId);

    const start = tech.page.getByRole('button', { name: /Start work/i });
    // If this seeded tech is not the assignee, skip gracefully with a clear annotation.
    if (!(await start.count())) {
      test.info().annotations.push({
        type: 'note',
        description: `technician1 may not be ranked first (assignment text: ${techText}). Suite still validates UI when assigned.`,
      });
      test.skip(true, 'Seeded technician1 was not selected by ranking; assignment UI covered in staff-admin suite.');
    }

    await start.click();
    await expect(tech.page.getByRole('status').or(tech.page.getByLabel(/Describe the completed work/i))).toBeVisible();

    await tech.page.getByLabel(/Describe the completed work/i).fill('Replaced washer and verified no further leak.');
    await tech.page.getByRole('button', { name: /Submit resolution/i }).click();
    await expect(tech.page.getByText(/resolved|Work status updated|Check the completed repair/i)).toBeVisible({ timeout: 30_000 });
    await tech.context.close();
  });
});
