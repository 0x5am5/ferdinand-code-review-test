import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function killProcessOnPort(port: number) {
  try {
    await execAsync(`fuser -k ${port}/tcp`);
    // Wait a moment for the port to be freed
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    // Ignore errors as the port might not be in use
  }
}

async function startServer() {
  try {
    console.log("Starting server initialization...");

    // Kill any existing process on port 5000
    await killProcessOnPort(5000);

    // Create HTTP server and register routes
    const server = createServer(app);
    registerRoutes(app);

    // Setup Vite middleware in development
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
      console.log("Vite middleware setup complete");
    } else {
      serveStatic(app);
      console.log("Static file serving setup complete");
    }

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started on port ${PORT}`);
      log(`Server listening at http://0.0.0.0:${PORT}`);
    });

    server.on('error', (err: any) => {
      console.error("Server startup error:", err);
      process.exit(1);
    });

    // Handle cleanup on exit
    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      server.close(() => process.exit(0));
    });

  } catch (err) {
    console.error("Fatal error during server startup:", err);
    process.exit(1);
  }
}

startServer();