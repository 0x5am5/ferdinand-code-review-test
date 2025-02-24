import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema } from "@shared/schema";

export function registerRoutes(app: Express) {
  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
  });

  // Auth routes - simplified for testing
  app.get("/api/auth/me", async (req, res) => {
    res.json({
      id: 1,
      email: "admin@example.com",
      name: "Admin User",
      role: "admin"
    });
  });
}