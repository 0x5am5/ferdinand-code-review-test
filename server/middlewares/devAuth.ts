import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/**
 * Development authentication bypass middleware
 * When BYPASS_AUTH_FOR_LOCAL_DEV is enabled, this middleware:
 * 1. Skips Firebase token verification
 * 2. Automatically logs in as a specified dev user (by email)
 *
 * IMPORTANT: Only use in local development. Never enable in production.
 */
export async function devAuthBypass(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only bypass auth if explicitly enabled
  const bypassEnabled = process.env.BYPASS_AUTH_FOR_LOCAL_DEV === "true";

  if (!bypassEnabled) {
    return next();
  }

  // Safety check: never allow in production
  if (process.env.NODE_ENV === "production") {
    console.error("⚠️  BYPASS_AUTH_FOR_LOCAL_DEV is enabled in production! This is a security risk.");
    res.status(500).json({
      message: "Invalid configuration"
    });
    return;
  }

  try {
    // Get the dev user email from environment variable
    const devUserEmail = process.env.DEV_USER_EMAIL;

    if (!devUserEmail) {
      console.error("BYPASS_AUTH_FOR_LOCAL_DEV is enabled but DEV_USER_EMAIL is not set");
      res.status(500).json({
        message: "Dev user email not configured"
      });
      return;
    }

    // Check if user already has a session
    if (req.session.userId) {
      return next();
    }

    // Find the dev user in the database
    const user = await storage.getUserByEmail(devUserEmail);

    if (!user) {
      console.error(`Dev user not found: ${devUserEmail}`);
      res.status(500).json({
        message: `Dev user not found: ${devUserEmail}`
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

    console.log(`🔓 Dev auth bypass: Logged in as ${devUserEmail} (ID: ${user.id})`);

    next();
  } catch (error) {
    console.error("Dev auth bypass error:", error);
    res.status(500).json({
      message: "Dev auth bypass failed"
    });
    return;
  }
}
