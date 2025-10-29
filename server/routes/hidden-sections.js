import { insertHiddenSectionSchema, UserRole } from "@shared/schema";
import { storage } from "../storage";
// User role middleware for admin checks
const requireAdminRole = async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // Check if user is either admin or super_admin
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
            return res
                .status(403)
                .json({ message: "Forbidden - Admin role required" });
        }
        next();
    }
    catch (error) {
        console.error("Error in admin role check:", error instanceof Error ? error.message : "Unknown error");
        return res.status(500).json({ message: "Internal server error" });
    }
};
export function registerHiddenSectionsRoutes(app) {
    // Get all hidden sections for a client
    app.get("/api/clients/:clientId/hidden-sections", async (req, res) => {
        try {
            const clientId = parseInt(req.params.clientId, 10);
            if (Number.isNaN(clientId)) {
                return res.status(400).json({ message: "Invalid client ID" });
            }
            const hiddenSections = await storage.getClientHiddenSections(clientId);
            return res.status(200).json(hiddenSections);
        }
        catch (error) {
            console.error("Error getting hidden sections:", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Add a section to the hidden list
    app.post("/api/clients/:clientId/hidden-sections", requireAdminRole, async (req, res) => {
        try {
            const clientId = parseInt(req.params.clientId, 10);
            if (Number.isNaN(clientId)) {
                return res.status(400).json({ message: "Invalid client ID" });
            }
            // Validate the request body
            const validationResult = insertHiddenSectionSchema.safeParse({
                ...req.body,
                clientId,
            });
            if (!validationResult.success) {
                return res.status(400).json({
                    message: "Invalid request data",
                    errors: validationResult.error.errors,
                });
            }
            const hiddenSection = await storage.createHiddenSection(validationResult.data);
            return res.status(201).json(hiddenSection);
        }
        catch (error) {
            console.error("Error creating hidden section:", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Remove a section from the hidden list
    app.delete("/api/clients/:clientId/hidden-sections/:sectionType", requireAdminRole, async (req, res) => {
        try {
            const clientId = parseInt(req.params.clientId, 10);
            if (Number.isNaN(clientId)) {
                return res.status(400).json({ message: "Invalid client ID" });
            }
            const { sectionType } = req.params;
            if (!sectionType) {
                return res.status(400).json({ message: "Section type is required" });
            }
            await storage.deleteHiddenSection(clientId, sectionType);
            return res
                .status(200)
                .json({ message: "Section removed from hidden list" });
        }
        catch (error) {
            console.error("Error removing hidden section:", error instanceof Error ? error.message : "Unknown error");
            return res.status(500).json({ message: "Internal server error" });
        }
    });
}
