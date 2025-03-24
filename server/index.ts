import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";

const execAsync = promisify(exec);
const app = express();
let server: ReturnType<typeof createServer> | null = null;

// Important: JSON middleware must come before session middleware
app.use(express.json());

// Set up PostgreSQL session store
const PostgresStore = connectPg(session);

// Configure session middleware
app.use(
  session({
    store: new PostgresStore({
      createTableIfMissing: true,
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
    }),
    secret: process.env.SESSION_SECRET || 'dev_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Add error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Increase the maximum number of listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

// Simple cleanup function
async function cleanup() {
  try {
    const port = 5000;
    console.log(`Ensuring port ${port} is free...`);

    // Kill any existing process on port 5000
    await execAsync('npx kill-port 5000');

    // Add a small delay to ensure port is freed
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`Port ${port} is now available`);
  } catch (err) {
    // Ignore errors as the port might not be in use
  }
}

async function startServer() {
  try {
    console.log('Starting server initialization...');

    // First ensure the port is free
    await cleanup();

    // Register API routes
    registerRoutes(app);

    const port = 5000;

    if (process.env.NODE_ENV !== "production") {
      // For development, create server first then setup Vite
      server = createServer(app);
      console.log('Setting up Vite...');
      await setupVite(app, server);
    } else {
      // For production, setup static serving then create server
      console.log('Setting up static serving...');
      serveStatic(app);
      server = createServer(app);
    }

    // Start listening on the port
    console.log(`Starting server on port ${port}...`);

    server.listen(port, '0.0.0.0', () => {
      console.log(`Server started successfully on port ${port}`);
      log(`Server listening at http://0.0.0.0:${port}`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is still in use, cannot start server`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

  } catch (err) {
    console.error("Server startup error:", err);
    process.exit(1);
  }
}

// Handle cleanup for various signals
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGUSR2', cleanup); // Handle nodemon restart

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup().then(() => process.exit(1));
});

// Start the server
console.log('Initiating server startup...');
startServer();