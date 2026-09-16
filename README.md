# FixFlow

Multi-site maintenance reporting platform (school / hostel / hotel) with AI-assisted classification and technician routing.

**Reporter, staff, and admin** can file issues (text + photos) at their site → AI classifies category / specialty / urgency → site-scoped routing assigns or opens a marketplace claim → technicians resolve → reporters confirm. Dual urgency (`ai_urgency` / `reporter_urgency` / `final_urgency`) and two-step resolution are core MVP requirements. Reassignments keep a full trail of previous technician ids.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Java 21, Spring Boot, JPA, Security, Session (JDBC), WebSockets |
| Frontend | Vue 3 + Vite (`Frontend/Web`) |
| Database | MySQL 8 |
| Object storage | MinIO (Docker, persistent volume) |
| AI | Gemini (primary); Ollama fallback (stretch/spike) |
| Tests | JUnit + Mockito (backend), Vitest (frontend — planned) |
| Infra | Docker Compose (`Backend/compose.yaml`) |

---

## Repository layout

```
Fixflow/
├── Backend/                 # Spring Boot API
│   ├── compose.yaml         # MySQL, Ollama, RabbitMQ
│   └── src/main/resources/
│       └── db/schema.sql    # Domain DDL (authoritative)
├── Frontend/
│   └── Web/                 # Vue 3 web client
├── Database/                # Reserved for DB scripts / seeds
├── Testing/                 # Test notes / records
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
| `reports` | Tickets, dual urgency, category/specialty, status, **current** assignee |
| `report_photos` | Up to 5 images per report (≤5MB), MinIO keys |
| `report_reporters` | Manual merge (many users ↔ one report) |
| `report_reassignments` | Append-only history of previous technician ids on reassign |
| `status_history` | Status transition audit trail |

**Status flow:**  
`open` → `routed` → `assigned` → `in_progress` → `resolved_pending_confirmation` → `confirmed` / `reopened` (+ `escalated` when marketplace has no techs)

**Reassignment:** when the assigned tech (or staff/admin) reassigns, insert into `report_reassignments` (`from_technician_id`, `to_technician_id`, `reassigned_by_user_id`) **before** updating `reports.assigned_technician_id`. History is never overwritten.

Apply schema (with MySQL running):

```bash
mysql -u myuser -p mydatabase < Backend/src/main/resources/db/schema.sql
```

Compose defaults (`Backend/compose.yaml`): database `mydatabase`, user `myuser`, password `secret`.

---

## Getting started

### Prerequisites

- Java 21 + Maven (or use `Backend/mvnw`)
- Node.js 18+ (for frontend)
- Docker (MySQL / supporting services)

### 1. Start infrastructure

```bash
cd Backend
docker compose up -d
```

### 2. Create tables

```bash
mysql -h 127.0.0.1 -P <mapped-port> -u myuser -p mydatabase < src/main/resources/db/schema.sql
```

Check the published MySQL port with `docker compose ps` (Compose maps `3306` without a host pin by default).

### 3. Run backend

```bash
cd Backend
./mvnw spring-boot:run
```

### 4. Run frontend

```bash
cd Frontend/Web
npm install
npm run dev
```

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

## Development workflow

- **GitHub Flow** with branch protection
- Author of a feature writes its tests
- CI (planned): lint + test + build + Docker build on every PR

