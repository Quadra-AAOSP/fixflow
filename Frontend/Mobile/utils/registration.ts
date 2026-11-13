import type { RegisterPayload, RegisterSkill, UserRole } from '@/types';

export const TECHNICIAN_SKILL_CATEGORIES = [
  'plumbing', 'electrical', 'hvac', 'carpentry', 'cleaning', 'general',
] as const;

export type RegistrationInput = {
  firstName: string; lastName: string; email: string; password: string;
  phone: string; role: UserRole; siteId: string; address?: string;
  // Admin self-apply site bundle — replaces siteId for admin role.
  siteName?: string; siteType?: 'school' | 'hostel' | 'hotel';
  siteAddress?: string; siteDescription?: string;
  // Technician onboarding at registration.
  trades?: string; experience?: string; qualifications?: string;
  acceptTechnicianTerms?: boolean; technicianTermsVersion?: string;
  skills?: RegisterSkill[];
  contractSiteId?: string; contractNote?: string;
};

export type RegistrationFieldErrors = Partial<Record<
  'firstName' | 'lastName' | 'email' | 'password' | 'siteId' | 'phone' | 'address'
  | 'siteName' | 'siteType' | 'siteAddress' | 'siteDescription'
  | 'trades' | 'experience' | 'qualifications' | 'skills' | 'acceptTechnicianTerms',
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

  // Phone — optional for reporters; required for technicians.
  if (input.role === 'technician') {
    if (!input.phone.trim() || input.phone.replace(/\D/g, '').length < 7) {
      errors.phone = 'Enter a contact phone number.';
    } else if (!/^[+\d\s\-()]{6,20}$/.test(input.phone.trim())) {
      errors.phone = 'Enter a valid phone number (6–20 digits).';
    }
    if (!input.address?.trim()) errors.address = 'Enter your business or correspondence address.';
    else if (input.address.trim().length > 512) errors.address = 'Keep the address under 512 characters.';
    if (!input.trades?.trim()) errors.trades = 'Enter your trades.';
    if (!input.experience?.trim()) errors.experience = 'Enter your experience.';
    if (!input.qualifications?.trim()) errors.qualifications = 'Enter your qualifications.';
    if (!input.skills?.length) errors.skills = 'Add at least one skill.';
    if (!input.acceptTechnicianTerms) errors.acceptTechnicianTerms = 'Accept the technician terms to continue.';
    if (!input.technicianTermsVersion?.trim()) {
      errors.acceptTechnicianTerms = 'Technician terms are unavailable. Reload and try again.';
    }
  } else if (input.phone.trim()) {
    if (!/^[+\d\s\-()]{6,20}$/.test(input.phone.trim()))
      errors.phone = 'Enter a valid phone number (6–20 digits).';
  }

  // Address — optional for non-technicians, but max length.
  if (input.role !== 'technician' && input.address && input.address.trim().length > 255)
    errors.address = 'Keep the address under 255 characters.';

  return errors;
}

function normalizeSkills(skills: RegisterSkill[] | undefined): RegisterSkill[] {
  if (!skills?.length) throw new Error('Add at least one skill with a category and proficiency.');
  const seen = new Set<string>();
  return skills.map((skill) => {
    const category = skill.category.trim().toLowerCase();
    if (!(TECHNICIAN_SKILL_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error('Choose a valid skill category.');
    }
    const specialty = skill.specialty?.trim() ? skill.specialty.trim().toLowerCase() : null;
    const proficiency = Number(skill.proficiency);
    if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 5) {
      throw new Error('Choose proficiency from 1 to 5.');
    }
    const key = `${category}\0${specialty ?? ''}`;
    if (seen.has(key)) throw new Error('Duplicate skill category/specialty pairs are not allowed.');
    seen.add(key);
    return { category, specialty, proficiency };
  });
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
    if (!input.acceptTechnicianTerms || !input.technicianTermsVersion?.trim()) {
      throw new Error('Accept the current technician terms to create an account.');
    }
    base.siteId = null;
    base.trades = input.trades!.trim();
    base.experience = input.experience!.trim();
    base.qualifications = input.qualifications!.trim();
    base.acceptTechnicianTerms = true;
    base.technicianTermsVersion = input.technicianTermsVersion.trim();
    base.skills = normalizeSkills(input.skills);
    if (input.contractSiteId?.trim()) {
      const contractSiteId = Number(input.contractSiteId);
      if (!Number.isSafeInteger(contractSiteId) || contractSiteId <= 0) {
        throw new Error('Select a valid site for your contract request.');
      }
      base.contractSiteId = contractSiteId;
      base.contractNote = input.contractNote?.trim() || undefined;
    }
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
