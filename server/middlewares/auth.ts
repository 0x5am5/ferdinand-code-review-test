import type { NextFunction, Request, Response } from "express";

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
    const { storage } = await import("../storage");
    const user = await storage.getUser(userId);

    if (!user) return false;

    // Super admins can access any client
    if (user.role === "super_admin") return true;

    // Admins can only access clients they're assigned to
    if (user.role === "admin") {
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
    const { storage } = await import("../storage");
    const { db } = await import("../db");
    const { userClients } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const admin = await storage.getUser(adminId);
    if (!admin) return false;

    // Super admins can access any user
    if (admin.role === "super_admin") return true;

    // Admins can only access users in their assigned clients
    if (admin.role === "admin") {
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

/**
 * Middleware to ensure user is authenticated and has admin or super admin role
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const { storage } = await import("../storage");
    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Error checking admin role:", error);
    return res.status(500).json({ message: "Error verifying permissions" });
  }
}

/**
 * Middleware to ensure user is authenticated and has super admin role
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const { storage } = await import("../storage");
    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "super_admin") {
      return res.status(403).json({ message: "Super admin access required" });
    }

    next();
  } catch (error) {
    console.error("Error checking super admin role:", error);
    return res.status(500).json({ message: "Error verifying permissions" });
  }
}
