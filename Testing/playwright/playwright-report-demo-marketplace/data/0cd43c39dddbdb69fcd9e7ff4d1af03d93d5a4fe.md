# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: marketplace.spec.ts >> Marketplace publish → apply → offer → accept @marketplace >> technician applies; admin offers; technician accepts when eligible
- Location: tests\marketplace.spec.ts:40:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/reports\/\d+/
Received string:  "http://localhost:5175/reports/new"
Timeout: 15000ms

Call log:
  - Expect "toHaveURL" with timeout 15000ms
    33 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:5175/reports/new"

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- complementary:
  - link "FixFlow Spaces work better together":
    - /url: /reporter
  - navigation "Main navigation":
    - link "My reports":
      - /url: /reporter
    - link "Report issue":
      - /url: /reports/new
    - link "My site":
      - /url: /sites
    - link "My building suggestions":
      - /url: /building-suggestions
  - paragraph: Well-maintained spaces create brighter days.
  - text: A little care. A big difference.
- banner:
  - button "Notifications"
  - button "Account menu":
    - text: RS
    - strong: Reporter1
- main:
  - text: CNU School
  - status "Updated 15 Nov 2026, 7:03 pm": Live updates disconnected
  - button "Check for updates"
  - link "All reports":
    - /url: /reports
  - heading "Report an issue" [level=1]
  - paragraph: Describe what needs attention at CNU School. Your report will be saved to the maintenance system.
  - alert: "Site setup required: ask the site admin to finish buildings, site details, and terms before reporting"
  - group:
    - heading "Issue details" [level=2]
    - text: What happened?
    - textbox "What happened?":
      - /placeholder: Describe the issue and what you noticed.
      - text: Offer flow offer-1794740565410-793531
    - heading "Location" [level=2]
    - text: Building or location
    - combobox "Building or location":
      - option "Choose a building" [disabled]
      - option "MAIN · Main building" [selected]
    - button "Can’t find your building?"
    - text: Room or exact spot (optional)
    - textbox "Room or exact spot (optional)":
      - /placeholder: Floor, room, or nearby landmark
    - heading "Classification and visibility" [level=2]
    - text: Category
    - combobox "Category":
      - option "Choose a category" [disabled]
      - option "Plumbing" [selected]
      - option "Electrical"
      - option "Hvac"
      - option "Carpentry"
      - option "Cleaning"
      - option "General"
    - text: Your urgency
    - combobox "Your urgency":
      - option "Choose an urgency" [disabled]
      - option "Low"
      - option "Medium" [selected]
      - option "High"
      - option "Critical"
    - text: Specialty (optional)
    - textbox "Specialty (optional)":
      - /placeholder: Specific trade or equipment, if known
    - text: Report visibility
    - combobox "Report visibility":
      - option "Public within your site" [selected]
      - option "Private report"
    - paragraph: Other reporters at your site can browse and join this report. Your identity and exact address stay masked until they join.
    - text: Why this urgency? (optional)
    - textbox "Why this urgency? (optional)":
      - /placeholder: Explain how this issue affects the space.
    - heading "Attachments" [level=2]
    - text: Photos (optional)
    - button "Photos (optional)"
    - paragraph: Up to 1 photos, 5 MiB each. Attached photos can be viewed by people authorized to access the report.
    - button "Submit report"
- contentinfo: FixFlow © 2026 FixFlow. Keeping spaces working beautifully. Better spaces. Brighter tomorrows.
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | 
  3  | /** Unique suffix so parallel runs do not collide on shared demo data. */
  4  | export function uniqueTag(prefix = 'e2e'): string {
  5  |   return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  6  | }
  7  | 
  8  | export async function gotoNav(page: Page, name: string | RegExp): Promise<void> {
  9  |   const nav = page.getByRole('navigation', { name: /Main navigation/i });
  10 |   const link = nav.getByRole('link', { name });
  11 |   if (await link.count()) {
  12 |     await link.first().click();
  13 |     return;
  14 |   }
  15 |   // Overflow "More" menu for secondary links
  16 |   const more = nav.getByText(/^More$/i);
  17 |   if (await more.count()) {
  18 |     await more.first().click();
  19 |     await nav.getByRole('link', { name }).first().click();
  20 |   }
  21 | }
  22 | 
  23 | export async function createPublicReport(page: Page, description: string, options?: {
  24 |   category?: RegExp | string;
  25 |   urgency?: RegExp | string;
  26 | }): Promise<string> {
  27 |   await page.goto('/reports/new');
  28 |   await expect(page.getByRole('heading', { name: /Report an issue/i })).toBeVisible();
  29 | 
  30 |   const building = page.getByLabel(/Building or location/i);
  31 |   await expect(building).toBeVisible({ timeout: 30_000 });
  32 |   const optionsCount = await building.locator('option:not([disabled])').count();
  33 |   expect(optionsCount, 'seed site needs at least one building').toBeGreaterThan(0);
  34 |   await building.selectOption({ index: 1 });
  35 | 
  36 |   await page.getByLabel(/What happened/i).fill(description);
  37 | 
  38 |   const category = page.getByRole('combobox', { name: /^Category$/i });
  39 |   if (options?.category) {
  40 |     const option = category.getByRole('option', { name: options.category });
  41 |     await expect(option).toHaveCount(1);
  42 |     await category.selectOption(await option.evaluate(node => (node as HTMLOptionElement).value));
  43 |   } else {
  44 |     await category.selectOption({ index: 1 });
  45 |   }
  46 | 
  47 |   const urgency = page.getByRole('combobox', { name: /Your urgency/i });
  48 |   const urgencyOption = urgency.getByRole('option', { name: options?.urgency ?? /^Medium$/i });
  49 |   await expect(urgencyOption).toHaveCount(1);
  50 |   await urgency.selectOption(await urgencyOption.evaluate(node => (node as HTMLOptionElement).value));
  51 | 
  52 |   const visibility = page.getByLabel(/Report visibility/i);
  53 |   await visibility.selectOption('public');
  54 | 
  55 |   await page.getByRole('button', { name: /Submit report/i }).click();
> 56 |   await expect(page).toHaveURL(/\/reports\/\d+/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  57 |   const match = page.url().match(/\/reports\/(\d+)/);
  58 |   expect(match).toBeTruthy();
  59 |   return match![1];
  60 | }
  61 | 
  62 | export async function openReport(page: Page, reportId: string | number): Promise<void> {
  63 |   await page.goto(`/reports/${reportId}`);
  64 |   await expect(page.getByRole('heading', { name: new RegExp(`Report #${reportId}`) })).toBeVisible({ timeout: 30_000 });
  65 | }
  66 | 
  67 | export async function expectForbiddenOrRedirect(page: Page, path: string): Promise<void> {
  68 |   await page.goto(path);
  69 |   const url = page.url();
  70 |   const blocked =
  71 |     !url.includes(path) ||
  72 |     (await page.getByRole('alert').count()) > 0 ||
  73 |     (await page.getByText(/not available|cannot|forbidden|access/i).count()) > 0;
  74 |   expect(blocked || !url.includes(path.split('?')[0])).toBeTruthy();
  75 | }
  76 | 
```