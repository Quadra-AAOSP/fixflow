import { stubApiFetch } from './csrfFetch';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildRegistrationPayload, buildProvisionPayload, type RegistrationInput } from '../src/utils/registration';
import { canProvisionRole } from '../src/constants/access';
import { register, getSiteAdminApplication, getPendingSiteAdminApplications, decideSiteAdminApplication } from '../src/services/auth';
import { provisionUser, createTechnicianContract } from '../src/services/access';
import type { UserRole } from '../src/types';

const form: RegistrationInput = {
  firstName: ' Test ', lastName: ' Technician ', email: 'test@example.invalid',
  password: 'a unique long passphrase', phone: '+1 202 555 0100', address: 'Business correspondence address', role: 'technician', siteId: '71',
};
afterEach(() => vi.unstubAllGlobals());

describe('role-based public registration', () => {
  it('always clears a technician site, even if a reporter site is left in form input', () => {
    expect(buildRegistrationPayload(form, 15)).toMatchObject({ role: 'technician', siteId: null, firstName: 'Test' });
  });
  it('requires technician contact details without affecting reporter requirements', () => {
    expect(() => buildRegistrationPayload({ ...form, phone: '' }, 15)).toThrow('phone');
    expect(() => buildRegistrationPayload({ ...form, address: '' }, 15)).toThrow('address');
    expect(() => buildRegistrationPayload({ ...form, address: 'x'.repeat(513) }, 15)).toThrow('512');
    expect(buildRegistrationPayload(form, 15).address).toBe(form.address);
    expect(buildRegistrationPayload({ ...form, role: 'reporter', phone: '', address: '' }, 15).role).toBe('reporter');
  });
  it('requires a valid reporter site ID and keeps the actual supplied ID', () => {
    expect(buildRegistrationPayload({ ...form, role: 'reporter' }, 15).siteId).toBe(71);
    for (const id of ['', '0', '-2', '2.5', '1e3', '9007199254740993']) {
      expect(() => buildRegistrationPayload({ ...form, role: 'reporter', siteId: id }, 15)).toThrow('site ID');
    }
  });
  it.each(['staff', 'admin', 'super_admin'] as UserRole[])('rejects public %s signup', role => {
    expect(() => buildRegistrationPayload({ ...form, role }, 15)).toThrow('cannot self-register');
  });
  it('uses the application status and super-admin decision endpoints', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await getSiteAdminApplication();
    await getPendingSiteAdminApplications();
    await decideSiteAdminApplication(42, 'approve');
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      '/api/auth/site-admin-application',
      '/api/admin/site-admin-applications',
      '/api/admin/site-admin-applications/42/approve',
    ]);
    expect(fetch.mock.calls[2]?.[1].method).toBe('POST');
  });
  it('permits long passphrases without composition rules and does not trim the secret', () => {
    const password = '  words with spaces  ';
    expect(buildRegistrationPayload({ ...form, password }, 15).password).toBe(password);
    expect(() => buildRegistrationPayload({ ...form, password: 'Short1!' }, 15)).toThrow('displayed length requirements');
    expect(() => buildRegistrationPayload({ ...form, password: '🙂'.repeat(8) }, 15)).toThrow('displayed length requirements');
  });
  it('rejects passwords the current bcrypt backend cannot represent without truncation', () => {
    expect(() => buildRegistrationPayload({ ...form, password: 'é'.repeat(37) }, 15)).toThrow('72-byte');
    expect(() => buildRegistrationPayload({ ...form, password: 'x'.repeat(73) }, 15)).toThrow('72-byte');
  });
  it('submits null siteId without issuing a contract request', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    await register(buildRegistrationPayload(form, 15));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/auth/register');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toMatchObject({ role: 'technician', siteId: null });
  });
});

describe('managed-role provisioning', () => {
  it('permits only a super admin to provision a site admin', () => {
    const input = { ...form, role: 'admin' as const };
    expect(buildProvisionPayload(input, 'super_admin', [71], 15)).toMatchObject({ role: 'admin', siteId: 71 });
    expect(() => buildProvisionPayload(input, 'admin', [71], 15)).toThrow('permission');
  });
  it('limits site admins to staff in an accessible site', () => {
    const input = { ...form, role: 'staff' as const };
    expect(buildProvisionPayload(input, 'admin', [71], 15).role).toBe('staff');
    expect(() => buildProvisionPayload(input, 'admin', [72], 15)).toThrow('available');
  });
  it('provisions shop managers without carrying over a site selection', async () => {
    const input = { ...form, role: 'shop_manager' as const };
    const payload = buildProvisionPayload(input, 'super_admin', [], 15);
    expect(payload).toMatchObject({ role: 'shop_manager', siteId: null });
    expect(() => buildProvisionPayload(input, 'admin', [71], 15)).toThrow('permission');
    expect(() => buildRegistrationPayload(input, 15)).toThrow('cannot self-register');
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    await provisionUser(payload);
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toMatchObject({ role: 'shop_manager', siteId: null });
  });
  it('never exposes super-admin provisioning or self-elevation', () => {
    for (const actor of ['reporter','technician','staff','admin','super_admin'] as UserRole[]) {
      expect(canProvisionRole(actor, 'super_admin')).toBe(false);
      expect(() => buildProvisionPayload({ ...form, role: 'super_admin' }, actor, [71], 15)).toThrow('permission');
    }
  });
  it('uses the managed-account endpoint and actual IDs for agreed contracts', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await provisionUser(buildProvisionPayload({ ...form, role: 'admin' }, 'super_admin', [71], 15));
    await createTechnicianContract(54, 71);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/admin/users','/api/technician-contracts']);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ technicianId: 54, siteId: 71 });
  });
});

it('rejects email addresses beyond the backend DTO limit', () => {
  expect(() => buildRegistrationPayload({ ...form, email: 'a'.repeat(244) + '@example.com' }, 15)).toThrow('Email address is too long.');
});
