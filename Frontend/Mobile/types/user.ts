import type { UserRole } from './common';

export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  role: UserRole;
  siteId: number | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

/**
 * Self-registration payload. The backend permits only `reporter` and
 * `technician` here (`AuthService.register` rejects staff/admin/super_admin
 * at runtime). `siteId` is required for reporter accounts and optional for
 * technicians — leaving it `null` makes the technician marketplace-eligible.
 *
 * Backed by backend `RegisterRequest` (DTO). Mirrors the locked contract.
 */
export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: Extract<UserRole, 'reporter' | 'technician'>;
  siteId?: number | null;
};

/**
 * Mirrors backend `ProvisionUserRequest`. Staff accounts are created by an
 * `admin` or `super_admin` (POST /api/admin/users) — `role` is restricted to
 * the two operational roles an admin is allowed to mint, and the account is
 * always bound to a site.
 *
 * Backed by backend `AdminUserController`.
 */
export type ProvisionUserPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: Extract<UserRole, 'admin' | 'staff'>;
  siteId: number;
};