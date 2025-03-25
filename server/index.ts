import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import { runMigrations } from "./migrations";

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
    // Try to clean up both potential ports
    const ports = [3000, 3001];
    
    for (const port of ports) {
      console.log(`Cleaning up port ${port}...`);
      
      try {
        // Kill any existing process on the port
        await execAsync(`npx kill-port ${port}`);
        console.log(`Port ${port} is now available`);
      } catch (err) {
        // Ignore errors as the port might not be in use
        console.log(`No cleanup needed for port ${port}`);
      }
    }

    // Add a small delay to ensure ports are freed
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (err) {
    console.log('Error during cleanup:', err);
  }
}

// Attempt to start the server multiple times
async function startServer(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Starting server (attempt ${attempt}/${retries})...`);

      // First ensure the port is free
      await cleanup();
      
      // Run database migrations
      console.log('Running database migrations...');
      await runMigrations();

      // Register API routes
      registerRoutes(app);

      // Try different ports if one is busy
      const ports = [3000, 3001, 3002];
      let serverStarted = false;
      let usedPort: number | null = null;

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

      // Try each port in sequence
      for (const port of ports) {
        if (serverStarted) break;
        
        try {
          // Start listening on the port
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Timeout when trying to bind to port ${port}`));
            }, 5000);
            
            server!.listen(port, '0.0.0.0', () => {
              clearTimeout(timeoutId);
              console.log(`Server started successfully on port ${port}`);
              log(`Server listening at http://0.0.0.0:${port}`);
              serverStarted = true;
              usedPort = port;
              resolve();
            });

            server!.on('error', (error: NodeJS.ErrnoException) => {
              clearTimeout(timeoutId);
              if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use, trying next port...`);
                reject(new Error(`Port ${port} is in use`));
              } else {
                console.error('Server error:', error);
                reject(error);
              }
            });
          });
        } catch (err) {
          console.log(`Failed to use port ${port}, trying next...`);
          // Continue to the next port
        }
      }
      
      // If no port worked, throw an error
      if (!serverStarted) {
        throw new Error(`Could not start server on any of the ports: ${ports.join(', ')}`);
      }

      // If we get here, the server started successfully
      return;

    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err);

      if (attempt === retries) {
        throw new Error(`Failed to start server after ${retries} attempts`);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
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
startServer().catch((error) => {
  console.error('Fatal server error:', error);
  process.exit(1);
});