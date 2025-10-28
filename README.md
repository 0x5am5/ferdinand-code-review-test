# Ferdinand Design System Manager

A comprehensive design system management platform built with React, TypeScript, and Express. Ferdinand helps organizations create, manage, and maintain consistent design systems across teams and projects.

## Features

### Core Design System Management
- **Logo System**: Upload and manage brand logos in multiple formats (PNG, SVG, PDF, AI)
- **Color System**: Create and organize brand color palettes with automatic accessibility checks
- **Typography System**: Manage fonts from Google Fonts, Adobe, or custom uploads with type scales
- **Asset Management**: Centralized storage and organization of design assets
- **Inspiration Boards**: Curate and share design inspiration with your team

### Advanced Features
- **Figma Integration**: Sync design tokens directly with Figma projects
- **User Personas**: Define and manage user personas for design decisions
- **Multi-tenancy**: Support for multiple clients/organizations with isolated data
- **Role-based Access Control**: Granular permissions (Super Admin, Admin, Editor, Standard, Guest)
- **Design Token Export**: Export design systems in various formats for development teams

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible component primitives
- **TanStack React Query** for server state management
- **React Hook Form** with Zod validation
- **Framer Motion** for animations

### Backend  
- **Express.js** with TypeScript
- **PostgreSQL** database
- **Drizzle ORM** for type-safe database operations
- **Firebase Authentication** with Google OAuth
- **Express Sessions** with PostgreSQL storage
- **Multer & Sharp** for file uploads and image processing

### Infrastructure
- **Firebase Admin SDK** for authentication
- **SendGrid** for email notifications
- **ESBuild** for production bundling

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Firebase project with Authentication enabled
- SendGrid account (for email notifications)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/ferdinand

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Session Security
SESSION_SECRET=your-secure-session-secret

# Email Service
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-verified-sender@domain.com

# Development
NODE_ENV=development
PORT=3001
```

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ferdinand
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:push
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

## Authentication & User Management

**Important**: This application uses a whitelist-based authentication system. Users must be manually added to the database before they can log in, even with valid Google credentials.

### Adding Users to the Database

To add a new user, you need to directly insert them into the PostgreSQL database:

```sql
INSERT INTO users (email, name, role, created_at, updated_at) 
VALUES (
    'user@example.com',
    'User Name', 
    'standard',  -- Can be: super_admin, admin, editor, standard, guest
    NOW(),
    NOW()
);
```

### User Roles

#### **Super Admin** (`super_admin`)
- **Full system access** - can view all users across all clients
- **Client management** - unrestricted access to all clients
- **User management** - can view all invitations and manage users
- **Design system modification** - can modify design systems and assets
- **Figma integration** - can create, sync, and delete Figma connections
- **Section management** - can hide/show sections across all clients

#### **Admin** (`admin`)
- **Client-specific access** - can only view users within their assigned clients
- **Limited client management** - access restricted to their associated clients
- **User management** - can view invitations for their clients
- **Design system modification** - can modify design systems and assets
- **Figma integration** - can create, sync, and delete Figma connections
- **Section management** - can hide/show sections within their clients

#### **Editor** (`editor`)
- **Content creation and editing** - can create and edit content within assigned clients
- **Design system modification** - can modify design systems and assets
- **Figma integration** - can create, sync, and delete Figma connections
- **Asset management** - can upload and manage brand assets

#### **Standard** (`standard`)
- **Basic user access** - default role for new users
- **Feature usage** - can use features within assigned clients
- **Read access** - can view design systems and assets
- **Limited permissions** - cannot modify design systems or manage integrations

#### **Guest** (`guest`)
- **Most limited access** - minimal permissions
- **Read-only access** - can view content but cannot modify anything
- **No administrative functions** - cannot access user management or settings

### Permission Matrix

| Feature | Guest | Standard | Editor | Admin | Super Admin |
|---------|-------|----------|--------|-------|-------------|
| View design systems | ✅ | ✅ | ✅ | ✅ | ✅ |
| Use features | ❌ | ✅ | ✅ | ✅ | ✅ |
| Modify design systems | ❌ | ❌ | ✅ | ✅ | ✅ |
| Upload/manage assets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Figma integration | ❌ | ❌ | ✅ | ✅ | ✅ |
| Hide/show sections | ❌ | ❌ | ❌ | ✅ | ✅ |
| View invitations | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users (own clients) | ❌ | ❌ | ❌ | ✅ | ✅ |
| View all users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Access all clients | ❌ | ❌ | ❌ | ❌ | ✅ |

### Multi-tenant Setup

To associate a user with a specific client organization:

```sql
-- First, create a client
INSERT INTO clients (name, created_at, updated_at, feature_toggles) 
VALUES (
    'Your Organization Name',
    NOW(),
    NOW(),
    '{"logoSystem": true, "colorSystem": true, "typeSystem": true}'::jsonb
);

-- Then, associate the user with the client
INSERT INTO user_clients (user_id, client_id, role, created_at, updated_at)
VALUES (
    (SELECT id FROM users WHERE email = 'user@example.com'),
    (SELECT id FROM clients WHERE name = 'Your Organization Name'),
    'admin',
    NOW(),
    NOW()
);
```

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run check

# Build for production (frontend + backend)
npm run build

# Start production server
npm start

# Database migrations
npm run db:push
```

## Project Structure

```
ferdinand/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── lib/          # Utilities and API functions
│   │   └── ...
├── server/                # Express backend
│   ├── routes/           # API route handlers
│   ├── migrations.ts     # Database migrations
│   ├── storage.ts        # Database operations
│   └── ...
├── shared/               # Shared types and schema
│   └── schema.ts         # Database schema & validation
└── ...
```

## Database Schema

The application uses Drizzle ORM with PostgreSQL. Key tables include:

- `users`: User accounts and authentication
- `clients`: Organizations/tenants
- `user_clients`: User-client associations with roles
- `logos`, `colors`, `fonts`: Design system assets
- `personas`: User persona definitions
- `inspiration_boards`: Design inspiration collections

## Feature Toggles

Clients can have features enabled/disabled via the `feature_toggles` JSON field:

```json
{
  "logoSystem": true,
  "colorSystem": true, 
  "typeSystem": true,
  "userPersonas": false,
  "inspiration": true,
  "figmaIntegration": false
}
```

## Development

### Code Style
- TypeScript strict mode enabled
- Avoid `any` types - import proper types from `shared/schema.ts`
- Use consistent naming conventions
- Follow existing component patterns

### Database Changes
1. Update `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update TypeScript types accordingly

# Local PostgreSQL Database Setup

This guide explains how to use a local PostgreSQL database for development instead of the remote Neon database.

## ✅ Setup Complete

Your local PostgreSQL database is now set up and ready to use!

- **Database Name:** `ferdinand_dev`
- **Connection URL:** `postgresql://samuelgregory@localhost:5432/ferdinand_dev`
- **All tables created:** 19 tables migrated successfully

## 🔄 Switching Between Local and Remote Databases

The app automatically detects whether you're using a local or remote database based on the `DATABASE_URL` in your `.env` file.

### Use Local Database (Current Setup)
```env
DATABASE_URL=postgresql://samuelgregory@localhost:5432/ferdinand_dev
```

### Use Remote Neon Database
```env
DATABASE_URL=postgresql://neondb_owner:npg_VcIOBQmlY81h@ep-spring-bonus-a581cq2t.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## 🚀 Starting Your App

Just run your app normally:
```bash
npm run dev
```

The console will show which database you're connected to:
- 🔧 Using local PostgreSQL database (local)
- ☁️  Using Neon serverless database (remote)

## 🔓 Bypassing Firebase Authentication for Local Development

If you can't whitelist your local domain in Firebase, you can bypass authentication entirely during local development:

### Setup

1. Add these environment variables to your `.env` file:
```env
BYPASS_AUTH_FOR_LOCAL_DEV=true
DEV_USER_EMAIL=your-email@example.com
```

2. Make sure the email matches a user that exists in your local database.

### How it Works

When `BYPASS_AUTH_FOR_LOCAL_DEV=true`:
- The app skips Firebase token verification
- Automatically logs you in as the user specified in `DEV_USER_EMAIL`
- Creates a session without requiring any authentication

### Security

**⚠️ IMPORTANT**: This bypass will **NEVER** work in production. The middleware has built-in safeguards that prevent it from running when `NODE_ENV=production`.

If you accidentally enable this in production, the app will return a 500 error instead of bypassing auth.

## 📊 Database Management

### View all tables
```bash
psql -U samuelgregory -d ferdinand_dev -c "\dt"
```

### Run SQL queries
```bash
psql -U samuelgregory -d ferdinand_dev
```

### Export data from remote to local
```bash
# Dump from remote Neon database
DATABASE_URL="<remote-neon-url>" pg_dump > backup.sql

# Import to local
psql -U samuelgregory -d ferdinand_dev -f backup.sql
```

### Reset local database
```bash
# Drop and recreate database
psql -U samuelgregory -d postgres -c "DROP DATABASE ferdinand_dev;"
psql -U samuelgregory -d postgres -c "CREATE DATABASE ferdinand_dev;"

# Re-run migrations
cd migrations
sed 's/^\/\*//' 0000_jittery_ma_gnuci.sql | sed 's/\*\///' | psql -U samuelgregory -d ferdinand_dev
```

## 🛠️ PostgreSQL Service Management

### Check if PostgreSQL is running
```bash
brew services list | grep postgresql
```

### Start PostgreSQL
```bash
brew services start postgresql@14
```

### Stop PostgreSQL
```bash
brew services stop postgresql@14
```

### Restart PostgreSQL
```bash
brew services restart postgresql@14
```

## 📝 Notes

- The local database starts empty. You'll need to seed it with test data or import from your remote database.
- The `.env.remote` file contains a backup of your remote database configuration.
- The database connection logic is in `server/db.ts` and automatically chooses the right driver based on the URL.

## 🔍 Troubleshooting

### App hangs on startup
- Make sure PostgreSQL is running: `brew services list | grep postgresql`
- Test connection manually: `psql -U samuelgregory -d ferdinand_dev -c "SELECT 1;"`

### Connection refused
- Ensure PostgreSQL is running on port 5432
- Check if another process is using port 5432: `lsof -i :5432`

### Tables not found
- Re-run the migrations as shown in "Reset local database" above


### Testing
- Run `npm run check` for TypeScript validation
- Ensure all type errors are resolved before committing
- Create tests for new features focusing on the current task

## Contributing

1. Follow the existing code conventions
2. Update TypeScript types when making schema changes
3. Test thoroughly before committing
4. Keep commits focused and well-documented

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please check the existing documentation or create an issue in the project repository.