# File Asset System Implementation Plan

## Overview
This plan outlines the phased implementation of Ferdinand's file asset management system. Google Drive integration is deferred to a later phase, focusing on core upload, organization, and discovery features for MVP.

---

## ✅ Phase 1: Database Schema & Backend Foundation [COMPLETED]

**Completed:** 2025-10-06
**Status:** All deliverables completed and database migration successful

### 1.1 Database Schema
**File:** `shared/schema.ts`

Create the following tables:

```typescript
// assets table
- id (uuid)
- clientId (references clients)
- uploadedBy (references users)
- fileName (text)
- originalFileName (text)
- fileType (text) // MIME type
- fileSize (integer) // bytes
- storagePath (text) // S3 or local path
- visibility (enum: 'private', 'shared')
- createdAt (timestamp)
- updatedAt (timestamp)
- deletedAt (timestamp, nullable) // soft delete

// asset_categories table
- id (uuid)
- name (text) // Documents, Spreadsheets, Slide Decks, Design Assets, Photography
- slug (text)
- isDefault (boolean)
- clientId (references clients, nullable) // null for system defaults

// asset_tags table
- id (uuid)
- name (text)
- slug (text)
- clientId (references clients)
- createdAt (timestamp)

// asset_category_assignments table
- assetId (references assets)
- categoryId (references asset_categories)
- primary key (assetId, categoryId)

// asset_tag_assignments table
- assetId (references assets)
- tagId (references asset_tags)
- primary key (assetId, tagId)
```

**Deliverables:**
- ✅ Schema definitions with Drizzle ORM
- ✅ Zod validation schemas for insert/update operations
- ✅ TypeScript types exported from schema
- ✅ Database migration via `npm run db:push`

**Implementation Notes:**
- Used `serial` for IDs instead of UUID for consistency with existing tables
- Added comprehensive indexes on foreign keys and commonly queried fields (clientId, uploadedBy, visibility, deletedAt)
- Soft delete implemented via `deletedAt` timestamp column
- All tables include proper foreign key relationships and cascading behavior

### 1.2 File Storage Setup
**Directory:** `server/storage/`

- Create storage configuration for local development
- Implement S3-compatible storage abstraction (can use local filesystem for MVP)
- Organize uploads by: `/{clientId}/assets/{year}/{month}/{uuid}-{filename}`
- Add storage utility functions (upload, delete, generateSignedUrl)

**Deliverables:**
- ✅ `server/storage/config.ts` - storage configuration
- ✅ `server/storage/local.ts` - local filesystem implementation
- ✅ `server/storage/s3.ts` - S3 implementation (stub for future)
- ✅ `server/storage/index.ts` - storage abstraction layer

**Implementation Notes:**
- Storage abstraction layer supports both local filesystem and S3 (via configuration)
- Local storage organizes files: `/{clientId}/assets/{year}/{month}/{uuid}-{filename}`
- Utility functions: `generateStoragePath()`, `generateUniqueFileName()`, `validateFileSize()`, `validateMimeType()`, `isRiskyFileType()`
- Configuration supports: max file size (500MB), allowed MIME types, storage type selection
- S3 stub includes interface for future implementation with signed URLs
- Default storage: local filesystem at `uploads/` directory (configurable via env var)

---

## ✅ Phase 2: File Upload API [COMPLETED]

### 2.1 Upload Middleware
**File:** `server/middlewares/upload.ts`

- Configure multer for multipart file uploads
- Set file size limits (500MB max)
- Validate file types (accept all, flag risky types)
- Add virus scanning placeholder (log-only for MVP)

### 2.2 Asset Routes
**File:** `server/routes/assets.ts`

Implement the following endpoints:

```typescript
POST   /api/assets/upload
  - Accepts multipart file upload
  - Validates user permissions
  - Stores file and creates database record
  - Returns asset metadata

GET    /api/assets
  - Lists assets for current client
  - Supports pagination (limit, offset)
  - Filters by category, tags, visibility
  - Respects user role permissions

GET    /api/assets/:id
  - Returns asset metadata
  - Permission check (visibility + role)

GET    /api/assets/:id/download
  - Streams file or generates signed URL
  - Permission check
  - Logs download event

PATCH  /api/assets/:id
  - Updates metadata (name, tags, categories, visibility)
  - Permission check (owner or admin)

DELETE /api/assets/:id
  - Soft delete asset
  - Permission check (owner or admin)
  - Cleanup job for permanent deletion (future)
```

**Deliverables:**
- Complete CRUD API for assets
- Permission middleware integration
- Error handling and validation
- Response formatting

### 2.3 Categories & Tags Routes
**File:** `server/routes/asset-categories.ts` & `server/routes/asset-tags.ts`

```typescript
// Categories
GET    /api/asset-categories
POST   /api/asset-categories (admin only)
PATCH  /api/asset-categories/:id (admin only)
DELETE /api/asset-categories/:id (admin only)

// Tags
GET    /api/asset-tags
POST   /api/asset-tags
DELETE /api/asset-tags/:id (creator or admin)
```

**Deliverables:**
- Category management endpoints
- Tag CRUD operations
- Default category seeding

---

## Phase 3: Frontend UI

### 3.1 Navigation & Routing
**Files:**
- `client/src/App.tsx` - Add route
- `client/src/components/sidebar.tsx` - Add navigation item

Add "Brand Assets" section to sidebar (between Brand and Settings)

Route: `/brand-assets`

### 3.2 Asset Manager Page
**File:** `client/src/pages/brand-assets.tsx`

Main page structure:
- Header with upload button
- Search bar (filters)
- View toggle (grid/list)
- Asset grid/list display
- Empty state for no assets

### 3.3 Upload Component
**File:** `client/src/components/brand/assets/asset-upload.tsx`

Features:
- Upload button with file picker
- Drag-and-drop zone
- Multi-file upload support
- Upload progress indicator
- File preview before upload
- Tag/category selection during upload
- Visibility toggle (private/shared)

### 3.4 Asset Grid/List View
**File:** `client/src/components/brand/assets/asset-list.tsx`

Display components:
- Grid view: thumbnail cards with name, type, size
- List view: table with columns (thumbnail, name, type, size, date, actions)
- Thumbnail generation for images
- File type icons for non-previewable files
- Quick actions menu (download, edit, delete)

### 3.5 Asset Detail Modal
**File:** `client/src/components/brand/assets/asset-detail.tsx`

Modal features:
- Large preview (images, PDFs via PDF.js)
- File metadata display
- Tag/category editing
- Download button
- Delete button (with confirmation)
- Share link generation (internal)

### 3.6 Search & Filter Component
**File:** `client/src/components/brand/assets/asset-filters.tsx`

Filter options:
- Text search (name)
- Category filter (multi-select)
- Tag filter (multi-select)
- File type filter
- Visibility filter (admin/editor only)

**Deliverables:**
- Complete React component tree
- TanStack Query hooks for data fetching
- Optimistic updates for upload/delete
- Responsive design (mobile-friendly)
- Loading states and error handling

---

## Phase 4: Search & Discovery

### 4.1 Basic Search Implementation
**File:** `server/routes/assets.ts` (enhance GET /api/assets)

For MVP, use PostgreSQL full-text search:
- Add tsvector column to assets table
- Create GIN index on searchable fields
- Implement search query with ranking
- Search across: fileName, tags, categories

### 4.2 Search API Enhancement
```typescript
GET /api/assets/search
  - Query parameter: q (search term)
  - Returns grouped results by category
  - Includes relevance ranking
  - Pagination support
```

### 4.3 Frontend Search Integration
**File:** `client/src/components/brand/assets/asset-search.tsx`

- Instant search with debouncing (300ms)
- Spotlight-style grouped results
- Keyboard navigation support
- Search suggestions (future)

**Future Enhancement:** Replace with ElasticSearch when asset count > 1000

---

## Phase 5: File Preview Generation

### 5.1 Thumbnail Service
**File:** `server/services/thumbnail.ts`

Generate thumbnails for:
- Images (JPEG, PNG, GIF, WebP) - using Sharp
- PDFs (first page) - using PDF.js or similar
- Videos (first frame) - using FFmpeg (future)

Thumbnail sizes:
- Small: 150x150 (grid view)
- Medium: 400x400 (preview)
- Large: 800x800 (detail modal)

### 5.2 Preview Routes
```typescript
GET /api/assets/:id/thumbnail/:size
  - Returns thumbnail image
  - Generates on-demand, caches result
  - Fallback to file type icon
```

### 5.3 PDF Preview Integration
**Frontend:** Use PDF.js library

- Render PDF in modal preview
- Navigation controls (page forward/back)
- Zoom controls
- Download option

**Deliverables:**
- Thumbnail generation service
- Caching strategy (filesystem or Redis)
- Frontend preview components
- File type icons for unsupported types

---

## Phase 6: Permissions & Security

### 6.1 Permission Middleware
**File:** `server/middlewares/assetPermissions.ts`

Implement role-based access:

| Role | Permissions |
|------|-------------|
| Guest | View shared assets only |
| Standard | CRUD own assets, view all shared assets |
| Editor | CRUD own assets, edit shared assets (not delete) |
| Admin | Full CRUD on all assets |
| Super Admin | Full CRUD on all assets |

### 6.2 Asset Visibility Rules
- **Private**: Only visible to creator and admins
- **Shared**: Visible to all client members based on role

### 6.3 Security Measures
- File type validation (block executable files)
- File size limits enforcement
- Rate limiting on upload endpoint
- Signed URLs for downloads (expire after 1 hour)
- CSRF protection on upload

**Deliverables:**
- Permission middleware functions
- Frontend permission checks
- Security headers configuration
- Rate limiting implementation

---

## Phase 7: Testing & Polish

### 7.1 Backend Tests
**Directory:** `server/__tests__/assets/`

Test coverage:
- Asset upload (various file types)
- Permission enforcement
- Tag/category assignment
- Search functionality
- Download with signed URLs
- Soft delete behavior

### 7.2 Frontend Tests
**Directory:** `client/src/components/brand/assets/__tests__/`

Test coverage:
- File upload flow
- Drag-and-drop upload
- Asset list rendering
- Search and filter
- Permission-based UI visibility

### 7.3 Integration Tests
- End-to-end upload workflow
- Multi-file upload handling
- Preview generation pipeline
- Role-based access scenarios

### 7.4 Performance Optimization
- Lazy load images in grid view
- Virtual scrolling for large asset lists
- Optimize thumbnail generation
- Database query optimization (indexes)
- Frontend bundle size analysis

**Deliverables:**
- Test suite with >80% coverage
- Performance benchmarks
- Bug fixes and refinements

---

## Phase 8: Feature Toggles & Launch

### 8.1 Feature Toggle
**File:** `shared/schema.ts`

Add to `clients.featureToggles`:
```typescript
assetManagement: boolean
```

### 8.2 Default Categories Seed
**File:** `server/db.ts` or migration script

Seed default categories:
- Documents
- Spreadsheets
- Slide Decks
- Design Assets
- Photography

### 8.3 User Documentation
**File:** `docs/features/asset-management.md`

- Upload instructions
- Tag/category guide
- Permission model explanation
- Search tips
- File type support list

### 8.4 Launch Checklist
- [ ] Database migrations complete
- [ ] Storage configured (S3 for production)
- [ ] Feature toggle enabled for pilot clients
- [ ] Performance testing (5000+ assets)
- [ ] Security audit passed
- [ ] User documentation published
- [ ] Error monitoring configured

---

## Success Metrics (from PRD)

- [ ] Users can upload 5+ different file types without errors
- [ ] Files searchable in <1 second for <5000 assets
- [ ] Permissions enforced according to user roles
- [ ] Previews/thumbnails load for 80%+ of file types

---

## Future Enhancements (Post-MVP)

### Phase 9: Google Drive Integration
- OAuth flow for Drive access
- Drive file picker UI
- Metadata sync (no file copy)
- Folder import (flattened)
- Periodic sync jobs

### Phase 10: Advanced Features
- File versioning with rollback
- Folder hierarchy support
- Advanced filters (date range, uploader)
- External share links with expiration
- Bulk upload and tagging
- Activity log (who accessed what)
- ElasticSearch migration (when needed)

---

## Technical Debt & Considerations

1. **Storage Costs**: Monitor storage usage, implement cleanup for deleted files
2. **Preview Generation**: CPU-intensive, consider queue system for batch processing
3. **Search Scaling**: PostgreSQL FTS adequate for <10k assets, plan ElasticSearch migration
4. **Bandwidth**: Large file downloads may impact server performance, consider CDN
5. **Mobile Upload**: Test mobile browser upload experience, may need native app support

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 2-3 days | None |
| Phase 2 | 3-4 days | Phase 1 |
| Phase 3 | 4-5 days | Phase 2 |
| Phase 4 | 2-3 days | Phase 2 |
| Phase 5 | 3-4 days | Phase 2 |
| Phase 6 | 2-3 days | Phase 2 |
| Phase 7 | 3-4 days | All above |
| Phase 8 | 1-2 days | All above |

**Total MVP Estimate:** 20-28 working days

---

## Open Questions

1. Storage provider: S3, GCP, or Azure for production?
2. Thumbnail storage: Same bucket or separate CDN?
3. File retention policy: How long to keep soft-deleted files?
4. Max storage per client: Enforce limits?
5. Virus scanning: Required for MVP or post-launch?
6. GDPR compliance: Special handling for EU clients?
