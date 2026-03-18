-- Add meta column to channels table
ALTER TABLE channels ADD COLUMN meta TEXT;

-- Move display from config JSON to meta JSON for any existing channels
UPDATE channels
SET meta = json_object('display', json_extract(config, '$.display')),
    config = json_remove(config, '$.display')
WHERE config IS NOT NULL AND json_extract(config, '$.display') IS NOT NULL;
