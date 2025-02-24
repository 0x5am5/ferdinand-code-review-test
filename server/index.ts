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

// Create HTTP server
const server = createServer(app);

// Register API routes
registerRoutes(app);

// Start server setup
async function startServer() {
  try {
    // Setup Vite middleware in development
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
      console.log("Vite middleware setup complete");
    } else {
      serveStatic(app);
      console.log("Static file serving setup complete");
    }

    // Start the server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started on port ${PORT}`);
      log(`Server listening at http://0.0.0.0:${PORT}`);
    });

  } catch (err) {
    console.error("Fatal error during server startup:", err);
    process.exit(1);
  }
}

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

startServer();