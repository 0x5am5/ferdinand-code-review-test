# Brand Guidelines Platform

## Overview

This is a comprehensive brand management platform built with a React frontend and Express.js backend. The application allows organizations to manage brand assets, design systems, typography, color palettes, user personas, and inspiration boards through a centralized dashboard. The platform supports multi-tenancy with role-based access control and provides tools for building and maintaining consistent brand guidelines.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend and backend concerns:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite for development and production builds
- **UI Library**: Radix UI primitives with custom Tailwind CSS styling
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Routing**: Wouter for client-side routing
- **Authentication**: Firebase Authentication with Google OAuth
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Firebase Admin SDK for token verification
- **Session Management**: Express sessions with PostgreSQL store
- **File Processing**: Sharp for image manipulation, multer for file uploads
- **Email Service**: SendGrid with fallback to file-based email generation

## Key Components

### Database Layer
- **ORM**: Drizzle with PostgreSQL adapter using Neon serverless
- **Schema**: Centralized schema definitions in `shared/schema.ts`
- **Migrations**: Custom migration system with versioning support
- **Connection**: Connection pooling with WebSocket support for Neon

### Authentication & Authorization
- **Provider**: Firebase Authentication for identity management
- **Backend Verification**: Firebase Admin SDK validates tokens
- **Role System**: Multi-level access control (super_admin, admin, editor, viewer)
- **Session Persistence**: PostgreSQL-backed sessions with configurable expiration

### Asset Management
- **File Upload**: Multer middleware for multipart form handling
- **Image Processing**: Sharp for format conversion and resizing
- **Storage Strategy**: Local file system with organized directory structure
- **Format Support**: PNG, JPG, SVG, PDF, AI formats with conversion capabilities

### Design System Management
- **Theme Configuration**: JSON-based theme system with CSS custom properties
- **Color Management**: Brand color palettes with semantic token mapping
- **Typography**: Font management with Google Fonts API integration
- **Component Styling**: SCSS modules with mixins for consistent styling

## Data Flow

### Client-Server Communication
1. React frontend makes API requests through TanStack Query
2. Express.js routes handle authentication and business logic
3. Drizzle ORM manages database interactions
4. Response data flows back through the query cache

### Authentication Flow
1. User authenticates with Google via Firebase client SDK
2. Frontend receives ID token and sends to backend
3. Backend verifies token with Firebase Admin SDK
4. Session created and stored in PostgreSQL
5. Subsequent requests authenticated via session cookies

### Asset Upload Flow
1. Client uploads files through React form components
2. Multer middleware processes multipart data
3. Sharp converts and optimizes images
4. Asset metadata stored in database
5. File references returned to client for display

## External Dependencies

### Required Services
- **Database**: PostgreSQL (configured via DATABASE_URL)
- **Authentication**: Firebase project with Admin SDK credentials
- **Email**: SendGrid API (optional, falls back to file generation)
- **Fonts**: Google Fonts API (optional, graceful degradation)

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `FIREBASE_PROJECT_ID`: Firebase project identifier
- `FIREBASE_PRIVATE_KEY`: Service account private key
- `FIREBASE_CLIENT_EMAIL`: Service account email
- `SENDGRID_API_KEY`: Email service API key (optional)
- `SENDGRID_FROM_EMAIL`: Sender email address (optional)
- `GOOGLE_FONTS_API_KEY`: Google Fonts access key (optional)
- `SESSION_SECRET`: Session encryption secret

### Third-Party Integrations
- **Firebase**: Authentication provider and admin services
- **SendGrid**: Transactional email delivery
- **Google Fonts**: Typography asset sourcing
- **Neon**: Serverless PostgreSQL hosting

## Deployment Strategy

### Development Environment
- **Runtime**: Local Node.js with hot reload via Vite
- **Database**: Replit-managed PostgreSQL instance
- **Build Process**: Concurrent frontend and backend development servers
- **Port Configuration**: Multiple ports for different services

### Production Deployment
- **Platform**: Google Cloud Run (configured in `.replit`)
- **Build Process**: 
  1. Vite builds React app to `dist/public`
  2. ESBuild bundles Express server to `dist/index.js`
- **Runtime**: Single Node.js process serving both static assets and API
- **Database**: External PostgreSQL via connection string

### Build Configuration
- **Frontend**: Vite with React plugin and custom path resolution
- **Backend**: ESBuild with external package handling
- **Assets**: Static files served from `dist/public` in production
- **Environment**: NODE_ENV-based configuration switching

## Changelog

```
Changelog:
- June 24, 2025. Debugged and fixed application startup issues:
  * Resolved persistent JSX syntax errors by recreating logos and pattern components
  * Added missing TypeScript interfaces (LogoProps, PatternProps) and BullLogo component
  * Fixed SCSS import conflicts by removing duplicate variables files  
  * Updated import paths to use underscore-prefixed SCSS files
  * Corrected SVG structure and attributes for proper rendering
  * Moved components to proper .tsx files in components/ directory
  * Updated login page imports to reference new component locations
  * Application now compiles and runs successfully on port 5000 with Firebase auth working
- June 22, 2025. Fixed deployment port configuration for Cloud Run compatibility:
  * Updated server to use PORT environment variable with 5100 default for production
  * Simplified port logic: single port for production, fallback ports for development
  * Added Cloud Run compatibility with proper 0.0.0.0 binding
  * Maintained backward compatibility for local development environment
- June 18, 2025. Completed comprehensive Code-Based Design System Builder V1 implementation:
  * Full semantic token generation system (140+ tokens from 23 raw tokens)
  * Automatic neutral color scale generation (11 shades from HSL base)
  * Brand color variations using chroma-js library
  * Real-time preview with component examples and token visualization
  * Comprehensive export functionality (CSS, SCSS, Tailwind with complete configurations)
  * Component property linking system for buttons, inputs, and cards
  * Enhanced backend API with authentication and error handling
- June 18, 2025. Implemented Code-Based Design System Builder V1 - Replaced Figma integration with comprehensive token management system
- June 17, 2025. Fixed Figma Integration feature toggle - Design System tab now appears correctly when enabled
- June 17, 2025. Added Figma Integration feature toggle system with database schema and UI components
- June 16, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
npm run db:push is used for database migrations
If new packages are installed, make sure to run `npm i`
the project runs on http://localhost:3001/
Create appropriate tests for any new features, workflows, helpers. Focus on test only for the current task
make sure all typescript errors are resolved
CLAUDE.md file and replit.md file should be in sync
```