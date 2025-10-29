import { UserRole } from "@shared/schema";
import { storage } from "server/storage";
export const requireAdminRole = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const user = await storage.getUser(req.session.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Check if user has admin or super_admin role
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
            return res.status(403).json({
                message: "Access denied. Admin or super admin role required.",
            });
        }
        next();
    }
    catch (error) {
        console.error("Error checking admin role:", error instanceof Error ? error.message : "Unknown error");
        res.status(500).json({ message: "Error verifying permissions" });
    }
};
