import { UserRole } from "@shared/schema";
import type { NextFunction, Response } from "express";
import type { RequestWithClientId } from "server/routes";
import { storage } from "server/storage";

export const requireSuperAdminRole = async (
  req: RequestWithClientId,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has super_admin role
    if (user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        message: "Access denied. Super admin role required.",
      });
    }

    next();
  } catch (error: unknown) {
    console.error(
      "Error checking super admin role:",
      error instanceof Error ? error.message : "Unknown error"
    );
    res.status(500).json({ message: "Error verifying permissions" });
  }
};
