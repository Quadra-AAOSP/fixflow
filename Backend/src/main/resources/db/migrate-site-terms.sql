-- Apply on existing MySQL databases that already ran schema.sql before site terms/contracts text.
-- Safe to re-run: skips columns that already exist.

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'terms_text'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN terms_text TEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'contract_terms_text'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN contract_terms_text TEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
