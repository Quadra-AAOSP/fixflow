-- DEVELOPMENT ONLY. Import into isolated fixflow_demo, not production.
-- New sample users: password equals email. Existing credentials are preserved.
CREATE DATABASE IF NOT EXISTS fixflow_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fixflow_demo;

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
                       'super_admin',
                       'shop_manager'
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
-- Existing databases also accept the dedicated shop management role.
ALTER TABLE users MODIFY COLUMN role ENUM('reporter','technician','staff','admin','super_admin','shop_manager') NOT NULL;

CREATE TABLE IF NOT EXISTS site_admin_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    site_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    decided_at TIMESTAMP(6) NULL,
    decided_by BIGINT UNSIGNED NULL,
    CONSTRAINT fk_site_admin_application_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_site_admin_application_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_site_admin_application_decider FOREIGN KEY (decided_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
CREATE TABLE IF NOT EXISTS subsites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    archived_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_subsite_site_label (site_id, label),
    CONSTRAINT fk_subsites_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsite_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT UNSIGNED NOT NULL,
    requested_by_user_id BIGINT UNSIGNED NOT NULL,
    note TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_contract_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    technician_id BIGINT UNSIGNED NOT NULL,
    site_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    note VARCHAR(1000) NULL,
    decision_reason VARCHAR(1000) NULL,
    decided_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP NULL,
    UNIQUE KEY uq_contract_request (technician_id, site_id),
    FOREIGN KEY (technician_id) REFERENCES users(id),
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_terms_acceptances (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    technician_id BIGINT UNSIGNED NOT NULL,
    terms_version VARCHAR(64) NOT NULL,
    document_url VARCHAR(1024) NOT NULL,
    accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_technician_terms_version (technician_id, terms_version),
    FOREIGN KEY (technician_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id                 BIGINT UNSIGNED NOT NULL,
    subsite_id              BIGINT UNSIGNED NULL,
    created_by_user_id      BIGINT UNSIGNED NOT NULL COMMENT 'Who filed; staff/admin filings are proxied',
    description             TEXT            NOT NULL,
    address                 VARCHAR(512)    NULL COMMENT 'Room-level; mask from peer reporters in API',
    category                VARCHAR(128)    NOT NULL COMMENT 'Must match site_rules.category for this site type',
    specialty               VARCHAR(128)    NULL COMMENT 'Optional sub-type, e.g. waste_plumbing; not in site_rules',
    ai_urgency              ENUM('low', 'medium', 'high', 'critical') NULL,
    ai_category             VARCHAR(128) NULL,
    ai_specialty            VARCHAR(128) NULL,
    ai_description          TEXT NULL,
    ai_urgency_reason        TEXT NULL,
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
    CONSTRAINT fk_reports_subsite FOREIGN KEY (subsite_id) REFERENCES subsites(id)
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
-- Preserve existing installations: CREATE TABLE IF NOT EXISTS alone does not
-- add columns. Prepared SQL keeps this additive migration restart-safe on MySQL 8.
SET @subsite_migration = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'reports' AND column_name = 'subsite_id') = 0,
    'ALTER TABLE reports ADD COLUMN subsite_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_reports_subsite FOREIGN KEY (subsite_id) REFERENCES subsites(id) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT 1');
PREPARE subsite_statement FROM @subsite_migration;
EXECUTE subsite_statement;
DEALLOCATE PREPARE subsite_statement;

SET @archive_migration = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'subsites' AND column_name = 'archived_at') = 0,
    'ALTER TABLE subsites ADD COLUMN archived_at TIMESTAMP NULL', 'SELECT 1');
PREPARE archive_statement FROM @archive_migration;
EXECUTE archive_statement;
DEALLOCATE PREPARE archive_statement;

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

-- ---------------------------------------------------------------------------
-- shop_products — catalogue items for the FixFlow shop
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_products (
    id            VARCHAR(64)     NOT NULL,
    name          VARCHAR(255)    NOT NULL,
    description   TEXT            NOT NULL,
    category      VARCHAR(128)    NOT NULL,
    brand         VARCHAR(128)    NULL,
    image_url     VARCHAR(1024)   NULL,
    price_minor   INT UNSIGNED    NOT NULL,
    stock         INT UNSIGNED    NOT NULL DEFAULT 0,
    active        TINYINT(1)      NOT NULL DEFAULT 1,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_shop_products_active (active),
    KEY idx_shop_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- shop_orders — customer orders (server-authoritative pricing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_orders (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           VARCHAR(36)     NOT NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    status              ENUM(
                            'pending_payment',
                            'paid',
                            'cancelled',
                            'refunded',
                            'fulfilled'
                        )               NOT NULL DEFAULT 'pending_payment',
    currency            CHAR(3)         NOT NULL,
    minor_unit_digits   TINYINT UNSIGNED NOT NULL DEFAULT 2,
    subtotal_minor      INT UNSIGNED    NOT NULL,
    shipping_minor      INT UNSIGNED    NOT NULL DEFAULT 0,
    tax_minor           INT UNSIGNED    NOT NULL DEFAULT 0,
    total_minor         INT UNSIGNED    NOT NULL,
    shipping_name       VARCHAR(255)    NOT NULL,
    shipping_phone      VARCHAR(64)     NULL,
    shipping_address    VARCHAR(512)    NOT NULL,
    idempotency_key     VARCHAR(128)    NOT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_orders_public_id (public_id),
    UNIQUE KEY uq_shop_orders_user_idempotency (user_id, idempotency_key),
    KEY idx_shop_orders_user_id (user_id),
    KEY idx_shop_orders_status (status),
    CONSTRAINT fk_shop_orders_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- shop_order_items — line snapshots at purchase time
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_order_items (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id          BIGINT UNSIGNED NOT NULL,
    product_id        VARCHAR(64)     NOT NULL,
    name              VARCHAR(255)    NOT NULL,
    unit_price_minor  INT UNSIGNED    NOT NULL,
    quantity          INT UNSIGNED    NOT NULL,
    PRIMARY KEY (id),
    KEY idx_shop_order_items_order_id (order_id),
    CONSTRAINT fk_shop_order_items_order
        FOREIGN KEY (order_id) REFERENCES shop_orders (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_shop_order_items_quantity
        CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- shop_payments — hosted checkout session tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_payments (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id      BIGINT UNSIGNED NOT NULL,
    provider      ENUM('stripe', 'dev') NOT NULL,
    provider_ref  VARCHAR(255)    NULL,
    status        ENUM(
                      'requires_action',
                      'succeeded',
                      'failed',
                      'cancelled'
                  )               NOT NULL DEFAULT 'requires_action',
    checkout_url  VARCHAR(2048)   NULL,
    raw_event     TEXT            NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_payments_order_id (order_id),
    KEY idx_shop_payments_provider_ref (provider_ref),
    CONSTRAINT fk_shop_payments_order
        FOREIGN KEY (order_id) REFERENCES shop_orders (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Background vision requests. Images are cleared on completion; jobs survive restarts.
CREATE TABLE IF NOT EXISTS report_vision_jobs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    report_id BIGINT UNSIGNED NOT NULL,
    image_data LONGBLOB NULL,
    ai_snapshot VARCHAR(64) NULL,
    description TEXT NOT NULL,
    category VARCHAR(128) NOT NULL,
    specialty VARCHAR(128) NULL,
    ai_urgency VARCHAR(32) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    model VARCHAR(255) NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_vision_queue(status,created_at),
    KEY idx_vision_report(report_id),
    CONSTRAINT fk_vision_job_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Add nullable AI fields without changing any existing human report data.
SET @fixflow_ai_column_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='ai_category') = 0, 'ALTER TABLE reports ADD COLUMN ai_category VARCHAR(128) NULL', 'SELECT 1');
PREPARE fixflow_ai_column_statement FROM @fixflow_ai_column_sql;
EXECUTE fixflow_ai_column_statement;
DEALLOCATE PREPARE fixflow_ai_column_statement;
SET @fixflow_ai_column_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='ai_specialty') = 0, 'ALTER TABLE reports ADD COLUMN ai_specialty VARCHAR(128) NULL', 'SELECT 1');
PREPARE fixflow_ai_column_statement FROM @fixflow_ai_column_sql;
EXECUTE fixflow_ai_column_statement;
DEALLOCATE PREPARE fixflow_ai_column_statement;
SET @fixflow_ai_column_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='ai_description') = 0, 'ALTER TABLE reports ADD COLUMN ai_description TEXT NULL', 'SELECT 1');
PREPARE fixflow_ai_column_statement FROM @fixflow_ai_column_sql;
EXECUTE fixflow_ai_column_statement;
DEALLOCATE PREPARE fixflow_ai_column_statement;
SET @fixflow_ai_column_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='ai_urgency_reason') = 0, 'ALTER TABLE reports ADD COLUMN ai_urgency_reason TEXT NULL', 'SELECT 1');
PREPARE fixflow_ai_column_statement FROM @fixflow_ai_column_sql;
EXECUTE fixflow_ai_column_statement;
DEALLOCATE PREPARE fixflow_ai_column_statement;
SET @fixflow_ai_column_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='report_vision_jobs' AND column_name='ai_snapshot') = 0, 'ALTER TABLE report_vision_jobs ADD COLUMN ai_snapshot VARCHAR(64) NULL', 'SELECT 1');
PREPARE fixflow_ai_column_statement FROM @fixflow_ai_column_sql;
EXECUTE fixflow_ai_column_statement;
DEALLOCATE PREPARE fixflow_ai_column_statement;

START TRANSACTION;
-- Authoritative startup taxonomy. Existing rules are never overwritten.
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='general');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='general');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='general');

-- Startup shop catalogue. Existing stock, prices and admin edits are preserved.
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'cordless-drill-18v','18V Cordless Drill','Compact cordless drill for everyday mounting and light woodwork around shared spaces.','Power tools','FixFlow Basics','https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800',8990,25,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='cordless-drill-18v');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'multi-bit-set','40-Piece Bit Set','Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.','Hand tools','FixFlow Basics','https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800',2490,40,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='multi-bit-set');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'adjustable-wrench','Adjustable Wrench 250mm','Steel adjustable wrench for plumbing valves and general fastener work.','Hand tools',NULL,NULL,1890,30,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='adjustable-wrench');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'led-work-light','Rechargeable LED Work Light','Portable light for corridors, plant rooms, and after-hours repairs.','Lighting','BrightPath',NULL,3290,18,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='led-work-light');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'cable-ties-pack','Cable Tie Assortment (200)','Mixed lengths for tidy cable runs and temporary securing of fixtures.','Electrical',NULL,NULL,990,60,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='cable-ties-pack');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'silicone-sealant','Neutral Silicone Sealant','Bathroom and kitchen sealing for joints, splashbacks, and fittings.','Consumables','SealPro',NULL,1290,45,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='silicone-sealant');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'safety-gloves','Cut-Resistant Work Gloves','Pair of protective gloves sized for maintenance crews and DIY reporters.','Safety','GuardHand',NULL,1590,50,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='safety-gloves');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'toolbox-small','Compact Toolbox','Organiser case for bits, fasteners, and small hand tools on site visits.','Storage','FixFlow Basics',NULL,4590,12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='toolbox-small');

-- DEVELOPMENT ONLY: every NEW sample account uses its own email as password.
-- BCrypt hashes only. Never enable/import in production.
-- Additive and repeatable: no DELETE, UPDATE, password resets or stock resets.

INSERT INTO sites(name,type,contract_status,address,created_at,updated_at)
SELECT 'Demo School','school','contracted','Demo campus',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name='Demo School');
INSERT INTO sites(name,type,contract_status,address,created_at,updated_at)
SELECT 'Demo Hotel','hotel','uncontracted','Demo hotel',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name='Demo Hotel');
INSERT INTO sites(name,type,contract_status,address,created_at,updated_at)
SELECT 'Demo Hostel','hostel','contracted','Demo residence',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name='Demo Hostel');
INSERT INTO sites(name,type,contract_status,address,created_at,updated_at)
SELECT 'Demo Setup Campus','school','uncontracted','No buildings yet; tests first-login setup',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name='Demo Setup Campus');

-- Role coverage: platform, sites, shop, independent and contracted technicians.
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'superadmin@fixflow.test','$2a$10$gXi2/.N6GokBWGe8kPgl9ulZ/BkYCQinVhJ.Jog1gDWfWcZqFIV7.','Demo','SuperAdmin','super_admin',NULL,'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='superadmin@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'admin@fixflow.test','$2a$10$2UigXInRjUgLIiG21bHaie6xPtC.S2YjBtgAf7T7mmtMidmWJ1QCm','School','Admin','admin',(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'staff@fixflow.test','$2a$10$ULveOf0judQ8kf46N.jLG.cFavBGvHrI1Oh8HHgtP9ITnJsIa2Nma','School','Staff','staff',(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='staff@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'reporter@fixflow.test','$2a$10$cd8KsL866LQCQanUJwwYauscQ2kbUQLaxD4ABdOzqEekPjrk6FlqG','School','Reporter','reporter',(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='reporter@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'technician@fixflow.test','$2a$10$jWOQOK4Wl..n1iRZfdPhauBCjutYU6aKchttefdcgCEdGxEyqZV/O','Contracted','Technician','technician',NULL,'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='technician@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'hoteladmin@fixflow.test','$2a$10$8/AW8q24/M5fvdszzdpTg.dFXA9FmtWAmRzgQy698NDSI3X/r0FTi','Hotel','Admin','admin',(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='hoteladmin@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'shopmanager@fixflow.test','$2a$10$14FNG6jfOk/o3vb6ZY6lyu.pGMMnerFKG4KLQY4.xEaEGy9Uh6EGq','Shop','Manager','shop_manager',NULL,'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='shopmanager@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'hosteladmin@fixflow.test','$2a$10$kiAqGlKTMeS7sgeAcZ1LpuiBJD5LeFVmIggom8I.5nKUQozoJPp1i','Hostel','Admin','admin',(SELECT id FROM sites WHERE name='Demo Hostel' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='hosteladmin@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'hotelreporter@fixflow.test','$2a$10$Nr3sZDH7wFKvs/gfMLymZ.5VX//PW2YONgRr5QzPAtRCevWrxLor6','Hotel','Reporter','reporter',(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='hotelreporter@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'independent@fixflow.test','$2a$10$y0uuUi8MAyhdPpG60jzXzOHhxkIkeIhgwaAp9QAQu8Nn03CIdZKDu','Independent','Technician','technician',NULL,'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='independent@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'pendingadmin@fixflow.test','$2a$10$6v2oSsU/368Zg1tusbbs0e6O7lSCC94D2fm1YLlrSJdUb8x/ykGjC','Pending','Applicant','reporter',(SELECT id FROM sites WHERE name='Demo Setup Campus' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='pendingadmin@fixflow.test');
INSERT INTO users(email,password_hash,first_name,last_name,role,site_id,phone,address,created_at,updated_at)
SELECT 'rejectedadmin@fixflow.test','$2a$10$rPBsmFRR8vG63cN7P8T7JOeHBDR8xpshx2QsfE2tCdEFDpq0.9zfO','Rejected','Applicant','reporter',(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'+6500000000','Development sample address',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='rejectedadmin@fixflow.test');

-- Labelled buildings; Setup Campus deliberately has none.
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'E5','Classroom building','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='E5');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'A1','Administration','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='A1');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'L2','Science laboratories','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='L2');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'OLD','Closed annex','Development reporting location',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='OLD');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),'H1','Main hotel building','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND label='H1');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),'H2','Guest wing','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND label='H2');
INSERT INTO subsites(site_id,label,name,description,archived_at,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo Hostel' ORDER BY id LIMIT 1),'R1','Residence block','Development reporting location',NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hostel' ORDER BY id LIMIT 1) AND label='R1');

-- Contracted technician remains site-less; independent technician has no contract.
INSERT INTO technician_contracts(technician_id,site_id,created_at) SELECT (SELECT id FROM users WHERE email='technician@fixflow.test'),(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM technician_contracts WHERE technician_id=(SELECT id FROM users WHERE email='technician@fixflow.test') AND site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1));
INSERT INTO technician_availability(technician_id,status,updated_at) SELECT (SELECT id FROM users WHERE email='technician@fixflow.test'),'available',CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM technician_availability WHERE technician_id=(SELECT id FROM users WHERE email='technician@fixflow.test'));
INSERT INTO technician_availability(technician_id,status,updated_at) SELECT (SELECT id FROM users WHERE email='independent@fixflow.test'),'available',CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM technician_availability WHERE technician_id=(SELECT id FROM users WHERE email='independent@fixflow.test'));
INSERT INTO technician_skills(technician_id,category,specialty,proficiency) SELECT (SELECT id FROM users WHERE email='technician@fixflow.test'),'plumbing','water_supply',4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills WHERE technician_id=(SELECT id FROM users WHERE email='technician@fixflow.test') AND category='plumbing' AND specialty='water_supply');
INSERT INTO technician_skills(technician_id,category,specialty,proficiency) SELECT (SELECT id FROM users WHERE email='technician@fixflow.test'),'electrical','lighting',4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills WHERE technician_id=(SELECT id FROM users WHERE email='technician@fixflow.test') AND category='electrical' AND specialty='lighting');
INSERT INTO technician_contract_requests(technician_id,site_id,status,note,decided_by_user_id,decided_at,decision_reason,created_at)
SELECT (SELECT id FROM users WHERE email='technician@fixflow.test'),(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'approved','Demo contract application',(SELECT id FROM users WHERE email='admin@fixflow.test'),CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM technician_contract_requests WHERE technician_id=(SELECT id FROM users WHERE email='technician@fixflow.test') AND site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1));
INSERT INTO technician_contract_requests(technician_id,site_id,status,note,decided_by_user_id,decided_at,decision_reason,created_at)
SELECT (SELECT id FROM users WHERE email='independent@fixflow.test'),(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'pending','Demo contract application',NULL,NULL,NULL,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM technician_contract_requests WHERE technician_id=(SELECT id FROM users WHERE email='independent@fixflow.test') AND site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1));
INSERT INTO technician_contract_requests(technician_id,site_id,status,note,decided_by_user_id,decided_at,decision_reason,created_at)
SELECT (SELECT id FROM users WHERE email='independent@fixflow.test'),(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),'rejected','Demo contract application',(SELECT id FROM users WHERE email='hoteladmin@fixflow.test'),CURRENT_TIMESTAMP,'Demo: supporting information incomplete',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM technician_contract_requests WHERE technician_id=(SELECT id FROM users WHERE email='independent@fixflow.test') AND site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1));
INSERT INTO site_admin_applications(user_id,site_id,status,created_at,decided_by,decided_at)
SELECT (SELECT id FROM users WHERE email='pendingadmin@fixflow.test'),(SELECT id FROM sites WHERE name='Demo Setup Campus' ORDER BY id LIMIT 1),'pending',CURRENT_TIMESTAMP,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM site_admin_applications WHERE user_id=(SELECT id FROM users WHERE email='pendingadmin@fixflow.test'));
INSERT INTO site_admin_applications(user_id,site_id,status,created_at,decided_by,decided_at)
SELECT (SELECT id FROM users WHERE email='rejectedadmin@fixflow.test'),(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),'rejected',CURRENT_TIMESTAMP,(SELECT id FROM users WHERE email='superadmin@fixflow.test'),CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_admin_applications WHERE user_id=(SELECT id FROM users WHERE email='rejectedadmin@fixflow.test'));

-- Missing-building alerts include a site that already has buildings.
INSERT INTO subsite_requests(site_id,requested_by_user_id,note,status,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'Demo: sports hall is missing','pending',CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM subsite_requests WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND requested_by_user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test') AND note='Demo: sports hall is missing');
INSERT INTO subsite_requests(site_id,requested_by_user_id,note,status,created_at)
SELECT (SELECT id FROM sites WHERE name='Demo Setup Campus' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='pendingadmin@fixflow.test'),'Demo: please add campus buildings','pending',CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM subsite_requests WHERE site_id=(SELECT id FROM sites WHERE name='Demo Setup Campus' ORDER BY id LIMIT 1) AND requested_by_user_id=(SELECT id FROM users WHERE email='pendingadmin@fixflow.test') AND note='Demo: please add campus buildings');

-- Historical lifecycle fixtures, not simulated live workflow events.
-- Reporter and AI urgency remain separate; null AI urgency exercises fallback.
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='E5'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-01] Leaking tap in E5','E5 room 101','plumbing','medium',NULL,'open',NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-01] Leaking tap in E5');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-01] Leaking tap in E5' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-01] Leaking tap in E5' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-01] Leaking tap in E5' ORDER BY id LIMIT 1),NULL,'open',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-01] Leaking tap in E5' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='A1'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-02] Flickering corridor light','A1 room 101','electrical','high','medium','assigned',(SELECT id FROM users WHERE email='technician@fixflow.test'),0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-02] Flickering corridor light');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-02] Flickering corridor light' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-02] Flickering corridor light' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-02] Flickering corridor light' ORDER BY id LIMIT 1),NULL,'assigned',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-02] Flickering corridor light' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='E5'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-03] Classroom ventilation failure','E5 room 101','hvac','high','high','in_progress',(SELECT id FROM users WHERE email='technician@fixflow.test'),0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-03] Classroom ventilation failure');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-03] Classroom ventilation failure' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-03] Classroom ventilation failure' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-03] Classroom ventilation failure' ORDER BY id LIMIT 1),NULL,'in_progress',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-03] Classroom ventilation failure' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='E5'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-04] Door hinge repaired, awaiting confirmation','E5 room 101','carpentry','low','low','resolved_pending_confirmation',(SELECT id FROM users WHERE email='technician@fixflow.test'),0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-04] Door hinge repaired, awaiting confirmation');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-04] Door hinge repaired, awaiting confirmation' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-04] Door hinge repaired, awaiting confirmation' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-04] Door hinge repaired, awaiting confirmation' ORDER BY id LIMIT 1),NULL,'resolved_pending_confirmation',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-04] Door hinge repaired, awaiting confirmation' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND label='H1'),(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'),'[DEMO:FF-05] Lobby floor cleaned','H1 room 101','cleaning','medium','low','confirmed',NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-05] Lobby floor cleaned');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-05] Lobby floor cleaned' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-05] Lobby floor cleaned' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-05] Lobby floor cleaned' ORDER BY id LIMIT 1),NULL,'confirmed',(SELECT id FROM users WHERE email='hoteladmin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-05] Lobby floor cleaned' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND label='H2'),(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'),'[DEMO:FF-06] Guest wing leak returned','H2 room 101','plumbing','high','high','reopened',NULL,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-06] Guest wing leak returned');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-06] Guest wing leak returned' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-06] Guest wing leak returned' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='hotelreporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-06] Guest wing leak returned' ORDER BY id LIMIT 1),NULL,'reopened',(SELECT id FROM users WHERE email='hoteladmin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo Hotel' ORDER BY id LIMIT 1) AND description='[DEMO:FF-06] Guest wing leak returned' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='L2'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-07] Laboratory circuit needs urgent attention','L2 room 101','electrical','critical','critical','escalated',(SELECT id FROM users WHERE email='technician@fixflow.test'),0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-07] Laboratory circuit needs urgent attention');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-07] Laboratory circuit needs urgent attention' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-07] Laboratory circuit needs urgent attention' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-07] Laboratory circuit needs urgent attention' ORDER BY id LIMIT 1),NULL,'escalated',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-07] Laboratory circuit needs urgent attention' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');
INSERT INTO reports(site_id,subsite_id,created_by_user_id,description,address,category,reporter_urgency,ai_urgency,status,assigned_technician_id,reopen_count,created_at,updated_at,editable)
SELECT (SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1),(SELECT id FROM subsites WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND label='A1'),(SELECT id FROM users WHERE email='reporter@fixflow.test'),'[DEMO:FF-08] Unresolved category requires staff review','A1 room 101','general','medium',NULL,'open',NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-08] Unresolved category requires staff review');
INSERT INTO report_reporters(report_id,user_id,joined_at) SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-08] Unresolved category requires staff review' ORDER BY id LIMIT 1),(SELECT id FROM users WHERE email='reporter@fixflow.test'),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM report_reporters WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-08] Unresolved category requires staff review' ORDER BY id LIMIT 1) AND user_id=(SELECT id FROM users WHERE email='reporter@fixflow.test'));
INSERT INTO status_history(report_id,from_status,to_status,changed_by_user_id,note,created_at)
SELECT (SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-08] Unresolved category requires staff review' ORDER BY id LIMIT 1),NULL,'open',(SELECT id FROM users WHERE email='admin@fixflow.test'),'Demo historical fixture imported',CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM status_history WHERE report_id=(SELECT id FROM reports WHERE site_id=(SELECT id FROM sites WHERE name='Demo School' ORDER BY id LIMIT 1) AND description='[DEMO:FF-08] Unresolved category requires staff review' ORDER BY id LIMIT 1) AND note='Demo historical fixture imported');

-- Historical paid dev checkout. Current catalogue stock is the opening balance;
-- importing history does not reserve/decrement it again. No live gateway calls.
INSERT INTO shop_orders(public_id,user_id,status,currency,minor_unit_digits,subtotal_minor,shipping_minor,tax_minor,total_minor,shipping_name,shipping_phone,shipping_address,idempotency_key,created_at,updated_at)
SELECT '00000000-0000-4000-8000-000000000001',(SELECT id FROM users WHERE email='reporter@fixflow.test'),'paid','SGD',2,3180,500,0,3680,'Demo Reporter','+6500000000','Demo campus reception','demo-history-order-1',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM shop_orders WHERE public_id='00000000-0000-4000-8000-000000000001');
INSERT INTO shop_order_items(order_id,product_id,name,unit_price_minor,quantity) SELECT (SELECT id FROM shop_orders WHERE public_id='00000000-0000-4000-8000-000000000001'),'safety-gloves','Cut-Resistant Work Gloves',1590,2 WHERE NOT EXISTS (SELECT 1 FROM shop_order_items WHERE order_id=(SELECT id FROM shop_orders WHERE public_id='00000000-0000-4000-8000-000000000001') AND product_id='safety-gloves');
INSERT INTO shop_payments(order_id,provider,provider_ref,status,created_at,updated_at) SELECT (SELECT id FROM shop_orders WHERE public_id='00000000-0000-4000-8000-000000000001'),'dev','demo-historical-payment-1','succeeded',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_payments WHERE order_id=(SELECT id FROM shop_orders WHERE public_id='00000000-0000-4000-8000-000000000001'));

COMMIT;
