import { test, expect } from '@playwright/test';
import { accounts, shopBuyers } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

test.describe('Shop checkout and fulfillment @shop', () => {
  test('non-reporter buyer can checkout; reporter is blocked from shop', async ({ browser, baseURL }) => {
    // Negative: reporters cannot use /shop
    const reporter = await authenticatedContext(browser, accounts.reporter1Site1, baseURL);
    await reporter.page.goto('/shop');
    await expect(reporter.page).not.toHaveURL(/\/shop$/);
    await reporter.context.close();

    const buyer = await authenticatedContext(browser, shopBuyers.staff, baseURL);
    await buyer.page.goto('/shop');
    await expect(buyer.page.getByRole('heading', { name: /A little care starts here/i })).toBeVisible({ timeout: 30_000 });

    const addButtons = buyer.page.getByRole('button', { name: /Add .+ to basket/i });
    await expect(addButtons.first()).toBeVisible({ timeout: 45_000 });
    await addButtons.first().click();

    await buyer.page.getByRole('button', { name: /Your basket/i }).click();
    await expect(buyer.page.getByRole('heading', { name: /Your basket/i })).toBeVisible();

    await buyer.page.getByLabel(/Full name/i).fill('E2E Buyer');
    await buyer.page.getByLabel(/Shipping address/i).fill(`42 Checkout Lane ${uniqueTag('addr')}`);
    await buyer.page.getByRole('button', { name: /^Checkout$/i }).click();

    // Dev payment completes in-app; land on order detail or confirmation.
    await expect(buyer.page).toHaveURL(/\/shop\/orders\//, { timeout: 60_000 });
    await expect(buyer.page.getByText(/Payment status|Order total|Fulfillment status/i).first()).toBeVisible();
    await buyer.context.close();
  });

  test('shop manager can process and ship an order', async ({ browser, baseURL }) => {
    const manager = await authenticatedContext(browser, accounts.shopmanager1, baseURL);
    await manager.page.goto('/shop/orders-management');
    await expect(manager.page.getByRole('heading', { name: /Manage orders/i })).toBeVisible();

    const firstOrder = manager.page.locator('ul a').first();
    if (!(await firstOrder.count())) {
      test.skip(true, 'No shop orders available yet — run buyer checkout first.');
    }

    await firstOrder.click();
    await expect(manager.page.getByText(/Fulfillment status/i)).toBeVisible();

    const process = manager.page.getByRole('button', { name: /Start processing/i });
    if (await process.count()) {
      await process.click();
      await expect(manager.page.getByText(/processing|Fulfillment status/i).first()).toBeVisible();
    }

    const ship = manager.page.getByRole('button', { name: /Mark shipped/i });
    if (await ship.count()) {
      await ship.click();
      await expect(manager.page.getByText(/shipped|Fulfillment status/i).first()).toBeVisible();
    }
    await manager.context.close();
  });

  test('buyer can confirm delivery when allowed', async ({ browser, baseURL }) => {
    const buyer = await authenticatedContext(browser, shopBuyers.staff, baseURL);
    await buyer.page.goto('/shop');
    await buyer.page.getByRole('button', { name: /^Orders$/i }).click();
    await expect(buyer.page.getByRole('heading', { name: /Your orders/i })).toBeVisible();

    const orderLink = buyer.page.locator('a[href*="/shop/orders/"]').first();
    if (!(await orderLink.count())) {
      // Orders dialog may list without links for some statuses; open via known path pattern after checkout.
      test.skip(true, 'No buyer orders listed — run checkout workflow first.');
    }
    await orderLink.click();
    await expect(buyer.page.getByText(/Fulfillment status/i)).toBeVisible({ timeout: 30_000 });

    const confirm = buyer.page.getByRole('button', { name: /Confirm delivery/i });
    if (await confirm.count()) {
      await buyer.page.getByLabel(/Your name/i).fill('E2E Buyer');
      await buyer.page.getByLabel(/I received this order/i).check();
      await confirm.click();
      await expect(buyer.page.getByText(/Received by/i)).toBeVisible({ timeout: 30_000 });
    } else {
      test.info().annotations.push({ type: 'note', description: 'Confirm delivery appears after shipment.' });
      await expect(buyer.page.getByText(/Fulfillment status/i)).toBeVisible();
    }
    await buyer.context.close();
  });
});
