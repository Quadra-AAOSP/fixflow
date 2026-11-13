import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, canProvisionRole } from '@/constants/access';
import type { AccountDetails, ProvisionUserPayload, RegisterPayload, RegisterSkill, UserRole } from '@/types';

export const TECHNICIAN_SKILL_CATEGORIES = [
  'plumbing', 'electrical', 'hvac', 'carpentry', 'cleaning', 'general',
] as const;

export interface RegistrationInput {
  firstName: string; lastName: string; email: string; password: string; phone: string; role: UserRole; siteId: string; address?: string;
  trades?: string; experience?: string; qualifications?: string;
  acceptTechnicianTerms?: boolean; technicianTermsVersion?: string;
  skills?: RegisterSkill[];
  contractSiteId?: string; contractNote?: string;
}
export function validateAccount(input: Omit<RegistrationInput, 'role' | 'siteId'>, passwordMinLength: number): AccountDetails {
  if (!Number.isInteger(passwordMinLength) || passwordMinLength < 1 || passwordMinLength > PASSWORD_MAX_LENGTH) throw new Error('Registration policy is unavailable. Reload and try again.');
  if (![input.firstName, input.lastName, input.email].every(value => value.trim()) || !input.password) throw new Error('First name, last name, email, and password are required.');
  if (input.firstName.trim().length > 128 || input.lastName.trim().length > 128) throw new Error('Names must be 128 characters or fewer.');
  if (input.email.trim().length > EMAIL_MAX_LENGTH) throw new Error('Email address is too long.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error('Enter a valid email address.');
  if ([...input.password].length < passwordMinLength || input.password.length > PASSWORD_MAX_LENGTH) throw new Error('Use a password that meets the displayed length requirements.');
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

function normalizeSkills(skills: RegisterSkill[] | undefined): RegisterSkill[] {
  if (!skills?.length) throw new Error('Add at least one skill with a category and proficiency.');
  if (skills.length > 20) throw new Error('At most 20 skills can be registered.');
  const seen = new Set<string>();
  return skills.map((skill, index) => {
    const category = skill.category.trim().toLowerCase();
    if (!TECHNICIAN_SKILL_CATEGORIES.includes(category as (typeof TECHNICIAN_SKILL_CATEGORIES)[number])) {
      throw new Error(`Skill ${index + 1}: choose a valid category.`);
    }
    const specialty = skill.specialty?.trim() ? skill.specialty.trim().toLowerCase() : null;
    const proficiency = Number(skill.proficiency);
    if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 5) {
      throw new Error(`Skill ${index + 1}: choose proficiency from 1 to 5.`);
    }
    const key = `${category}\0${specialty ?? ''}`;
    if (seen.has(key)) throw new Error('Duplicate skill category/specialty pairs are not allowed.');
    seen.add(key);
    return { category, specialty, proficiency };
  });
}

export function buildRegistrationPayload(input: RegistrationInput, passwordMinLength: number): RegisterPayload {
  if (input.role !== 'reporter' && input.role !== 'technician') throw new Error('This role requires administrator provisioning and cannot self-register.');
  const account = validateAccount(input, passwordMinLength);
  if (input.role === 'technician') {
    if (!input.phone.trim() || input.phone.replace(/\D/g, '').length < 7) throw new Error('Enter a contact phone number for technician registration.');
    if (!input.address?.trim()) throw new Error('Enter your business or correspondence address.');
    if (input.address.trim().length > 512) throw new Error('Address must be 512 characters or fewer.');
    if (!input.trades?.trim() || !input.experience?.trim() || !input.qualifications?.trim()) {
      throw new Error('Enter your trades, experience, and qualifications for verification.');
    }
    if (input.trades.trim().length > 2000 || input.experience.trim().length > 4000 || input.qualifications.trim().length > 4000) {
      throw new Error('Verification details exceed the allowed length.');
    }
    if (!input.acceptTechnicianTerms) throw new Error('Accept the current technician terms to create an account.');
    if (!input.technicianTermsVersion?.trim()) throw new Error('Technician terms are unavailable. Reload and try again.');
    const skills = normalizeSkills(input.skills);
    account.address = input.address.trim();
    const payload: RegisterPayload = {
      ...account,
      role: 'technician',
      siteId: null,
      trades: input.trades.trim(),
      experience: input.experience.trim(),
      qualifications: input.qualifications.trim(),
      acceptTechnicianTerms: true,
      technicianTermsVersion: input.technicianTermsVersion.trim(),
      skills,
    };
    if (input.contractSiteId?.trim()) {
      payload.contractSiteId = positiveId(input.contractSiteId);
      payload.contractNote = input.contractNote?.trim() || undefined;
    }
    return payload;
  }
  return { ...account, role: 'reporter', siteId: positiveId(input.siteId) };
}
export function buildProvisionPayload(input: RegistrationInput, actorRole: UserRole | undefined, permittedSiteIds: number[], passwordMinLength: number): ProvisionUserPayload {
  if (!canProvisionRole(actorRole, input.role)) throw new Error('You do not have permission to provision this role.');
  if (input.role === 'shop_manager') return { ...validateAccount(input, passwordMinLength), role: 'shop_manager', siteId: null };
  const siteId = positiveId(input.siteId);
  if (!permittedSiteIds.includes(siteId)) throw new Error('Choose a site available to your account.');
  return { ...validateAccount(input, passwordMinLength), role: input.role as 'admin' | 'staff', siteId };
}
