import type { RegisterPayload, UserRole } from '@/types';

export type RegistrationInput = {
  firstName: string; lastName: string; email: string; password: string;
  phone: string; role: UserRole; siteId: string; address?: string;
  // Admin self-apply site bundle — replaces siteId for admin role.
  siteName?: string; siteType?: 'school' | 'hostel' | 'hotel';
  siteAddress?: string; siteDescription?: string;
};

export type RegistrationFieldErrors = Partial<Record<
  'firstName' | 'lastName' | 'email' | 'password' | 'siteId' | 'phone' | 'address'
  | 'siteName' | 'siteType' | 'siteAddress' | 'siteDescription',
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

  // ── Site bundle / siteId logic ───────────────────────────────────────
  if (input.role === 'admin') {
    // Admin self-apply: requires siteName + siteType.
    if (!input.siteName?.trim()) errors.siteName = 'Site name is required.';
    else if (input.siteName.trim().length > 128)
      errors.siteName = 'Keep site name under 128 characters.';
    if (!input.siteType) errors.siteType = 'Pick a site type.';
    if (input.siteAddress && input.siteAddress.trim().length > 512)
      errors.siteAddress = 'Keep site address under 512 characters.';
    if (input.siteDescription && input.siteDescription.trim().length > 2000)
      errors.siteDescription = 'Keep site description under 2000 characters.';
    // siteId ignored for admin — we auto-create from bundle.
  }
  // reporter / technician — no site requirement (reporters pick per report).

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
  const base: RegisterPayload = {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    email: input.email.trim(), password: input.password,
    phone: input.phone.trim() || undefined, address: input.address?.trim() || undefined,
    role: input.role as RegisterPayload['role'],
  };

  if (input.role === 'technician') {
    base.siteId = null;
    return base;
  }

  if (input.role === 'reporter') {
    // Optional default site — reporters file wherever the issue is.
    const siteId = input.siteId.trim() ? Number(input.siteId) : null;
    if (siteId !== null && (!Number.isSafeInteger(siteId) || siteId <= 0)) {
      throw new Error('Enter a valid numeric site ID.');
    }
    base.siteId = siteId;
    return base;
  }

  // admin — site bundle required.
  if (!input.siteName?.trim()) throw new Error('Site name is required.');
  if (!input.siteType) throw new Error('Pick a site type.');
  base.siteId = null; // server will set the id after creation
  base.siteName = input.siteName.trim();
  base.siteType = input.siteType;
  base.siteAddress = input.siteAddress?.trim() || undefined;
  base.siteDescription = input.siteDescription?.trim() || undefined;
  return base;
}
