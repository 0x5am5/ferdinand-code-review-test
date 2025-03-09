import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());

let server: ReturnType<typeof createServer> | null = null;

// Cleanup handler
function cleanup() {
  if (server) {
    server.close(() => {
      console.log('Server shut down complete');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
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

    // Start server on port 5000 as specified in .replit
    const PORT = 5000;
    const HOST = "0.0.0.0";

    // Start server with proper error handling
    await new Promise<void>((resolve, reject) => {
      try {
        server!.listen(PORT, HOST, () => {
          console.log(`Server started on port ${PORT}`);
          log(`Server listening at http://${HOST}:${PORT}`);
          resolve();
        });

        server!.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Please ensure no other service is running on this port.`);
          }
          reject(error);
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