import type { UserRoleType } from "@shared/schema";
import { UserRole } from "@shared/schema";
import type { NextFunction, Response } from "express";
import type { RequestWithClientId } from "server/routes";
import { storage } from "../storage";

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<UserRoleType, number> = {
  [UserRole.GUEST]: 1,
  [UserRole.STANDARD]: 2,
  [UserRole.EDITOR]: 3,
  [UserRole.ADMIN]: 4,
  [UserRole.SUPER_ADMIN]: 5,
};

export const requireMinimumRole = (minimumRole: UserRoleType) => {
  return async (
    req: RequestWithClientId,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user's role meets minimum requirement
      const userHierarchy = ROLE_HIERARCHY[user.role];
      const minimumHierarchy = ROLE_HIERARCHY[minimumRole];

      if (userHierarchy < minimumHierarchy) {
        return res.status(403).json({
          message: `Access denied. ${minimumRole} role or higher required.`,
        });
      }

      next();
    } catch (error: unknown) {
      console.error(
        "Error checking minimum role:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error verifying permissions" });
    }
  };
};
