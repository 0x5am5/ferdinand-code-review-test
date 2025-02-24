import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import { Server } from "net";

const app = express();
app.use(express.json());

const findAvailablePort = (startPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const testPort = (port: number) => {
      const server = new Server();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          server.close(() => testPort(port + 1));
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port);
    };

    testPort(startPort);
  });
};

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

    // Find an available port starting from 5000
    const port = await findAvailablePort(5000);

    // Start server with proper error handling
    await new Promise<void>((resolve, reject) => {
      try {
        server!.listen(port, "0.0.0.0", () => {
          console.log(`Server started on port ${port}`);
          log(`Server listening at http://0.0.0.0:${port}`);
          resolve();
        });

        server!.on('error', (error: NodeJS.ErrnoException) => {
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