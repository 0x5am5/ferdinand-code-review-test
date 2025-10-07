-- Run this on your remote database to check what's there

-- Check the new file assets system (assets table)
SELECT id, client_id, file_name, original_file_name, created_at, deleted_at
FROM assets
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check the old brand assets system (brand_assets table)
SELECT id, client_id, name, category, created_at
FROM brand_assets
ORDER BY created_at DESC
LIMIT 10;

-- Count records in each table
SELECT
  (SELECT COUNT(*) FROM assets WHERE deleted_at IS NULL) as file_assets_count,
  (SELECT COUNT(*) FROM brand_assets) as brand_assets_count;
