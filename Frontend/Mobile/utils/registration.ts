import type { RegisterPayload, UserRole } from '@/types';

export type RegistrationInput = {
  firstName: string; lastName: string; email: string; password: string;
  phone: string; role: UserRole; siteId: string; address?: string;
};

export type RegistrationFieldErrors = Partial<Record<
  'firstName' | 'lastName' | 'email' | 'password' | 'siteId' | 'phone' | 'address',
  string
>>;

/**
 * Per-field client-side validation. Server-side still runs its own checks —
 * this is to give users friendly inline feedback before they hit Submit.
 * Returns an empty object when everything is acceptable locally.
 */
export function validateRegistration(
  input: RegistrationInput,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  // Names — at least 2 letters, letters/spaces/hyphens only.
  if (!input.firstName.trim()) errors.firstName = 'First name is required.';
  else if (!/^[A-Za-zÀ-ÿ' -]{2,}$/.test(input.firstName.trim()))
    errors.firstName = 'Use 2+ letters (letters, spaces, hyphens only).';

  if (!input.lastName.trim()) errors.lastName = 'Last name is required.';
  else if (!/^[A-Za-zÀ-ÿ' -]{2,}$/.test(input.lastName.trim()))
    errors.lastName = 'Use 2+ letters (letters, spaces, hyphens only).';

  // Email — standard shape.
  if (!input.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    errors.email = 'Enter a valid email address.';

  // Password — 15+ chars (matches the backend's policy tip on the form).
  if (!input.password) errors.password = 'Password is required.';
  else if (input.password.length < 15)
    errors.password = 'Use at least 15 characters.';

  // Site ID — reporter/admin must provide a positive integer; technician skips.
  if (input.role === 'reporter' || input.role === 'admin') {
    if (!input.siteId.trim()) errors.siteId = 'Enter the site ID from your administrator.';
    else if (!/^\d+$/.test(input.siteId.trim()))
      errors.siteId = 'Site ID must be a positive whole number.';
  }

  // Phone — optional, but if entered must be 6-20 chars of digits, spaces, or +-.
  if (input.phone.trim()) {
    if (!/^[+\d\s\-()]{6,20}$/.test(input.phone.trim()))
      errors.phone = 'Enter a valid phone number (6–20 digits).';
  }

  // Address — optional, but max 255 chars.
  if (input.address && input.address.trim().length > 255)
    errors.address = 'Keep the address under 255 characters.';

  return errors;
}

/**
 * Form parsing + backend-contract enforcement. Password rules, role policy,
 * and site membership are still validated server-side — this only converts
 * the typed form input into a `RegisterPayload`.
 */
export function buildRegistrationPayload(input: RegistrationInput): RegisterPayload {
  const siteId = input.role === 'technician' || !input.siteId.trim() ? null : Number(input.siteId);
  if (siteId !== null && (!Number.isSafeInteger(siteId) || siteId <= 0)) {
    throw new Error('Enter a valid numeric site ID.');
  }
  if ((input.role === 'reporter' || input.role === 'admin') && siteId === null) {
    throw new Error('Enter the site ID provided by your administrator.');
  }
  return {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    email: input.email.trim(), password: input.password,
    phone: input.phone.trim() || undefined, address: input.address?.trim() || undefined,
    role: input.role as RegisterPayload['role'],
    siteId,
  };
}
