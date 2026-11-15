-- Apply on existing MySQL databases that already ran schema.sql before proposed_timing.
-- Safe to re-run: skips the column when it already exists.

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'marketplace_applications' AND COLUMN_NAME = 'proposed_timing'),
    'SELECT 1',
    'ALTER TABLE marketplace_applications ADD COLUMN proposed_timing VARCHAR(160) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
