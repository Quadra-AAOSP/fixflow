# FixFlow

Task ownership, current product decisions and completion tracking live in the
[Central Task PRD](fixflow-task-prd.md). Older setup/provider/role descriptions
below may lag current contracts; do not use this README as a second task plan.

Multi-site maintenance reporting platform (school / hostel / hotel) with AI-assisted classification and technician routing.

**Reporter, staff, and admin** can file issues (text + photos) at their site → AI classifies category / specialty / urgency → site-scoped routing assigns or opens a marketplace claim → technicians resolve → reporters confirm. Dual urgency (`ai_urgency` / `reporter_urgency` / `final_urgency`) and two-step resolution are core MVP requirements. Reassignments keep a full trail of previous technician ids.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Java 21, Spring Boot, JPA, Security, Session (JDBC), WebSockets |
| Frontend | Vue 3 + Vite + TypeScript + Tailwind (`Frontend/Web`); Expo React Native (`Frontend/Mobile`) |
| Database | MySQL 8 |
| Object storage | MinIO (Docker, persistent volume) |
| AI | Gemini (primary); Ollama fallback (stretch/spike) |
| Tests | JUnit + Mockito (backend), Vitest (mobile) |
| Infra | Docker Compose (`Backend/docker/compose.yaml`) |

---

## Repository layout

```
Fixflow/
├── Backend/                 # Spring Boot API
│   ├── docker/              # Compose + Dockerfile + env templates
│   └── src/main/resources/
│       └── db/schema.sql    # Domain DDL (authoritative)
├── Frontend/
│   ├── Web/                 # Vue 3 web client
│   └── Mobile/              # Expo Router React Native
├── Testing/playwright/      # Web end-to-end workflows
└── README.md
```

---

## Roles

| Role | Scope | Registration | Can create reports |
|---|---|---|---|
| `reporter` | Own site | Self-register | Yes |
| `technician` | One or more sites via contracts | Self-register | No (unless also a reporter account) |
| `staff` | Own site | Admin-provisioned | Yes |
| `admin` | Own site | Admin-provisioned | Yes |
| `super_admin` | Cross-site | Admin-provisioned | Support/demo only if needed |

---

## Data model

[`Backend/src/main/resources/db/schema.sql`](Backend/src/main/resources/db/schema.sql)

| Table | Purpose |
|---|---|
| `sites` | Locations + type + contract status |
| `site_rules` | Fixed category / urgency taxonomy per site type |
| `users` | All accounts (`role` + optional `site_id`) |
| `technician_contracts` | Multi-site technician contracts |
| `technician_availability` | Self-toggled availability |
| `technician_skills` | Trade (`category`) + specialty + proficiency (stretch recommendation) |
| `reports` | Tickets, dual urgency (`low`/`medium`/`high`/`critical`), category from `site_rules`, status, **current** assignee |
| `report_photos` | Up to 5 images per report (≤5MB), MinIO keys |
| `report_reporters` | Manual merge (many users ↔ one report); creator is always inserted on create |
| `report_reassignments` | Append-only history of previous technician ids on reassign |
| `status_history` | Status transition audit trail |
| `shop_products` | Shop catalogue (string ids, price in minor units, stock) |
| `shop_orders` | Customer orders with idempotency + shipping snapshot |
| `shop_order_items` | Order line snapshots |
| `shop_payments` | Simulated checkout session (`dev` provider) |

**Status flow:**  
`open` → `routed` → `assigned` → `in_progress` → `resolved_pending_confirmation` → `confirmed` / `reopened` (+ `escalated` when marketplace has no techs)

**Reassignment:** when the assigned tech (or staff/admin) reassigns, insert into `report_reassignments` (`from_technician_id`, `to_technician_id`, `reassigned_by_user_id`) **before** updating `reports.assigned_technician_id`. History is never overwritten.

**Privacy:** peer reporters at a site can list reports, but `address` and submitter identity are masked. Staff, admin, assigned technician, and users attached via `report_reporters` see the full fields.

**Urgency:** `ai_urgency` / `reporter_urgency` / `final_urgency` are `low | medium | high | critical` (not free text). `reporter_urgency` on a staff/admin filing may be proxied — there is no `on_behalf_of_user_id`.

Apply schema (with MySQL running):

```bash
mysql -u myuser -p mydatabase < Backend/src/main/resources/db/schema.sql
```

Compose defaults come from your env file (`Backend/docker/compose.env.example`: database/user `fixflow`, MySQL on host port `3307`).

---

## Getting started

### Prerequisites

- Java 21 + Maven (or use `Backend/mvnw`)
- Node.js 18+ (for frontend)
- Docker (MySQL / supporting services)

### 1. Start infrastructure

Copy `Backend/docker/compose.env.example` to a path outside Git (or `Backend/docker/docker.env`), fill secrets, then:

```bash
cd Backend/docker
chmod +x compose.sh
./compose.sh --env-file /absolute/path/to/docker.env -p fixflow-local up -d --build --wait
```

PowerShell: `./compose.ps1 -EnvFile C:\path\to\docker.env -p fixflow-local up -d --build --wait`

See [`Backend/docker/DOCKER.md`](Backend/docker/DOCKER.md) for MinIO, production override, and smoke checks.

### 2. Create tables

With Compose, the backend applies `schema.sql` on startup. For a manual MySQL import:

```bash
mysql -h 127.0.0.1 -P 3307 -u fixflow -p fixflow < src/main/resources/db/schema.sql
```

### 3. Run backend

```bash
cd Backend
./mvnw spring-boot:run
```

### 4. Run frontend (web)

```bash
cd Frontend/Web
npm install
npm run dev
```

Opens at `http://localhost:5173`. Copy `.env.example` to `.env` if needed. Set `VITE_SHOP_CATALOG_PATH=/api/shop/catalog` to connect the storefront.

Auth screens: **Sign in** / **Register** (reporter). Session uses the backend `SESSION` cookie (`credentials: 'include'`). After login: Home / Reports / Profile (same shell as Mobile). Public **Shop** is at `/shop` (sidebar link when signed in).

### Shop (web)

- Public catalogue: `GET /api/shop/catalog` (no login).
- Checkout / orders require a signed-in session; basket stays in the browser until checkout.
- Checkout uses a simulated **dev** payment provider; complete an order with `POST /api/shop/payments/dev/complete/{publicId}`.
- Admin product CRUD: `/api/admin/shop/products` (`ADMIN` / `SUPER_ADMIN`).

### 5. Run mobile (Expo)

```bash
cd Frontend/Mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android). The UI is **light-first** — a dark variant is not implemented; the token layer (`global.css` + `constants/theme.ts`) is structured so one can be added without touching screens.

Set the API base URL if the device cannot reach `localhost:8080` (physical phone / Android emulator):

```bash
# example: your machine LAN IP, or 10.0.2.2 for Android emulator
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080 npx expo start
```

Auth screens: **Sign in** / **Register**. Registration supports **reporter** and **technician** accounts; technicians may omit the site ID to become marketplace-eligible. Session uses the backend `SESSION` cookie (`credentials: 'include'`). After login, tabs are Home / Reports / Profile; reports support list → detail → join, and staff/admin can assign a technician. A `super_admin` gets a site switcher on Home and Profile.

Mobile screens implemented against the current backend:

| Area | Status |
|---|---|
| Auth (login, register, session bootstrap) | ✅ |
| Home (active site, urgency legend, file report entry) | ✅ |
| Reports list (site-scoped, pull-to-refresh, privacy masking) | ✅ |
| Report create (taxonomy-driven category, dual urgency) | ✅ |
| Report detail (privacy-gated fields, join, assign) | ✅ |
| Profile (read-only account, working site, sign out) | ✅ |
| `super_admin` site switcher | ✅ |

Not implemented (blocked on backend endpoints — see *Audit dependencies* below): photo upload, status transitions, urgency override, reassignment, technician directory, claimable/assigned-to-me queues.

### Secrets

Use a local `.env` for API keys and passwords. 
---

## MVP highlights

- Report submit by **reporter, staff, or admin** (text + ≤5 photos) → AI text classification → site routing
- Dual urgency with override that **re-triggers routing**
- Contracted sites: assign / claim; uncontracted: admin triage → marketplace
- Manual merge via `report_reporters` (no automated dedup)
- Reassignment with full `report_reassignments` trail (previous tech id retained)
- Two-step resolution (tech pending → reporter confirms)
- WebSockets for assignment / status / resolution events only
- Session-based auth (web)

---

## Technician recommendation metrics *(stretch)*

Deterministic **weighted score**. Hard-filter first, then rank.

**Hard filters:** available; site-eligible (contract or marketplace); has the report’s **trade/category**.

**Scored metrics:**

| Metric | Meaning | Example |
|---|---|---|
| Category match | Trade equals report category | `plumbing` job → plumbers only |
| Specialty match | Sub-skill equals report specialty | `waste_plumbing` beats a general plumber or a `water_supply` specialist |
| Proficiency | 1–5 depth in that skill | Higher proficiency ranks up |
| Workload | Fewer open assigned reports → higher | Balance load across the pool |
| Site affinity | Prefer contracted techs over marketplace-only | When both pools exist |
| Reassign bounce *(optional)* | Soft penalty if recently on this report’s reassignment trail | Avoid ping-pong |

Example: a blocked sewer report (`plumbing` / `waste_plumbing`) ranks a waste-plumbing specialist above a water-supply plumber, who still ranks above a general plumber; electricians are filtered out.

Staff/admin can override the ranked list.


---

### Live AI verification

From `Backend`, load the `OPENROUTER_*` settings from your local environment,
then run the opt-in smoke test:

```powershell
$env:FIXFLOW_LIVE_AI_TEST = 'true'
try { .\mvnw.cmd '-Dtest=LiveAiSmokeTest' test }
finally { Remove-Item Env:FIXFLOW_LIVE_AI_TEST }
```

The test uses an isolated in-memory database and sends only synthetic report data
and a generated image to OpenRouter. It checks manual classification, the report
assistant, pre-report triage, AI technician ranking, and background photo analysis.
Live responses can take longer than normal API calls.

## Development workflow

- **GitHub Flow** with branch protection
- Author of a feature writes its tests
- CI (planned): lint + test + build + Docker build on every PR


### Participation-based urgency

Distinct report participants include the creator. `fixflow.urgency.medium-reporters` (default 3) and `fixflow.urgency.high-reporters` (default 5) set the minimum participant counts for raising urgency to medium and high. The calculation preserves a higher reporter urgency, including critical. A manual final urgency takes precedence. Joining or leaving and editing the reporter urgency recalculate the stored value. Existing reports are backfilled at startup using the configured thresholds.
