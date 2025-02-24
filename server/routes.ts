import type { Express } from "express";

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
}