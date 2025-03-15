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

// Cleanup handler with proper error handling
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
  process.exit(0);
}

// Handle cleanup for various signals
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGUSR2', cleanup); // Handle nodemon restart

async function startServer() {
  try {
    // Close existing server if any
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }

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

    // Start server with proper error handling
    await new Promise<void>((resolve, reject) => {
      try {
        const port = process.env.PORT || 5000;
        server!.on('error', async (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use. Trying to free it up...`);
            try {
              await execAsync(`npx kill-port ${port}`);
              server!.listen(port, () => {
                console.log(`Server started on port ${port}`);
                log(`Server listening at http://0.0.0.0:${port}`);
                resolve();
              });
            } catch (err) {
              console.error('Failed to free up port:', err);
              reject(error);
            }
          } else {
            reject(error);
          }
        });

        server!.listen(port, () => {
          console.log(`Server started on port ${port}`);
          log(`Server listening at http://0.0.0.0:${port}`);
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });

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