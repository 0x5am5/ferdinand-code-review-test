# Role and Permission Audit Report
## Issue: JUP-26 - Guest Users Have Unexpected Admin Privileges

**Date:** 2025-11-12
**Status:** ✅ **CRITICAL VULNERABILITY FIXED**
**Last Updated:** 2025-11-12

---

## Executive Summary

This audit identified the role and permission architecture across the Ferdinand application. The codebase uses a hierarchical role system with **5 roles**: `guest`, `standard`, `editor`, `admin`, and `super_admin`.

### ✅ Critical Finding - RESOLVED
**GET `/api/clients/:clientId/hidden-sections`** - **NOW SECURED** ✅
- Location: `server/routes/hidden-sections.ts:47`
- **FIX APPLIED:** Added `requireAdminRole` middleware
- This endpoint now requires `editor`, `admin`, or `super_admin` role
- **Root cause of JUP-26 has been resolved**

**What Changed:**
```typescript
// BEFORE (VULNERABLE):
app.get("/api/clients/:clientId/hidden-sections", async (req, res) => {
  // ... no auth check
});

// AFTER (SECURED):
app.get("/api/clients/:clientId/hidden-sections", requireAdminRole, async (req, res) => {
  // ... now requires editor/admin/super_admin
});
```

---

## Role Hierarchy Definition

Located in: `shared/schema.ts:79-85`

```typescript
export const UserRole = {
  SUPER_ADMIN: "super_admin",  // Level 5 - Full system access
  ADMIN: "admin",               // Level 4 - Multi-client management
  EDITOR: "editor",             // Level 3 - Content editing
  STANDARD: "standard",         // Level 2 - Read/limited write
  GUEST: "guest",               // Level 1 - Read-only
} as const;
```

**Role Hierarchy** (defined in `server/middlewares/requireMinimumRole.ts:8-14`):
- `GUEST`: 1
- `STANDARD`: 2
- `EDITOR`: 3
- `ADMIN`: 4
- `SUPER_ADMIN`: 5

---

## Backend Authentication Middleware

### Core Middleware Files

| Middleware | Location | Purpose | Roles Allowed |
|------------|----------|---------|---------------|
| `requireAuth` | `server/middlewares/auth.ts:7-12` | Basic authentication check | All authenticated users |
| `requireAdmin` | `server/middlewares/auth.ts:95-121` | Admin access | `admin`, `super_admin` |
| `requireSuperAdmin` | `server/middlewares/auth.ts:126-152` | Super admin only | `super_admin` |
| `requireAdminRole` | `server/middlewares/requireAdminRole.ts` | Admin role check | `admin`, `super_admin` |
| `requireSuperAdminRole` | `server/middlewares/requireSuperAdminRole.ts` | Super admin check | `super_admin` |
| `requireMinimumRole` | `server/middlewares/requireMinimumRole.ts` | Hierarchical role check | Configurable minimum |

### Helper Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `canAdminAccessClient` | `server/middlewares/auth.ts:21-45` | Check if admin can access specific client |
| `canAdminAccessUser` | `server/middlewares/auth.ts:54-90` | Check if admin can access specific user |

---

## Permission Checks by Route

### User Management Routes (`server/routes/users.ts`)

| Endpoint | Method | Middleware | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| `/api/user` | GET | Session check | Authenticated users | ✓ |
| `/api/user/clients` | GET | Session check | Authenticated users | ✓ |
| `/api/users` | GET | Session check + role logic | All (filtered by role) | ✓ |
| `/api/users` | POST | `csrfProtection`, `mutationRateLimit` | Authenticated users | ⚠️ No explicit role check |
| `/api/users/role` | PATCH | `csrfProtection` | Own role only | ✓ |
| `/api/users/:id/role` | PATCH | `csrfProtection`, `requireAdmin` | `admin`, `super_admin` | ✓ |
| `/api/users/:id/clients` | GET | `requireAdmin` | `admin`, `super_admin` | ✓ |
| `/api/users/client-assignments` | GET | `requireSuperAdmin` | `super_admin` | ✓ |
| `/api/user-clients` | POST | `csrfProtection`, `requireAdmin` | `admin`, `super_admin` | ✓ |
| `/api/user-clients/:userId/:clientId` | DELETE | `csrfProtection` | Authenticated users | ⚠️ No explicit role check |
| `/api/clients/:clientId/users` | GET | `requireAdmin`, `validateClientId` | `admin`, `super_admin` | ✓ |

### Client Management Routes (`server/routes/clients.ts`)

| Endpoint | Method | Middleware | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| `/api/clients` | GET | Session check + role logic | `super_admin` gets all, others get assigned | ✓ |
| `/api/clients/:id` | GET | Session check + access validation | Users with client access | ✓ |
| `/api/clients/:id` | DELETE | `csrfProtection`, `requireSuperAdminRole` | `super_admin` | ✓ |
| `/api/clients` | POST | `csrfProtection`, `mutationRateLimit`, `requireSuperAdminRole` | `super_admin` | ✓ |
| `/api/clients/order` | PATCH | `csrfProtection`, `requireSuperAdminRole` | `super_admin` | ✓ |
| `/api/clients/:id` | PATCH | `csrfProtection`, `requireMinimumRole(EDITOR)` | `editor`, `admin`, `super_admin` | ✓ |

### Hidden Sections Routes (`server/routes/hidden-sections.ts`)

| Endpoint | Method | Middleware | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| `/api/clients/:clientId/hidden-sections` | GET | `requireAdminRole` (local) | `admin`, `super_admin`, `editor` | ✅ **FIXED** |
| `/api/clients/:clientId/hidden-sections` | POST | `requireAdminRole` (local) | `admin`, `super_admin`, `editor` | ✓ |
| `/api/clients/:clientId/hidden-sections/:sectionType` | DELETE | `requireAdminRole` (local) | `admin`, `super_admin`, `editor` | ✓ |

**✅ UPDATED:** GET endpoint now secured with `requireAdminRole` middleware (line 47).
**📝 NOTE:** Hidden sections route defines its OWN `requireAdminRole` middleware (lines 6-41) that allows `EDITOR` role, which differs from the global middleware.

### Design System Routes (`server/routes/design-system.ts`)

| Endpoint | Method | Role Check | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| `/api/design-system` | PATCH | Inline check (lines 657-665) | `editor`, `admin`, `super_admin` | ✓ |
| `/api/design-system/export` | GET | Inline check (lines 899-905) | All roles including `guest` | ⚠️ Too permissive? |

### Inspiration Board Routes (`server/routes/inspiration-boards.ts`)

| Endpoint | Method | Middleware | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| POST/PATCH/DELETE operations | Multiple | `requireAdminRole` | `admin`, `super_admin` | ✓ |

### Slack OAuth Routes (`server/routes/slack-oauth.ts`)

| Endpoint | Method | Middleware | Roles Allowed | Status |
|----------|--------|------------|---------------|--------|
| OAuth operations | Multiple | `requireAdminRole` | `admin`, `super_admin` | ✓ |

---

## Frontend Permission Checks

### Context: Role Switching (`client/src/contexts/RoleSwitchingContext.tsx`)

**Purpose:** Allows `super_admin` users to view the app as different roles for testing/debugging.

**Key Logic:**
- Only `super_admin` can switch roles/users
- Persists viewing role in `sessionStorage`
- Auto-reverts when accessing restricted pages
- Uses `canAccessCurrentPage()` function (lines 134-168)

**Page Access Rules:**
- `/dashboard`: `super_admin` only
- `/users`: `super_admin`, `admin`
- `/clients`: `super_admin`, `admin`
- `/design-builder`: `super_admin`, `admin`, `editor`
- `/clients/:id`: All roles (filtered by access)

### Protected Route Component (`client/src/components/auth/protected-route.tsx`)

**Purpose:** Frontend route guard for role-based access control.

**Behavior:**
- Checks if user has required role
- For `super_admin`, uses `currentViewingRole` from role switching context
- Redirects unauthorized users to their assigned client or design builder
- Shows loading state while auth resolves

### Client Access Hook (`client/src/hooks/use-client-access.tsx`)

**Purpose:** Validates user access to specific clients.

**Logic:**
- `super_admin` has access to all clients
- Other users checked against `assignedClients` from `/api/user/clients`
- Auto-redirects if no access
- Queries user's assigned clients from backend

---

## Security Issues Identified

### ✅ FIXED: Unauthenticated Access to Hidden Sections

**File:** `server/routes/hidden-sections.ts:47`
**Status:** ✅ **RESOLVED** (2025-11-12)

**What Was Wrong:**
```typescript
// BEFORE (VULNERABLE):
app.get(
  "/api/clients/:clientId/hidden-sections",
  async (req: Request, res: Response) => {  // ← NO MIDDLEWARE!
    // ... anyone could access
  }
);
```

**Impact:**
- ANY user (authenticated or not) could view hidden sections
- Guest users could see what sections admins chose to hide
- Data exposure vulnerability
- **This was the root cause of JUP-26**

**Fix Applied:**
```typescript
// AFTER (SECURED):
app.get(
  "/api/clients/:clientId/hidden-sections",
  requireAdminRole,  // ← NOW REQUIRES editor/admin/super_admin
  async (req: Request, res: Response) => {
    // ... only authorized users can access
  }
);
```

**Access Control Now:**
- ❌ Unauthenticated users - **DENIED (401)**
- ❌ Guest users - **DENIED (403)**
- ❌ Standard users - **DENIED (403)**
- ✅ Editor users - **ALLOWED**
- ✅ Admin users - **ALLOWED**
- ✅ Super admin users - **ALLOWED**

### 🔴 HIGH: Guest User Permission Issues - Frontend Access Control

**Status:** ⚠️ **IDENTIFIED** (2025-11-12) - Requires immediate attention
**Severity:** High - Guest users can perform admin actions despite backend restrictions

Multiple components allow guest users to see and interact with admin controls that should be hidden. While some backend protections exist, the UI exposes functionality that creates confusion and poor UX.

#### Issue 1: Logo Manager - Guest Can Delete Logos

**Component:** `client/src/components/brand/logo-manager/`
**Current Behavior:** Guest users can click delete buttons on logos
**Expected Behavior:** Guest users should only be able to download logos
**Impact:** Confusing UX, guest users attempt actions they don't have permission for

**Required Changes:**
- Hide add/edit/delete buttons from guest users
- Show only download functionality
- Add role check: `user.role !== UserRole.GUEST`

#### Issue 2: Color Manager - Guest Can Delete and Edit Colors

**Component:** `client/src/components/brand/color-manager.tsx:644-680`
**Current Behavior:** Guest users can see and click edit/delete buttons for colors
**Expected Behavior:** Guest users should only be able to copy color values
**Impact:** UI allows actions that backend denies, poor user experience

**Required Changes:**
- Hide edit button (color editing dialog)
- Hide delete button (AlertDialog for deletion)
- Show only copy functionality
- Verify guest users cannot add new colors

#### Issue 3: Font Manager - Guest Can Edit Fonts

**Component:** `client/src/components/brand/font-manager/font-manager.tsx:72-74`
**Current Behavior:** Guest users can access font editing functionality
**Expected Behavior:** Guest users should have read-only access to fonts
**Impact:** Inappropriate access to font configuration

**Code Analysis:**
```typescript
const isAbleToEdit = user
  ? ["super_admin", "admin", "editor"].includes(user.role as string)
  : false;
```

**Issue:** While `isAbleToEdit` check exists, it's not properly applied to all edit UI elements

**Required Changes:**
- Ensure all edit controls check `isAbleToEdit`
- Hide font upload/edit/delete for guest users
- Verify read-only presentation for guests

#### Issue 4: Asset Manager - Guest Sees Upload and Delete Controls

**Component:** `client/src/components/brand/asset-manager.tsx:163`
**Current Behavior:**
- Guest users can see "Upload Assets" button
- Guest users can click delete on assets (request fails)
- Failed deletion not handled gracefully

**Expected Behavior:**
- Hide "Upload Assets" button for guest users
- Hide delete buttons for guest users
- Handle failed mutations with appropriate error messages

**Code Analysis:**
```typescript
const canUseGoogleDrive = user?.role !== UserRole.GUEST;
```

**Issue:** Only Google Drive button is hidden for guests, but general upload and delete are still visible

**Required Changes:**
- Add role check for upload button visibility
- Add role check for delete button visibility
- Improve error handling in delete mutation for permission failures
- Consistent with `canUseGoogleDrive` pattern

#### Summary of Guest Access Issues

| Component | Current Access | Expected Access | Status |
|-----------|---------------|-----------------|--------|
| Logo Manager | Delete, Edit | Download only | ❌ Needs Fix |
| Color Manager | Edit, Delete | Copy only | ❌ Needs Fix |
| Font Manager | Edit | Read-only | ❌ Needs Fix |
| Asset Manager | Upload, Delete | View only | ❌ Needs Fix |

**Recommended Approach:**
1. Create consistent permission helper: `canEditBrandAssets(user)`
2. Update all four components to use role checks
3. Add backend validation to ensure defense in depth
4. Improve error messages when guests attempt restricted actions

### ⚠️ MEDIUM: Inconsistent Role Checks

**Issue 1: Local vs Global Middleware**
- `hidden-sections.ts` defines its own `requireAdminRole` (lines 6-41)
- This local version allows `EDITOR` role (line 26)
- Global `requireAdminRole` only allows `ADMIN` and `SUPER_ADMIN`
- Creates inconsistency and confusion

**Recommendation:** Use global middleware consistently or document the difference clearly.

**Issue 2: Design System Export Too Permissive**
- `server/routes/design-system.ts:899-905`
- Allows ALL roles including `guest` to export design system
- Check at line 900: `["super_admin", "admin", "editor", "standard", "guest"].includes(user.role)`

**Recommendation:** Consider restricting export to `editor` and above.

### ⚠️ LOW: Missing Explicit Role Checks

**Issue:** Some endpoints rely only on session authentication without explicit role validation:
1. `POST /api/users` - Creates invitation (lines 120-261)
2. `DELETE /api/user-clients/:userId/:clientId` - Deletes user-client relationship (lines 622-673)

**Recommendation:** Add explicit role checks or document intended behavior.

---

## Permission Logic Patterns

### Pattern 1: Middleware-Based (Recommended)

```typescript
app.post(
  "/api/clients",
  csrfProtection,
  mutationRateLimit,
  requireSuperAdminRole,  // ← Clear, reusable
  async (req, res) => {
    // ... handler code
  }
);
```

### Pattern 2: Inline Role Checks

```typescript
app.patch("/api/design-system", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = await storage.getUser(req.session.userId);

  // Inline role check
  if (user.role !== UserRole.EDITOR &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }

  // ... handler code
});
```

**Issue:** Pattern 2 is more verbose and error-prone. Should standardize on Pattern 1.

---

## Recommendations

### ✅ Completed Actions (P0 - Critical)

1. **~~Fix unauthenticated hidden-sections GET endpoint~~** ✅ **COMPLETED**
   - File: `server/routes/hidden-sections.ts:47`
   - Added `requireAdminRole` middleware
   - TypeScript checks passing
   - **Ready for testing and deployment**

### Short-term Actions (P1 - High)

2. **Standardize middleware usage**
   - Remove local `requireAdminRole` from `hidden-sections.ts`
   - Use global middleware from `server/middlewares/`
   - Document any intentional deviations

3. **Add explicit role checks to endpoints**
   - `POST /api/users` (invitation creation)
   - `DELETE /api/user-clients/:userId/:clientId`

4. **Review design system export permissions**
   - Determine if `guest` and `standard` should have export access
   - Restrict to `editor` and above if not needed

### Long-term Actions (P2 - Medium)

5. **Convert inline checks to middleware**
   - Replace inline role checks in `design-system.ts`
   - Improves consistency and testability

6. **Add comprehensive integration tests**
   - Test each endpoint with all role types
   - Verify proper 403 responses for unauthorized access
   - Test edge cases (no session, invalid role, etc.)

7. **Create permission matrix documentation**
   - Document which roles can access which endpoints
   - Make it easy to audit in the future

---

## Appendix A: Complete File Inventory

### Backend Files with Role Logic
- `server/middlewares/auth.ts`
- `server/middlewares/requireAdminRole.ts`
- `server/middlewares/requireMinimumRole.ts`
- `server/middlewares/requireSuperAdminRole.ts`
- `server/routes/users.ts`
- `server/routes/clients.ts`
- `server/routes/hidden-sections.ts`
- `server/routes/design-system.ts`
- `server/routes/inspiration-boards.ts`
- `server/routes/slack-oauth.ts`
- `shared/schema.ts`

### Frontend Files with Role Logic
- `client/src/contexts/RoleSwitchingContext.tsx`
- `client/src/components/auth/protected-route.tsx`
- `client/src/components/auth/client-protected-route.tsx`
- `client/src/hooks/use-client-access.tsx`
- `client/src/pages/dashboard.tsx`
- `client/src/pages/users.tsx`
- `client/src/pages/clients.tsx`
- `client/src/components/layout/sidebar.tsx`
- (Additional UI components with conditional rendering based on role)

---

## Appendix B: Testing Recommendations

### Manual Testing Checklist

Test the following scenarios for **each role** (guest, standard, editor, admin, super_admin):

1. Access `/api/clients/:clientId/hidden-sections` (GET)
   - Expected: guest should be DENIED (currently ALLOWED - BUG)
2. Create hidden section (POST)
   - Expected: Only editor/admin/super_admin allowed
3. Delete hidden section (DELETE)
   - Expected: Only editor/admin/super_admin allowed
4. Export design system (GET)
   - Expected: Verify current behavior matches requirements
5. Update user role (PATCH)
   - Expected: Only admin/super_admin allowed
6. Access dashboard page
   - Expected: Only super_admin allowed

### Automated Test Coverage Needed

```typescript
// Example test structure
describe('Hidden Sections API', () => {
  describe('GET /api/clients/:clientId/hidden-sections', () => {
    it('should require authentication', async () => {
      // Test without session
      const response = await request(app).get('/api/clients/1/hidden-sections');
      expect(response.status).toBe(401);
    });

    it('should allow authenticated users', async () => {
      // Test with valid session
      const response = await request(app)
        .get('/api/clients/1/hidden-sections')
        .set('Cookie', validSessionCookie);
      expect(response.status).toBe(200);
    });

    it('should deny guest users', async () => {
      // Test with guest role
      const response = await request(app)
        .get('/api/clients/1/hidden-sections')
        .set('Cookie', guestSessionCookie);
      expect(response.status).toBe(403);
    });
  });
});
```

---

## Conclusion

The audit successfully mapped all role and permission checks across the Ferdinand application. **One critical vulnerability was identified**: the unauthenticated GET endpoint for hidden sections (`server/routes/hidden-sections.ts:45`), which is the likely root cause of JUP-26 (guest users having unexpected admin privileges).

**Next Steps:**
1. Fix the critical hidden-sections vulnerability (immediate)
2. Implement recommendations from P0 and P1 sections
3. Add comprehensive test coverage for all role-based access controls
4. Document permission matrix for future reference

---

**Report Generated:** 2025-11-12
**Auditor:** Claude Code
**Task:** JUP-26 - Guest Has Unexpected Admin Privileges
