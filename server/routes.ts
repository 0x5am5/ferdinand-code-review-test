import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema } from "@shared/schema";

export function registerRoutes(app: Express) {
  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
  });

  // Auth routes - simplified for testing
  app.get("/api/auth/me", async (_req, res) => {
    res.json({
      id: 1,
      email: "admin@example.com", 
      name: "Admin User",
      role: "admin"
    });
  });

  // Client routes
  app.get("/api/clients", async (_req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid client data",
          errors: parsed.error.errors
        });
      }

      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error creating client" });
    }
  });
}