import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { adminAuth } from "./firebase";
import { insertUserSchema, insertClientSchema, insertBrandAssetSchema, FILE_FORMATS } from "@shared/schema";
import multer from "multer";

const upload = multer();

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { token, email, name } = req.body;

    try {
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (!decodedToken) {
        return res.status(401).json({ message: "Invalid token" });
      }
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        req.session.userId = existingUser.id;
        return res.json(existingUser);
      }

      const user = await storage.createUser({
        email,
        name,
        role: "client",
      });

      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    res.json({
      id: 1,
      email: "admin@example.com",
      name: "Admin User",
      role: "admin"
    });
  });

  return httpServer;
}