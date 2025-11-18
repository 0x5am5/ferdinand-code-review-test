/**
 * Middleware to verify that the authenticated user has access to the requested client
 *
 * This middleware checks if req.session.userId has access to req.clientId by:
 * - Allowing super_admin users to access any client
 * - Checking the userClients table for other users
 * - Returning 403 if the user doesn't have access
 */

import { userClients, users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Response } from "express";
import { db } from "../db";
import type { RequestWithClientId } from "../routes";

export async function validateClientAccess(
  req: RequestWithClientId,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!req.clientId) {
      res.status(400).json({ message: "Client ID is required" });
      return;
    }

    // Fetch the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // Super admins have access to all clients
    if (user.role === "super_admin") {
      next();
      return;
    }

    // Check if user has access to this client
    const [userClient] = await db
      .select()
      .from(userClients)
      .where(
        and(
          eq(userClients.userId, req.session.userId),
          eq(userClients.clientId, req.clientId)
        )
      );

    if (!userClient) {
      res.status(403).json({
        message: "You do not have access to this client",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Error validating client access:", error);
    res.status(500).json({ message: "Error verifying client access" });
  }
}
