-- FixFlow domain schema (MySQL 8+).
-- CREATE-only, idempotent. Never drops data. Reference rows use INSERT IGNORE.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sites (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name             VARCHAR(255)    NOT NULL,
    type             ENUM('school', 'hostel', 'hotel') NOT NULL,
    contract_status  ENUM('contracted', 'uncontracted') NOT NULL DEFAULT 'uncontracted',
    address          VARCHAR(512)    NULL,
    description      TEXT            NULL,
    image_url        VARCHAR(1024)   NULL,
    created_at       TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_sites_name (name),
    KEY idx_sites_type (type),
    KEY idx_sites_contract_status (contract_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_rules (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_type       ENUM('school', 'hostel', 'hotel') NOT NULL,
    category        VARCHAR(128)    NOT NULL,
    urgency_weight  INT             NOT NULL DEFAULT 0,
    sort_order      INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_rules_type_category (site_type, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    site_id        BIGINT UNSIGNED NULL,
    created_at     TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_site_id (site_id),
    CONSTRAINT fk_users_site
        FOREIGN KEY (site_id) REFERENCES sites (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_admin_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    site_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    decided_at TIMESTAMP(6) NULL,
    decided_by BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_admin_application_user (user_id),
    CONSTRAINT fk_site_admin_application_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_site_admin_application_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_site_admin_application_decider FOREIGN KEY (decided_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_contracts (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id  BIGINT UNSIGNED NOT NULL,
    site_id        BIGINT UNSIGNED NOT NULL,
    created_at     TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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

CREATE TABLE IF NOT EXISTS technician_availability (
    technician_id  BIGINT UNSIGNED NOT NULL,
    status         ENUM('available', 'unavailable') NOT NULL DEFAULT 'unavailable',
    updated_at     TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (technician_id),
    CONSTRAINT fk_tech_availability_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_skills (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id  BIGINT UNSIGNED NOT NULL,
    category       VARCHAR(128)    NOT NULL,
    specialty      VARCHAR(128)    NULL,
    proficiency    TINYINT UNSIGNED NOT NULL DEFAULT 3,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tech_skill (technician_id, category, specialty),
    KEY idx_tech_skills_category (category),
    CONSTRAINT fk_tech_skills_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_tech_skills_proficiency
        CHECK (proficiency BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    archived_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_subsite_site_label (site_id, label),
    CONSTRAINT fk_subsites_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsite_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id BIGINT UNSIGNED NOT NULL,
    requested_by_user_id BIGINT UNSIGNED NOT NULL,
    note TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_subsite_requests_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_subsite_requests_user FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_contract_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id BIGINT UNSIGNED NOT NULL,
    site_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    note VARCHAR(1000) NULL,
    decision_reason VARCHAR(1000) NULL,
    decided_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    decided_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_request (technician_id, site_id),
    CONSTRAINT fk_tech_contract_req_tech FOREIGN KEY (technician_id) REFERENCES users(id),
    CONSTRAINT fk_tech_contract_req_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_tech_contract_req_decider FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_terms_acceptances (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id BIGINT UNSIGNED NOT NULL,
    terms_version VARCHAR(64) NOT NULL,
    document_url VARCHAR(1024) NOT NULL,
    accepted_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_technician_terms_version (technician_id, terms_version),
    CONSTRAINT fk_tech_terms_technician FOREIGN KEY (technician_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id                 BIGINT UNSIGNED NOT NULL,
    subsite_id              BIGINT UNSIGNED NULL,
    created_by_user_id      BIGINT UNSIGNED NOT NULL,
    description             TEXT            NOT NULL,
    address                 VARCHAR(512)    NULL,
    category                VARCHAR(128)    NOT NULL,
    specialty               VARCHAR(128)    NULL,
    ai_urgency              ENUM('low', 'medium', 'high', 'critical') NULL,
    ai_category             VARCHAR(128)    NULL,
    ai_specialty            VARCHAR(128)    NULL,
    ai_description          TEXT            NULL,
    ai_urgency_reason       TEXT            NULL,
    reporter_urgency        ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    reporter_reason         TEXT            NULL,
    final_urgency           ENUM('low', 'medium', 'high', 'critical') NULL,
    calculated_urgency      ENUM('low', 'medium', 'high', 'critical') NULL,
    participation_count     INT             NOT NULL DEFAULT 1,
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
    assigned_technician_id  BIGINT UNSIGNED NULL,
    editable                TINYINT(1)      NOT NULL DEFAULT 1,
    archived_at             TIMESTAMP(6)    NULL,
    visibility              VARCHAR(16)     NOT NULL DEFAULT 'public',
    reopen_count            INT UNSIGNED    NOT NULL DEFAULT 0,
    reopen_reason           TEXT            NULL,
    confirmed_by_user_id    BIGINT UNSIGNED NULL,
    confirmed_at            TIMESTAMP(6)    NULL,
    confirmation_signed_name VARCHAR(255)   NULL,
    created_at              TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_reports_site_status_archived (site_id, status, archived_at),
    KEY idx_reports_assigned_status (assigned_technician_id, status),
    KEY idx_reports_created_by (created_by_user_id),
    CONSTRAINT fk_reports_site
        FOREIGN KEY (site_id) REFERENCES sites (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reports_subsite
        FOREIGN KEY (subsite_id) REFERENCES subsites(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reports_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reports_assigned_technician
        FOREIGN KEY (assigned_technician_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_reports_confirmed_by
        FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- report_photos — max 1 image per report (≤5MB); MinIO object keys; also sent to AI vision
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

-- Existing databases gain report visibility without losing data.
SET @visibility_migration = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'reports' AND column_name = 'visibility') = 0,
    'ALTER TABLE reports ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT ''public''', 'SELECT 1');
PREPARE visibility_statement FROM @visibility_migration;
EXECUTE visibility_statement;
DEALLOCATE PREPARE visibility_statement;

SET @report_archive_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'reports' AND column_name = 'archived_at') = 0,
    'ALTER TABLE reports ADD COLUMN archived_at TIMESTAMP(6) NULL', 'SELECT 1');
PREPARE report_archive_statement FROM @report_archive_sql;
EXECUTE report_archive_statement;
DEALLOCATE PREPARE report_archive_statement;

CREATE TABLE IF NOT EXISTS report_notifications (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT UNSIGNED NOT NULL,
    report_id    BIGINT UNSIGNED NOT NULL,
    type         VARCHAR(32) NOT NULL,
    created_at   TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_report_notification_inbox (recipient_id, id),
    CONSTRAINT fk_report_notification_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_notification_report
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_photos (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id        BIGINT UNSIGNED NOT NULL,
    object_key       VARCHAR(512)    NOT NULL,
    url              VARCHAR(1024)   NULL,
    content_type     VARCHAR(128)    NULL,
    file_size_bytes  INT UNSIGNED    NOT NULL,
    sort_order       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at       TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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

CREATE TABLE IF NOT EXISTS report_reporters (
    report_id  BIGINT UNSIGNED NOT NULL,
    user_id    BIGINT UNSIGNED NOT NULL,
    joined_at  TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (report_id, user_id),
    KEY idx_report_reporters_user (user_id),
    CONSTRAINT fk_report_reporters_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_report_reporters_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_reassignments (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id              BIGINT UNSIGNED NOT NULL,
    from_technician_id     BIGINT UNSIGNED NOT NULL,
    to_technician_id       BIGINT UNSIGNED NULL,
    reassigned_by_user_id  BIGINT UNSIGNED NOT NULL,
    reason                 TEXT            NULL,
    created_at             TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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

CREATE TABLE IF NOT EXISTS status_history (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id           BIGINT UNSIGNED NOT NULL,
    from_status         VARCHAR(64)     NULL,
    to_status           VARCHAR(64)     NOT NULL,
    changed_by_user_id  BIGINT UNSIGNED NOT NULL,
    note                TEXT            NULL,
    created_at          TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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
    created_at    TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_shop_products_active (active),
    KEY idx_shop_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    fulfillment_status  VARCHAR(20)     NULL,
    processing_at       TIMESTAMP(6)    NULL,
    shipped_at          TIMESTAMP(6)    NULL,
    delivery_confirmed_at TIMESTAMP(6)  NULL,
    delivery_signed_name VARCHAR(255)   NULL,
    delivery_confirmed_by BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_orders_public_id (public_id),
    UNIQUE KEY uq_shop_orders_user_idempotency (user_id, idempotency_key),
    KEY idx_shop_orders_user_id (user_id),
    KEY idx_shop_orders_status (status),
    CONSTRAINT fk_shop_orders_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_shop_orders_delivery_by
        FOREIGN KEY (delivery_confirmed_by) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT UNSIGNED NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_notice (recipient_id, order_id, type),
    KEY idx_shop_notice_inbox (recipient_id, id),
    CONSTRAINT fk_shop_notice_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS shop_payments (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id      BIGINT UNSIGNED NOT NULL,
    provider      ENUM('dev') NOT NULL,
    provider_ref  VARCHAR(255)    NULL,
    status        ENUM(
                      'requires_action',
                      'succeeded',
                      'failed',
                      'cancelled'
                  )               NOT NULL DEFAULT 'requires_action',
    checkout_url  VARCHAR(2048)   NULL,
    raw_event     TEXT            NULL,
    created_at    TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_shop_payments_order_id (order_id),
    KEY idx_shop_payments_provider_ref (provider_ref),
    CONSTRAINT fk_shop_payments_order
        FOREIGN KEY (order_id) REFERENCES shop_orders (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_vision_jobs (
    id VARCHAR(36) NOT NULL,
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
    PRIMARY KEY (id),
    KEY idx_vision_queue (status, created_at),
    KEY idx_vision_report (report_id),
    CONSTRAINT fk_vision_job_report
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_resolutions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT UNSIGNED NOT NULL,
    technician_id BIGINT UNSIGNED NOT NULL,
    description VARCHAR(10000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_resolution_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_resolution_technician FOREIGN KEY (technician_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_ratings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    resolution_id BIGINT UNSIGNED NOT NULL,
    rated_by_id BIGINT UNSIGNED NOT NULL,
    score INT NOT NULL,
    feedback VARCHAR(2000) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_resolution_rater UNIQUE (resolution_id, rated_by_id),
    CONSTRAINT ck_rating_score CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT fk_rating_resolution FOREIGN KEY (resolution_id) REFERENCES report_resolutions(id),
    CONSTRAINT fk_rating_user FOREIGN KEY (rated_by_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT UNSIGNED NOT NULL,
    linked_report_id BIGINT UNSIGNED NOT NULL,
    created_by_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_report_link UNIQUE (report_id, linked_report_id),
    CONSTRAINT ck_report_link_self CHECK (report_id <> linked_report_id),
    CONSTRAINT fk_link_source FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_link_target FOREIGN KEY (linked_report_id) REFERENCES reports(id),
    CONSTRAINT fk_link_author FOREIGN KEY (created_by_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_verifications (
    technician_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL,
    phone VARCHAR(128) NULL,
    email VARCHAR(255) NULL,
    trades VARCHAR(2000) NULL,
    experience VARCHAR(4000) NULL,
    qualifications VARCHAR(4000) NULL,
    identity_checked BOOLEAN NOT NULL DEFAULT FALSE,
    email_checked BOOLEAN NOT NULL DEFAULT FALSE,
    phone_checked BOOLEAN NOT NULL DEFAULT FALSE,
    trade_checked BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(2000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    updated_at TIMESTAMP(6) NULL,
    version BIGINT NULL,
    PRIMARY KEY (technician_id),
    CONSTRAINT fk_verification_technician FOREIGN KEY (technician_id) REFERENCES users(id),
    CONSTRAINT fk_verification_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_verification_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    technician_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL,
    snapshot LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_verification_audit_technician FOREIGN KEY (technician_id) REFERENCES users(id),
    CONSTRAINT fk_verification_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tracking_hash VARCHAR(64) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    site_type VARCHAR(32) NOT NULL,
    address VARCHAR(512) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(64) NOT NULL,
    relationship VARCHAR(1000) NOT NULL,
    admin_first_name VARCHAR(128) NOT NULL,
    admin_last_name VARCHAR(128) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    review_message VARCHAR(2000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    site_id BIGINT UNSIGNED NULL,
    admin_id BIGINT UNSIGNED NULL,
    setup_hash VARCHAR(64) NULL,
    setup_expires_at TIMESTAMP(6) NULL,
    setup_used_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    reviewed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_applications_tracking (tracking_hash),
    UNIQUE KEY uq_site_applications_setup (setup_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_application_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(32) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    snapshot TEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_site_application_audit_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT UNSIGNED NOT NULL,
    summary VARCHAR(300) NOT NULL,
    broad_location VARCHAR(160) NOT NULL,
    timing VARCHAR(160) NOT NULL,
    category VARCHAR(128) NOT NULL,
    specialty VARCHAR(128) NULL,
    status VARCHAR(16) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY ix_marketplace_report_status (report_id, status),
    KEY ix_marketplace_status_expiry (status, expires_at),
    CONSTRAINT fk_marketplace_listing_report
        FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketplace_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    listing_id BIGINT UNSIGNED NOT NULL,
    technician_id BIGINT UNSIGNED NOT NULL,
    note VARCHAR(1000) NOT NULL,
    status VARCHAR(16) NOT NULL,
    offer_expires_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_marketplace_applicant (listing_id, technician_id),
    CONSTRAINT fk_marketplace_application_listing
        FOREIGN KEY (listing_id) REFERENCES marketplace_listings (id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_application_technician
        FOREIGN KEY (technician_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketplace_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    listing_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NULL,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(32) NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY ix_marketplace_audit_listing (listing_id),
    CONSTRAINT fk_marketplace_audit_listing
        FOREIGN KEY (listing_id) REFERENCES marketplace_listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_technician_vetting (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id BIGINT UNSIGNED NOT NULL,
    technician_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL,
    reviewed_by BIGINT UNSIGNED NOT NULL,
    reviewed_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NULL,
    identity_checked BOOLEAN NOT NULL,
    references_checked BOOLEAN NOT NULL,
    qualifications_checked BOOLEAN NOT NULL,
    licence_applicable BOOLEAN NOT NULL,
    licence_checked BOOLEAN NOT NULL,
    licence_expires_at TIMESTAMP(6) NULL,
    insurance_applicable BOOLEAN NOT NULL,
    insurance_checked BOOLEAN NOT NULL,
    insurance_expires_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    KEY idx_site_technician_vetting (site_id, technician_id, id),
    CONSTRAINT fk_site_vetting_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_site_vetting_technician FOREIGN KEY (technician_id) REFERENCES users(id),
    CONSTRAINT fk_site_vetting_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS technician_ranking_audits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    requested_mode VARCHAR(16) NOT NULL,
    method_used VARCHAR(16) NOT NULL,
    fallback_reason VARCHAR(255) NULL,
    technician_order LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ranking_audit_report (report_id, created_at),
    CONSTRAINT fk_ranking_audit_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_ranking_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Reference data (always). Insert-if-absent; never overwrites edits.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES
    ('school', 'plumbing', 40, 1),
    ('school', 'electrical', 50, 2),
    ('school', 'hvac', 35, 3),
    ('school', 'carpentry', 20, 4),
    ('school', 'cleaning', 10, 5),
    ('school', 'general', 15, 6),
    ('hostel', 'plumbing', 40, 1),
    ('hostel', 'electrical', 50, 2),
    ('hostel', 'hvac', 35, 3),
    ('hostel', 'carpentry', 20, 4),
    ('hostel', 'cleaning', 10, 5),
    ('hostel', 'general', 15, 6),
    ('hotel', 'plumbing', 40, 1),
    ('hotel', 'electrical', 50, 2),
    ('hotel', 'hvac', 35, 3),
    ('hotel', 'carpentry', 20, 4),
    ('hotel', 'cleaning', 10, 5),
    ('hotel', 'general', 15, 6);

INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active) VALUES
    ('cordless-drill-18v', '18V Cordless Drill', 'Compact cordless drill for everyday mounting and light woodwork around shared spaces.', 'Power tools', 'FixFlow Basics', 'https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800', 8990, 25, TRUE),
    ('multi-bit-set', '40-Piece Bit Set', 'Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.', 'Hand tools', 'FixFlow Basics', 'https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800', 2490, 40, TRUE),
    ('adjustable-wrench', 'Adjustable Wrench 250mm', 'Steel adjustable wrench for plumbing valves and general fastener work.', 'Hand tools', NULL, NULL, 1890, 30, TRUE),
    ('led-work-light', 'Rechargeable LED Work Light', 'Portable light for corridors, plant rooms, and after-hours repairs.', 'Lighting', 'BrightPath', NULL, 3290, 18, TRUE),
    ('cable-ties-pack', 'Cable Tie Assortment (200)', 'Mixed lengths for tidy cable runs and temporary securing of fixtures.', 'Electrical', NULL, NULL, 990, 60, TRUE),
    ('silicone-sealant', 'Neutral Silicone Sealant', 'Bathroom and kitchen sealing for joints, splashbacks, and fittings.', 'Consumables', 'SealPro', NULL, 1290, 45, TRUE),
    ('safety-gloves', 'Cut-Resistant Work Gloves', 'Pair of protective gloves sized for maintenance crews and DIY reporters.', 'Safety', 'GuardHand', NULL, 1590, 50, TRUE),
    ('toolbox-small', 'Compact Toolbox', 'Organiser case for bits, fasteners, and small hand tools on site visits.', 'Storage', 'FixFlow Basics', NULL, 4590, 12, TRUE);

INSERT IGNORE INTO sites (name, type, contract_status, address) VALUES
    ('CNU School', 'school', 'contracted', 'CNU main campus'),
    ('CNU Hostel', 'hostel', 'contracted', 'CNU student residence'),
    ('CNU Hotel', 'hotel', 'contracted', 'CNU hospitality building');

INSERT INTO subsites (site_id, label, name)
SELECT s.id, 'MAIN', 'Main building'
FROM sites s
WHERE s.name IN ('CNU School', 'CNU Hostel', 'CNU Hotel')
  AND NOT EXISTS (
      SELECT 1 FROM subsites ss
      WHERE ss.site_id = s.id AND ss.label = 'MAIN' AND ss.archived_at IS NULL
  );
