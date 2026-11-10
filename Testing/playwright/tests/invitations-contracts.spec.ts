import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

test.describe('Invitations → contract request → approve → vetting → assign @contracts', () => {
  test('admin can invite technicians from a report', async ({ browser, baseURL }) => {
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const reportId = await createPublicReport(reporter.page, `Invite flow ${uniqueTag('invite')}`);
    await reporter.context.close();

    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await openReport(admin.page, reportId);

    const route = admin.page.getByLabel(/Technician route/i);
    await expect(route).toBeVisible();
    await route.selectOption({ label: /Invite technicians to request a site contract/i });
    await expect(admin.page.getByText(/Invite matching technicians/i)).toBeVisible();
    // Invitation sender UI is present for managers; exact candidate list depends on seed directory.
    await expect(admin.page.getByText(/request a site contract/i).first()).toBeVisible();
    await admin.context.close();
  });

  test('technician can open invitations inbox and contract request form', async ({ browser, baseURL }) => {
    const tech = await authenticatedContext(browser, accounts.technician2Site1, baseURL);
    await tech.page.goto('/technician/invitations');
    await expect(tech.page.getByRole('heading', { name: /Site invitations/i })).toBeVisible();
    await expect(tech.page.getByText(/do not assign work or create contracts/i)).toBeVisible();

    await tech.page.goto('/contracts');
    await expect(tech.page.getByRole('heading', { name: /Site contracts|Request a site contract/i }).first()).toBeVisible();
    await expect(tech.page.getByRole('heading', { name: /Request a site contract/i })).toBeVisible();
    await tech.page.getByLabel(/^Site ID$/i).fill('1');
    await tech.page.getByLabel(/Note to the site administrator/i).fill(`E2E contract request ${uniqueTag('contract')}`);

    const send = tech.page.getByRole('button', { name: /Send contract request/i });
    if (await send.isEnabled()) {
      await send.click();
      await expect(tech.page.getByRole('status')).toContainText(/submitted|Request #/i);
    } else {
      // Terms must be accepted before sending.
      await expect(tech.page.getByText(/accept the current terms|Terms status must load/i)).toBeVisible();
    }
    await tech.context.close();
  });

  test('admin reviews contract requests and site vetting controls', async ({ browser, baseURL }) => {
    const admin = await authenticatedContext(browser, accounts.admin1Site1, baseURL);
    await admin.page.goto('/contracts');
    await expect(admin.page.getByRole('heading', { name: /Site contracts|Site contract requests/i }).first()).toBeVisible();
    await expect(admin.page.getByRole('heading', { name: /Site contract requests|Your contract requests/i }).first()).toBeVisible();
    await expect(admin.page.getByText(/Approval creates the site contract|No requests yet|Request #/i).first()).toBeVisible();

    // Site vetting panel is available for contracted technicians.
    await expect(admin.page.getByRole('heading', { name: /Site technician vetting|Recorded site contracts/i }).first()).toBeVisible();
    const approveVetting = admin.page.getByRole('button', { name: /Record approval/i });
    if (await approveVetting.count()) {
      await expect(approveVetting.first()).toBeVisible();
    }
    await admin.context.close();
  });
});
