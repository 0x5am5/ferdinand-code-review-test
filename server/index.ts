import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server first
const server = createServer(app);

// Register API routes
registerRoutes(app);

// Initialize server
async function startServer() {
  try {
    // Setup middleware based on environment
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    return new Promise((resolve, reject) => {
      server.listen(5000, "0.0.0.0")
        .once('listening', () => {
          console.log("Server started on port 5000");
          log(`Server listening at http://0.0.0.0:5000`); //Added log statement from original
          resolve(null);
        })
        .once('error', (err: any) => {
          console.error("Server startup error:", err);
          reject(err);
        }); //Improved error handling
    });
  } catch (err) {
    console.error("Server startup error:", err);
    process.exit(1);
  }
}

startServer();