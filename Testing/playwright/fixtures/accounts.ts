/**
 * Seed account map for FixFlow demo data (SEED_DEMO_DATA=true).
 * Password equals email for every seeded account.
 *
 * Site-scoped: {role}{n}.site{s}@fixflow.test  (n=1..5, s=1..3)
 * Globals:     superadmin{n}@fixflow.test, shopmanager{n}@fixflow.test
 * Compat:      short aliases map to n=1 / site1 where applicable
 */

export type SeedRole =
  | 'reporter'
  | 'staff'
  | 'admin'
  | 'technician'
  | 'super_admin'
  | 'shop_manager';

export type SeedAccount = {
  email: string;
  password: string;
  role: SeedRole;
  siteId?: 1 | 2 | 3;
  label: string;
};

function siteAccount(role: Exclude<SeedRole, 'super_admin' | 'shop_manager'>, n: number, site: 1 | 2 | 3): SeedAccount {
  const email = `${role}${n}.site${site}@fixflow.test`;
  return { email, password: email, role, siteId: site, label: `${role}${n}@site${site}` };
}

function globalAccount(role: 'super_admin' | 'shop_manager', n: number): SeedAccount {
  const local = role === 'super_admin' ? `superadmin${n}` : `shopmanager${n}`;
  const email = `${local}@fixflow.test`;
  return { email, password: email, role, label: local };
}

/** Full matrix: sites 1..3 × roles × n=1..5, plus global operators. */
export const seedAccounts = {
  sites: {
    1: {
      reporters: [1, 2, 3, 4, 5].map(n => siteAccount('reporter', n, 1)),
      staff: [1, 2, 3, 4, 5].map(n => siteAccount('staff', n, 1)),
      admins: [1, 2, 3, 4, 5].map(n => siteAccount('admin', n, 1)),
      technicians: [1, 2, 3, 4, 5].map(n => siteAccount('technician', n, 1)),
    },
    2: {
      reporters: [1, 2, 3, 4, 5].map(n => siteAccount('reporter', n, 2)),
      staff: [1, 2, 3, 4, 5].map(n => siteAccount('staff', n, 2)),
      admins: [1, 2, 3, 4, 5].map(n => siteAccount('admin', n, 2)),
      technicians: [1, 2, 3, 4, 5].map(n => siteAccount('technician', n, 2)),
    },
    3: {
      reporters: [1, 2, 3, 4, 5].map(n => siteAccount('reporter', n, 3)),
      staff: [1, 2, 3, 4, 5].map(n => siteAccount('staff', n, 3)),
      admins: [1, 2, 3, 4, 5].map(n => siteAccount('admin', n, 3)),
      technicians: [1, 2, 3, 4, 5].map(n => siteAccount('technician', n, 3)),
    },
  },
  globals: {
    superAdmins: [1, 2, 3, 4, 5].map(n => globalAccount('super_admin', n)),
    shopManagers: [1, 2, 3, 4, 5].map(n => globalAccount('shop_manager', n)),
  },
} as const;

/** Convenience aliases used heavily by workflow specs. */
export const accounts = {
  // Compatibility short names (= n=1 / site1)
  reporter: siteAccount('reporter', 1, 1),
  staff: siteAccount('staff', 1, 1),
  admin: siteAccount('admin', 1, 1),
  technician: siteAccount('technician', 1, 1),
  superadmin: globalAccount('super_admin', 1),
  shopmanager: globalAccount('shop_manager', 1),

  // Explicit primary actors
  reporter1Site1: siteAccount('reporter', 1, 1),
  reporter2Site1: siteAccount('reporter', 2, 1),
  reporter3Site1: siteAccount('reporter', 3, 1),
  reporter4Site1: siteAccount('reporter', 4, 1),
  reporter5Site1: siteAccount('reporter', 5, 1),
  reporter1Site2: siteAccount('reporter', 1, 2),

  staff1Site1: siteAccount('staff', 1, 1),
  admin1Site1: siteAccount('admin', 1, 1),
  admin1Site2: siteAccount('admin', 1, 2),

  technician1Site1: siteAccount('technician', 1, 1),
  technician2Site1: siteAccount('technician', 2, 1),
  technician1Site2: siteAccount('technician', 1, 2),

  superadmin1: globalAccount('super_admin', 1),
  shopmanager1: globalAccount('shop_manager', 1),
} as const;

/** Buyers for shop checkout must not be reporters (router blocks /shop for reporters). */
export const shopBuyers = {
  staff: accounts.staff1Site1,
  admin: accounts.admin1Site1,
  technician: accounts.technician1Site1,
} as const;

export function accountEmail(role: Exclude<SeedRole, 'super_admin' | 'shop_manager'>, n: number, site: 1 | 2 | 3): string {
  return `${role}${n}.site${site}@fixflow.test`;
}

export function passwordFor(email: string): string {
  return email;
}
