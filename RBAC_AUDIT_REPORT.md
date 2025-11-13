# RBAC Audit Report - Permission Checks Inventory

**Date:** 2025-11-13
**Task:** 7.2 - Audit Existing Permission Checks
**Status:** Complete

## Executive Summary

This audit identified **35+ files** with permission checks across frontend and backend. Key findings:

- ❌ **Critical:** String literals used instead of TypeScript constants in 2 files
- ⚠️ **High Priority:** 40+ lines of complex inline permission logic in `users.ts`
- ⚠️ **High Priority:** Permission logic duplicated across 15+ locations
- ℹ️ **Medium Priority:** Inconsistent middleware usage patterns
- ✅ **Good Pattern:** `asset-permissions.ts` has centralized logic (needs integration)

## Critical Issues Requiring Immediate Attention

### 1. Type Safety Violations (STRING LITERALS)

**Files:**
- `client/src/pages/clients/[id].tsx` (line 342)
- `client/src/pages/dashboard.tsx` (line 635)

**Issue:**
```typescript
// WRONG - Using string literals
if (user?.role !== "admin" && user?.role !== "super_admin") { ... }

// CORRECT - Using TypeScript constants
if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.SUPER_ADMIN) { ... }
```

**Risk:** Type safety lost, prone to typos, won't catch during refactoring

**Action Required:** Replace all string literals with `UserRole` constants before other refactoring

---

## Backend Permission Checks Inventory

### Middleware Usage (8 Files)

| File | Middleware Used | Count | Notes |
|------|----------------|-------|-------|
| `server/routes/personas.ts` | `requireMinimumRole(UserRole.STANDARD)` | 1 | ✅ Good pattern |
| `server/routes/inspiration-boards.ts` | `requireAdminRole` | 4 | ⚠️ Should use requireMinimumRole |
| `server/routes/hidden-sections.ts` | Inline `requireAdminRole` | 3 | ⚠️ Duplicates middleware |
| `server/routes/slack-oauth.ts` | `requireAdminRole` | 3 | ⚠️ Should use requireMinimumRole |
| `server/routes/clients.ts` | `requireSuperAdminRole` | 3 | ⚠️ Should use requireMinimumRole |
| `server/routes/clients.ts` | `requireMinimumRole(UserRole.EDITOR)` | 1 | ✅ Good pattern |

**Finding:** Inconsistent middleware usage across routes. Should standardize on `requireMinimumRole`.

### Inline Role Checks (12 Files)

#### High Complexity Files

**`server/routes/users.ts`** - **PRIORITY: HIGH**
- **Lines 79, 81:** Super admin vs admin listing logic
- **Lines 318-347:** 30+ lines of role change validation
- **Lines 476:** Admin client access validation
- **Issue:** Business logic embedded in route handler
- **Action:** Extract to `server/services/user-permissions.ts`

**`server/routes/design-system.ts`**
- **Lines 658-660:** Three-way role check `editor || admin || super_admin`
- **Lines 901, 1321, 1673:** Role passed to services
- **Issue:** Mixed pattern - sometimes checks, sometimes delegates
- **Action:** Standardize permission checking

**`server/routes/clients.ts`**
- **Lines 28-33, 72:** Super admin bypass logic
- **Line 186:** Uses `requireMinimumRole` (good!)
- **Issue:** Mix of inline checks and middleware
- **Action:** Move all checks to middleware

**`server/routes/google-drive.ts`**
- **Line 224:** Super admin validation check
- **Line 288:** Passes role to service
- **Action:** Use middleware instead of inline check

#### Service Layer

**`server/services/asset-permissions.ts`** - **GOOD PATTERN**
- **Lines 13-19:** Defines `ROLE_PERMISSIONS` constant
```typescript
const ROLE_PERMISSIONS = {
  [UserRole.GUEST]: ["read"],
  [UserRole.STANDARD]: ["read", "write"],
  [UserRole.EDITOR]: ["read", "write", "delete", "share"],
  [UserRole.ADMIN]: ["read", "write", "delete", "share"],
  [UserRole.SUPER_ADMIN]: ["read", "write", "delete", "share"],
}
```
- **Lines 75-95:** Permission matrix lookup with ownership checks
- **Good Practice:** Centralized permission logic
- **Issue:** Duplicates role hierarchy, separate from main permission system
- **Action:** Integrate into unified `shared/permissions.ts`

---

## Frontend Permission Checks Inventory

### Direct Role Checks (20+ Files)

#### High Complexity Files

**`client/src/pages/users.tsx`** - **PRIORITY: HIGH**
- **Lines 417-418:** Delete button visibility
```typescript
currentUser?.role === UserRole.SUPER_ADMIN ||
currentUser?.role === UserRole.ADMIN
```
- **Lines 457, 592:** Super admin-only features
- **Lines 503-559:** Complex role dropdown with disable states (50+ lines)
- **Lines 702-760:** Role badge display with filtering
- **Issue:** 15+ inline role checks, highly duplicated
- **Action:** Create `useUserPermissions()` hook

**`client/src/pages/dashboard.tsx`** - **PRIORITY: HIGH**
- **Lines 157-159:** Delete capability check
```typescript
user.role === UserRole.SUPER_ADMIN ||
user.role === UserRole.ADMIN ||
user.role === UserRole.EDITOR
```
- **Line 635:** ❌ String literal `"super_admin"` used
- **Issue:** Mixed constants and strings
- **Action:** Fix string literal, use permission hook

**`client/src/pages/clients/[id].tsx`** - **PRIORITY: CRITICAL**
- **Line 342:** ❌ String literals used
```typescript
// WRONG!
if (user?.role !== "admin" && user?.role !== "super_admin") { ... }
```
- **Action:** Immediate fix required before other refactoring

**`client/src/pages/clients/users.tsx`** - **PRIORITY: HIGH**
- Similar to `pages/users.tsx` with duplicated logic
- **Lines 503, 521, 595, 619, 624-626:** Multiple admin checks
- **Issue:** Copy-pasted from users.tsx
- **Action:** Share logic via hook

**`client/src/components/search/spotlight-search.tsx`**
- **Lines 75, 98, 134, 166-168:** Multiple admin/editor checks
- **Issue:** Permission logic in UI component
- **Action:** Move to permission hook

**`client/src/components/color-manager/color-card.tsx`** - **GOOD PATTERN**
- **Line 102:** Simple clear check
```typescript
const canEditColors = user?.role !== UserRole.GUEST;
```
- **Good Practice:** Clear, declarative variable name
- **Enhancement:** Use `usePermissions()` hook when available

**`client/src/hooks/use-client-access.tsx`** - **GOOD PATTERN**
- **Lines 34, 43:** Super admin bypass centralized in hook
- **Good Practice:** Reusable permission logic
- **Enhancement:** Extend pattern to general permissions

---

## Key Findings & Impact Assessment

### 1. Inconsistent Middleware Usage
**Impact:** High
**Risk:** Security gaps, difficult to audit
**Affected Files:** 8 backend routes
**Example:**
- `inspiration-boards.ts` uses `requireAdminRole`
- `personas.ts` uses `requireMinimumRole(UserRole.STANDARD)`
- No clear pattern for which to use

**Recommendation:** Standardize on `requireMinimumRole` everywhere

### 2. Duplicated Permission Logic
**Impact:** Critical
**Risk:** Changes require updates in 15+ places, divergence likely
**Affected Areas:**
- Backend middleware (3 files)
- Backend inline checks (12+ files)
- Frontend components (20+ files)
- Service layer (1 file)

**Example:** "Can user delete?" check appears in:
- `users.tsx` (line 417)
- `dashboard.tsx` (line 157)
- `clients/users.tsx` (line 503)
- `spotlight-search.tsx` (line 166)
- ...and 11+ more locations

**Recommendation:** Create shared permission utilities

### 3. Frontend String Literals
**Impact:** Critical
**Risk:** Type safety lost, runtime errors possible
**Affected Files:**
- `clients/[id].tsx` (line 342)
- `dashboard.tsx` (line 635)

**Recommendation:** Fix immediately before other refactoring

### 4. No Centralized Permission System
**Impact:** High
**Risk:** Inconsistent behavior, hard to maintain
**Current State:**
- Each component implements own logic
- No shared vocabulary for permissions
- No caching or optimization

**Recommendation:** Create `shared/permissions.ts` + `usePermissions()` hook

### 5. Asset Permissions vs General Permissions
**Impact:** Medium
**Risk:** Two sources of truth, can diverge
**Issue:** `asset-permissions.ts` has its own `ROLE_PERMISSIONS` matrix

**Current State:**
```typescript
// In asset-permissions.ts
const ROLE_PERMISSIONS = {
  [UserRole.GUEST]: ["read"],
  [UserRole.STANDARD]: ["read", "write"],
  // ...
}
```

**Recommendation:** Move to `shared/permissions.ts` and extend for all resources

### 6. Complex Inline Logic in users.ts
**Impact:** High
**Risk:** Hard to test, business logic in controller
**Lines:** 318-347 (30+ lines of validation)

**Current Issue:**
```typescript
// In route handler - TOO COMPLEX
if (currentUser.role === UserRole.ADMIN) {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
    return res.status(403).json({...});
  }
  if (targetUser.role === UserRole.SUPER_ADMIN) {
    return res.status(403).json({...});
  }
  if (targetUser.id === currentUser.id) {
    return res.status(403).json({...});
  }
  // ... more checks
}
```

**Recommendation:** Extract to `validateRoleChange(currentUser, targetUser, newRole)` service

### 7. Frontend Lacks Permission Caching
**Impact:** Medium
**Risk:** Performance, consistency
**Issue:** Every component accesses `user?.role` directly

**Recommendation:** Implement `usePermissions()` with useMemo/React Query

### 8. Ownership Checks Are Ad-Hoc
**Impact:** Medium
**Risk:** Inconsistent enforcement of "editors can only delete own items"
**Found in:** `asset-permissions.ts` (lines 91-94)
**Missing in:** Most other resources

**Recommendation:** Standardize ownership validation pattern

---

## Permission Patterns Summary

### Current Patterns (5 types found)

1. **Middleware-based** ✅
   - `requireMinimumRole`, `requireAdminRole`, `requireSuperAdminRole`
   - **Keep:** requireMinimumRole
   - **Deprecate:** Others

2. **Inline backend checks** ⚠️
   - `if (user.role === UserRole.X)`
   - **Replace with:** Middleware or service functions

3. **Service-based** ✅
   - `asset-permissions.ts` with role matrix
   - **Extend to:** Unified permission system

4. **Frontend inline checks** ⚠️
   - `user?.role === UserRole.X`
   - **Replace with:** `usePermissions()` hook

5. **Frontend hook-based** ✅
   - `useClientAccess` for multi-tenant
   - **Pattern to follow:** Extend to permissions

### Missing Patterns (Need to implement)

- ❌ Permission-based checks (vs role-based)
- ❌ Ownership validation system
- ❌ Frontend permission caching
- ❌ Declarative permission gates (`<PermissionGate>`)

---

## Refactoring Priority Matrix

### Critical Priority (Fix First)
1. **Fix string literals** in `clients/[id].tsx` and `dashboard.tsx`
2. **Create `shared/permissions.ts`** with role hierarchy and permission matrix
3. **Deprecate duplicate middleware** (`requireAdminRole`, `requireSuperAdminRole`)

### High Priority (Refactor Next)
4. **Extract complex logic** from `server/routes/users.ts` to service
5. **Create `usePermissions()` hook** for frontend
6. **Refactor `users.tsx` and `clients/users.tsx`** to use hook

### Medium Priority (Standardize)
7. **Update all routes** to use `requireMinimumRole` middleware
8. **Integrate `asset-permissions.ts`** into unified system
9. **Replace inline frontend checks** with permission hook

### Low Priority (Polish)
10. **Add ownership validation** utilities
11. **Create `<PermissionGate>` component**
12. **Add permission constants** for actions

---

## Files Requiring Changes

### Backend Files (14 files)

**High Priority:**
- [ ] `server/routes/users.ts` - Extract 40+ lines of role logic
- [ ] `server/routes/design-system.ts` - Standardize permission checks
- [ ] `server/routes/clients.ts` - Move inline checks to middleware

**Medium Priority:**
- [ ] `server/routes/inspiration-boards.ts` - Switch to requireMinimumRole
- [ ] `server/routes/hidden-sections.ts` - Remove inline middleware
- [ ] `server/routes/slack-oauth.ts` - Switch to requireMinimumRole
- [ ] `server/routes/google-drive.ts` - Use middleware instead of inline
- [ ] `server/services/asset-permissions.ts` - Integrate with shared module

**Low Priority (Middleware deprecated after refactor):**
- [ ] `server/middlewares/requireAdminRole.ts` - Mark deprecated
- [ ] `server/middlewares/requireSuperAdminRole.ts` - Mark deprecated
- [ ] `server/middlewares/requireMinimumRole.ts` - Keep and enhance

### Frontend Files (20+ files)

**Critical Priority:**
- [ ] `client/src/pages/clients/[id].tsx` - Fix string literals (line 342)
- [ ] `client/src/pages/dashboard.tsx` - Fix string literal (line 635)

**High Priority:**
- [ ] `client/src/pages/users.tsx` - Replace 15+ role checks with hook
- [ ] `client/src/pages/clients/users.tsx` - Replace duplicate logic with hook
- [ ] `client/src/components/search/spotlight-search.tsx` - Use permission hook

**Medium Priority:**
- [ ] `client/src/components/brand/logo-manager/logo-section.tsx`
- [ ] `client/src/components/brand/asset-manager.tsx`
- [ ] `client/src/components/assets/asset-detail-modal.tsx`
- [ ] `client/src/components/layout/client-sidebar.tsx`
- [ ] `client/src/components/brand/logo-manager/logo-manager.tsx`
- [ ] `client/src/components/brand/color-manager.tsx`
- [ ] `client/src/components/color-manager/color-card.tsx`
- [ ] `client/src/components/type-scale/type-scale-manager.tsx`
- [ ] `client/src/components/brand/font-manager/font-manager.tsx`
- [ ] `client/src/components/brand/logo-manager/asset-section.tsx`
- [ ] `client/src/pages/login.tsx`
- [ ] `client/src/pages/design-builder.tsx`
- [ ] `client/src/pages/admin/settings.tsx`
- [ ] `client/src/components/layout/sidebar.tsx`
- [ ] `client/src/components/layout/role-switching-ribbon.tsx`

**Low Priority (Extend pattern):**
- [ ] `client/src/hooks/use-client-access.tsx` - Extend to permissions

---

## Next Steps for Implementation

### Subtask 7.3: Consolidate Backend Middleware
1. Keep `requireMinimumRole` as primary middleware
2. Add deprecation notices to `requireAdminRole` and `requireSuperAdminRole`
3. Update all routes to use `requireMinimumRole`
4. Write tests for middleware consolidation

### Subtask 7.4: Create Shared Permission Module
1. Create `shared/permissions.ts` with:
   - Role hierarchy constants
   - Permission matrix (from `RBAC_GUIDELINES.md`)
   - `hasPermission(role, action, resource)` utility
   - `canModifyResource(user, resource, action)` ownership checks
2. Create `client/src/hooks/use-permissions.tsx` with:
   - Permission caching
   - `can(action, resource)` method
   - `isRole(role)` method
   - `hasMinimumRole(role)` method
3. Create `client/src/components/PermissionGate.tsx` wrapper component

### Subtask 7.5: Systematic Refactoring
1. **Phase 1:** Fix string literals (Critical files first)
2. **Phase 2:** Refactor backend routes to use unified middleware
3. **Phase 3:** Extract complex permission logic from `users.ts`
4. **Phase 4:** Refactor frontend pages to use `usePermissions` hook
5. **Phase 5:** Update all components to use permission system
6. **Phase 6:** Remove deprecated middleware files

---

## Testing Requirements

All refactored files must include:

1. **Unit Tests**
   - Permission checks for each role
   - Ownership validation
   - Edge cases (null users, missing permissions)

2. **Integration Tests**
   - Backend endpoints with different roles
   - Frontend component rendering based on permissions
   - Multi-tenant access validation

3. **Regression Tests**
   - Use 'acting as' test helper from Task 4
   - Verify all role × permission combinations
   - Test both positive and negative scenarios

---

## Related Documentation

- **Permission Matrix:** See `RBAC_GUIDELINES.md`
- **Best Practices:** See `RBAC_GUIDELINES.md` Implementation Guidelines section
- **Task Tracking:** Task 7 in `.taskmaster/tasks/tasks.json`
- **Project Guidelines:** See `CLAUDE.md` RBAC section

---

**Audit Status:** ✅ Complete
**Last Updated:** 2025-11-13
**Next Review:** After subtask 7.3 completion
