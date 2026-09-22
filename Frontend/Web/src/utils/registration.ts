import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, canProvisionRole } from '@/constants/access';
import type { AccountDetails, ProvisionUserPayload, RegisterPayload, UserRole } from '@/types';

export interface RegistrationInput {
  firstName: string; lastName: string; email: string; password: string; phone: string; role: UserRole; siteId: string;
}
export function validateAccount(input: Omit<RegistrationInput, 'role' | 'siteId'>): AccountDetails {
  if (![input.firstName, input.lastName, input.email].every(value => value.trim()) || !input.password) throw new Error('First name, last name, email, and password are required.');
  if (input.firstName.trim().length > 128 || input.lastName.trim().length > 128) throw new Error('Names must be 128 characters or fewer.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error('Enter a valid email address.');
  if ([...input.password].length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) throw new Error(`Use a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters. Spaces and passphrases are welcome.`);
  // Current backend uses bcrypt; reject inputs it cannot safely represent instead of truncating them.
  if (new TextEncoder().encode(input.password).length > 72) throw new Error('This password exceeds the current server’s 72-byte limit. Use a shorter passphrase; accented characters and emoji can use more than one byte.');
  if (input.phone.trim().length > 64) throw new Error('Phone numbers must be 64 characters or fewer.');
  return { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), password: input.password, phone: input.phone.trim() || undefined };
}
export function positiveId(value: string) {
  if (!/^\d+$/.test(value.trim())) throw new Error('Enter a valid site ID from your administrator.');
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Enter a valid site ID from your administrator.');
  return id;
}
export function buildRegistrationPayload(input: RegistrationInput): RegisterPayload {
  if (input.role !== 'reporter' && input.role !== 'technician') throw new Error('This role requires administrator provisioning and cannot self-register.');
  const account = validateAccount(input);
  // Never carry a reporter's previous site selection into technician registration.
  return input.role === 'technician' ? { ...account, role: 'technician', siteId: null } : { ...account, role: 'reporter', siteId: positiveId(input.siteId) };
}
export function buildProvisionPayload(input: RegistrationInput, actorRole: UserRole | undefined, permittedSiteIds: number[]): ProvisionUserPayload {
  if (!canProvisionRole(actorRole, input.role)) throw new Error('You do not have permission to provision this role.');
  const siteId = positiveId(input.siteId);
  if (!permittedSiteIds.includes(siteId)) throw new Error('Choose a site available to your account.');
  return { ...validateAccount(input), role: input.role as 'admin' | 'staff', siteId };
}
