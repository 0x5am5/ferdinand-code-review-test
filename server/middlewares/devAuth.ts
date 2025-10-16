import type { NextFunction, Request, Response } from "express";
import { storage } from "../storage";

/**
 * Development authentication bypass middleware
 * When BYPASS_AUTH_FOR_LOCAL_DEV is enabled, this middleware:
 * 1. Skips Firebase token verification
 * 2. Automatically logs in as a specified dev user (by email)
 * 3. In test mode, supports x-test-user-id header for per-request user switching
 *
 * IMPORTANT: Only use in local development/testing. Never enable in production.
 */
export async function devAuthBypass(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only bypass auth if explicitly enabled
  const bypassEnabled =
    process.env.BYPASS_AUTH_FOR_LOCAL_DEV === "true" ||
    process.env.NODE_ENV === "test";

  if (!bypassEnabled) {
    return next();
  }

  // Safety check: never allow in production
  if (process.env.NODE_ENV === "production") {
    console.error(
      "⚠️  BYPASS_AUTH_FOR_LOCAL_DEV is enabled in production! This is a security risk."
    );
    res.status(500).json({
      message: "Invalid configuration",
    });
    return;
  }

  try {
    // Check for test user header first (works in both test and dev modes)
    // This enables integration tests to impersonate different users per request
    const testUserId = req.headers["x-test-user-id"];

    if (testUserId) {
      const userId = parseInt(testUserId as string, 10);
      if (!Number.isNaN(userId)) {
        // Verify user exists
        const user = await storage.getUser(userId);
        if (user) {
          req.session.userId = userId;
          return next();
        } else {
          res.status(401).json({ message: "Test user not found" });
          return;
        }
      }
    }

    // Test mode without header: continue without auth
    if (process.env.NODE_ENV === "test") {
      // If no test user header, check if session already has a user
      if (req.session.userId) {
        return next();
      }

      // No user specified - continue without auth
      return next();
    }

    // Dev mode: use dev user email from environment
    const devUserEmail = process.env.DEV_USER_EMAIL;

    if (!devUserEmail) {
      console.error(
        "BYPASS_AUTH_FOR_LOCAL_DEV is enabled but DEV_USER_EMAIL is not set"
      );
      res.status(500).json({
        message: "Dev user email not configured",
      });
      return;
    }

    // Check if user already has a session
    if (req.session.userId) {
      return next();
    }

    // Don't auto-login on the homepage or login page - allow user to stay logged out
    // This prevents immediate re-login after logout
    const publicPaths = ["/", "/api/user"];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    // Find the dev user in the database
    const user = await storage.getUserByEmail(devUserEmail);

    if (!user) {
      console.error(`Dev user not found: ${devUserEmail}`);
      res.status(500).json({
        message: `Dev user not found: ${devUserEmail}`,
      });
      return;
    }

    // Set user in session
    req.session.userId = user.id;

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Error saving dev session:", err);
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });

    console.log(
      `🔓 Dev auth bypass: Logged in as ${devUserEmail} (ID: ${user.id})`
    );

    next();
  } catch (error) {
    console.error("Dev auth bypass error:", error);
    res.status(500).json({
      message: "Dev auth bypass failed",
    });
    return;
  }
}
