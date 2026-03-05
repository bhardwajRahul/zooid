-- Replace max_scope + allowed_channels with max_scopes on trusted_keys
ALTER TABLE trusted_keys ADD COLUMN max_scopes TEXT;

-- Migrate legacy max_scope values to max_scopes array format
-- For keys WITH allowed_channels, produce channel-scoped entries:
--   max_scope='publish', allowed_channels='["foo","bar"]' → '["pub:foo","sub:foo","pub:bar","sub:bar"]'
--   max_scope='subscribe', allowed_channels='["foo"]' → '["sub:foo"]'
-- For keys WITHOUT allowed_channels, produce wildcard entries:
--   admin → ["admin"], publish → ["pub:*","sub:*"], subscribe → ["sub:*"]

-- Step 1: Keys with allowed_channels and max_scope='publish'
-- Build scoped array from channel list using json_group_array + json_each
UPDATE trusted_keys
SET max_scopes = (
  SELECT json_group_array(scope) FROM (
    SELECT 'pub:' || j.value AS scope FROM json_each(allowed_channels) AS j
    UNION ALL
    SELECT 'sub:' || j.value AS scope FROM json_each(allowed_channels) AS j
  )
)
WHERE max_scope = 'publish'
  AND allowed_channels IS NOT NULL
  AND max_scopes IS NULL;

-- Step 2: Keys with allowed_channels and max_scope='subscribe'
UPDATE trusted_keys
SET max_scopes = (
  SELECT json_group_array('sub:' || j.value) FROM json_each(allowed_channels) AS j
)
WHERE max_scope = 'subscribe'
  AND allowed_channels IS NOT NULL
  AND max_scopes IS NULL;

-- Step 3: Keys without allowed_channels (wildcard)
UPDATE trusted_keys
SET max_scopes = CASE
  WHEN max_scope = 'admin' THEN '["admin"]'
  WHEN max_scope = 'publish' THEN '["pub:*","sub:*"]'
  WHEN max_scope = 'subscribe' THEN '["sub:*"]'
  ELSE NULL
END
WHERE max_scope IS NOT NULL
  AND allowed_channels IS NULL
  AND max_scopes IS NULL;
