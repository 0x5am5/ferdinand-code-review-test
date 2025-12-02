# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 Critical RBAC Documents (READ FIRST for Permission Work)

When working on ANY permission-related features or bug fixes:

1. **`RBAC_GUIDELINES.md`** - Permission matrix, implementation patterns, best practices
2. **`RBAC_AUDIT_REPORT.md`** - Current issues, files needing refactoring, priorities
3. **See "RBAC System Implementation" section below** for task progress

**Critical Rules:**
- ❌ Never use string literals for roles (e.g., `"admin"`)
- ✅ Always use `UserRole.ADMIN` constants
- ✅ Use `requireMinimumRole()` middleware on backend
- ❌ Do not duplicate permission checks - use shared utilities

## Development Commands

```bash
# Development server (React + Express with hot reload)
npm run dev

# Type checking
npm run check

# Production build (builds both frontend and backend)
npm run build

# Start production server
npm start

# Database migrations
npm run db:push
```

## Code Architecture

### Project Structure
- **Frontend**: React 18 + TypeScript in `client/src/` with Vite bundler
- **Backend**: Express.js + TypeScript in `server/` with ESBuild for production
- **Shared**: Database schema and types in `shared/schema.ts`
- **Database**: PostgreSQL with Drizzle ORM

### Key Directories
- `client/src/components/` - React components organized by feature
- `client/src/lib/` - Client-side utilities and API functions
- `server/routes/` - Express API route handlers
- `server/middlewares/` - Custom Express middleware
- `shared/` - Shared types and database schema

### Import Path Aliases
```typescript
"@/*": ["./client/src/*"]       // Frontend components and utilities
"@shared/*": ["./shared/*"]     // Shared types and schema
```

### Database Schema
All database tables, types, and validation schemas are centralized in `shared/schema.ts`. This file contains:
- PostgreSQL table definitions using Drizzle ORM
- Zod validation schemas for all data operations
- TypeScript types inferred from database schema
- Constants and enums used across the application

### Authentication & Authorization System
- **Frontend**: Firebase Authentication with Google OAuth
- **Backend**: Firebase Admin SDK for token verification
- **Sessions**: Express sessions stored in PostgreSQL
- **Role-based access**: Multi-tenant system with user roles (super_admin, admin, editor, standard, guest)
- **RBAC Guidelines**: See `RBAC_GUIDELINES.md` for complete permission matrix and implementation patterns

#### RBAC Implementation Rules
1. **Backend-First Enforcement**: All permission checks MUST be enforced on the backend. Frontend checks are for UX only.
2. **Use Centralized Middleware**: Use `requireMinimumRole(UserRole.X)` from `server/middlewares/requireMinimumRole.ts`
3. **Use Permission Hook in Frontend**: Use `usePermissions()` hook from `client/src/hooks/use-permissions.tsx` for frontend checks
4. **Permission Matrix**: Follow the role hierarchy and permission matrix defined in `RBAC_GUIDELINES.md`
5. **No Role Hardcoding**: Avoid checking roles directly (e.g., `if (user.role === 'admin')`). Use permission-based checks.
6. **Ownership Checks**: Editors can only delete/update their own resources. Implement ownership validation in routes.

**Frontend Permission Checking:**
```typescript
import { usePermissions, PermissionAction, Resource } from '@/hooks/use-permissions';

// In your component:
const { can, hasRole, canModify, canManageUsers } = usePermissions();

// Check permissions:
if (can(PermissionAction.CREATE, Resource.BRAND_ASSETS)) { /* ... */ }
if (hasRole(UserRole.EDITOR)) { /* ... */ }
if (canModify(PermissionAction.DELETE, Resource.BRAND_ASSETS, ownerId)) { /* ... */ }
```

The `usePermissions()` hook automatically:
- Respects role switching for super admins
- Returns loading states during authentication
- Provides convenient permission checking methods
- Uses the shared permission system from `@shared/permissions`

#### Role Switching System (JUP-38)
Super admins can temporarily view the application as if they had a different role for testing purposes.

**Architecture:**
- **Frontend**: Stores viewing role in sessionStorage (`ferdinand_viewing_role`)
- **HTTP Header**: `X-Viewing-Role` sent with every API request
- **Backend**: `requireMinimumRole` middleware validates and enforces viewing role
- **Security**: Only `SUPER_ADMIN` users can use role switching; all attempts are audit logged

**Key Files:**
- `server/middlewares/requireMinimumRole.ts` - Backend validation and enforcement
- `server/utils/audit-logger.ts` - Audit logging for role switching events
- `client/src/contexts/RoleSwitchingContext.tsx` - Frontend state management
- `client/src/lib/queryClient.ts` & `client/src/lib/api.ts` - Add `X-Viewing-Role` header
- `tests/security/role-switching-validation.test.ts` - Security test suite

**Security Requirements:**
- ✅ Only `SUPER_ADMIN` can use role switching (403 for others)
- ✅ `X-Viewing-Role` header is validated as valid `UserRole` enum
- ✅ All attempts (allowed/denied) are audit logged with full context
- ✅ Backend enforces permissions using viewing role, not actual role
- ✅ Cannot escalate privileges (can only switch to lower roles)

**Documentation:**
- See `ROLE_SWITCHING_IMPLEMENTATION.md` for complete architecture and implementation details
- Session storage key: `ferdinand_viewing_role`
- HTTP header: `X-Viewing-Role`

### API Architecture
- RESTful API routes in `server/routes/`
- Authentication middleware validates Firebase tokens
- Client ID validation middleware for multi-tenant operations
- TanStack React Query for client-side data fetching and caching

### Asset Management Systems

The application has **two distinct asset systems** with different purposes:

#### 1. Brand Assets (`server/routes/brand-assets.ts`)
Design system elements: logos, colors, and fonts
- **Storage**: Database (`brand_assets` table, base64 encoded)
- **CRUD Routes**: `/api/clients/:clientId/brand-assets`
- **Serving Endpoint**: `/api/assets/:assetId/file` (with format conversion)
- **Features**:
  - SVG → PNG/JPG/PDF/AI format conversion
  - Dark/light logo variants
  - Dynamic resizing and caching
- **Frontend Utility**: `getSecureAssetUrl()` in `client/src/components/brand/logo-manager/logo-utils.ts`

#### 2. File Assets (`server/routes/file-assets.ts`)
General file storage: documents, images, videos, any file type
- **Storage**: External (`assets` table, S3 or local filesystem)
- **CRUD Routes**: `/api/clients/:clientId/file-assets` (client-scoped)
- **Serving Endpoint**: `/api/assets/:assetId/download` (direct download, no conversion)
- **Features**:
  - Categories and tags
  - Full-text search
  - Public shareable links with expiration
  - Virus scanning on upload
- **Permissions**: `checkAssetPermission()` service in `server/services/asset-permissions.ts`

**⚠️ CRITICAL CROSSOVER:** The `/api/assets/:assetId/file` endpoint is defined in `brand-assets.ts` and serves brand assets only (not file assets). File assets use `/api/assets/:assetId/download` for direct downloads.

See `ROUTE_PERMISSIONS.md` for complete asset architecture documentation.

### UI Components
- **Design System**: Custom components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Component Library**: Reusable UI components in `client/src/components/ui/`
- **Forms**: React Hook Form with Zod validation

## Important Development Notes

### Type Safety
- Always import types from `shared/schema.ts` instead of using `any`
- Use TypeScript strict mode - avoid `any` types
- Database operations must use proper Drizzle types

### Database Operations
- All database queries use Drizzle ORM
- Schema changes require updating `shared/schema.ts`
- Run `npm run db:push` after schema changes
- Database migrations are handled automatically on server startup

### Error Handling
- API routes return consistent error response format
- Frontend error boundaries catch React component errors
- Toast notifications for user-facing error messages

### File Uploads
- Asset uploads handled by multer middleware
- Image processing with Sharp library
- File storage uses local filesystem in organized directories

### Development Workflow
1. Run `npm run dev` for development server with hot reload
2. Always run `npm run check` for TypeScript validation
3. Database schema changes require `npm run db:push`
4. Production deployment uses single build command

### Feature Flags
The application uses feature toggles stored in the database (`clients.featureToggles`):
- `logoSystem`: Logo asset management
- `colorSystem`: Color palette management  
- `typeSystem`: Typography and type scale management
- `userPersonas`: User persona management
- `inspiration`: Inspiration board functionality
- `figmaIntegration`: Figma design token synchronization

### Multi-tenancy
- All client data is isolated by `clientId`
- Middleware validates user access to specific clients
- Role-based permissions control feature access
- Users can be associated with multiple clients

### RBAC System Implementation (Task 7)
The unified RBAC system is being implemented in Task 7. Key deliverables:
- ✅ **Research & Permission Matrix**: Completed in subtask 7.1 (see `RBAC_GUIDELINES.md`)
- ✅ **Audit**: Completed in subtask 7.2 (see `RBAC_AUDIT_REPORT.md`)
- ⏳ **Middleware Consolidation**: Subtask 7.3 - Refactor backend middleware
- ⏳ **Shared Module**: Subtask 7.4 - Create `shared/permissions.ts`
- ⏳ **Refactoring**: Subtask 7.5 - Update all permission checks

**IMPORTANT - Audit Findings:**
Before making ANY permission-related changes, review `RBAC_AUDIT_REPORT.md` for:
- Critical issues (string literals in 2 files)
- Files requiring refactoring (35+ files identified)
- Current permission patterns and their issues
- Refactoring priority matrix

**Critical Issues to Avoid:**
1. ❌ **DO NOT use string literals** for roles (e.g., `"admin"` instead of `UserRole.ADMIN`)
2. ❌ **DO NOT duplicate permission checks** - use shared utilities
3. ❌ **DO NOT add inline role checks** - use middleware or hooks

When implementing new features, always:
1. Check `RBAC_GUIDELINES.md` for the permission matrix
2. Check `RBAC_AUDIT_REPORT.md` for refactoring priorities
3. Use `requireMinimumRole()` middleware on backend routes
4. Enforce permissions on the backend before any sensitive operations
5. Use `usePermissions()` hook in frontend (when available, subtask 7.4)
6. Never use string literals for role comparisons

## User Preferences

```
Preferred communication style: Simple, everyday language.
npm run db:push is used for database migrations
If new packages are installed, make sure to run `npm i`
the project runs on http://localhost:3001/
Create appropriate tests for any new features, workflows, helpers. Focus on test only for the current task
make sure all typescript errors are resolved
CLAUDE.md file, AGENTS.md file should be in sync
Any authentication/permission should ALWAYS be enforced on the backend
run biome checks after each tasks to fix linting and coding errors
don't create documentation unless specifically asked
do not create new git branches
```

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
