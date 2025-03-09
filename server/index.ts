import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());

let server: ReturnType<typeof createServer> | null = null;

// Cleanup handler with improved logging
function cleanup() {
  if (server) {
    server.close(() => {
      console.log('Server shut down complete');
      process.exit(0);
    });

    // Force close after 5 seconds
    setTimeout(() => {
      console.log('Forcing server shutdown after timeout');
      process.exit(1);
    }, 5000);
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
      console.log('Closing existing server instance');
      await new Promise<void>((resolve) => server!.close(() => resolve()));
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

    const PORT = process.env.PORT || 5000;
    const HOST = "0.0.0.0";

    // Start server with proper error handling and retry logic
    let retries = 0;
    const maxRetries = 3;
    const startPort = Number(PORT);

    while (retries < maxRetries) {
      try {
        await new Promise<void>((resolve, reject) => {
          const currentPort = startPort + retries;

          const handleError = (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
              console.log(`Port ${currentPort} is in use, trying next port`);
              server!.close();
              retries++;
              if (retries < maxRetries) {
                return; // Continue to next retry
              }
            }
            reject(error);
          };

          server!.once('error', handleError);

          server!.listen(currentPort, HOST, () => {
            server!.removeListener('error', handleError);
            console.log(`Server started successfully on port ${currentPort}`);
            log(`Server listening at http://${HOST}:${currentPort}`);
            resolve();
          });
        });

        // If we get here, server started successfully
        break;
      } catch (err) {
        if (retries >= maxRetries - 1) {
          throw err; // Rethrow if we're out of retries
        }
        // Otherwise continue to next retry
        retries++;
      }
    }

  } catch (err) {
    console.error("Fatal server startup error:", err);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup();
});

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});