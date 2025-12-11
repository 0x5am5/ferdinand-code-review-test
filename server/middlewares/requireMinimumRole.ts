import type { UserRoleType } from "@shared/schema";
import { UserRole } from "@shared/schema";
import type { NextFunction, Response } from "express";
import type { RequestWithClientId } from "server/routes";
import { storage } from "../storage";
import { getClientIp, logRoleSwitchingAudit } from "../utils/audit-logger";

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<UserRoleType, number> = {
  [UserRole.GUEST]: 1,
  [UserRole.STANDARD]: 2,
  [UserRole.EDITOR]: 3,
  [UserRole.ADMIN]: 4,
  [UserRole.SUPER_ADMIN]: 5,
};

/**
 * Validates and authorizes X-Viewing-Role header for role switching
 * Security requirements:
 * - Only SUPER_ADMIN users can use role switching
 * - Header value must be a valid UserRole enum value
 * - Non-admins attempting to use the header will be denied (prevents privilege escalation)
 * - All attempts are logged for audit purposes
 */
function validateViewingRoleHeader(
  userRole: UserRoleType,
  viewingRoleHeader: string | string[] | undefined,
  userId: number,
  userEmail: string | null | undefined,
  req: RequestWithClientId
): { allowed: boolean; effectiveRole: UserRoleType; reason?: string } {
  const requestedRole = Array.isArray(viewingRoleHeader)
    ? viewingRoleHeader[0]
    : viewingRoleHeader;

  // If no header is present, use the user's actual role
  if (!requestedRole) {
    return { allowed: true, effectiveRole: userRole };
  }

  // CRITICAL SECURITY CHECK: Only SUPER_ADMIN can use role switching
  // This prevents privilege escalation attacks where non-admins manipulate sessionStorage
  if (userRole !== UserRole.SUPER_ADMIN) {
    const reason = `Non-super-admin user (${userRole}) attempted to use X-Viewing-Role header`;
    logRoleSwitchingAudit({
      userId,
      userEmail: userEmail ?? undefined,
      userRole,
      requestedViewingRole: requestedRole,
      authorizationDecision: "denied",
      reason,
      timestamp: new Date(),
      requestPath: req.path,
      requestMethod: req.method,
      ipAddress: getClientIp(req),
    });
    return {
      allowed: false,
      effectiveRole: userRole,
      reason: "Role switching is only available for super administrators",
    };
  }

  // Validate that the requested role is a valid UserRole enum value
  if (!Object.values(UserRole).includes(requestedRole as UserRoleType)) {
    const reason = `Invalid role value: ${requestedRole}`;
    logRoleSwitchingAudit({
      userId,
      userEmail: userEmail ?? undefined,
      userRole,
      requestedViewingRole: requestedRole,
      authorizationDecision: "denied",
      reason,
      timestamp: new Date(),
      requestPath: req.path,
      requestMethod: req.method,
      ipAddress: getClientIp(req),
    });
    return {
      allowed: false,
      effectiveRole: userRole,
      reason: "Invalid viewing role specified",
    };
  }

  // Authorization successful - log the allowed role switch
  logRoleSwitchingAudit({
    userId,
    userEmail: userEmail ?? undefined,
    userRole,
    requestedViewingRole: requestedRole,
    authorizationDecision: "allowed",
    timestamp: new Date(),
    requestPath: req.path,
    requestMethod: req.method,
    ipAddress: getClientIp(req),
  });

  return {
    allowed: true,
    effectiveRole: requestedRole as UserRoleType,
  };
}

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

      // Validate and authorize X-Viewing-Role header (treat as untrusted input)
      const viewingRoleHeader = req.headers["x-viewing-role"];
      const validation = validateViewingRoleHeader(
        user.role,
        viewingRoleHeader,
        user.id,
        user.email,
        req
      );

      // If role switching was requested but not authorized, deny the request
      if (!validation.allowed) {
        return res.status(403).json({
          message: validation.reason || "Unauthorized role switching attempt",
        });
      }

      const effectiveRole = validation.effectiveRole;

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
