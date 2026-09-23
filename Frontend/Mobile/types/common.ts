/**
 * Shared cross-cutting types. Values come directly from the locked backend
 * `Response` / `Request` records — do not invent variants here.
 */

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export type UserRole =
  | 'reporter'
  | 'technician'
  | 'staff'
  | 'admin'
  | 'super_admin';

export type ApiErrorBody = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
};