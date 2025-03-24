import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";

const execAsync = promisify(exec);
const app = express();

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

let server: ReturnType<typeof createServer> | null = null;

// Increase the maximum number of listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

// Enhanced cleanup handler with retry mechanism
async function cleanup() {
  if (server) {
    try {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Server shut down complete');
    } catch (err) {
      console.error('Error during server shutdown:', err);
    }
  }

  // Force kill any process on port 5000
  try {
    await execAsync('npx kill-port 5000');
    // Add a small delay to ensure port is freed
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (err) {
    console.error('Error killing port:', err);
  }
}

// Handle cleanup for various signals
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGUSR2', cleanup); // Handle nodemon restart

async function startServer() {
  try {
    // Ensure port is free before starting
    await cleanup();

    // Create new server instance
    server = createServer(app);

    // Register routes
    registerRoutes(app);

    // Setup middleware based on environment
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server with proper error handling and retry mechanism
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const port = 5000; // Hard code to port 5000 as required
        await new Promise<void>((resolve, reject) => {
          server!.listen(port, '0.0.0.0', () => {
            console.log(`Server started on port ${port}`);
            log(`Server listening at http://0.0.0.0:${port}`);
            resolve();
          });

          server!.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`Port ${port} is in use`));
            } else {
              reject(error);
            }
          });
        });
        break; // If successful, exit the retry loop
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error(`Failed to start server after ${maxRetries} attempts`);
        }
        console.log(`Retry attempt ${retryCount}/${maxRetries}`);
        await cleanup(); // Ensure cleanup before retry
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
      }
    }
  } catch (err) {
    console.error("Server startup error:", err);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup();
});

// Start the server
startServer();