# Asset Systems Architecture

This document explains the two complementary asset systems in Ferdinand and when to use each one.

## Overview

Ferdinand has two distinct asset management systems that serve different purposes:

1. **Brand Assets** - Design system elements stored in the database
2. **File Assets** - General file storage with external backends

These systems are **complementary**, not competing. Each is optimized for its specific use case.

---

## Brand Assets System

**Route Module:** `/server/routes/brand-assets.ts`

**Database Tables:** `brand_assets`, `converted_assets`

**Storage:** PostgreSQL database (base64 encoded)

### Purpose
Manage design system elements that are core to a client's brand and design guidelines.

### Supported Asset Types

#### Logos
- Multiple logo types: main, square, favicon, vertical, horizontal, app_icon
- Light and dark variants support
- Automatic format conversion (PNG, SVG, PDF, JPG, AI, EPS)
- Stored with metadata about dimensions, type, and variants

#### Fonts
- Google Fonts integration (cloud-hosted)
- Adobe Fonts integration (via Typekit API)
- Custom font file uploads (WOFF, WOFF2, OTF, TTF, EOT)
- Font weight and style metadata

#### Colors
- Brand color palette
- Color metadata (name, hex, RGB, HSL)
- Supports tints and shades generation

#### Typography
- Font size scales
- Line height rules
- Letter spacing specifications

### Key Features

**Format Conversion**
- Automatic conversion of logos to multiple formats on upload
- SVG → PNG, PDF, JPG at various sizes
- Dark variant support for each format

**Database Storage**
- All assets stored as base64 in PostgreSQL
- Fast retrieval for frequently-accessed items
- Atomic operations for data consistency

**Metadata & Versioning**
- Logo type classification
- Dark variant tracking
- File format metadata
- Conversion history

### API Endpoints

**Create brand asset:**
```
POST /api/clients/:clientId/brand-assets
```

**List client brand assets:**
```
GET /api/clients/:clientId/brand-assets
```

**Get single brand asset:**
```
GET /api/brand-assets/:id
```

**Update brand asset:**
```
PATCH /api/clients/:clientId/brand-assets/:assetId
```

**Delete brand asset:**
```
DELETE /api/clients/:clientId/brand-assets/:assetId
```

**Serve brand asset:**
```
GET /api/assets/:assetId/file?format=png&variant=dark
GET /api/assets/:assetId/light
GET /api/assets/:assetId/dark
```

### Permission Model

Brand asset permissions follow the standard role hierarchy:
- **GUEST:** Read-only (shared assets only)
- **STANDARD:** Create, read, update own assets
- **EDITOR:** Full asset management
- **ADMIN:** Full asset management + client-scoped
- **SUPER_ADMIN:** Full system-wide access

### Use Cases

✅ **Use Brand Assets for:**
- Company logos and their variations
- Brand-approved fonts and typography scales
- Official brand color palettes
- Design tokens and guidelines
- Assets that need format conversion and variant management
- Frequently-accessed design elements
- Assets that are core to client branding

❌ **Don't use Brand Assets for:**
- User-uploaded documents (use File Assets)
- Large binary files (use File Assets)
- Assets needing search/tagging (use File Assets)
- Assets requiring public sharing links (use File Assets)

---

## File Assets System

**Route Module:** `/server/routes/file-assets.ts`, `/server/routes/file-asset-categories.ts`, `/server/routes/file-asset-tags.ts`

**Database Tables:** `assets`, `asset_categories`, `asset_tags`, `asset_category_assignments`, `asset_tag_assignments`, `asset_public_links`

**Storage:** External backends (S3, local filesystem, Google Drive)

### Purpose
General-purpose file storage and sharing system for any file type.

### Supported Asset Types

- Documents (PDF, Word, Excel, etc.)
- Images (PNG, JPG, GIF, SVG, WebP, etc.)
- Videos (MP4, WebM, etc.)
- Audio files (MP3, WAV, etc.)
- Archives (ZIP, RAR, etc.)
- Any file type up to size limits

### Key Features

**Full-Text Search**
- PostgreSQL full-text search on filenames and metadata
- Ranking and relevance scoring
- Fast search across thousands of assets

**Organization**
- Client-scoped categories (e.g., "Marketing", "Legal")
- Multi-tag support (e.g., "Q4", "2024", "approved")
- Hierarchical category structure

**Sharing & Collaboration**
- Public share links with optional expiration
- Token-based access without authentication
- Link-specific permissions and visibility control

**Google Drive Integration**
- Reference external Google Drive files without storing locally
- Synced metadata and thumbnails
- Reduces storage overhead

**Thumbnails**
- Automatic thumbnail generation for images
- Cached for performance
- File type icons for non-image files

**Bulk Operations**
- Bulk upload multiple files
- Bulk tagging and categorization
- Bulk delete with soft delete support

**Visibility Controls**
- Private vs. shared assets
- Role-based filtering
- Guest users see only shared assets

### API Endpoints

**List assets:**
```
GET /api/assets
GET /api/assets/search?q=query
```

**Get single asset:**
```
GET /api/assets/:assetId
```

**Upload asset:**
```
POST /api/assets (multipart/form-data)
```

**Update asset metadata:**
```
PATCH /api/assets/:assetId
```

**Delete asset (soft delete):**
```
DELETE /api/assets/:assetId
```

**Download asset:**
```
GET /api/assets/:assetId/download
```

**Get thumbnail:**
```
GET /api/assets/:assetId/thumbnail/:size
```

**Create public share link:**
```
POST /api/clients/:clientId/assets/:assetId/share
```

### Permission Model

File asset permissions use the permission service:
- **GUEST:** Read shared assets only
- **STANDARD:** Create, read, update/delete own assets
- **EDITOR:** Full asset management + sharing
- **ADMIN:** Full asset management + client-scoped
- **SUPER_ADMIN:** Full system-wide access

### Use Cases

✅ **Use File Assets for:**
- User-uploaded documents
- Marketing materials and collateral
- Project files and deliverables
- Team collaboration documents
- Assets needing search/discovery
- Assets with public sharing requirements
- Assets with expiring links or temporary access
- Google Drive linked files
- Large files (up to size limits)

❌ **Don't use File Assets for:**
- Brand logos (use Brand Assets)
- Design system tokens (use Brand Assets)
- Font definitions (use Brand Assets)
- Assets needing automatic format conversion (use Brand Assets)
- Small, frequently-accessed design elements (use Brand Assets)

---

## Comparison Matrix

| Feature | Brand Assets | File Assets |
|---------|--------------|------------|
| **Storage Backend** | PostgreSQL (base64) | S3/Filesystem/Google Drive |
| **File Size Limit** | 5MB (recommended) | 500MB+ |
| **Format Conversion** | ✅ Automatic (SVG→PNG, etc.) | ❌ No |
| **Search** | ❌ No | ✅ Full-text |
| **Categories** | ❌ No | ✅ Yes |
| **Tags** | ❌ No | ✅ Yes |
| **Public Sharing** | ❌ No | ✅ With expiration |
| **Thumbnails** | ⚠️ Manual | ✅ Auto-generated |
| **Dark Variants** | ✅ Yes | ❌ No |
| **Google Drive Integration** | ❌ No | ✅ Yes |
| **Soft Delete** | ❌ Hard delete | ✅ Yes |
| **Bulk Operations** | ❌ No | ✅ Yes |
| **Access Speed** | 🚀 Fast (in-DB) | ⚡ Moderate (external) |
| **Best For** | Design system | General storage |

---

## API Route Organization

### Brand Assets Routes
```
/api/brand-assets/                          - List all global brand assets
/api/brand-assets/:id                       - Get single brand asset
/api/clients/:clientId/brand-assets         - List client brand assets
/api/clients/:clientId/brand-assets         - Create brand asset
/api/clients/:clientId/brand-assets/:id     - Update brand asset
/api/clients/:clientId/brand-assets/:id     - Delete brand asset
/api/assets/:assetId/file                   - Serve file with format conversion
/api/assets/:assetId/light                  - Serve light variant
/api/assets/:assetId/dark                   - Serve dark variant
/api/assets/:assetId/thumbnail/:size        - Get thumbnail
/api/assets/:assetId/converted              - List converted formats
```

### File Assets Routes
```
/api/assets                                 - List all file assets (user's)
/api/assets/search                          - Full-text search
/api/assets/:assetId                        - Get single file asset
/api/assets/:assetId                        - Update file asset metadata
/api/assets/:assetId                        - Delete file asset (soft)
/api/assets/:assetId/download               - Download file
/api/assets/:assetId/thumbnail/:size        - Get thumbnail
/api/clients/:clientId/assets/:assetId/share - Create public share link
/api/clients/:clientId/categories           - Manage categories
/api/clients/:clientId/tags                 - Manage tags
```

---

## Migration Guide

### Migrating FROM Brand Assets TO File Assets

If you have a file that should be in File Assets instead:

1. Download the file from the brand asset endpoint
2. Upload via the File Assets endpoint
3. Add appropriate categories and tags
4. Update any links to use the new File Assets endpoint
5. Delete the old brand asset

### Migrating FROM File Assets TO Brand Assets

If you have a file that should be in Brand Assets instead:

1. Download the file from the File Assets endpoint
2. Upload via the Brand Assets endpoint (for logos, use POST with type)
3. Wait for automatic format conversion to complete
4. Update any links to use the new Brand Assets endpoint
5. Delete the old file asset

---

## Performance Considerations

### Brand Assets
- **Pros:** Database lookups are O(1) and very fast
- **Cons:** Stored in database, larger database size
- **Best for:** High-frequency access, small files, design elements

### File Assets
- **Pros:** Offloaded to external storage, unlimited size
- **Cons:** Network round-trip to storage backend
- **Best for:** Infrequent access, large files, documents

---

## Implementation Notes

### Shared Code

Both systems share:
- Permission service (`server/services/asset-permissions.ts`)
- Authentication middleware
- Error handling patterns

### Future Consolidation

While these systems are kept separate, there are opportunities for consolidation:
- Unified search across both systems
- Common tagging system for brand assets
- Format conversion for file assets
- Version history for brand assets

---

## Troubleshooting

**Q: I uploaded a logo to File Assets, why doesn't it have format conversion?**
A: Format conversion is only available in Brand Assets. Re-upload to the Brand Assets system.

**Q: Why can't I search brand assets?**
A: Brand Assets don't have full-text search. Use the list endpoint and filter client-side, or switch to File Assets if you need search capabilities.

**Q: Can I share a brand asset publicly?**
A: No, public sharing is only available in File Assets. Serve brand assets via authenticated endpoints or embed in design system documentation.

**Q: Which system should I use for company documents?**
A: Use File Assets. Brand Assets are specifically for design system elements.

**Q: Can I have dark variants in File Assets?**
A: Not automatically. If you need dark variants, consider using Brand Assets for those files.

---

## See Also

- `ROUTE_PERMISSIONS.md` - Detailed permission matrix for all routes
- `/server/routes/brand-assets.ts` - Brand Assets implementation
- `/server/routes/file-assets.ts` - File Assets implementation
- `/server/services/asset-permissions.ts` - Permission service
