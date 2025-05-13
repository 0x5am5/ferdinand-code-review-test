import type { Express } from "express";
import multer from "multer";

import { storage } from "../storage";
import { updateClientOrderSchema, insertClientSchema, UserRole } from "@shared/schema";

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

      if (!user.client_id) {
        return res.status(400).json({ message: "User client ID not defined" });
      }

      const filteredClients = clients.filter((client) => {
        if (user.role === UserRole.SUPER_ADMIN) return true;

        return user.client_id == client.id;
      });

      res.json(filteredClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Error fetching client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      await storage.deleteClient(id);
      res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Error deleting client" });
    }
  });
  
  // Create new client
  app.post("/api/clients", async (req, res) => {
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
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error creating client" });
    }
  });

  // Add new route for updating client order
  app.patch("/api/clients/order", async (req, res) => {
    try {
      const { clientOrders } = updateClientOrderSchema.parse(req.body);
      // Update each client's display order
      await Promise.all(
        clientOrders.map(({ id, displayOrder }) =>
          storage.updateClient(id, { displayOrder }),
        ),
      );
      res.json({ message: "Client order updated successfully" });
    } catch (error) {
      console.error("Error updating client order:", error);
      res.status(500).json({ message: "Error updating client order" });
    }
  });

  // Update client information
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
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
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Error updating client" });
    }
  });
}
