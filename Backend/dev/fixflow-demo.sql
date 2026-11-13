-- FixFlow standalone MySQL dump for local demos / disposable containers.
-- Contains schema.sql + demo-data.sql verbatim.

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

-- FixFlow demo seed (development only).
-- Passwords for @fixflow.test accounts match their email (bcrypt).
-- Taxonomy/shop/CNU sites come from schema.sql; this file adds demo accounts and relationships.
-- Technician terms: version=2026-11-03 url=http://localhost:8080/agreements/technician/2026-11-03.html
-- Repeatable via WHERE NOT EXISTS / unique keys.

-- Site-scoped users: 5 reporters, 5 staff, 5 admins per site
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter@fixflow.test', '$2a$10$SzzrmRPglcZSEe18KIF1oOT8mQovYj8dGBZQcNuU1qgwdqUzOstmG', 'Reporter1', 'S1', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter2.site1@fixflow.test', '$2a$10$4X56mjmh7wxtlQJMCOn2peZrPuYopMCcZWoAM870dtx7CSpHZlubu', 'Reporter2', 'S1', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter2.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter3.site1@fixflow.test', '$2a$10$yR10lHF2tBVCc.k61DRtmO5VIFY22VKVqeDBugWASJZvQxDv2VLyq', 'Reporter3', 'S1', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter3.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter4.site1@fixflow.test', '$2a$10$Cj5sFZbEgj9dFaf2VFLpr.2pAVRs1fju7qOcE.yj9cpEcsQb9ce4W', 'Reporter4', 'S1', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter4.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter5.site1@fixflow.test', '$2a$10$w0TusSBKgNM5pNooJoFrdOPaNYycNTO9ZPgnIY9wH2w8catb9lJzu', 'Reporter5', 'S1', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter5.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff@fixflow.test', '$2a$10$H.7eF7WqHO3UbWENzKp99eWITbzeCLZJhHdnMFQJaHh8QqteOoHFO', 'Staff1', 'S1', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff2.site1@fixflow.test', '$2a$10$Ro3NiWVNJ7U9O9ZdyyheZu8eY5Y5rvfFrFheYjZB/ZV55P8G9rpIu', 'Staff2', 'S1', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff2.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff3.site1@fixflow.test', '$2a$10$IVsBkIqCU4Ig/qkjF1UnROMl9/6mQQHYJ.25xb0xjnNt.bkF8Niv6', 'Staff3', 'S1', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff3.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff4.site1@fixflow.test', '$2a$10$cLwvQ246xd/x.JKaeaLIlOS4Xo7rMwsr3fCNMDz98u1tR7OH6EaoC', 'Staff4', 'S1', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff4.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff5.site1@fixflow.test', '$2a$10$7dEZtehkODrk6lw.E5ZPf.Zy.xzesLR3fsaXqqYQVuFDiXGkuuOsK', 'Staff5', 'S1', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff5.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin@fixflow.test', '$2a$10$/1mUxY2L1C.e/y/QyeNFPeJY4MYJ7S1EhJtV48M/F8XQf7t2/6Pmu', 'Site1', 'S1', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin2.site1@fixflow.test', '$2a$10$HoeuESkMeoS63KYWcfp7YuudL.spm/3kVdUyEQmOU.7zKyWGArm76', 'Site2', 'S1', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin2.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin3.site1@fixflow.test', '$2a$10$ilMbVC0BHSM9JPGsfBa8Y.CqPTe4TwY/OZJdifvnP1co08Kqg4BoK', 'Site3', 'S1', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin3.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin4.site1@fixflow.test', '$2a$10$R2Eww33zeYunW9M1fD/9SOvCM7Jnn3urRQdQqKs5BtOq2VH67CDP2', 'Site4', 'S1', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin4.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin5.site1@fixflow.test', '$2a$10$5FLYdnLba5MMQ1fUFvcPkeVU0flckRlfl/qDpJIoXALnLnlbU3ENG', 'Site5', 'S1', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin5.site1@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter1.site2@fixflow.test', '$2a$10$81nr9uzkf6jmvE3gxe6jzekhF/.K57ySxECj4F1moDZWa0/qecCU.', 'Reporter1', 'S2', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter1.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter2.site2@fixflow.test', '$2a$10$w0agxK54T7BDi16oQ0U3FO5VnPrOw5jwI3OzlxhFKkBbRSy2esE0O', 'Reporter2', 'S2', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter2.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter3.site2@fixflow.test', '$2a$10$HZxPcw3NyynnjmegAGv8oOE0brsVnJS/CgfqXqWwJzPb//qKGD0ZG', 'Reporter3', 'S2', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter3.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter4.site2@fixflow.test', '$2a$10$patGaJlp192B0HRxWZtgNuSFSlxp2R5LQ.fEM99eLGxuPhQuxKNru', 'Reporter4', 'S2', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter4.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter5.site2@fixflow.test', '$2a$10$KV6m.mWsWofEC/J6CfaB8uqs1WqRYVXevU5LCX.tpvrASv5pN4HBa', 'Reporter5', 'S2', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter5.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff1.site2@fixflow.test', '$2a$10$nTxtgTYNwtKLvI/RvrDhEuOBLFuTg9eOmJpYnl6.o2WElh9lAucv6', 'Staff1', 'S2', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff2.site2@fixflow.test', '$2a$10$MpDpEpGOMllR3.rRZiKGveGPT99YDXVCq4.spypnB57eyP4bhecy2', 'Staff2', 'S2', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff2.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff3.site2@fixflow.test', '$2a$10$EV/SLI.NPS0/kyqDMTKr6egaEClXaQ4fg816LWjBp/qX/0e1dxnsq', 'Staff3', 'S2', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff3.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff4.site2@fixflow.test', '$2a$10$CwzCMwKWEaP2LOltou.qZeG8LWtFemilYu/JX1bBXMeyhFvCc1NHa', 'Staff4', 'S2', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff4.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff5.site2@fixflow.test', '$2a$10$w87dqO2bmEFbPasppabMeOzUlCH/rEup12m76q116eJ.50b0VG4zy', 'Staff5', 'S2', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff5.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin1.site2@fixflow.test', '$2a$10$KG6bdlIXiF2juHDZ2wJ3k.sW/Vd0EWj5JAaPeWHzLke8KTwXbH7Ky', 'Site1', 'S2', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin1.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin2.site2@fixflow.test', '$2a$10$apyq4YFRA.BYFYV8XsQfgeI4gjQxcoKmE/Va0jVERdv519gvvGkmi', 'Site2', 'S2', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin2.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin3.site2@fixflow.test', '$2a$10$SA9ek42H32NsU2j7E7IEPudClqxWGPlsniayImPdAE4fCwduuEMgG', 'Site3', 'S2', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin3.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin4.site2@fixflow.test', '$2a$10$y41FsWMwmXbHrZFwYPGLV.sP8XXNqdxMHrXVs/8CzsHQeR1nXXqvi', 'Site4', 'S2', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin4.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin5.site2@fixflow.test', '$2a$10$6OVva1w7leBJk4A/.18.i.gdHjkhmU9SZLRHsdQa4mRSR6CZYEc/i', 'Site5', 'S2', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin5.site2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter1.site3@fixflow.test', '$2a$10$GXH.rv008qT8FBWh3Cs4teAh73qZ0OC6pJw/sOA74gojAiS71JoXy', 'Reporter1', 'S3', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter1.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter2.site3@fixflow.test', '$2a$10$znvBb7rUaqCJTYP/zJ/j7ux3eT1VOOM1rFBgeFYcB28Ec9zIvP9g2', 'Reporter2', 'S3', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter2.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter3.site3@fixflow.test', '$2a$10$YgScrreb81ugOmLUgtHUIu3cJfXEUSojup7aAO8HJkjO1XpLhFUw2', 'Reporter3', 'S3', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter3.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter4.site3@fixflow.test', '$2a$10$lvS4d4njL.vksuemSEfaKeYFRa0K8BG4Z9JKiIF0EjBQreTBiQeO2', 'Reporter4', 'S3', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter4.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'reporter5.site3@fixflow.test', '$2a$10$iIJKDhQcNaRVHUQv6fg3I.abCF37xw8RbKCowE4FGwAYlAA/ErqIS', 'Reporter5', 'S3', '+15550000000', 'Demo address', 'reporter', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'reporter5.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff1.site3@fixflow.test', '$2a$10$n9ivJvAYgTFCBYlZ2AdjyeqfZQnU43FmmxyDebcRO2ECZ.9d.H3xi', 'Staff1', 'S3', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff2.site3@fixflow.test', '$2a$10$pPX9kU2NKjXrNZhg8p7s8OFvPXDDoeNBT1C5QjCSXENaOenaiJwY2', 'Staff2', 'S3', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff2.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff3.site3@fixflow.test', '$2a$10$AXSyir3L.emup1vpfRBXleqGoVN2qCGbhARU.89CfIMsRIHFiz21y', 'Staff3', 'S3', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff3.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff4.site3@fixflow.test', '$2a$10$Mk1SQfMWBkx9ssV6/I0efObBctcnly2SSPJAOD9VOIRfIEoAmDMQa', 'Staff4', 'S3', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff4.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'staff5.site3@fixflow.test', '$2a$10$nR4BAZg/77jwKjvJoUev9O2E80P8QdrNZFUuik75HnAChUiQNk3IS', 'Staff5', 'S3', '+15550000000', 'Demo address', 'staff', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff5.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin1.site3@fixflow.test', '$2a$10$/jZJbb4kwTaLoK6K3HFfy.L.QgupD7pQ11cnf.JFgM26ZauDEP3I.', 'Site1', 'S3', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin1.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin2.site3@fixflow.test', '$2a$10$UlDtDKoDgfnE0mM1ZeeeUOryYfJxJAPI65ETBogX.eR4E1M6lS.wC', 'Site2', 'S3', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin2.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin3.site3@fixflow.test', '$2a$10$tWvmMHOYmGMKcWRv6uSTCeKYg/smt3QVjQT.bnxDpJjjnsO5ZF4Ge', 'Site3', 'S3', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin3.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin4.site3@fixflow.test', '$2a$10$mcneokGxjrx0Mzjq5T9MsuxuEzmDH9KFcgfiQnGc9GKEkKcq.9zlO', 'Site4', 'S3', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin4.site3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'admin5.site3@fixflow.test', '$2a$10$1aye69QbgrjEcxRlQW8Fl.S/eHlcsqItRVMvKLXGMWKTE8jckTO0y', 'Site5', 'S3', '+15550000000', 'Demo address', 'admin', (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin5.site3@fixflow.test');

-- Technicians (users.site_id NULL) + contracts per site
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician@fixflow.test', '$2a$10$miZ2Qb1pmS6ntaFi7MRPH..ORCU3qU5CZKcmw.xyDmkauXYpYrn7m', 'Tech1', 'S1', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician2.site1@fixflow.test', '$2a$10$tRNSChTHA1xZ/XvxbYoKF.BnoErR1czSmNgDrWrk5HaSle/JqVUiq', 'Tech2', 'S1', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician2.site1@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician3.site1@fixflow.test', '$2a$10$Ps8KkAnOWZv94RtFp32/Q.weYaISzsxD0KABAoWmtOmNWY0WHTyMi', 'Tech3', 'S1', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician3.site1@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician4.site1@fixflow.test', '$2a$10$iZwwZsHjqz2cmbOXRA1h4O0aDVpXvi.EmCo4Ri0grgXr7UlKjdvsK', 'Tech4', 'S1', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician4.site1@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician5.site1@fixflow.test', '$2a$10$VQU5H8MuHHaNjnnk6dmG5eyMW/WTf5GJbO2xf68BeaCkxSNd3fBY6', 'Tech5', 'S1', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician5.site1@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician1.site2@fixflow.test', '$2a$10$NyGYpC1MaeGxSBCqm7sir.H4P/8JMtv3po2TXHMzCbRFUzbLD5WNW', 'Tech1', 'S2', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician1.site2@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician2.site2@fixflow.test', '$2a$10$nKYqr6ghxaJTJ1LNsIx4tue4KQ3bmPNtQ.lvA0QGyQwWLuMF/88dS', 'Tech2', 'S2', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician2.site2@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician3.site2@fixflow.test', '$2a$10$xVbDecXEE2Yiz3.cecp4Fejjem3iNicv1xW1gZYiWr0JhGjcN9uW.', 'Tech3', 'S2', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician3.site2@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician4.site2@fixflow.test', '$2a$10$sNx.RrMOe1XFz1Ph808WceRnXZgMzyBHdPEOpSK1nTBKeCmmsS9cS', 'Tech4', 'S2', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician4.site2@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician5.site2@fixflow.test', '$2a$10$bzUbRUp1VEwXomiZKO5A6O8EW8unyMkriATjKmJPWzwrr93QJ7kHO', 'Tech5', 'S2', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician5.site2@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician1.site3@fixflow.test', '$2a$10$RXLCMRRlALTC6wRFzqWMGeduS8yOmzNur.gvPWxcyfvtWCI9G9PP2', 'Tech1', 'S3', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician1.site3@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician2.site3@fixflow.test', '$2a$10$JaQ8cOunvRbSgBiA75y0AOtYPoRx1U.FQVwhiJVSu3JvMSQS5z7xu', 'Tech2', 'S3', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician2.site3@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician3.site3@fixflow.test', '$2a$10$NwYETanMhboEJp7ETUARZ.ocdV1t3s0Xm2O25yyunOxnQM38mCDne', 'Tech3', 'S3', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician3.site3@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician4.site3@fixflow.test', '$2a$10$l6Ws0C7Zi8ht1xSbGo5nJ.moZT8y5LqOvEWtxzGifp7OwhnJBdS.q', 'Tech4', 'S3', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician4.site3@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1));
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'technician5.site3@fixflow.test', '$2a$10$LWAtHQtCN5nHuKFBSpCoaeH1oUoqWfIkg0qysTS8PRAnFO1eLQzvS', 'Tech5', 'S3', '+15550000000', 'Demo address', 'technician', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'technician5.site3@fixflow.test');
INSERT INTO technician_contracts (technician_id, site_id, created_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_contracts tc WHERE tc.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test') AND tc.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1));

-- Global super_admins and shop_managers (site_id NULL)
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'superadmin@fixflow.test', '$2a$10$v28SeYERFn5/VPLQxhfokuHwo1UW3u/qnZ7jbve2EJRjllBqCss82', 'Super1', 'Admin', '+15550000000', 'Demo address', 'super_admin', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'shopmanager@fixflow.test', '$2a$10$joB4qyZrLv2/5ttKpn1LSuX5oNSsYU7M.f/BFWByGA2QY9BR6ssUK', 'Shop1', 'Manager', '+15550000000', 'Demo address', 'shop_manager', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'shopmanager@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'superadmin2@fixflow.test', '$2a$10$LDD9l8rH3upTmqi48.s3u.4DV5jUHPC.yPYqKH8ZYUWJ1Z2aT/K7G', 'Super2', 'Admin', '+15550000000', 'Demo address', 'super_admin', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'shopmanager2@fixflow.test', '$2a$10$BY/MaTQ8mE86yjngH1/5pue4GBTEmy18Yu1J0/cbDEhKY387ITNT2', 'Shop2', 'Manager', '+15550000000', 'Demo address', 'shop_manager', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'shopmanager2@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'superadmin3@fixflow.test', '$2a$10$7v3PrCz7g7745EWOd3YsueBfUtHp7uTjLHQS6BgTeX12ep4CpfeB6', 'Super3', 'Admin', '+15550000000', 'Demo address', 'super_admin', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'shopmanager3@fixflow.test', '$2a$10$5qibc4iHClVjyKI7UwkGzO30NTVx2ZknKDeT1QAxDg8LLIzkJqS0S', 'Shop3', 'Manager', '+15550000000', 'Demo address', 'shop_manager', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'shopmanager3@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'superadmin4@fixflow.test', '$2a$10$Gxv3CjneaILA1pYGTa54I.BA0ZnyMvL7.pTXefaIz.TNtifAjEfJq', 'Super4', 'Admin', '+15550000000', 'Demo address', 'super_admin', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin4@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'shopmanager4@fixflow.test', '$2a$10$6pSMJ.YoQK5kjLQfjjRxf.IFEEggq0y67SBcG1VOW8oR1fTnqeN8i', 'Shop4', 'Manager', '+15550000000', 'Demo address', 'shop_manager', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'shopmanager4@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'superadmin5@fixflow.test', '$2a$10$hZu5GOu5B.dR.qy2u61QKej/nzp5atabYfIevPFCuLqieJjN86lGu', 'Super5', 'Admin', '+15550000000', 'Demo address', 'super_admin', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin5@fixflow.test');
INSERT INTO users (email, password_hash, first_name, last_name, phone, address, role, site_id, created_at, updated_at) SELECT 'shopmanager5@fixflow.test', '$2a$10$aUqAkqIw0z3lU3623oXmceAyrQCaFbQmY10UHBpnwyByAUicVC4Nu', 'Shop5', 'Manager', '+15550000000', 'Demo address', 'shop_manager', NULL, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'shopmanager5@fixflow.test');

-- Technician platform verifications (verified + all checks)
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'verified', '+155511100011', 'technician@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), 'verified', '+155511100012', 'technician2.site1@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), 'verified', '+155511100013', 'technician3.site1@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), 'verified', '+155511100014', 'technician4.site1@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), 'verified', '+155511100015', 'technician5.site1@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), 'verified', '+155511100021', 'technician1.site2@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), 'verified', '+155511100022', 'technician2.site2@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), 'verified', '+155511100023', 'technician3.site2@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), 'verified', '+155511100024', 'technician4.site2@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), 'verified', '+155511100025', 'technician5.site2@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), 'verified', '+155511100031', 'technician1.site3@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), 'verified', '+155511100032', 'technician2.site3@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), 'verified', '+155511100033', 'technician3.site3@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), 'verified', '+155511100034', 'technician4.site3@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'));
INSERT INTO technician_verifications (technician_id, status, phone, email, trades, experience, qualifications, identity_checked, email_checked, phone_checked, trade_checked, reason, reviewed_by, updated_at, version) SELECT (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), 'verified', '+155511100035', 'technician5.site3@fixflow.test', 'plumbing,electrical,hvac', '5 years demo experience', 'Demo trade certificate', TRUE, TRUE, TRUE, TRUE, NULL, (SELECT id FROM users WHERE email = 'superadmin@fixflow.test'), '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM technician_verifications tv WHERE tv.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'));

-- Technician terms acceptances
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test') AND t.terms_version = '2026-11-03');
INSERT INTO technician_terms_acceptances (technician_id, terms_version, document_url, accepted_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), '2026-11-03', 'http://localhost:8080/agreements/technician/2026-11-03.html', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_terms_acceptances t WHERE t.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test') AND t.terms_version = '2026-11-03');

-- Site vetting approved for each contracted technician
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site3@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site3@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site3@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site3@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test') AND v.status = 'approved');
INSERT INTO site_technician_vetting (site_id, technician_id, status, reviewed_by, reviewed_at, expires_at, identity_checked, references_checked, qualifications_checked, licence_applicable, licence_checked, licence_expires_at, insurance_applicable, insurance_checked, insurance_expires_at) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), 'approved', (SELECT id FROM users WHERE email = 'admin1.site3@fixflow.test'), '2026-01-15 10:00:00.000000', '2037-12-31 23:59:59.000000', TRUE, TRUE, TRUE, FALSE, FALSE, NULL, FALSE, FALSE, NULL WHERE NOT EXISTS (SELECT 1 FROM site_technician_vetting v WHERE v.site_id = (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1) AND v.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test') AND v.status = 'approved');

-- Technician skills
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), 'electrical', 'outlets', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test') AND sk.category = 'electrical' AND sk.specialty = 'outlets');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), 'hvac', 'filters', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test') AND sk.category = 'hvac' AND sk.specialty = 'filters');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), 'general', NULL, 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test') AND sk.category = 'general' AND sk.specialty IS NULL);
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), 'electrical', 'outlets', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test') AND sk.category = 'electrical' AND sk.specialty = 'outlets');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), 'hvac', 'filters', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test') AND sk.category = 'hvac' AND sk.specialty = 'filters');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), 'general', NULL, 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test') AND sk.category = 'general' AND sk.specialty IS NULL);
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), 'electrical', 'outlets', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test') AND sk.category = 'electrical' AND sk.specialty = 'outlets');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), 'hvac', 'filters', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test') AND sk.category = 'hvac' AND sk.specialty = 'filters');
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), 'general', NULL, 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test') AND sk.category = 'general' AND sk.specialty IS NULL);
INSERT INTO technician_skills (technician_id, category, specialty, proficiency) SELECT (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), 'plumbing', 'leaks', 4 WHERE NOT EXISTS (SELECT 1 FROM technician_skills sk WHERE sk.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test') AND sk.category = 'plumbing' AND sk.specialty = 'leaks');

-- Technician availability = available
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician5.site1@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician3.site2@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician4.site2@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician5.site2@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician2.site3@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician3.site3@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician4.site3@fixflow.test'));
INSERT INTO technician_availability (technician_id, status, updated_at) SELECT (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'), 'available', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = (SELECT id FROM users WHERE email = 'technician5.site3@fixflow.test'));

-- Sample reports across statuses (stable description markers)
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), '[demo-seed] school-open-1', 'Demo School floor 1', 'plumbing', 'leaks', 'medium', 'medium', 'medium', 1, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-open-1');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), '[demo-seed] school-multi-join', 'Demo School floor 1', 'electrical', 'outlets', 'low', 'low', 'medium', 3, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-multi-join');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'), '[demo-seed] school-routed', 'Demo School floor 1', 'hvac', 'filters', 'medium', 'medium', 'medium', 1, 'Demo seed reason', NULL, 'routed', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-routed');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'), '[demo-seed] school-assigned', 'Demo School floor 1', 'carpentry', 'doors', 'high', 'high', 'high', 1, 'Demo seed reason', NULL, 'assigned', (SELECT id FROM users WHERE email = 'technician@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-assigned');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), '[demo-seed] school-in-progress', 'Demo School floor 1', 'plumbing', 'drains', 'high', 'high', 'high', 1, 'Demo seed reason', NULL, 'in_progress', (SELECT id FROM users WHERE email = 'technician@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-in-progress');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), '[demo-seed] school-resolved', 'Demo School floor 1', 'cleaning', NULL, 'low', 'low', 'low', 1, 'Demo seed reason', NULL, 'resolved_pending_confirmation', (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-resolved');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter4.site1@fixflow.test'), '[demo-seed] school-confirmed', 'Demo School floor 1', 'general', NULL, 'low', 'low', 'low', 1, 'Demo seed reason', NULL, 'confirmed', (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-confirmed');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU School' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU School' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter5.site1@fixflow.test'), '[demo-seed] school-marketplace', 'Demo School floor 1', 'electrical', 'lighting', 'medium', 'medium', 'medium', 1, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] school-marketplace');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hostel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site2@fixflow.test'), '[demo-seed] hostel-open', 'Demo Hostel floor 1', 'plumbing', 'leaks', 'medium', 'medium', 'medium', 1, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hostel-open');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hostel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site2@fixflow.test'), '[demo-seed] hostel-escalated', 'Demo Hostel floor 1', 'electrical', 'panels', 'critical', 'critical', 'critical', 2, 'Demo seed reason', NULL, 'escalated', (SELECT id FROM users WHERE email = 'technician1.site2@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hostel-escalated');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hostel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hostel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site2@fixflow.test'), '[demo-seed] hostel-reopened', 'Demo Hostel floor 1', 'hvac', 'noise', 'high', 'high', 'high', 1, 'Demo seed reason', NULL, 'reopened', (SELECT id FROM users WHERE email = 'technician2.site2@fixflow.test'), TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hostel-reopened');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hotel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'), '[demo-seed] hotel-open', 'Demo Hotel floor 1', 'cleaning', NULL, 'low', 'low', 'low', 1, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'private', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hotel-open');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hotel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site3@fixflow.test'), '[demo-seed] hotel-assigned', 'Demo Hotel floor 1', 'carpentry', 'furniture', 'medium', 'medium', 'medium', 1, 'Demo seed reason', NULL, 'assigned', (SELECT id FROM users WHERE email = 'technician1.site3@fixflow.test'), FALSE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hotel-assigned');
INSERT INTO reports (site_id, subsite_id, created_by_user_id, description, address, category, specialty, ai_urgency, reporter_urgency, calculated_urgency, participation_count, reporter_reason, final_urgency, status, assigned_technician_id, editable, visibility, created_at, updated_at, reopen_count) SELECT (SELECT id FROM sites WHERE name = 'CNU Hotel' ORDER BY id LIMIT 1), (SELECT ss.id FROM subsites ss JOIN sites s ON s.id = ss.site_id WHERE s.name = 'CNU Hotel' AND ss.label = 'MAIN' AND ss.archived_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'), '[demo-seed] hotel-multi-join', 'Demo Hotel floor 1', 'general', NULL, 'low', 'low', 'medium', 4, 'Demo seed reason', NULL, 'open', NULL, TRUE, 'public', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000', 0 WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.description = '[demo-seed] hotel-multi-join');

-- report_reporters (creators + multi-joiners for urgency tests)
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-open-1' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-open-1' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-routed' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-routed' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-assigned' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-assigned' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-in-progress' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-in-progress' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-confirmed' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter4.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-confirmed' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter4.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter5.site1@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter5.site1@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-open' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site2@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-open' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter1.site2@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site2@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter1.site2@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site2@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site2@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-reopened' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site2@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-reopened' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter3.site2@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-open' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-open' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-assigned' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-assigned' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site3@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter1.site3@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter2.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter2.site3@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter3.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter3.site3@fixflow.test'));
INSERT INTO report_reporters (report_id, user_id, joined_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1), (SELECT id FROM users WHERE email = 'reporter4.site3@fixflow.test'), '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_reporters rr WHERE rr.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hotel-multi-join' LIMIT 1) AND rr.user_id = (SELECT id FROM users WHERE email = 'reporter4.site3@fixflow.test'));

-- status_history samples
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-assigned' LIMIT 1), NULL, 'assigned', (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'Assigned in demo seed', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-assigned' LIMIT 1) AND sh.to_status = 'assigned' AND sh.note = 'Assigned in demo seed');
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-in-progress' LIMIT 1), 'assigned', 'in_progress', (SELECT id FROM users WHERE email = 'technician@fixflow.test'), 'Work started', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-in-progress' LIMIT 1) AND sh.to_status = 'in_progress' AND sh.note = 'Work started');
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1), 'in_progress', 'resolved_pending_confirmation', (SELECT id FROM users WHERE email = 'technician2.site1@fixflow.test'), 'Awaiting confirmation', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1) AND sh.to_status = 'resolved_pending_confirmation' AND sh.note = 'Awaiting confirmation');
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-confirmed' LIMIT 1), 'resolved_pending_confirmation', 'confirmed', (SELECT id FROM users WHERE email = 'reporter4.site1@fixflow.test'), 'Confirmed by reporter', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-confirmed' LIMIT 1) AND sh.to_status = 'confirmed' AND sh.note = 'Confirmed by reporter');
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1), 'assigned', 'escalated', (SELECT id FROM users WHERE email = 'admin1.site2@fixflow.test'), 'Escalated for safety', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-escalated' LIMIT 1) AND sh.to_status = 'escalated' AND sh.note = 'Escalated for safety');
INSERT INTO status_history (report_id, from_status, to_status, changed_by_user_id, note, created_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] hostel-reopened' LIMIT 1), 'confirmed', 'reopened', (SELECT id FROM users WHERE email = 'reporter3.site2@fixflow.test'), 'Issue returned', '2026-01-16 11:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] hostel-reopened' LIMIT 1) AND sh.to_status = 'reopened' AND sh.note = 'Issue returned');

-- Marketplace listing + applications
INSERT INTO marketplace_listings (report_id, summary, broad_location, timing, category, specialty, status, expires_at) SELECT (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1), 'Demo marketplace lighting job', 'Demo School campus', 'Within 48 hours', 'electrical', 'lighting', 'open', '2037-12-31 23:59:59.000000' WHERE NOT EXISTS (SELECT 1 FROM marketplace_listings ml WHERE ml.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1));
INSERT INTO marketplace_applications (listing_id, technician_id, note, status, offer_expires_at) SELECT (SELECT id FROM marketplace_listings WHERE report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1) LIMIT 1), (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'), 'I can handle lighting swaps tomorrow morning.', 'pending', NULL WHERE NOT EXISTS (SELECT 1 FROM marketplace_applications ma WHERE ma.listing_id = (SELECT id FROM marketplace_listings WHERE report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1) LIMIT 1) AND ma.technician_id = (SELECT id FROM users WHERE email = 'technician3.site1@fixflow.test'));
INSERT INTO marketplace_applications (listing_id, technician_id, note, status, offer_expires_at) SELECT (SELECT id FROM marketplace_listings WHERE report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1) LIMIT 1), (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'), 'Available this week for electrical work.', 'pending', NULL WHERE NOT EXISTS (SELECT 1 FROM marketplace_applications ma WHERE ma.listing_id = (SELECT id FROM marketplace_listings WHERE report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-marketplace' LIMIT 1) LIMIT 1) AND ma.technician_id = (SELECT id FROM users WHERE email = 'technician4.site1@fixflow.test'));

-- Report notifications
INSERT INTO report_notifications (recipient_id, report_id, type, created_at) SELECT (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test'), (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1), 'work_completed', '2026-01-17 12:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM report_notifications rn WHERE rn.recipient_id = (SELECT id FROM users WHERE email = 'reporter3.site1@fixflow.test') AND rn.report_id = (SELECT id FROM reports WHERE description = '[demo-seed] school-resolved' LIMIT 1) AND rn.type = 'work_completed');

-- One paid shop order with items + payment (shop manager fulfillment demo)
INSERT INTO shop_orders (public_id, user_id, status, currency, minor_unit_digits, subtotal_minor, shipping_minor, tax_minor, total_minor, shipping_name, shipping_phone, shipping_address, idempotency_key, fulfillment_status, created_at, updated_at) SELECT '11111111-2222-4333-8444-555555555501', (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), 'paid', 'CNY', 2, 5670, 500, 0, 6170, 'Reporter User', '+15550000000', 'Demo School receiving desk', 'demo-seed-order-1', 'ordered', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM shop_orders o WHERE o.public_id = '11111111-2222-4333-8444-555555555501');
INSERT INTO shop_order_items (order_id, product_id, name, unit_price_minor, quantity) SELECT (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501'), 'safety-gloves', 'Cut-Resistant Work Gloves', 1590, 2 WHERE NOT EXISTS (SELECT 1 FROM shop_order_items i WHERE i.order_id = (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501') AND i.product_id = 'safety-gloves');
INSERT INTO shop_order_items (order_id, product_id, name, unit_price_minor, quantity) SELECT (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501'), 'multi-bit-set', '40-Piece Bit Set', 2490, 1 WHERE NOT EXISTS (SELECT 1 FROM shop_order_items i WHERE i.order_id = (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501') AND i.product_id = 'multi-bit-set');
INSERT INTO shop_payments (order_id, provider, provider_ref, status, checkout_url, raw_event, created_at, updated_at) SELECT (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501'), 'dev', 'demo-pay-1', 'succeeded', NULL, '{"demo":true}', '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM shop_payments p WHERE p.order_id = (SELECT id FROM shop_orders WHERE public_id = '11111111-2222-4333-8444-555555555501'));
INSERT INTO shop_notifications (recipient_id, order_id, type, created_at) SELECT (SELECT id FROM users WHERE email = 'reporter@fixflow.test'), '11111111-2222-4333-8444-555555555501', 'order_placed', '2026-01-15 10:00:00.000000' WHERE NOT EXISTS (SELECT 1 FROM shop_notifications n WHERE n.recipient_id = (SELECT id FROM users WHERE email = 'reporter@fixflow.test') AND n.order_id = '11111111-2222-4333-8444-555555555501' AND n.type = 'order_placed');
