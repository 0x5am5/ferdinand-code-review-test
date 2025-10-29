/**
 * Middleware to ensure user is authenticated
 * Checks if user has a valid session with userId
 */
export function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({ message: "Authentication required" });
    }
    next();
}
/**
 * Middleware to ensure user is authenticated and has admin or super admin role
 */
export async function requireAdmin(req, res, next) {
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
    }
    catch (error) {
        console.error("Error checking admin role:", error);
        return res.status(500).json({ message: "Error verifying permissions" });
    }
}
/**
 * Middleware to ensure user is authenticated and has super admin role
 */
export async function requireSuperAdmin(req, res, next) {
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
    }
    catch (error) {
        console.error("Error checking super admin role:", error);
        return res.status(500).json({ message: "Error verifying permissions" });
    }
}
