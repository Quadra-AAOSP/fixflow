import { test, expect } from '@playwright/test';
import { accounts, shopBuyers } from '../fixtures/accounts';
import { authenticatedContext } from '../fixtures/auth';
import { uniqueTag } from '../fixtures/helpers';

test('synthetic order: checkout, fulfill and confirm delivery @shop', async ({ browser, baseURL }) => {
  test.skip(process.env.ALLOW_WORKFLOW_WRITES !== 'true', 'Synthetic writes are opt-in');
  const buyer = await authenticatedContext(browser, shopBuyers.staff, baseURL);
  const manager = await authenticatedContext(browser, accounts.shopmanager1, baseURL);
  try {
    await buyer.page.goto('/shop');
    await buyer.page.getByRole('button', { name: /Add .+ to basket/i }).first().click();
    await buyer.page.getByRole('button', { name: /Your basket/i }).click();
    await buyer.page.getByLabel(/Full name/i).fill('E2E Buyer');
    await buyer.page.getByLabel(/Shipping address/i).fill(`42 Checkout Lane ${uniqueTag('addr')}`);
    const created = buyer.page.waitForResponse(r => r.url().endsWith('/api/shop/orders') && r.request().method() === 'POST');
    await buyer.page.getByRole('button', { name: /^Checkout$/i }).click();
    const response = await created;
    expect(response.ok()).toBeTruthy();
    const { orderId } = await response.json() as { orderId: string };
    expect(orderId).toBeTruthy();
    await buyer.page.getByRole('button', { name: /Simulate successful payment/i }).click();
    await expect(buyer.page.getByRole('heading', { name: /Your orders/i })).toBeVisible();
    await manager.page.goto(`/shop/orders-management/${encodeURIComponent(orderId)}`);
    await expect(manager.page.getByRole('heading', { name: orderId, exact: true })).toBeVisible();
    await manager.page.getByRole('button', { name: /Start processing/i }).click();
    await manager.page.getByRole('button', { name: /Mark shipped/i }).click();
    await buyer.page.goto(`/shop/orders/${encodeURIComponent(orderId)}`);
    await buyer.page.getByLabel(/Your name/i).fill('E2E Buyer');
    await buyer.page.getByLabel(/I received this order/i).check();
    await buyer.page.getByRole('button', { name: /Confirm delivery/i }).click();
    await expect(buyer.page.getByText(/Received by E2E Buyer/i)).toBeVisible();
  } finally {
    await manager.context.close();
    await buyer.context.close();
  }
});
