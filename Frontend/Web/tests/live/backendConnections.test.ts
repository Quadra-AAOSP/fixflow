// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { advanceRequestSession, ApiError } from '../../src/services/api';
import { getMe, login, logout } from '../../src/services/auth';
import { getAccountPolicy } from '../../src/services/accountPolicy';
import { getReport, listPendingSubsiteRequests, listReports, listSites, listSubsites } from '../../src/services/maintenance';
import { listReportPhotos } from '../../src/services/reportPhotos';
import { loadCatalog, listOrders } from '../../src/services/shop';

// Explicit opt-in: normal tests never contact a backend or use stored credentials.
const target = process.env.FIXFLOW_LIVE_API;
const nativeFetch = globalThis.fetch;
const cookies = new Map<string, string>();
let siteId: number;
let reportId: number;
let email: string;
let authenticated = false;

function positiveId(name: string) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must identify an existing disposable fixture.`);
  return value;
}

describe.skipIf(!target).sequential('live web service connections (isolated backend)', () => {
  beforeAll(async () => {
    const origin = new URL(target!);
    if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
        origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('FIXFLOW_LIVE_API must be a loopback HTTP origin for an isolated test backend.');
    }
    email = process.env.FIXFLOW_LIVE_REPORTER_EMAIL ?? '';
    const password = process.env.FIXFLOW_LIVE_PASSWORD;
    if (!email.endsWith('@example.invalid') || !password) {
      throw new Error('Provide a disposable @example.invalid reporter and FIXFLOW_LIVE_PASSWORD.');
    }
    siteId = positiveId('FIXFLOW_LIVE_SITE_ID');
    reportId = positiveId('FIXFLOW_LIVE_REPORT_ID');
    // Node has no browser cookie jar. This bridge uses real network responses,
    // while the production service still supplies CSRF, bodies and error handling.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!path.startsWith('/api/')) throw new Error('Run with VITE_API_URL empty; only relative API requests are accepted.');
      const headers = new Headers(init.headers);
      if (cookies.size) headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
      const response = await nativeFetch(new URL(path, origin), { ...init, headers });
      for (const item of response.headers.getSetCookie()) {
        const pair = item.split(';', 1)[0]!;
        const equals = pair.indexOf('=');
        const name = pair.slice(0, equals);
        const value = pair.slice(equals + 1);
        if (equals > 0) { if (value) cookies.set(name, value); else cookies.delete(name); }
      }
      return response;
    });
    advanceRequestSession();
    const user = await login({ email, password });
    authenticated = true;
    expect(user.role).toBe('reporter');
    expect(user.siteId).toBe(siteId);
  }, 30_000);

  afterAll(async () => {
    try { if (authenticated) await logout(); }
    finally { cookies.clear(); advanceRequestSession(); vi.unstubAllGlobals(); }
  });

  it('restores the same authenticated reporter through the production service', async () => {
    const user = await getMe();
    expect(user.email).toBe(email);
    expect(user.role).toBe('reporter');
    expect(user.siteId).toBe(siteId);
  });
  it('parses the published registration policy and accessible sites', async () => {
    const policy = await getAccountPolicy();
    expect(policy.passwordMinLength).toBeGreaterThan(0);
    expect(policy.selfRegistrationRoles).toContain('reporter');
    const sites = await listSites();
    expect(sites.some(site => site.id === siteId)).toBe(true);
    expect(sites.every(site => site.id === siteId)).toBe(true);
  });
  it('loads actual buildings, paginated reports and the selected report', async () => {
    const buildings = await listSubsites(siteId);
    expect(Array.isArray(buildings)).toBe(true);
    expect(buildings.every(building => building.siteId === siteId)).toBe(true);
    const reports = await listReports(siteId);
    expect(reports.some(report => report.id === reportId)).toBe(true);
    const detail = await getReport(reportId);
    expect(detail.id).toBe(reportId);
    expect(typeof detail.description).toBe('string');
  });
  it('reads authorized photo metadata without claiming object-storage acceptance', async () => {
    expect(Array.isArray(await listReportPhotos(reportId))).toBe(true);
  });
  it('rejects reporter access to the administration inbox without clearing the session', async () => {
    await expect(listPendingSubsiteRequests(siteId)).rejects.toMatchObject({ status: 403 });
    expect((await getMe()).role).toBe('reporter');
  });
  it('parses the published catalogue and the current account order history', async () => {
    const catalogue = await loadCatalog();
    expect(Array.isArray(catalogue.products)).toBe(true);
    expect(catalogue.currency).toMatch(/^[A-Z]{3}$/);
    expect(Array.isArray(await listOrders())).toBe(true);
  });
  it('invalidates its own server session on logout', async () => {
    await logout(); authenticated = false;
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    await expect(getMe()).rejects.toMatchObject({ status: 401 });
  });
});
