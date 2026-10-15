import type { RegisterPayload, UserRole } from '@/types';

export type RegistrationInput = {
  firstName: string; lastName: string; email: string; password: string;
  phone: string; role: UserRole; siteId: string; address?: string;
};

/** Form parsing only. Password, contact requirements, role and site policy are server-owned. */
export function buildRegistrationPayload(input: RegistrationInput): RegisterPayload {
  const siteId = input.role === 'technician' || !input.siteId.trim() ? null : Number(input.siteId);
  if (siteId !== null && (!Number.isSafeInteger(siteId) || siteId <= 0)) {
    throw new Error('Enter a valid numeric site ID.');
  }
  return {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    email: input.email.trim(), password: input.password,
    phone: input.phone.trim() || undefined, address: input.address?.trim() || undefined,
    role: input.role as RegisterPayload['role'],
    siteId,
  };
}
