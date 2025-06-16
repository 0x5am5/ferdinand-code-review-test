# Brand Guidelines Management System

## Overview

This is a full-stack web application for managing brand guidelines and design systems. It allows companies to upload, manage, and share brand assets including logos, color palettes, typography, user personas, and inspiration boards. The system includes user management with role-based permissions and Firebase authentication.

## System Architecture

**Architecture Pattern**: Monorepo with clear separation between client and server
- **Frontend**: React with TypeScript, using Vite for development and build
- **Backend**: Express.js with TypeScript, running on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Firebase Auth with Google OAuth
- **File Storage**: Local file system with multer
- **Deployment**: Google Cloud Run

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Styling**: Tailwind CSS with custom SCSS components
- **UI Components**: Custom component library built on Radix UI primitives
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript modules
- **Database ORM**: Drizzle with PostgreSQL adapter
- **Session Management**: Express-session with PostgreSQL store
- **File Uploads**: Multer for multipart form handling
- **Image Processing**: Sharp for image conversion and optimization
- **Email Service**: SendGrid with local file fallback

### Database Schema
- **Users**: Authentication and role management
- **Clients**: Brand organizations with feature toggles
- **Brand Assets**: Logos, fonts, colors with file storage
- **User Personas**: Target audience definitions
- **Inspiration Boards**: Visual reference collections
- **Invitations**: User onboarding system
- **Sessions**: Authentication state persistence

### Authentication System
- **Primary**: Firebase Authentication with Google OAuth
- **Session Management**: Server-side sessions with PostgreSQL storage
- **Authorization**: Role-based access control (Super Admin, Admin, Editor, Viewer)
- **Invitation System**: Token-based user onboarding

## Data Flow

1. **Authentication Flow**:
   - Firebase handles OAuth with Google
   - Backend validates Firebase tokens
   - Server creates/maintains sessions
   - Role-based route protection

2. **Asset Management Flow**:
   - File uploads processed by multer
   - Sharp converts images to multiple formats
   - Converted assets stored with metadata
   - Assets served with download capabilities

3. **Design System Flow**:
   - Theme configuration stored as JSON
   - CSS variables updated dynamically
   - SCSS compilation for custom styling
   - Real-time preview updates

## External Dependencies

### Authentication
- Firebase Authentication for Google OAuth
- Firebase Admin SDK for token validation

### Email Services
- SendGrid for transactional emails
- Local file fallback for development

### File Processing
- Sharp for image processing and conversion
- PDF-lib for PDF document generation

### Database
- Neon PostgreSQL for production
- Local PostgreSQL for development

### Styling
- Adobe Fonts integration (Typekit)
- Google Fonts API integration

## Deployment Strategy

**Platform**: Google Cloud Run with automated deployment
- **Development**: Local development with Vite dev server
- **Build Process**: Vite builds client, esbuild bundles server
- **Production**: Single container with static file serving
- **Database**: Neon PostgreSQL with connection pooling
- **Environment**: Docker containerization for Cloud Run

**Port Configuration**:
- Development server: 3000
- Production server: 5000
- Database connections via environment variables

**Session Storage**: PostgreSQL-backed sessions for scalability

Changelog:
- June 16, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.