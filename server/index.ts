import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import memorystore from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware setup
const MemStore = memorystore(session);
app.use(
  session({
    cookie: { 
      maxAge: 86400000, // 24 hours
      secure: process.env.NODE_ENV === "production"
    },
    secret: process.env.SESSION_SECRET || "development_secret",
    resave: false,
    saveUninitialized: false,
    store: new MemStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
  })
);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Singleton HTTP server instance
let server: ReturnType<typeof registerRoutes> | null = null;

async function startServer() {
  try {
    console.log("Starting server initialization...");

    // Close existing server if any
    if (server) {
      await new Promise((resolve) => server?.close(resolve));
      server = null;
    }

    // Register routes and create HTTP server
    server = await registerRoutes(app);
    console.log("Routes registered successfully");

    // Setup middleware based on environment
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
      console.log("Vite middleware setup complete");
    } else {
      serveStatic(app);
      console.log("Static file serving setup complete");
    }

    // Start listening on port 5000
    await new Promise<void>((resolve, reject) => {
      server?.listen(5000, "0.0.0.0", () => {
        console.log("Server started successfully on port 5000");
        log("Server ready and listening on port 5000");
        resolve();
      }).on("error", (err) => {
        console.error("Failed to start server:", err);
        reject(err);
      });
    });

  } catch (err) {
    console.error("Fatal error during server startup:", err);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGTERM', () => {
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

// Start the server
startServer();