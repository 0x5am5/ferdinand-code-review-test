import { createServer } from "node:net";

/**
 * Finds the next available port starting from the given port.
 * Tries ports sequentially until an available one is found.
 *
 * @param startPort - The port to start checking from (default: 3001)
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns Promise resolving to an available port number
 * @throws Error if no available port is found within maxAttempts
 */
export async function findAvailablePort(
  startPort = 3001,
  maxAttempts = 10
): Promise<number> {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const tryPort = (port: number) => {
      attempts++;

      if (attempts > maxAttempts) {
        reject(
          new Error(
            `No available port found after ${maxAttempts} attempts (tried ports ${startPort}-${currentPort - 1})`
          )
        );
        return;
      }

      const server = createServer();

      server.listen(port, () => {
        server.once("close", () => {
          resolve(port);
        });
        server.close();
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          // Port is in use, try the next one
          currentPort++;
          tryPort(currentPort);
        } else {
          // Some other error occurred
          reject(err);
        }
      });
    };

    tryPort(currentPort);
  });
}

