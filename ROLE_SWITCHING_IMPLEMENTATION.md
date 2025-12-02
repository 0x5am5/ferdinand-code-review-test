# Role Switching Implementation (JUP-38)

## Overview

Role switching allows **super admins** to temporarily view the application as if they had a different role (Admin, Editor, Standard, or Guest). This is useful for testing permissions and seeing what different users experience.

## Problem Statement

Previously, the role switching feature was broken because:
- **Frontend** tracked the viewing role in React state and sessionStorage (`RoleSwitchingContext.tsx`)
- **Backend** middleware (`requireMinimumRole.ts`) always checked the user's actual role from the database
- **No communication** existed between frontend and backend about role switching
- **Result**: Backend always enforced permissions based on actual role, ignoring the frontend's viewing role

## Solution: Header-Based Role Switching

The fix implements a header-based approach where the frontend sends an `X-Viewing-Role` HTTP header with every API request.

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
├─────────────────────────────────────────────────────────────────────┤
│  1. Super admin selects role in UI (role-switching-ribbon.tsx)      │
│  2. Role stored in sessionStorage ("ferdinand_viewing_role")         │
│  3. Every API request includes X-Viewing-Role header                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                    │
├─────────────────────────────────────────────────────────────────────┤
│  1. requireMinimumRole middleware receives request                  │
│  2. Checks if user is SUPER_ADMIN                                   │
│  3. If yes, reads X-Viewing-Role header                             │
│  4. Validates header is a valid UserRole enum value                 │
│  5. Uses viewing role (not actual role) for permission checks       │
└─────────────────────────────────────────────────────────────────────┘
```

## Files Modified

### Backend

#### `server/middlewares/requireMinimumRole.ts`
- **Lines 19-35**: Added X-Viewing-Role header support
- Only processes header for users with `SUPER_ADMIN` role
- Validates viewing role is a valid `UserRole` enum value
- Returns 400 error for invalid roles
- Uses viewing role as effective role for permission checks

```typescript
// Key logic (lines 19-35)
if (user.role === UserRole.SUPER_ADMIN) {
  const viewingRole = req.headers["x-viewing-role"] as UserRoleType | undefined;

  if (viewingRole) {
    if (Object.values(UserRole).includes(viewingRole)) {
      effectiveRole = viewingRole;
    } else {
      return res.status(400).json({ message: "Invalid viewing role specified" });
    }
  }
}
```

### Frontend

#### `client/src/lib/queryClient.ts`
- **`apiRequest` function**: Adds `X-Viewing-Role` header from sessionStorage
- **`getQueryFn` function**: Adds `X-Viewing-Role` header for query requests

```typescript
// Both functions now include:
const viewingRole = sessionStorage.getItem("ferdinand_viewing_role");
if (viewingRole) {
  headers["X-Viewing-Role"] = viewingRole;
}
```

#### `client/src/lib/api.ts`
- **`apiRequest` function**: Adds `X-Viewing-Role` header from sessionStorage

#### `client/src/contexts/RoleSwitchingContext.tsx`
- **Simplified** to remove user switching (scope limited to role switching only)
- Manages `currentViewingRole` state
- Persists to sessionStorage (`ferdinand_viewing_role`)
- Provides `canAccessCurrentPage()` to determine if a role can view current page

**Exports:**
- `currentViewingRole` - The role the super admin is viewing as
- `actualUserRole` - The user's real role (always `super_admin` for role switchers)
- `switchRole(role)` - Function to change viewing role
- `resetRole()` - Function to revert to actual role
- `isRoleSwitched` - Boolean indicating if currently viewing as different role
- `isReady` - Boolean indicating if context is initialized
- `canAccessCurrentPage(role)` - Function to check if a role can access current page

#### `client/src/components/layout/role-switching-ribbon.tsx`
- Simplified UI showing only role selection dropdown
- Shows "(No access)" for roles that can't view current page
- Only visible to super admins

#### `client/src/components/layout/role-switching-fab.tsx`
- Floating action button version of role switcher
- Same functionality as ribbon

#### `client/src/components/layout/role-indicator-banner.tsx`
- Shows banner when role is switched
- Allows quick reset to actual role

#### `client/src/pages/dashboard.tsx`
- Removed user switching references (unused imports cleaned up)

## Page Access Rules

Defined in `RoleSwitchingContext.tsx` lines 84-118:

| Page | Allowed Roles |
|------|---------------|
| `/dashboard` | `super_admin` only |
| `/users` | `super_admin`, `admin` |
| `/clients` | `super_admin`, `admin` |
| `/design-builder` | `super_admin`, `admin`, `editor` |
| `/clients/*` | All roles |
| Default | All roles |

## SessionStorage Keys

- `ferdinand_viewing_role` - Stores the current viewing role (e.g., "editor", "standard")

## HTTP Headers

- `X-Viewing-Role` - Sent with every API request when role switching is active

## Security Considerations

1. **Super Admin Only**: Only users with `SUPER_ADMIN` role can use role switching
2. **Header Validation**: Backend validates the viewing role is a valid enum value
3. **Server-Side Enforcement**: All permission checks happen on the backend - frontend is for UX only
4. **Cannot Escalate**: Super admin can only switch to lower roles, never higher

## Testing the Feature

1. Log in as a super admin
2. Look for the role switcher in the sidebar (eye icon with "View as:" dropdown)
3. Select a different role (e.g., "Editor")
4. Notice:
   - UI changes to reflect the selected role's permissions
   - API requests now include `X-Viewing-Role: editor` header
   - Backend enforces permissions as if you were an editor
5. Try accessing pages/features that the selected role shouldn't have access to
6. Click the X button to reset to your actual role

## Removed Features

The following were removed to simplify scope:
- **User switching**: Previously could switch to view as a specific user (not just role)
- Related removed functions: `switchToUser`, `currentViewingUser`, `isUserSwitched`, `getEffectiveClientId`
- Related removed sessionStorage key: `ferdinand_viewing_user`

## Future Considerations

If user switching needs to be re-added:
1. Add `X-Viewing-User-Id` header
2. Backend would need to fetch that user and use their role/client access
3. Would require additional security validation

## Related Files for Reference

- `RBAC_GUIDELINES.md` - Full RBAC permission matrix
- `RBAC_AUDIT_REPORT.md` - Audit of permission implementation
- `shared/schema.ts` - `UserRole` enum definition
