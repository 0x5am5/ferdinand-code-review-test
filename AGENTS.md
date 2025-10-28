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

### Authentication System
- **Frontend**: Firebase Authentication with Google OAuth
- **Backend**: Firebase Admin SDK for token verification
- **Sessions**: Express sessions stored in PostgreSQL
- **Role-based access**: Multi-tenant system with user roles (super_admin, admin, editor, standard, guest)

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
```