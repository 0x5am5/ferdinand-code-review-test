
import type { Express } from "express";
import { storage } from "../storage";
import { clients, userClients, UserRole } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "../db";

export function registerClientRoutes(app: Express) {
  // Get all clients
  app.get("/api/clients", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const allClients = await db.query.clients.findMany();
      res.json(allClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  // Get single client
  app.get("/api/clients/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const client = await db.query.clients.findFirst({
        where: eq(clients.id, parseInt(req.params.id)),
      });

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Error fetching client" });
    }
  });

  // Create client
  app.post("/api/clients", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const result = await db.insert(clients).values(req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error creating client" });
    }
  });

  // Update client
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await db.update(clients)
        .set(req.body)
        .where(eq(clients.id, parseInt(req.params.id)));
      
      res.json({ message: "Client updated successfully" });
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Error updating client" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await db.delete(clients)
        .where(eq(clients.id, parseInt(req.params.id)));
      
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Error deleting client" });
    }
  });

  // Update client order
  app.patch("/api/clients/order", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { clientOrders } = req.body;
      
      for (const order of clientOrders) {
        await db.update(clients)
          .set({ displayOrder: order.displayOrder })
          .where(eq(clients.id, order.id));
      }
      
      res.json({ message: "Client order updated successfully" });
    } catch (error) {
      console.error("Error updating client order:", error);
      res.status(500).json({ message: "Error updating client order" });
    }
  });
}
