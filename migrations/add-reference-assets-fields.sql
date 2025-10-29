-- Add reference-only asset fields to assets table
-- Migration: add_reference_assets_fields
-- Description: Add externalUrl and referenceOnly fields to support Google Workspace reference assets

-- Add external_url field for storing webViewLink for Google Drive files
ALTER TABLE assets ADD COLUMN external_url TEXT;

-- Add reference_only flag to mark reference-only assets
ALTER TABLE assets ADD COLUMN reference_only BOOLEAN DEFAULT FALSE;

-- Add index for external_url to improve query performance for reference assets
CREATE INDEX idx_assets_external_url ON assets(external_url);

-- Add index for reference_only to improve query performance
CREATE INDEX idx_assets_reference_only ON assets(reference_only);

-- Add comment to document the new fields
COMMENT ON COLUMN assets.external_url IS 'External URL (webViewLink) for reference-only assets like Google Workspace files';
COMMENT ON COLUMN assets.reference_only IS 'Flag indicating if asset is reference-only (no local file storage)';