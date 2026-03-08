-- Move strict column into config JSON as strict_types
-- For channels with strict=1 and existing config, merge strict_types into config
UPDATE channels
SET config = json_set(COALESCE(config, '{}'), '$.strict_types', json('true'))
WHERE strict = 1;

-- SQLite does not support DROP COLUMN on older versions,
-- but D1 uses a recent SQLite that does.
ALTER TABLE channels DROP COLUMN strict;
