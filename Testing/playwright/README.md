# FixFlow Web — Playwright workflow suite

End-to-end workflows for the Vue web app under `Frontend/Web`.

## Prerequisites

1. **Demo seed** — start the backend with demo accounts enabled:

   ```bash
   SEED_DEMO_DATA=true
   ```

   (Exact env wiring depends on your Backend run config / Spring profile.)

2. **Backend** listening on `http://localhost:8080` (Vite proxies `/api`).

3. **Web** on `http://localhost:5173`:

   ```bash
   cd Frontend/Web && npm run dev
   ```

4. **This package** dependencies:

   ```bash
   cd Testing/playwright
   npm install
   // Microsoft Edge must be installed
   ```

## Seed accounts

Password **equals email** for every seeded account.

| Kind | Pattern | Example |
|------|---------|---------|
| Site-scoped | `{role}{n}.site{s}@fixflow.test` | `reporter2.site1@fixflow.test` |
| Global | `superadmin{n}@fixflow.test`, `shopmanager{n}@fixflow.test` | `shopmanager1@fixflow.test` |
| Compat aliases | `reporter@fixflow.test` … | maps to n=1 / site1 |

Roles on sites 1..3 with n=1..5: `reporter`, `staff`, `admin`, `technician`.

See `fixtures/accounts.ts`.

## Commands

```bash
# Discover tests (no browser / no servers required)
npx playwright test --list

# Run against a live stack (backend + web already up)
npx playwright test

# Optional: have Playwright start Vite
PLAYWRIGHT_WEB_SERVER=true npx playwright test

# UI mode
npx playwright test --ui
```

`baseURL` defaults to `http://localhost:5173`. Override with `PLAYWRIGHT_BASE_URL`.

## Auth strategy

- Most workflows use **API login** (`GET /api/auth/csrf` → `POST /api/auth/login`) into a fresh browser context (`fixtures/auth.ts`).
- At least one test exercises **UI login/logout** (`tests/auth.spec.ts`).

## Workflow coverage

| Spec | Area |
|------|------|
| `auth.spec.ts` | Login/logout per role; register reporter/technician smoke |
| `reporter.spec.ts` | Create, join, leave, photos, confirm affordances |
| `join-urgency.spec.ts` | 3–5 joiners; participation / calculated urgency |
| `staff-admin.spec.ts` | Assign technician, urgency override, escalate |
| `technician.spec.ts` | Terms, verification, availability, start/resolve |
| `marketplace.spec.ts` | Publish → apply → offer → accept |
| `super-admin.spec.ts` | Site applications, verification decide, team provision |
| `site-admin.spec.ts` | Site rules, buildings, create staff |
| `shop.spec.ts` | Buyer checkout, manager fulfill, confirm delivery |
| `cross-site.spec.ts` | Site1 cannot operate site2 data |

## Notes

- Vitest unit/component tests under `Frontend/Web/tests/*.test.ts` are separate — do not run them from this package.
- Prefer role/label selectors that match Vue UI copy.
- Listing tests (`--list`) must succeed offline; a full run needs the live stack + Microsoft Edge.

## Selecting workflows and writes

Run a role or named workflow with Playwright's grep filter, for example:

```powershell
npx playwright test --grep @technician
npx playwright test --grep @shop
npx playwright test tests/reporter.spec.ts
```

Tests that may create or change records are skipped unless `$env:ALLOW_WORKFLOW_WRITES="true"` is set. The shop flow creates a synthetic order and uses that order throughout fulfillment. Other existing workflows may modify seeded data; inspect them before enabling writes. `DEMO_MODE=true` announces UI login as one action; other actions do not yet have announcements. The suite targets Vue; Expo web and native phone are separate and are not covered here.
