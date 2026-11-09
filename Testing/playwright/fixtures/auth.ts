import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { SeedAccount } from './accounts';
import { passwordFor } from './accounts';

export type AuthUser = {
  id: number;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  siteId?: number | null;
};

type CsrfToken = { headerName: string; token: string };

/**
 * API session login (CSRF + cookie). Faster than UI for multi-actor workflows.
 * Password equals email for seeded accounts.
 */
export async function apiLogin(
  request: APIRequestContext,
  account: SeedAccount | { email: string; password?: string },
): Promise<AuthUser> {
  const email = account.email;
  const password = 'password' in account && account.password ? account.password : passwordFor(email);

  const csrf = await request.get('/api/auth/csrf');
  expect(csrf.ok(), `CSRF failed for ${email}`).toBeTruthy();
  const csrfBody = (await csrf.json()) as CsrfToken;
  expect(csrfBody.headerName).toBe('X-CSRF-TOKEN');
  expect(csrfBody.token).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    headers: {
      [csrfBody.headerName]: csrfBody.token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: { email, password },
  });
  expect(login.ok(), `Login failed for ${email}: ${login.status()} ${await login.text()}`).toBeTruthy();
  return (await login.json()) as AuthUser;
}

export async function apiLogout(request: APIRequestContext): Promise<void> {
  const csrf = await request.get('/api/auth/csrf');
  if (!csrf.ok()) return;
  const csrfBody = (await csrf.json()) as CsrfToken;
  await request.post('/api/auth/logout', {
    headers: {
      [csrfBody.headerName]: csrfBody.token,
      Accept: 'application/json',
    },
  });
}

export async function apiMe(request: APIRequestContext): Promise<AuthUser> {
  const me = await request.get('/api/auth/me', { headers: { Accept: 'application/json' } });
  expect(me.ok()).toBeTruthy();
  return (await me.json()) as AuthUser;
}

/** Fill LoginView and submit. */
export async function uiLogin(page: Page, account: SeedAccount | { email: string; password?: string }): Promise<void> {
  const email = account.email;
  const password = 'password' in account && account.password ? account.password : passwordFor(email);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function uiLogout(page: Page): Promise<void> {
  await page.goto('/profile');
  await page.getByRole('button', { name: /Sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Create a fresh browser context already authenticated via API cookies. */
export async function authenticatedContext(
  browser: Browser,
  account: SeedAccount,
  baseURL?: string,
): Promise<{ context: BrowserContext; page: Page; user: AuthUser }> {
  const context = await browser.newContext({ baseURL, storageState: undefined });
  const request = context.request;
  const user = await apiLogin(request, account);
  const page = await context.newPage();
  return { context, page, user };
}

/** Persist storageState for reuse across tests in the same worker. */
export async function saveStorageState(
  browser: Browser,
  account: SeedAccount,
  path: string,
  baseURL?: string,
): Promise<AuthUser> {
  const { context, user } = await authenticatedContext(browser, account, baseURL);
  await context.storageState({ path });
  await context.close();
  return user;
}
