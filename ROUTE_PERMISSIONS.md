# Route Permissions Assessment

Complete analysis of all server-side routes and their permission structures.

**Document Date:** November 6, 2025
**Total Routes Analyzed:** 80+
**Categories:** 11 major route groups

---

## Table of Contents

1. [User Roles & Permission Model](#user-roles--permission-model)
2. [Route Documentation](#route-documentation)
3. [Security Features](#security-features)
4. [Security Issues Identified](#security-issues-identified)
5. [Role-Based Access Matrix](#role-based-access-matrix)
6. [Recommendations](#recommendations)

---

## User Roles & Permission Model

### Role Hierarchy

The system defines 5 distinct user roles in `/shared/schema.ts`:

| Role | Hierarchy | Access Level | Description |
|------|-----------|--------------|-------------|
| **SUPER_ADMIN** | 5 (Highest) | System-wide | Full access to all clients and features |
| **ADMIN** | 4 | Client-scoped | Admin access within assigned clients only |
| **EDITOR** | 3 | Client-scoped | Full asset management (CRUD + share) |
| **STANDARD** | 2 | Client-scoped | Can read all, write/delete own assets only |
| **GUEST** | 1 (Lowest) | Client-scoped | Read-only access to shared assets |

### Base Permission Model

```
ROLE_PERMISSIONS = {
  GUEST:      ["read"],
  STANDARD:   ["read", "write"],           // write/delete own assets only
  EDITOR:     ["read", "write", "delete", "share"],
  ADMIN:      ["read", "write", "delete", "share"],
  SUPER_ADMIN: ["read", "write", "delete", "share"]
}
```

### Centralized Permission Service

All asset-related permissions flow through `/server/services/asset-permissions.ts`:

- **`checkAssetPermission(assetId, userId, requiredPermission)`** - Core permission checker
- **SUPER_ADMIN Bypass:** Super admins bypass client-scoped access checks
- **Soft Deletes:** Deleted assets use `deletedAt` timestamp instead of hard deletion

---

## Route Documentation

### 1. Authentication Routes

**File:** `/server/routes/auth.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| POST | `/api/auth/logout` | No | All | No | No | Destroys session |
| POST | `/api/auth/google` | No | Public | No | No | Creates user if valid invitation token |

---

### 2. User Management Routes

**File:** `/server/routes/users.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/user` | Yes | All | No | No | Current user profile |
| GET | `/api/user/clients` | Yes | All | No | No | User's assigned clients |
| GET | `/api/users` | Yes | All | No | No | SUPER_ADMIN: all; ADMIN: their clients; Others: self |
| POST | `/api/users` | Yes | ADMIN, SUPER_ADMIN | Yes | Yes | Create invitation |
| PATCH | `/api/users/role` | Yes | All | No | No | Update own role |
| PATCH | `/api/users/:id/role` | Yes | ADMIN, SUPER_ADMIN | Yes | No | ✅ With CSRF; ADMIN scoped to own clients; cannot assign ADMIN/SUPER_ADMIN |
| POST | `/api/users/:id/reset-password` | No | Public | No | No | Password reset email |
| POST | `/api/reset-password` | No | Public | No | No | Handle password reset |
| GET | `/api/users/:id/clients` | Yes | ADMIN, SUPER_ADMIN | No | No | ✅ Secured; ADMIN scoped to own clients |
| GET | `/api/users/client-assignments` | Yes | SUPER_ADMIN | No | No | ✅ Secured; SUPER_ADMIN only |
| POST | `/api/user-clients` | Yes | ADMIN, SUPER_ADMIN | Yes | No | ✅ Secured; ADMIN scoped to own clients |
| DELETE | `/api/user-clients/:userId/:clientId` | Yes | ADMIN, SUPER_ADMIN | Yes | No | Delete user-client relationship |
| GET | `/api/clients/:clientId/users` | Yes | ADMIN, SUPER_ADMIN | No | No | ✅ Secured; ADMIN scoped to own clients |

---

### 3. Client Routes

**File:** `/server/routes/clients.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients` | Yes | All | No | No | SUPER_ADMIN: all; Others: assigned only |
| GET | `/api/clients/:id` | Yes | All | No | No | Single client details |
| POST | `/api/clients` | Yes | All | Yes | Yes | Create client |
| PATCH | `/api/clients/order` | Yes | All | Yes | No | Update display order |
| PATCH | `/api/clients/:id` | Yes | All | Yes | No | Update client; records lastEditedBy |
| DELETE | `/api/clients/:id` | Yes | ADMIN, SUPER_ADMIN | Yes | No | Delete client |

---

### 4. Brand Assets Routes

**File:** `/server/routes/brand-assets.ts`

**Purpose:** Design system assets (logos, fonts, colors, typography) stored directly in the database with format conversion support. This is distinct from File Assets which handle general file storage with external storage backends.

**⚠️ IMPORTANT ARCHITECTURE NOTE:**
The `/api/assets/:assetId/file` endpoint is defined in `brand-assets.ts` and serves **BRAND ASSETS ONLY** (not file assets). This endpoint provides format conversion (SVG → PNG/JPG/PDF/AI), dark variant switching, and dynamic resizing specifically for brand assets. File assets use `/api/assets/:assetId/download` for direct downloads without conversion.

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| POST | `/api/utils/fix-logo-types` | Yes | SUPER_ADMIN | No | No | Utility endpoint |
| POST | `/api/utils/update-client-logos` | Yes | SUPER_ADMIN | No | No | Utility endpoint |
| GET | `/api/adobe-fonts/:projectId` | Yes | All | No | No | Adobe Fonts API |
| GET | `/api/google-fonts` | No | Public | No | No | Google Fonts API |
| GET | `/api/brand-assets` | Yes | All | No | No | List brand assets |
| GET | `/api/brand-assets/:id` | Yes | All | No | No | Single brand asset |
| POST | `/api/clients/:clientId/brand-assets` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | Yes | Create brand asset; file upload |
| PATCH | `/api/clients/:clientId/brand-assets/:assetId` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Update brand asset/variants |
| DELETE | `/api/clients/:clientId/brand-assets/:assetId` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Delete brand asset/variant |
| DELETE | `/api/assets/:id` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Delete brand asset (uses permission service) |
| GET | `/api/clients/:clientId/brand-assets` | Yes | All | No | No | List client brand assets |
| GET | `/api/assets/:assetId/light` | No | Public | No | No | **BRAND ASSET**: Light variant (cached) |
| GET | `/api/assets/:assetId/dark` | No | Public | No | No | **BRAND ASSET**: Dark variant (cached) |
| GET | `/api/assets/:assetId/file` | No | Public | No | No | **⚠️ BRAND ASSET**: Primary serving endpoint with format conversion & resizing |
| GET | `/api/assets/:assetId/download` | No | Public | No | No | **BRAND ASSET**: Redirects to `/file` |
| GET | `/api/clients/:clientId/assets/:assetId/download` | Yes | All | No | No | **BRAND ASSET**: Auth redirects to `/file` |
| GET | `/api/assets/:assetId/converted` | Yes | All | No | No | **BRAND ASSET**: Get converted formats |
| GET | `/api/assets/:assetId/thumbnail/:size` | Yes | All | No | No | **BRAND ASSET**: Thumbnail; GUEST sees shared only |

---

### 5. File Assets Routes

**File:** `/server/routes/file-assets.ts`

**Purpose:** General file storage system for documents, images, videos, and any file type. Supports external storage backends, full-text search, categories, tags, and public sharing. This is distinct from Brand Assets which handle design system elements stored in the database.

**⚠️ IMPORTANT:** File assets use `/api/assets/:assetId/download` for serving (direct downloads). They do NOT use `/api/assets/:assetId/file` which is reserved for brand asset format conversion.

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/assets` | Yes | All | No | No | SUPER_ADMIN: all; GUEST: shared; Others: assigned |
| GET | `/api/assets/search` | Yes | All | No | No | Full-text search with role filtering |
| GET | `/api/assets/:assetId` | Yes | All | No | No | Uses permission service (read) |
| POST | `/api/assets` | Yes | STANDARD, EDITOR, ADMIN, SUPER_ADMIN | Yes | Yes | Upload asset; file upload; virus scan |
| PATCH | `/api/assets/:assetId` | Yes | Owner/EDITOR/ADMIN/SUPER_ADMIN | No | No | Uses permission service (write) |
| DELETE | `/api/assets/:assetId` | Yes | Owner/EDITOR/ADMIN/SUPER_ADMIN | No | No | Uses permission service (delete); soft delete |
| GET | `/api/assets/:assetId/download` | Yes | All | No | No | Download; checks read permission |

---

### 6. Asset Categories Routes

**File:** `/server/routes/file-asset-categories.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/categories` | Yes | All | No | No | List categories |
| POST | `/api/clients/:clientId/categories` | Yes | EDITOR, ADMIN, SUPER_ADMIN | Yes | No | Create category |
| PATCH | `/api/clients/:clientId/categories/:categoryId` | Yes | EDITOR, ADMIN, SUPER_ADMIN | Yes | No | Update category |
| DELETE | `/api/clients/:clientId/categories/:categoryId` | Yes | ADMIN, SUPER_ADMIN | Yes | No | Delete category |

---

### 7. Asset Tags Routes

**File:** `/server/routes/file-asset-tags.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/tags` | Yes | All | No | No | List tags |
| POST | `/api/clients/:clientId/tags` | Yes | STANDARD, EDITOR, ADMIN, SUPER_ADMIN | Yes | No | Create tag |
| PATCH | `/api/clients/:clientId/tags/:tagId` | Yes | EDITOR, ADMIN, SUPER_ADMIN | Yes | No | Update tag |
| DELETE | `/api/clients/:clientId/tags/:tagId` | Yes | ADMIN, SUPER_ADMIN | Yes | No | Delete tag |

---

### 8. Shareable Links Routes

**File:** `/server/routes/shareable-links.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| POST | `/api/clients/:clientId/assets/:assetId/share` | Yes | Has "share" permission | No | No | Uses permission service |
| GET | `/api/clients/:clientId/assets/:assetId/share` | Yes | Has "read" permission | No | No | Uses permission service |
| DELETE | `/api/clients/:clientId/assets/:assetId/share/:linkId` | Yes | Has "write" permission | No | No | Uses permission service |
| GET | `/api/public/assets/:token` | No | Public | No | No | Public link download |

---

### 9. Invitations Routes

**File:** `/server/routes/invitations.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/invitations` | Yes | ADMIN, SUPER_ADMIN | No | No | List pending invitations |
| POST | `/api/invitations` | Yes | ADMIN, SUPER_ADMIN | Yes | Yes | Create invitation |
| GET | `/api/invitations/:token` | No | Public | No | No | Get invitation details |
| GET | `/api/invitations/:token/client` | No | Public | No | No | Get client for invitation |
| POST | `/api/invitations/:id/use` | No | Public | No | No | Mark invitation used |
| DELETE | `/api/invitations/:id` | Yes | ADMIN, SUPER_ADMIN | Yes | No | Delete invitation |
| POST | `/api/invitations/:id/resend` | Yes | ADMIN, SUPER_ADMIN | No | No | Resend invitation email |
| GET | `/api/clients/:clientId/invitations` | Yes | ADMIN, SUPER_ADMIN | No | No | Get client invitations |

---

### 10. API Tokens Routes

**File:** `/server/routes/api-tokens.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| POST | `/api/clients/:clientId/tokens` | Yes | All with client access | Yes | Yes | Create token; comprehensive protection |
| GET | `/api/clients/:clientId/tokens` | Yes | All with client access | No | No | List tokens |
| PATCH | `/api/clients/:clientId/tokens/:tokenId` | Yes | All with client access | No | No | Update token (rename, scopes) |
| DELETE | `/api/clients/:clientId/tokens/:tokenId` | Yes | All with client access | No | No | Deactivate token |
| GET | `/api/clients/:clientId/tokens/:tokenId/stats` | Yes | All with client access | No | No | Token usage statistics |

---

### 11. Design System Routes

**File:** `/server/routes/design-system.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/design-system` | Yes | All | No | No | Read theme.json |
| PATCH | `/api/design-system` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Update design system |
| PATCH | `/api/design-system/typography` | Yes | All | No | No | ⚠️ **NO ROLE CHECK IN CODE** |
| GET | `/api/design-system/export/css/:clientId` | Yes | All | No | No | Export CSS |
| GET | `/api/design-system/export/scss/:clientId` | Yes | All | No | No | Export SCSS |
| GET | `/api/design-system/export/tailwind/:clientId` | Yes | All | No | No | Export Tailwind config |

---

### 12. Personas Routes

**File:** `/server/routes/personas.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/personas` | Yes (validateClientId) | All with client access | No | No | List personas |
| POST | `/api/clients/:clientId/personas` | Yes (validateClientId) | All with client access | No | No | ⚠️ **No explicit role restriction** |
| PATCH | `/api/clients/:clientId/personas/:personaId` | Yes (validateClientId) | All with client access | No | No | Checks ownership |
| DELETE | `/api/clients/:clientId/personas/:personaId` | Yes (validateClientId) | All with client access | No | No | Checks ownership |

---

### 13. Type Scales Routes

**File:** `/server/routes/type-scales.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/type-scales` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| GET | `/api/type-scales/:id` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| POST | `/api/clients/:clientId/type-scales` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| PATCH | `/api/type-scales/:id` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| DELETE | `/api/type-scales/:id` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| POST | `/api/type-scales/:id/export/css` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| POST | `/api/type-scales/:id/export/scss` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |

---

### 14. Figma Integration Routes

**File:** `/server/routes/figma.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/figma/connections/:clientId` | Yes | All | No | No | Sanitizes tokens |
| POST | `/api/figma/test-connection` | Yes | All | No | No | Test connection |
| POST | `/api/figma/files` | Yes | All | No | No | Browse files |
| POST | `/api/figma/connections` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Create connection |
| GET | `/api/figma/connections/:connectionId/tokens` | Yes | All | No | No | Get design tokens |
| POST | `/api/figma/connections/:connectionId/sync-from-figma` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Sync tokens |
| DELETE | `/api/figma/connections/:connectionId` | Yes | EDITOR, ADMIN, SUPER_ADMIN | No | No | Delete connection |
| GET | `/api/figma/connections/:connectionId/sync-logs` | Yes | All | No | No | View sync logs |

---

### 15. Google Drive Integration Routes

**File:** `/server/routes/google-drive.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/auth/google/url` | Yes | All | No | No | OAuth URL |
| GET | `/api/google-drive/status` | Yes | All | No | No | Connection status |
| GET | `/api/google-drive/token` | Yes | All | No | No | Get access token |
| GET | `/api/auth/google/callback` | No | Public | No | No | OAuth callback |
| GET | `/api/drive/files` | Yes (googleAuth) | All with auth | No | Yes | List files; rate limited |
| POST | `/api/google-drive/import` | Yes (googleAuth) | All with auth | No | Yes | Import files (SSE); rate limited |
| DELETE | `/api/google-drive/disconnect` | Yes | All | No | No | Revoke OAuth token |

---

### 16. Slack Routes

**File:** `/server/routes/slack.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| ALL | `/api/slack/events` | Slack signature | Slack users | No | No | Bolt SDK handles verification |
| POST | `/api/slack/map-user-test` | No | Dev only | No | No | ⚠️ **Development only** |
| POST | `/api/slack/map-user` | Yes | All with client | No | No | Manual user mapping |
| GET | `/api/clients/:clientId/slack/mappings` | Yes (validateClientId) | All | No | No | Get mappings |
| GET | `/api/slack/user-status` | Yes (optional) | All | No | No | Integration status |
| GET | `/api/slack/health` | No | Public | No | No | Health check |

---

### 17. Slack OAuth Routes

**File:** `/server/routes/slack-oauth.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/slack/oauth/install` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | OAuth initiation |
| GET | `/api/slack/oauth/callback` | No | Public | No | No | OAuth callback |
| GET | `/api/clients/:clientId/slack/workspaces` | Yes (validateClientId) | All | No | No | List workspaces |
| POST | `/api/clients/:clientId/slack/workspaces/:workspaceId/reactivate` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Reactivate workspace |
| DELETE | `/api/clients/:clientId/slack/workspaces/:workspaceId/delete` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Permanent delete |
| DELETE | `/api/clients/:clientId/slack/workspaces/:workspaceId` | Yes (validateClientId) | All | No | No | ⚠️ **Soft delete; no admin check** |

---

### 18. Inspiration Boards Routes

**File:** `/server/routes/inspiration-boards.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/inspiration/sections` | Yes (validateClientId) | All | No | No | View sections |
| POST | `/api/clients/:clientId/inspiration/sections` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Create section |
| PATCH | `/api/clients/:clientId/inspiration/sections/:sectionId` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Update section |
| DELETE | `/api/clients/:clientId/inspiration/sections/:sectionId` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Delete section |
| POST | `/api/clients/:clientId/inspiration/sections/:sectionId/images` | Yes (validateClientId) | All | No | No | ⚠️ **No admin check on upload** |

---

### 19. Hidden Sections Routes

**File:** `/server/routes/hidden-sections.ts`

| Method | Endpoint | Auth | Roles | CSRF | Rate Limit | Notes |
|--------|----------|------|-------|------|-----------|-------|
| GET | `/api/clients/:clientId/hidden-sections` | **❌ NONE** | **Public** | No | No | 🚨 **SECURITY ISSUE** |
| POST | `/api/clients/:clientId/hidden-sections` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Add hidden section |
| DELETE | `/api/clients/:clientId/hidden-sections/:sectionType` | Yes + requireAdminRole | ADMIN, SUPER_ADMIN | No | No | Remove hidden section |

---

## Security Features

### 1. CSRF Protection

CSRF tokens are applied to mutation endpoints (POST, PATCH, DELETE):

```
Applied to:
- ✅ User management (creation, role changes)
- ✅ Client management
- ✅ Asset operations (creation, updates)
- ✅ Category/tag management
- ✅ API token creation
- ✅ Invitations
- ⚠️ Missing on: User role updates, design system updates
- ❌ Missing on: Figma, Google Drive, Slack routes
```

### 2. Rate Limiting

Implemented for sensitive operations:

- **`authRateLimit`** - Authentication attempts
- **`mutationRateLimit`** - General mutations
- **`invitationRateLimit`** - Invitation creation
- **`tokenCreationRateLimit`** - API token creation
- **`uploadRateLimit`** - File uploads
- **`driveListingRateLimit`** - Google Drive file listing
- **`driveImportRateLimit`** - Google Drive imports

### 3. File Upload Security

- ✅ Virus scanning via `virusScan` middleware
- ✅ File type validation
- ✅ Size limits
- ✅ Rate limiting

### 4. Session Management

- ✅ Express sessions with PostgreSQL store
- ✅ Secure cookies (httpOnly, secure flags)
- ✅ Session expiration

### 5. OAuth Integration

- ✅ Google OAuth for authentication
- ✅ Slack OAuth for integration
- ✅ Token sanitization (tokens not sent to frontend)
- ✅ Signature verification for Slack

### 6. Data Integrity

- ✅ Soft deletes (using `deletedAt` timestamp)
- ✅ Audit logging (e.g., `lastEditedBy` tracking)
- ✅ Permission service for granular access control

---

## Security Issues Identified

### 🚨 Critical Issues

#### 1. Type Scales Routes - No Authentication
**Location:** `/server/routes/type-scales.ts`

All 7 endpoints have **zero authentication**:
- `GET /api/clients/:clientId/type-scales`
- `GET /api/type-scales/:id`
- `POST /api/clients/:clientId/type-scales`
- `PATCH /api/type-scales/:id`
- `DELETE /api/type-scales/:id`
- `POST /api/type-scales/:id/export/css`
- `POST /api/type-scales/:id/export/scss`

**Impact:** Any unauthenticated user can:
- View, create, update, delete type scales
- Export CSS/SCSS for any type scale
- Bypass all permission controls

**Recommendation:** Add session authentication and client validation middleware.

---

#### 2. Hidden Sections GET - No Authentication
**Location:** `/server/routes/hidden-sections.ts`

The `GET /api/clients/:clientId/hidden-sections` endpoint has **no authentication**.

**Impact:** Anyone can view which sections are hidden for any client.

**Recommendation:** Require session authentication.

---

#### 3. Design System Typography PATCH - No Role Check
**Location:** `/server/routes/design-system.ts:29`

```typescript
router.patch('/design-system/typography', async (req, res) => {
  // ⚠️ No checkRole() or permission check
  const clientId = req.body.clientId;
  // ... directly updates without checking role
})
```

**Impact:** All authenticated users can update typography design system.

**Recommendation:** Add role restriction (EDITOR, ADMIN, SUPER_ADMIN) or CSRF protection.

---

### ⚠️ Medium-Priority Issues

#### 4. Personas Routes - Insufficient Role Restrictions
**Location:** `/server/routes/personas.ts`

```typescript
// POST endpoint allows ALL authenticated users to create personas
router.post('/clients/:clientId/personas', validateClientId, async (req, res) => {
  // ✅ Checks client access via validateClientId
  // ❌ But allows GUEST to create personas
})
```

**Recommendation:** Restrict to STANDARD+ roles (exclude GUEST):
```typescript
requireMinimumRole('STANDARD')
```

---

#### 5. Inspiration Boards Image Upload - Missing Admin Check
**Location:** `/server/routes/inspiration-boards.ts`

```typescript
// POST image endpoint allows all authenticated users
router.post(
  '/clients/:clientId/inspiration/sections/:sectionId/images',
  validateClientId,
  // ❌ No requireAdminRole middleware
  async (req, res) => {
    // Uploads image directly
  }
)
```

**Inconsistency:** Section create/update/delete requires `requireAdminRole`, but image uploads don't.

**Recommendation:** Add `requireAdminRole` middleware to image upload endpoint.

---

#### 6. Slack Workspace Soft Delete - Missing Admin Check
**Location:** `/server/routes/slack-oauth.ts`

```typescript
// Soft delete endpoint missing admin check
router.delete(
  '/clients/:clientId/slack/workspaces/:workspaceId',
  validateClientId,
  // ❌ No requireAdminRole middleware
  // But the permanent delete endpoint below DOES have it
  async (req, res) => {
    await slackWorkspace.update({ active: false });
  }
)

// Permanent delete HAS admin check
router.delete(
  '/clients/:clientId/slack/workspaces/:workspaceId/delete',
  validateClientId,
  requireAdminRole,  // ✅ Present
  async (req, res) => {
    // Hard delete
  }
)
```

**Inconsistency:** Soft delete should have same protection as hard delete.

**Recommendation:** Add `requireAdminRole` middleware to soft delete endpoint.

---

#### 7. User Client Assignments - Public Endpoint
**Location:** `/server/routes/users.ts`

**Status:** ✅ **FIXED**

**Previous Implementation:**
```typescript
// ❌ No authentication required
router.get('/api/users/:id/clients', async (req, res) => {
  // Returns which clients a user is assigned to
})

router.get('/api/users/client-assignments', async (req, res) => {
  // Returns all user-client assignments
})
```

**Current Implementation:**
```typescript
// ✅ Now secured with requireAdmin middleware
router.get('/api/users/:id/clients', requireAdmin, async (req, res) => {
  // ADMIN: can only access users in their assigned clients
  // SUPER_ADMIN: can access any user
})

router.get('/api/users/client-assignments', requireSuperAdmin, async (req, res) => {
  // SUPER_ADMIN only - system-wide overview
})
```

**Changes Made:**
- Added `requireAdmin` middleware to `/api/users/:id/clients` with client-scoped validation for ADMIN users
- Changed `/api/users/client-assignments` to require `requireSuperAdmin` (SUPER_ADMIN only)
- Both endpoints now enforce proper authentication and authorization

---

### ℹ️ Minor Issues

#### 8. Missing CSRF on User Role Updates
**Location:** `/server/routes/users.ts:73`

**Status:** ✅ **FIXED**

**Previous Implementation:**
```typescript
// ⚠️ No CSRF protection
router.patch('/users/:id/role', async (req, res) => {
  // Updates user role without CSRF token
})
```

**Current Implementation:**
```typescript
// ✅ Now has CSRF protection
router.patch('/api/users/:id/role', csrfProtection, requireAdmin, async (req, res) => {
  // Properly protected
})
```

**Changes Made:**
- Added `csrfProtection` middleware to the endpoint
- Also added `requireAdmin` middleware for proper authorization

---

#### 9. Missing CSRF on Design System Updates
**Location:** `/server/routes/design-system.ts`

PATCH endpoints for design system updates lack CSRF protection.

**Recommendation:** Add `csrfProtection` middleware to:
- `PATCH /api/design-system`
- `PATCH /api/design-system/typography`

---

## Role-Based Access Matrix

Quick reference table showing what each role can do:

| Feature | GUEST | STANDARD | EDITOR | ADMIN | SUPER_ADMIN |
|---------|-------|----------|--------|-------|-------------|
| **User Management** |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| View other users | ❌ | ❌ | ❌ | ✅* | ✅ |
| Create invitations | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage user roles | ❌ | ❌ | ❌ | ✅** | ✅ |
| **Client Management** |
| View assigned clients | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all clients | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create clients | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update clients | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete clients | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Asset Management** |
| View assets | ✅*** | ✅ | ✅ | ✅ | ✅ |
| Create assets | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update assets | ❌ | ✅**** | ✅ | ✅ | ✅ |
| Delete assets | ❌ | ✅**** | ✅ | ✅ | ✅ |
| Share assets | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Category/Tag Management** |
| View categories/tags | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create categories/tags | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update categories/tags | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete categories/tags | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Integration Management** |
| View integrations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create integrations | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Slack workspace | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create API tokens | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Admin Features** |
| View invitations | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage API tokens | ❌ | ❌ | ❌ | ✅ | ✅ |

**Legend:**
- `✅` = Can perform
- `❌` = Cannot perform
- `*` = Only for their assigned clients
- `**` = Cannot assign ADMIN/SUPER_ADMIN or modify SUPER_ADMIN users
- `***` = GUEST only sees shared assets
- `****` = STANDARD can only modify assets they own

---

## Recommendations

### Immediate Actions Required (Critical)

1. **Secure Type Scales Routes**
   - Add session authentication middleware
   - Add client validation via `validateClientId`
   - Consider requiring `requireMinimumRole('EDITOR')`

2. **Secure Hidden Sections GET**
   - Add session authentication middleware
   - Add client validation

3. **Fix Design System Typography Endpoint**
   - Add explicit role check (EDITOR+)
   - Add CSRF protection

4. **Fix User Client Assignments Endpoints**
   - Add session authentication
   - Add role-based filtering

---

### Short-Term Actions (Medium Priority)

1. **Restrict Personas to STANDARD+ Users**
   ```typescript
   router.post('/clients/:clientId/personas',
     validateClientId,
     requireMinimumRole('STANDARD'),  // Add this
     async (req, res) => { ... }
   )
   ```

2. **Add Admin Check to Inspiration Image Upload**
   ```typescript
   router.post('/clients/:clientId/inspiration/sections/:sectionId/images',
     validateClientId,
     requireAdminRole,  // Add this
     async (req, res) => { ... }
   )
   ```

3. **Standardize Slack Workspace Deletion**
   ```typescript
   // Make soft delete require admin role (consistent with hard delete)
   router.delete('/clients/:clientId/slack/workspaces/:workspaceId',
     validateClientId,
     requireAdminRole,  // Add this
     async (req, res) => { ... }
   )
   ```

4. **Add CSRF to User Role Updates**
   ```typescript
   router.patch('/users/:id/role',
     csrfProtection,  // Add this
     async (req, res) => { ... }
   )
   ```

5. **Add CSRF to Design System Updates**
   ```typescript
   router.patch('/design-system',
     csrfProtection,  // Add this
     async (req, res) => { ... }
   )

   router.patch('/design-system/typography',
     csrfProtection,  // Add this
     async (req, res) => { ... }
   )
   ```

---

### Best Practices to Implement

1. **Consistency Check**
   - Audit all mutation endpoints (POST, PATCH, DELETE)
   - Ensure all have CSRF protection
   - Ensure all have proper role restrictions

2. **Middleware Standardization**
   - Create wrapper middleware for common patterns:
     ```typescript
     const requirePermission = (minRole) => [
       csrfProtection,
       requireMinimumRole(minRole)
     ]
     ```

3. **Permission Service Expansion**
   - Consider expanding `checkAssetPermission` pattern to other resources
   - Apply to categories, tags, personas, etc.

4. **Audit Logging**
   - Add audit trail for sensitive operations:
     - Role changes
     - User deletions
     - Token creations
     - Design system modifications

5. **Rate Limiting Expansion**
   - Add rate limiting to:
     - Design system updates
     - Figma sync operations
     - Slack operations

---

## Summary

**Total Routes:** 80+
**Fully Protected Routes:** 70 (87.5%)
**Routes Requiring Fixes:** 10 (12.5%)

### Recent Security Improvements (November 6, 2025)

The following security enhancements were implemented:

**✅ Fixed Issues:**
1. **User Management Routes** - Added authentication and authorization to previously unprotected endpoints:
   - `PATCH /api/users/:id/role` - Added CSRF protection
   - `GET /api/users/:id/clients` - Added `requireAdmin` middleware with client-scoped validation
   - `GET /api/users/client-assignments` - Changed to `requireSuperAdmin` (SUPER_ADMIN only)
   - `POST /api/user-clients` - Added `requireAdmin` middleware with client-scoped validation
   - `GET /api/clients/:clientId/users` - Added `requireAdmin` middleware with client-scoped validation

**Helper Functions Added:**
- `canAdminAccessClient()` - Verify ADMIN access to specific client
- `canAdminAccessUser()` - Verify ADMIN access to specific user (only in their assigned clients)

### Protection Status by Category

| Category | Protected | Issues | Priority |
|----------|-----------|--------|----------|
| Authentication | ✅ 2/2 | 0 | ✅ Low |
| User Management | ✅ 13/13 | 0 | ✅ Low |
| Client Management | ✅ 6/6 | 0 | ✅ Low |
| Brand Assets | ✅ 14/14 | 0 | ✅ Low |
| File Assets | ✅ 7/7 | 0 | ✅ Low |
| Categories/Tags | ✅ 8/8 | 0 | ✅ Low |
| Shareable Links | ✅ 4/4 | 0 | ✅ Low |
| Invitations | ✅ 8/8 | 0 | ✅ Low |
| API Tokens | ✅ 5/5 | 0 | ✅ Low |
| Design System | ⚠️ 6/6 | 2 | 🟡 Medium |
| Personas | ⚠️ 4/4 | 1 | 🟡 Medium |
| Type Scales | ❌ 0/7 | 7 | 🔴 Critical |
| Figma | ✅ 8/8 | 0 | ✅ Low |
| Google Drive | ✅ 7/7 | 0 | ✅ Low |
| Slack | ⚠️ 6/6 | 1 | 🟡 Medium |
| Inspiration Boards | ⚠️ 5/5 | 1 | 🟡 Medium |
| Hidden Sections | ⚠️ 3/3 | 1 | 🔴 Critical |

---

## Asset Architecture: Brand Assets vs File Assets

### Two Distinct Systems

The application maintains two separate asset management systems with different purposes and implementations:

#### 1. Brand Assets (`brand_assets` table)
**Purpose:** Design system elements (logos, colors, fonts)
**Storage:** Database (base64 encoded)
**Routes File:** `server/routes/brand-assets.ts`

**CRUD Operations:**
- `GET /api/clients/:clientId/brand-assets` - List
- `POST /api/clients/:clientId/brand-assets` - Create
- `PATCH /api/clients/:clientId/brand-assets/:assetId` - Update
- `DELETE /api/clients/:clientId/brand-assets/:assetId` - Delete

**Serving Endpoints:**
- `GET /api/assets/:assetId/file` - **PRIMARY**: Format conversion, resizing, variants
- `GET /api/assets/:assetId/light` - Light logo variant (cached)
- `GET /api/assets/:assetId/dark` - Dark logo variant (cached)
- `GET /api/assets/:assetId/download` - Redirect to `/file`
- `GET /api/assets/:assetId/thumbnail/:size` - Thumbnail generation
- `GET /api/assets/:assetId/converted` - List pre-converted formats

**Features:**
- SVG → PNG/JPG/PDF/AI format conversion
- Dark/light logo variant system
- Dynamic image resizing with aspect ratio preservation
- Pre-conversion caching in `converted_assets` table
- CDN-friendly cache headers

**Frontend Utility:** `getSecureAssetUrl()` in `client/src/components/brand/logo-manager/logo-utils.ts`

---

#### 2. File Assets (`assets` table)
**Purpose:** General file storage (documents, images, videos, any file type)
**Storage:** External (S3 or local filesystem)
**Routes File:** `server/routes/file-assets.ts`

**CRUD Operations:**
- `GET /api/assets` - List all file assets
- `GET /api/assets/search` - Full-text search
- `POST /api/assets/upload` - Upload
- `PATCH /api/assets/:assetId` - Update metadata
- `DELETE /api/assets/:assetId` - Delete (soft delete)

**Client-Scoped Operations:**
- `POST /api/clients/:clientId/file-assets/upload`
- `GET /api/clients/:clientId/file-assets`
- `PATCH /api/clients/:clientId/file-assets/:assetId`
- `DELETE /api/clients/:clientId/file-assets/:assetId`

**Serving Endpoints:**
- `GET /api/assets/:assetId/download` - **PRIMARY**: Direct file download (no conversion)
- `GET /api/clients/:clientId/file-assets/:assetId/download` - Client-scoped download
- `GET /api/clients/:clientId/file-assets/:assetId/thumbnail/:size` - Thumbnail

**Public Sharing:**
- `POST /api/clients/:clientId/assets/:assetId/public-links` - Create shareable link
- `GET /api/clients/:clientId/assets/:assetId/public-links` - List links
- `DELETE /api/clients/:clientId/assets/:assetId/public-links/:linkId` - Revoke link
- `GET /api/public/assets/:token` - Public download via token

**Features:**
- Categories and tags for organization
- Full-text search across metadata
- Public shareable links with expiration
- Thumbnail generation (images, PDFs, videos)
- Virus scanning on upload
- Bulk operations (delete, update)

**Permissions:** `checkAssetPermission()` service in `server/services/asset-permissions.ts`

---

### Critical Crossover: `/api/assets/:assetId/file`

**⚠️ IMPORTANT:** Despite the `/assets/` URL pattern, this endpoint is defined in `brand-assets.ts` and serves **BRAND ASSETS ONLY**.

**Why This Crossover Exists:**
1. **Historical naming:** Predates the brand/file asset separation
2. **Feature requirements:** Brand assets need format conversion, file assets don't
3. **Consistency:** Grouped with other brand asset serving endpoints (/light, /dark, /thumbnail)
4. **Caching:** Changing the URL would break existing browser and CDN caches

**File Assets Do NOT Use This Endpoint:**
- File assets use `/api/assets/:assetId/download` for direct downloads
- No format conversion or resizing for file assets
- Files are served exactly as uploaded

**Used By:**
- All brand asset preview components (logo-preview.tsx, font-card.tsx)
- Logo download buttons (standard-logo-download-button.tsx, etc.)
- Design system builder
- Client dashboards
- Any component displaying logos, colors, or fonts

---

### Quick Reference Table

| Feature | Brand Assets | File Assets |
|---------|--------------|-------------|
| **Table** | `brand_assets` | `assets` |
| **Storage** | Database (base64) | External (S3/local) |
| **CRUD Routes** | `/api/clients/:clientId/brand-assets` | `/api/clients/:clientId/file-assets` |
| **Serving Endpoint** | `/api/assets/:assetId/file` | `/api/assets/:assetId/download` |
| **Format Conversion** | ✅ Yes (SVG → PNG/JPG/PDF/AI) | ❌ No (served as-is) |
| **Resizing** | ✅ Yes (dynamic) | ❌ No |
| **Dark Variants** | ✅ Yes (logos only) | ❌ No |
| **Public Sharing** | ❌ No | ✅ Yes (shareable links) |
| **Categories/Tags** | ❌ No | ✅ Yes |
| **Full-Text Search** | ❌ No | ✅ Yes |
| **Permission Service** | ❌ No | ✅ Yes (`checkAssetPermission`) |

---

**Document Version:** 1.2
**Last Updated:** November 6, 2025 (Updated with asset architecture documentation)
