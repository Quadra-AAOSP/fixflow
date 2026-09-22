import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildRegistrationPayload, buildProvisionPayload, type RegistrationInput } from '../src/utils/registration';
import { canProvisionRole } from '../src/constants/access';
import { register } from '../src/services/auth';
import { provisionUser, createTechnicianContract } from '../src/services/access';
import type { UserRole } from '../src/types';

const form: RegistrationInput = {
  firstName: ' Test ', lastName: ' Technician ', email: 'test@example.invalid',
  password: 'a unique long passphrase', phone: '', role: 'technician', siteId: '71',
};
afterEach(() => vi.unstubAllGlobals());

describe('role-based public registration', () => {
  it('always clears a technician site, even if a reporter site is left in form input', () => {
    expect(buildRegistrationPayload(form)).toMatchObject({ role: 'technician', siteId: null, firstName: 'Test' });
  });
  it('requires a valid reporter site ID and keeps the actual supplied ID', () => {
    expect(buildRegistrationPayload({ ...form, role: 'reporter' }).siteId).toBe(71);
    for (const id of ['', '0', '-2', '2.5', '1e3', '9007199254740993']) {
      expect(() => buildRegistrationPayload({ ...form, role: 'reporter', siteId: id })).toThrow('site ID');
    }
  });
  it.each(['staff', 'admin', 'super_admin'] as UserRole[])('rejects public %s signup', role => {
    expect(() => buildRegistrationPayload({ ...form, role })).toThrow('cannot self-register');
  });
  it('permits long passphrases without composition rules and does not trim the secret', () => {
    const password = '  words with spaces  ';
    expect(buildRegistrationPayload({ ...form, password }).password).toBe(password);
    expect(() => buildRegistrationPayload({ ...form, password: 'Short1!' })).toThrow('between 15');
    expect(() => buildRegistrationPayload({ ...form, password: '🙂'.repeat(8) })).toThrow('between 15');
  });
  it('rejects passwords the current bcrypt backend cannot represent without truncation', () => {
    expect(() => buildRegistrationPayload({ ...form, password: 'é'.repeat(37) })).toThrow('72-byte');
    expect(() => buildRegistrationPayload({ ...form, password: 'x'.repeat(73) })).toThrow('72-byte');
  });
  it('submits null siteId without issuing a contract request', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetch);
    await register(buildRegistrationPayload(form));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/auth/register');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toMatchObject({ role: 'technician', siteId: null });
  });
});

describe('managed-role provisioning', () => {
  it('permits only a super admin to provision a site admin', () => {
    const input = { ...form, role: 'admin' as const };
    expect(buildProvisionPayload(input, 'super_admin', [71])).toMatchObject({ role: 'admin', siteId: 71 });
    expect(() => buildProvisionPayload(input, 'admin', [71])).toThrow('permission');
  });
  it('limits site admins to staff in an accessible site', () => {
    const input = { ...form, role: 'staff' as const };
    expect(buildProvisionPayload(input, 'admin', [71]).role).toBe('staff');
    expect(() => buildProvisionPayload(input, 'admin', [72])).toThrow('available');
  });
  it('never exposes super-admin provisioning or self-elevation', () => {
    for (const actor of ['reporter','technician','staff','admin','super_admin'] as UserRole[]) {
      expect(canProvisionRole(actor, 'super_admin')).toBe(false);
      expect(() => buildProvisionPayload({ ...form, role: 'super_admin' }, actor, [71])).toThrow('permission');
    }
  });
  it('uses the managed-account endpoint and actual IDs for agreed contracts', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); vi.stubGlobal('fetch', fetch);
    await provisionUser(buildProvisionPayload({ ...form, role: 'admin' }, 'super_admin', [71]));
    await createTechnicianContract(54, 71);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/admin/users','/api/technician-contracts']);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ technicianId: 54, siteId: 71 });
  });
});
