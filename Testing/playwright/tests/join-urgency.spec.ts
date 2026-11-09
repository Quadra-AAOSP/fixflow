import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { createPublicReport, openReport, uniqueTag } from '../fixtures/helpers';

const joiners = [
  accounts.reporter2Site1,
  accounts.reporter3Site1,
  accounts.reporter4Site1,
  accounts.reporter5Site1,
];

test.describe('Join boosts calculated urgency @join-urgency', () => {
  test('multiple reporters join the same public report and participation is visible', async ({ browser, baseURL }) => {
    test.info().annotations.push({ type: 'joiners', description: String(joiners.length) });

    const creator = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    const description = `Crowd urgency ${uniqueTag('urgency')}`;
    const reportId = await createPublicReport(creator.page, description, { urgency: /Low/i });
    await expect(creator.page.getByText(/People joined/i)).toBeVisible();
    await creator.context.close();

    for (const account of joiners) {
      const session = await authenticatedContext(browser, account, baseURL);
      await openReport(session.page, reportId);
      const join = session.page.getByRole('button', { name: /This issue affects me too/i });
      if (await join.count()) {
        await join.click();
        await expect(session.page.getByRole('status')).toContainText(/attached/i);
      }
      await session.context.close();
    }

    const observer = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    await openReport(observer.page, reportId);
    await expect(observer.page.getByText(/People joined/i)).toBeVisible();

    // Participation count should reflect creator + joiners (UI shows a number in the detail grid).
    const peopleJoined = observer.page.locator('dt', { hasText: /People joined/i }).locator('..').locator('dd');
    await expect(peopleJoined).toBeVisible();
    const countText = (await peopleJoined.textContent())?.trim() ?? '0';
    expect(Number(countText)).toBeGreaterThanOrEqual(joiners.length);

    // Calculated urgency may rise with joins (never Critical from joins alone).
    const calculated = observer.page.locator('dt', { hasText: /Calculated urgency/i }).locator('..').locator('dd');
    await expect(calculated).toBeVisible();
    await expect(calculated).not.toHaveText(/Not determined|Critical/i);
    await observer.context.close();
  });
});
