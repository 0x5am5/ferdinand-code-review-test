import { userClients, UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";

/**
 * Middleware to ensure user is authenticated
 * Checks if user has a valid session with userId
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

/**
 * Helper function to check if an ADMIN user has access to a specific client
 * SUPER_ADMINs always have access
 * @param userId The ID of the user making the request
 * @param clientId The ID of the client being accessed
 * @returns true if the user can access the client
 */
export async function canAdminAccessClient(
  userId: number,
  clientId: number
): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);

    if (!user) return false;

    // Super admins can access any client
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Admins can only access clients they're assigned to
    if (user.role === UserRole.ADMIN) {
      const adminClients = await storage.getUserClients(userId);
      return adminClients.some((c) => c.id === clientId);
    }

    return false;
  } catch (error) {
    console.error("Error checking client access:", error);
    return false;
  }
}

/**
 * Helper function to check if an ADMIN user has access to a specific user
 * SUPER_ADMINs always have access
 * @param adminId The ID of the admin making the request
 * @param targetUserId The ID of the user being accessed
 * @returns true if the admin can access the target user
 */
export async function canAdminAccessUser(
  adminId: number,
  targetUserId: number
): Promise<boolean> {
  try {
    const admin = await storage.getUser(adminId);
    if (!admin) return false;

    // Super admins can access any user
    if (admin.role === UserRole.SUPER_ADMIN) return true;

    // Admins can only access users in their assigned clients
    if (admin.role === UserRole.ADMIN) {
      const adminClients = await storage.getUserClients(adminId);
      const adminClientIds = adminClients.map((c) => c.id);

      const targetUserClients = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, targetUserId));

      return targetUserClients.some((uc) =>
        adminClientIds.includes(uc.clientId)
      );
    }

    return false;
  } catch (error) {
    console.error("Error checking user access:", error);
    return false;
  }
}

