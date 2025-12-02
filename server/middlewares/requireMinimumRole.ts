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

      // Determine effective role (support role switching for super admins)
      let effectiveRole = user.role;

      // Check for role switching via X-Viewing-Role header (super admins only)
      if (user.role === UserRole.SUPER_ADMIN) {
        const viewingRole = req.headers["x-viewing-role"] as
          | UserRoleType
          | undefined;

        if (viewingRole) {
          // Validate viewing role is a valid UserRole enum value
          if (Object.values(UserRole).includes(viewingRole)) {
            effectiveRole = viewingRole;
          } else {
            return res.status(400).json({
              message: "Invalid viewing role specified",
            });
          }
        }
      }

      // Check if effective role meets minimum requirement
      const userHierarchy = ROLE_HIERARCHY[effectiveRole];
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
