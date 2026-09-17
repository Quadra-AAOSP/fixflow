export type UserRole =
  | 'reporter'
  | 'technician'
  | 'staff'
  | 'admin'
  | 'super_admin';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

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

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: 'reporter';
  siteId: number;
};

export type ApiErrorBody = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
};
