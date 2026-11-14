-- Apply on existing MySQL databases that already ran schema.sql before contract flat fees.
-- Safe to re-run: skips columns that already exist.

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'contract_flat_fee_minor'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN contract_flat_fee_minor BIGINT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'contract_fee_currency'),
    'SELECT 1',
    'ALTER TABLE sites ADD COLUMN contract_fee_currency VARCHAR(8) NOT NULL DEFAULT ''USD'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'technician_contracts' AND COLUMN_NAME = 'flat_fee_minor'),
    'SELECT 1',
    'ALTER TABLE technician_contracts ADD COLUMN flat_fee_minor BIGINT NOT NULL DEFAULT 0'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'technician_contracts' AND COLUMN_NAME = 'fee_currency'),
    'SELECT 1',
    'ALTER TABLE technician_contracts ADD COLUMN fee_currency VARCHAR(8) NOT NULL DEFAULT ''USD'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE sites
SET contract_flat_fee_minor = COALESCE(contract_flat_fee_minor, 50000),
    contract_fee_currency = COALESCE(NULLIF(TRIM(contract_fee_currency), ''), 'USD')
WHERE name IN ('CNU School', 'CNU Hostel', 'CNU Hotel');
