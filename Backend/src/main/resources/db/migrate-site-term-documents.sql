-- Apply on existing MySQL databases that already ran schema before site document columns.
-- Safe to re-run: skips columns that already exist.
--
-- Example:
--   mysql -u root -p fixflow < Backend/src/main/resources/db/migrate-site-term-documents.sql

USE fixflow;

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'terms_document_key'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN terms_document_key VARCHAR(512) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'terms_document_name'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN terms_document_name VARCHAR(255) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'contract_terms_document_key'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN contract_terms_document_key VARCHAR(512) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'contract_terms_document_name'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN contract_terms_document_name VARCHAR(255) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
