import {
  insertClientSchema,
  UserRole,
  updateClientOrderSchema,
} from "@shared/schema";
import type { Express } from "express";
import { mutationRateLimit } from "../middlewares/rate-limit";
import { requireMinimumRole } from "../middlewares/requireMinimumRole";
import { requireSuperAdminRole } from "../middlewares/requireSuperAdminRole";
import { csrfProtection } from "../middlewares/security-headers";
import { storage } from "../storage";

export function registerClientRoutes(app: Express) {
  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const clients = await storage.getClients();
      const user = await storage.getUser(req.session.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.role) {
        return res.status(400).json({ message: "User role not defined" });
      }

      // For super admins, return all clients
      if (user.role === UserRole.SUPER_ADMIN) {
        res.json(clients);
        return;
      }

      // For other users, get their assigned clients through userClients relationship
      const userClients = await storage.getUserClients(user.id);
      res.json(userClients);
    } catch (error: unknown) {
      console.error(
        "Error fetching clients:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Super admins can view any client
      if (user.role === UserRole.SUPER_ADMIN) {
        res.json(client);
        return;
      }

      // For other users, verify they're assigned to this client
      const userClients = await storage.getUserClients(user.id);
      const hasAccess = userClients.some((uc) => uc.id === id);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(client);
    } catch (error: unknown) {
      console.error(
        "Error fetching client:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching client" });
    }
  });

  app.delete(
    "/api/clients/:id",
    csrfProtection,
    requireSuperAdminRole,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }
        const client = await storage.getClient(id);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        await storage.deleteClient(id);
        res.status(200).json({ message: "Client deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting client:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting client" });
      }
    }
  );

  // Create new client
  app.post(
    "/api/clients",
    csrfProtection,
    mutationRateLimit,
    requireSuperAdminRole,
    async (req, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        // Validate client data
        const parsed = insertClientSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid client data",
            errors: parsed.error?.errors || "Validation failed",
          });
        }

        // Create client with validated data
        const clientData = parsed.data;

        const client = await storage.createClient(clientData);
        res.status(201).json(client);
      } catch (error: unknown) {
        console.error(
          "Error creating client:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating client" });
      }
    }
  );

  // Add new route for updating client order
  app.patch(
    "/api/clients/order",
    csrfProtection,
    requireSuperAdminRole,
    async (req, res) => {
      try {
        const { clientOrders } = updateClientOrderSchema.parse(req.body);
        // Update each client's display order
        await Promise.all(
          clientOrders.map(({ id, displayOrder }) =>
            storage.updateClient(id, { displayOrder })
          )
        );
        res.json({ message: "Client order updated successfully" });
      } catch (error: unknown) {
        console.error(
          "Error updating client order:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating client order" });
      }
    }
  );

  // Update client information
  app.patch(
    "/api/clients/:id",
    csrfProtection,
    requireMinimumRole(UserRole.EDITOR),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        const client = await storage.getClient(id);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        // If user is updating the client, record who made the change
        const userId = req.session.userId;
        if (userId) {
          req.body.lastEditedBy = userId;
          req.body.updatedAt = new Date();
        }

        // Update the client
        const updatedClient = await storage.updateClient(id, req.body);
        res.json(updatedClient);
      } catch (error: unknown) {
        console.error(
          "Error updating client:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating client" });
      }
    }
  );
}
