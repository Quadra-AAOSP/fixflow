-- FixFlow domain schema (MySQL 8+)
-- Source of truth aligned with fixflow-project-plan-v2.md §2
-- This script is run by Spring Boot at application startup. It is deliberately
-- idempotent: it creates an empty database schema but never removes existing data.

SET NAMES utf8mb4;
-- ---------------------------------------------------------------------------
-- sites — physical locations (school / hostel / hotel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sites (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name             VARCHAR(255)    NOT NULL,
    type             ENUM('school', 'hostel', 'hotel') NOT NULL,
    contract_status  ENUM('contracted', 'uncontracted') NOT NULL DEFAULT 'uncontracted',
    address          VARCHAR(512)    NULL,
    description      TEXT            NULL,
    image_url        VARCHAR(1024)   NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sites_type (type),
    KEY idx_sites_contract_status (contract_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- site_rules — fixed category + urgency taxonomy per site type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_rules (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_type       ENUM('school', 'hostel', 'hotel') NOT NULL,
    category        VARCHAR(128)    NOT NULL,
    urgency_weight  INT             NOT NULL DEFAULT 0,
    sort_order      INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_rules_type_category (site_type, category),
    KEY idx_site_rules_site_type (site_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- users — all accounts; role + optional site scope
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email          VARCHAR(255)    NOT NULL,
    password_hash  VARCHAR(255)    NOT NULL,
    first_name     VARCHAR(128)    NOT NULL,
    last_name      VARCHAR(128)    NOT NULL,
    phone          VARCHAR(64)     NULL,
    address        VARCHAR(512)    NULL,
    role           ENUM(
                       'reporter',
                       'technician',
                       'staff',
                       'admin',
                       'super_admin'
                   )               NOT NULL,
    site_id        BIGINT UNSIGNED NULL COMMENT 'Required for reporter/staff/admin; null for super_admin; optional for technician (see technician_contracts)',
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_site_id (site_id),
    CONSTRAINT fk_users_site
        FOREIGN KEY (site_id) REFERENCES sites (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- technician_contracts — multi-site contracts; absence ⇒ marketplace-eligible
-- technician_id FK cannot enforce role = technician — application must reject
-- writes unless users.role is technician.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technician_contracts (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id  BIGINT UNSIGNED NOT NULL COMMENT 'Must be users.role = technician (app-enforced)',
    site_id        BIGINT UNSIGNED NOT NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tech_contract (technician_id, site_id),
    KEY idx_tech_contracts_site (site_id),
    CONSTRAINT fk_tech_contracts_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tech_contracts_site
        FOREIGN KEY (site_id) REFERENCES sites (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- technician_availability — self-toggled availability for routing/claim pools
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technician_availability (
    technician_id  BIGINT UNSIGNED NOT NULL COMMENT 'Must be users.role = technician (app-enforced)',
    status         ENUM('available', 'unavailable') NOT NULL DEFAULT 'unavailable',
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (technician_id),
    CONSTRAINT fk_tech_availability_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- technician_skills — stretch: trade + specialty for recommendation scoring
-- e.g. category=plumbing, specialty=waste_plumbing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technician_skills (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id  BIGINT UNSIGNED NOT NULL COMMENT 'Must be users.role = technician (app-enforced)',
    category       VARCHAR(128)    NOT NULL COMMENT 'Trade: plumbing, electrical, hvac, …',
    specialty      VARCHAR(128)    NULL COMMENT 'Sub-skill: waste_plumbing, water_supply, …; NULL = generalist',
    proficiency    TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1–5 depth within this skill',
    PRIMARY KEY (id),
    UNIQUE KEY uq_tech_skill (technician_id, category, specialty),
    KEY idx_tech_skills_category (category),
    CONSTRAINT fk_tech_skills_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_tech_skills_proficiency
        CHECK (proficiency BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- reports — maintenance tickets (dual urgency + lifecycle)
-- category must exist in site_rules for sites.type (app-enforced; MySQL cannot
-- FK a composite site_type+category without extra plumbing).
-- address is masked from peer reporters in API responses (staff/admin/assigned
-- tech/attached reporters see it). No on_behalf_of_user_id — created_by_user_id
-- is who filed; reporter_urgency may be staff-proxied.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id                 BIGINT UNSIGNED NOT NULL,
    created_by_user_id      BIGINT UNSIGNED NOT NULL COMMENT 'Who filed; staff/admin filings are proxied',
    description             TEXT            NOT NULL,
    address                 VARCHAR(512)    NULL COMMENT 'Room-level; mask from peer reporters in API',
    category                VARCHAR(128)    NOT NULL COMMENT 'Must match site_rules.category for this site type',
    specialty               VARCHAR(128)    NULL COMMENT 'Optional sub-type, e.g. waste_plumbing; not in site_rules',
    ai_urgency              ENUM('low', 'medium', 'high', 'critical') NULL,
    reporter_urgency        ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    reporter_reason         TEXT            NULL,
    final_urgency           ENUM('low', 'medium', 'high', 'critical') NULL COMMENT 'Staff/admin override; null until overridden',
    status                  ENUM(
                                'open',
                                'routed',
                                'assigned',
                                'in_progress',
                                'resolved_pending_confirmation',
                                'confirmed',
                                'reopened',
                                'escalated'
                            )               NOT NULL DEFAULT 'open',
    assigned_technician_id  BIGINT UNSIGNED NULL COMMENT 'Must be users.role = technician (app-enforced)',
    editable                TINYINT(1)      NOT NULL DEFAULT 1,
    reopen_count            INT UNSIGNED    NOT NULL DEFAULT 0,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reports_site_id (site_id),
    KEY idx_reports_status (status),
    KEY idx_reports_assigned_tech (assigned_technician_id),
    KEY idx_reports_created_by (created_by_user_id),
    CONSTRAINT fk_reports_site
        FOREIGN KEY (site_id) REFERENCES sites (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reports_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reports_assigned_technician
        FOREIGN KEY (assigned_technician_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- report_photos — max 5 images per report (≤5MB each); MinIO object keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_photos (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id        BIGINT UNSIGNED NOT NULL,
    object_key       VARCHAR(512)    NOT NULL,
    url              VARCHAR(1024)   NULL,
    content_type     VARCHAR(128)    NULL,
    file_size_bytes  INT UNSIGNED    NOT NULL,
    sort_order       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_report_photos_report_id (report_id),
    CONSTRAINT fk_report_photos_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_report_photos_size
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    CONSTRAINT chk_report_photos_sort
        CHECK (sort_order <= 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- report_reporters — manual merge (many users ↔ one report)
-- Always insert the creator (created_by_user_id) at report create time.
-- List-reporters queries use this table only — do not UNION created_by_user_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_reporters (
    report_id  BIGINT UNSIGNED NOT NULL,
    user_id    BIGINT UNSIGNED NOT NULL,
    joined_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id, user_id),
    KEY idx_report_reporters_user (user_id),
    CONSTRAINT fk_report_reporters_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_report_reporters_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- report_reassignments — append-only prior technician ids on reassign
-- Insert BEFORE updating reports.assigned_technician_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_reassignments (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id              BIGINT UNSIGNED NOT NULL,
    from_technician_id     BIGINT UNSIGNED NOT NULL,
    to_technician_id       BIGINT UNSIGNED NULL COMMENT 'NULL if unassigned back to pool',
    reassigned_by_user_id  BIGINT UNSIGNED NOT NULL,
    reason                 TEXT            NULL,
    created_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_report_reassignments_report (report_id),
    KEY idx_report_reassignments_from (from_technician_id),
    CONSTRAINT fk_report_reassignments_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_report_reassignments_from
        FOREIGN KEY (from_technician_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_report_reassignments_to
        FOREIGN KEY (to_technician_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_report_reassignments_by
        FOREIGN KEY (reassigned_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- status_history — append-only audit of status transitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id           BIGINT UNSIGNED NOT NULL,
    from_status         VARCHAR(64)     NULL,
    to_status           VARCHAR(64)     NOT NULL,
    changed_by_user_id  BIGINT UNSIGNED NOT NULL,
    note                TEXT            NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_status_history_report_id (report_id),
    KEY idx_status_history_created_at (created_at),
    CONSTRAINT fk_status_history_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_status_history_user
        FOREIGN KEY (changed_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
