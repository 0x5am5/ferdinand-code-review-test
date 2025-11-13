# RBAC Guidelines for Ferdinand Application

**Last Updated:** 2025-11-13
**Source:** Task 7.1 - Research RBAC Best Practices

## Overview

This document defines the Role-Based Access Control (RBAC) system for the Ferdinand application. All developers must follow these guidelines when implementing features, adding routes, or modifying permission logic.

## Core Principles

### 1. Backend-First Enforcement
- **Backend APIs are the ultimate authority** for all authorization decisions
- All permission checks MUST occur on the server before executing sensitive operations
- Frontend permission checks are for UX only (hiding/disabling UI elements)
- **Never trust frontend checks alone** - always enforce on backend

### 2. Centralized Permission Management
- Use the shared permission module (`shared/permissions.ts`) as the single source of truth
- Permission matrix maps roles → actions → resources
- **Avoid hardcoding roles** directly in component or route code
- Use declarative permission checking: `hasPermission('resource:action')`

### 3. Role Hierarchy
The application uses a hierarchical role system:

```
super_admin (level 5) > admin (level 4) > editor (level 3) > standard (level 2) > guest (level 1)
```

Higher roles inherit all permissions from lower roles.

## Role Definitions

### Role Hierarchy & Permissions

| Role | Level | Description | Permissions |
|------|-------|-------------|-------------|
| **guest** | 1 | Read-only observer | Read all resources within assigned client |
| **standard** | 2 | Basic user | Read all + Create (assets, inspiration boards) |
| **editor** | 3 | Content creator | Read all + Create all + Update all + Delete own items |
| **admin** | 4 | Client administrator | Full CRUD within client + Manage client users |
| **super_admin** | 5 | Platform administrator | All permissions across all clients |

## Permission Matrix

### Resources and Actions

| Resource | Actions | Guest | Standard | Editor | Admin | Super Admin |
|----------|---------|-------|----------|--------|-------|-------------|
| **Brand Assets** (logos, colors, fonts) | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| | create | ❌ | ✅ | ✅ | ✅ | ✅ |
| | update | ❌ | ❌ | ✅ | ✅ | ✅ |
| | delete | ❌ | ❌ | ✅* | ✅ | ✅ |
| **File Assets** | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| | create | ❌ | ✅ | ✅ | ✅ | ✅ |
| | update | ❌ | ❌ | ✅ | ✅ | ✅ |
| | delete | ❌ | ❌ | ✅* | ✅ | ✅ |
| | share | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Type Scales** | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| | create | ❌ | ❌ | ✅ | ✅ | ✅ |
| | update | ❌ | ❌ | ✅ | ✅ | ✅ |
| | delete | ❌ | ❌ | ✅* | ✅ | ✅ |
| **User Personas** | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| | create | ❌ | ❌ | ✅ | ✅ | ✅ |
| | update | ❌ | ❌ | ✅ | ✅ | ✅ |
| | delete | ❌ | ❌ | ✅* | ✅ | ✅ |
| **Inspiration Boards** | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| | create | ❌ | ✅ | ✅ | ✅ | ✅ |
| | update | ❌ | ❌ | ✅ | ✅ | ✅ |
| | delete | ❌ | ❌ | ✅* | ✅ | ✅ |
| **Users** | read | ❌ | ❌ | ❌ | ✅ | ✅ |
| | create | ❌ | ❌ | ❌ | ✅ | ✅ |
| | update | ❌ | ❌ | ❌ | ✅ | ✅ |
| | delete | ❌ | ❌ | ❌ | ✅ | ✅ |
| | manage_roles | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Clients** | read | ❌ | ❌ | ❌ | ❌ | ✅ |
| | create | ❌ | ❌ | ❌ | ❌ | ✅ |
| | update | ❌ | ❌ | ❌ | ❌ | ✅ |
| | delete | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** | read | ❌ | ❌ | ❌ | ✅ | ✅ |
| | update | ❌ | ❌ | ❌ | ✅ | ✅ |

**Note:** * Editors can only delete their own items, not items created by others.

## Implementation Guidelines

### Backend Implementation

#### Middleware Usage

**Primary Middleware** (Use these):
- `requireMinimumRole(role)` - Checks if user meets minimum role requirement
- `requirePermission(action, resource)` - Checks specific permission (to be implemented)

**Deprecated Middleware** (Avoid these, use `requireMinimumRole` instead):
- `requireAdminRole` - Use `requireMinimumRole(UserRole.ADMIN)` instead
- `requireSuperAdminRole` - Use `requireMinimumRole(UserRole.SUPER_ADMIN)` instead

#### Example Backend Usage

```typescript
import { requireMinimumRole } from '../middlewares/requireMinimumRole';
import { UserRole } from '@shared/schema';

// Protecting a route that requires editor role or higher
router.post(
  '/api/clients/:clientId/brand-assets',
  requireMinimumRole(UserRole.EDITOR),
  async (req, res) => {
    // Handle creation
  }
);

// Protecting a route that requires admin role or higher
router.delete(
  '/api/clients/:clientId/users/:userId',
  requireMinimumRole(UserRole.ADMIN),
  async (req, res) => {
    // Handle deletion
  }
);
```

#### Ownership Checks

For resources that editors can only delete if they own them:

```typescript
router.delete(
  '/api/clients/:clientId/assets/:assetId',
  requireMinimumRole(UserRole.EDITOR),
  async (req, res) => {
    const asset = await storage.getAsset(req.params.assetId);

    // Admins and super_admins can delete any asset
    if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN) {
      await storage.deleteAsset(req.params.assetId);
      return res.json({ success: true });
    }

    // Editors can only delete their own assets
    if (asset.createdBy !== req.user.id) {
      return res.status(403).json({
        message: 'You can only delete your own assets'
      });
    }

    await storage.deleteAsset(req.params.assetId);
    res.json({ success: true });
  }
);
```

### Frontend Implementation

#### Permission Hooks

**Current Hooks:**
- `useAuth()` - Get current user and authentication state
- `useClientAccess(clientId)` - Check if user has access to a specific client

**To Be Implemented:**
- `usePermissions()` - Centralized permission checking with caching
- `<PermissionGate permission="resource:action">` - Component for conditional rendering

#### Example Frontend Usage

**Current Pattern (Role-based):**
```typescript
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@shared/schema';

function AssetManager() {
  const { user } = useAuth();

  // Check if user can create assets
  const canCreate = user && [
    UserRole.STANDARD,
    UserRole.EDITOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ].includes(user.role);

  const canDelete = user && [
    UserRole.EDITOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ].includes(user.role);

  return (
    <div>
      {canCreate && <Button>Create Asset</Button>}
      {canDelete && <Button>Delete</Button>}
    </div>
  );
}
```

**Future Pattern (Permission-based, to be implemented):**
```typescript
import { usePermissions } from '@/hooks/use-permissions';

function AssetManager() {
  const { can } = usePermissions();

  return (
    <div>
      {can('create', 'assets') && <Button>Create Asset</Button>}
      {can('delete', 'assets') && <Button>Delete</Button>}
    </div>
  );
}
```

## Testing Guidelines

### Required Tests

All permission-related features must include:

1. **Backend API Tests:**
   - Test each role's access to protected endpoints
   - Test both allowed and denied scenarios
   - Use the 'acting as' test helper for role simulation
   - Verify proper HTTP status codes (401, 403, 200)

2. **Frontend Component Tests:**
   - Verify UI elements are shown/hidden based on permissions
   - Test button states (enabled/disabled)
   - Test route protection and redirects

3. **Integration Tests:**
   - Verify frontend and backend permission enforcement align
   - Test edge cases (ownership checks, multi-tenant access)

### Example Test Pattern

```typescript
describe('Asset Management Permissions', () => {
  test('guest users cannot create assets', async () => {
    const response = await request(app)
      .post('/api/clients/1/assets')
      .set('Cookie', guestUserCookie)
      .send({ name: 'Test Asset' });

    expect(response.status).toBe(403);
  });

  test('editor can create assets', async () => {
    const response = await request(app)
      .post('/api/clients/1/assets')
      .set('Cookie', editorUserCookie)
      .send({ name: 'Test Asset' });

    expect(response.status).toBe(201);
  });

  test('editor cannot delete assets they do not own', async () => {
    const response = await request(app)
      .delete('/api/clients/1/assets/123')
      .set('Cookie', editorUserCookie);

    expect(response.status).toBe(403);
  });
});
```

## Migration Strategy

When refactoring existing code to use the unified permission system:

1. **Identify** all existing permission checks (both frontend and backend)
2. **Map** them to the permission matrix defined in this document
3. **Replace** hardcoded role checks with centralized permission functions
4. **Test** thoroughly using both manual and automated tests
5. **Document** any special cases or exceptions

## Common Pitfalls to Avoid

❌ **Don't:** Check roles directly in components
```typescript
if (user.role === 'admin') { ... }
```

✅ **Do:** Use permission-based checks
```typescript
if (can('manage', 'users')) { ... }
```

❌ **Don't:** Skip backend permission checks
```typescript
// Frontend only - INSECURE!
router.delete('/api/assets/:id', async (req, res) => {
  await deleteAsset(req.params.id);
});
```

✅ **Do:** Always enforce on backend
```typescript
router.delete('/api/assets/:id',
  requireMinimumRole(UserRole.EDITOR),
  async (req, res) => {
    await deleteAsset(req.params.id);
  }
);
```

❌ **Don't:** Duplicate permission logic
```typescript
// Multiple places checking the same thing
const isAdmin = user.role === 'admin' || user.role === 'super_admin';
```

✅ **Do:** Use centralized utilities
```typescript
import { hasMinimumRole } from '@shared/permissions';
const isAdmin = hasMinimumRole(user.role, UserRole.ADMIN);
```

## Questions or Updates?

If you have questions about permissions or need to propose changes to this system:

1. Review this document first
2. Check existing implementation in `shared/permissions.ts`
3. Discuss with the team before making changes
4. Update this document when the permission matrix changes
5. Ensure all tests pass after modifications

---

**Related Files:**
- `shared/schema.ts` - Role definitions
- `shared/permissions.ts` - Permission matrix and utilities (to be created)
- `server/middlewares/requireMinimumRole.ts` - Backend middleware
- `client/src/hooks/use-auth.tsx` - Frontend authentication
- Task 7 in `.taskmaster/tasks/tasks.json` - Implementation tracking
