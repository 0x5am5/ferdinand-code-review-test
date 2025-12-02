# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Asset Systems
Ferdinand has two complementary asset systems - **never confuse them**:
- **Brand Assets** (`/api/brand-assets`, `/api/clients/:clientId/brand-assets`): Design system elements (logos, fonts, colors, typography) stored in PostgreSQL with automatic format conversion and dark variant support
- **File Assets** (`/api/assets`, `/api/clients/:clientId/assets`): General file storage (documents, images, videos) with external backends, search, categories, tags, and public sharing
- See `docs/ASSET-SYSTEMS.md` for detailed comparison and use case guidelines

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