import {
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  canProvisionRole,
} from '@/constants/access';
import type {
  ProvisionUserPayload,
  RegisterPayload,
  UserRole,
} from '@/types';

/**
 * Client-side validation mirroring the backend DTO constraints. This exists
 * to give immediate feedback, never as a substitute for server checks — the
 * backend re-validates everything and remains the authority.
 */

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  siteId: string;
  address?: string;
};

export type AccountDetails = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Exact UTF-8 byte length. `TextEncoder` is not part of the Hermes runtime,
 * so the count is done per code point: 1 byte for ASCII, 2–3 for most
 * accented characters, 4 for astral-plane emoji.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function validateAccount(
  input: Omit<RegistrationInput, 'role' | 'siteId'>,
): AccountDetails {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (!firstName || !lastName || !email || !input.password) {
    throw new Error(
      'First name, last name, email, and password are required.',
    );
  }
  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    throw new Error(`Names must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  // Count code points, not UTF-16 units, so emoji are not double-counted.
  if (
    [...input.password].length < PASSWORD_MIN_LENGTH ||
    input.password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Use a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters. Spaces and passphrases are welcome.`,
    );
  }
  // bcrypt cannot safely represent more than 72 bytes; reject rather than
  // silently truncate the user's password.
  if (utf8ByteLength(input.password) > PASSWORD_MAX_BYTES) {
    throw new Error(
      `This password exceeds the server's ${PASSWORD_MAX_BYTES}-byte limit. Use a shorter passphrase; accented characters and emoji can use more than one byte.`,
    );
  }
  if (phone.length > MAX_PHONE_LENGTH) {
    throw new Error(
      `Phone numbers must be ${MAX_PHONE_LENGTH} characters or fewer.`,
    );
  }

  return {
    firstName,
    lastName,
    email,
    password: input.password,
    ...(phone ? { phone } : {}),
  };
}

/** Parses a site id typed or picked by the user. */
export function positiveId(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Choose a valid site.');
  }
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Choose a valid site.');
  }
  return id;
}

export function buildRegistrationPayload(
  input: RegistrationInput,
): RegisterPayload {
  if (input.role !== 'reporter' && input.role !== 'technician') {
    throw new Error(
      'This role requires administrator provisioning and cannot self-register.',
    );
  }

  const account = validateAccount(input);

  if (input.role === 'technician') {
    const address = input.address?.trim() ?? '';
    if (!account.phone || account.phone.replace(/\D/g, '').length < 7) {
      throw new Error(
        'Enter a contact phone number for technician registration.',
      );
    }
    if (!address) {
      throw new Error('Enter your business or correspondence address.');
    }
    if (address.length > MAX_ADDRESS_LENGTH) {
      throw new Error(
        `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.`,
      );
    }
    // Never carry a reporter's site selection into technician registration:
    // an unbound technician is marketplace-eligible.
    return { ...account, address, role: 'technician', siteId: null };
  }

  return { ...account, role: 'reporter', siteId: positiveId(input.siteId) };
}

export function buildProvisionPayload(
  input: RegistrationInput,
  actorRole: UserRole | undefined,
  permittedSiteIds: number[],
): ProvisionUserPayload {
  if (!canProvisionRole(actorRole, input.role)) {
    throw new Error('You do not have permission to provision this role.');
  }

  const siteId = positiveId(input.siteId);
  if (!permittedSiteIds.includes(siteId)) {
    throw new Error('Choose a site available to your account.');
  }

  return {
    ...validateAccount(input),
    role: input.role as 'admin' | 'staff',
    siteId,
  };
}
