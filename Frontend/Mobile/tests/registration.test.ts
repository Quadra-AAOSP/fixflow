import { describe, expect, it } from 'vitest';

import {
  buildRegistrationPayload,
  validateRegistration,
  type RegistrationInput,
} from '../utils/registration';

function input(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return {
    firstName: 'Alex',
    lastName: 'Ng',
    email: 'alex@example.com',
    password: 'abcdefghijklmno', // 15 characters
    phone: '',
    role: 'reporter',
    siteId: '12',
    address: '',
    ...overrides,
  };
}

describe('validateRegistration', () => {
  it('accepts a valid reporter input with a siteId', () => {
    expect(validateRegistration(input())).toEqual({});
  });

  it('requires first and last names', () => {
    const errors = validateRegistration(input({ firstName: '   ', lastName: '' }));
    expect(errors.firstName).toBe('First name is required.');
    expect(errors.lastName).toBe('Last name is required.');
  });

  it('rejects a one-character name with a format error', () => {
    const errors = validateRegistration(input({ firstName: 'A' }));
    expect(errors.firstName).toBe('Use 2+ letters (letters, spaces, hyphens only).');
  });

  it('rejects a malformed email', () => {
    const errors = validateRegistration(input({ email: 'not-an-email' }));
    expect(errors.email).toBe('Enter a valid email address.');
  });

  it('enforces the 15-character password minimum', () => {
    expect(validateRegistration(input({ password: 'a'.repeat(14) })).password).toBe(
      'Use at least 15 characters.',
    );
    expect(validateRegistration(input({ password: 'a'.repeat(15) })).password).toBeUndefined();
  });

  it('requires a siteId for reporter and admin but not technician', () => {
    expect(validateRegistration(input({ role: 'reporter', siteId: '' })).siteId).toBe(
      'Enter the site ID from your administrator.',
    );
    expect(validateRegistration(input({ role: 'admin', siteId: '   ' })).siteId).toBe(
      'Enter the site ID from your administrator.',
    );
    expect(validateRegistration(input({ role: 'technician', siteId: '' })).siteId).toBeUndefined();
  });

  it('rejects a non-numeric siteId', () => {
    expect(validateRegistration(input({ siteId: 'abc' })).siteId).toBe(
      'Site ID must be a positive whole number.',
    );
  });

  it('validates optional phone numbers only when present', () => {
    expect(validateRegistration(input({ phone: '12' })).phone).toBe(
      'Enter a valid phone number (6–20 digits).',
    );
    expect(validateRegistration(input({ phone: '+44 20 7946' })).phone).toBeUndefined();
    expect(validateRegistration(input({ phone: '' })).phone).toBeUndefined();
    expect(validateRegistration(input({ phone: '   ' })).phone).toBeUndefined();
  });

  it('caps the optional address at 255 characters', () => {
    expect(validateRegistration(input({ address: 'a'.repeat(256) })).address).toBe(
      'Keep the address under 255 characters.',
    );
    expect(validateRegistration(input({ address: 'a'.repeat(255) })).address).toBeUndefined();
  });
});

describe('buildRegistrationPayload', () => {
  it('coerces siteId, trims fields, and omits empty optional strings', () => {
    const payload = buildRegistrationPayload(
      input({
        firstName: '  Alex ',
        lastName: ' Ng  ',
        email: ' alex@example.com ',
        siteId: ' 42 ',
        phone: '   ',
        address: '',
      }),
    );

    expect(payload).toMatchObject({
      firstName: 'Alex',
      lastName: 'Ng',
      email: 'alex@example.com',
      role: 'reporter',
      siteId: 42,
    });
    expect(typeof payload.siteId).toBe('number');
    expect(payload.phone).toBeUndefined();
    expect(payload.address).toBeUndefined();
  });

  it('keeps a non-empty phone and address', () => {
    const payload = buildRegistrationPayload(
      input({ phone: ' +44 20 7946 ', address: ' 5 Main Street ' }),
    );
    expect(payload.phone).toBe('+44 20 7946');
    expect(payload.address).toBe('5 Main Street');
  });

  it('returns a null siteId for technicians', () => {
    const payload = buildRegistrationPayload(input({ role: 'technician', siteId: '12' }));
    expect(payload.siteId).toBeNull();
  });

  it('throws when a reporter has no siteId', () => {
    expect(() => buildRegistrationPayload(input({ role: 'reporter', siteId: '' }))).toThrow(
      'Enter the site ID provided by your administrator.',
    );
  });

  it('throws for non-positive site IDs', () => {
    expect(() => buildRegistrationPayload(input({ siteId: '0' }))).toThrow(
      'Enter a valid numeric site ID.',
    );
    expect(() => buildRegistrationPayload(input({ siteId: '-3' }))).toThrow(
      'Enter a valid numeric site ID.',
    );
  });
});
