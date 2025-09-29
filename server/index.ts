import "dotenv/config";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import connectPg from "connect-pg-simple";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import session from "express-session";
import { runMigrations } from "./migrations";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

const app = express();
let server: ReturnType<typeof createServer> | null = null;

// Important: Body parsing middleware must come before session middleware
// Skip body parsing for Slack endpoints (ExpressReceiver handles its own parsing)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/slack/events')) {
    return next();
  }
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/slack/events')) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});

// Set up PostgreSQL session store
const PostgresStore = connectPg(session);

app.set("trust proxy", 1); // trust first proxy

// Configure session middleware
app.use(
  session({
    store: new PostgresStore({
      createTableIfMissing: true,
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
    }),
    secret: process.env.SESSION_SECRET || "dev_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Add error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});

// Basic health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Increase the maximum number of listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

// Port configuration: use PORT env var or default to 5000 (mapped to external port 80)
const PORT = parseInt(process.env.PORT ?? "5000", 10);


// Improved server startup function
async function startServer(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Starting server (attempt ${attempt}/${retries})...`);


      // Run database migrations
      console.log("Running database migrations...");
      await runMigrations();

      // Register API routes
      registerRoutes(app);

      // Create the HTTP server
      if (process.env.NODE_ENV !== "production") {
        // For development, create server first then setup Vite
        server = createServer(app);
        console.log("Setting up Vite development server...");
        await setupVite(app, server);
      } else {
        // For production, setup static serving then create server
        console.log("Setting up static file serving for production...");
        serveStatic(app);
        server = createServer(app);
      }

      // Simplified port logic for production vs development
      if (process.env.NODE_ENV === "production") {
        // Production: Only use the specified port (5100 or PORT env var)
        console.log(`Starting server on port ${PORT} for production`);
        await new Promise<void>((resolve, reject) => {
          server?.listen(PORT, "0.0.0.0", () => {
            console.log(`✓ Server started successfully on port ${PORT}`);
            log(`Server listening at http://0.0.0.0:${PORT}`);
            resolve();
          });

          server?.on("error", (error: NodeJS.ErrnoException) => {
            console.error(
              "Server error:",
              error instanceof Error ? error.message : "Unknown error"
            );
            reject(error);
          });
        });
      } else {
        // Development: Use a single fixed port
        console.log(`Starting development server on port ${PORT}`);
        await new Promise<void>((resolve, reject) => {
          server?.listen(PORT, "0.0.0.0", () => {
            console.log(`✓ Server started successfully on port ${PORT}`);
            log(`Server listening at http://0.0.0.0:${PORT}`);
            resolve();
          });

          server?.on("error", (error: NodeJS.ErrnoException) => {
            console.error(
              "Server error:",
              error instanceof Error ? error.message : "Unknown error"
            );
            reject(error);
          });
        });
      }

      // If we get here, the server started successfully
      return;
    } catch (err: unknown) {
      console.error(`Attempt ${attempt} failed:`, err);

      if (attempt === retries) {
        throw new Error(`Failed to start server after ${retries} attempts`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}


// Start the server
console.log("Initiating server startup...");
startServer().catch((error) => {
  console.error(
    "Fatal server error:",
    error instanceof Error ? error.message : "Unknown error"
  );
  process.exit(1);
});
