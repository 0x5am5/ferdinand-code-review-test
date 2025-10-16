import type { Express } from "express";
import { auth as firebaseAuth } from "../firebase";
import { authRateLimit } from "../middlewares/rate-limit";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(
          "=== LOGOUT SESSION DESTROY ERROR ===",
          err instanceof Error ? err.message : "Unknown error"
        );
        return res.status(500).json({ message: "Logout failed" });
      }

      // Clear the session cookie to prevent dev auth bypass from re-creating the session
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.json({ message: "Logged out successfully" });
    });
  });

  // Google Auth endpoint
  app.post("/api/auth/google", authRateLimit, async (req, res) => {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "No ID token provided" });
      }

      const decodedToken = await firebaseAuth.verifyIdToken(idToken);

      if (!decodedToken.email) {
        return res.status(400).json({ message: "No email found in token" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(decodedToken.email);

      if (!user) {
        try {
          // await firebaseAuth.deleteUser(decodedToken.uid);
          return res.status(403).json({ message: "User not authorized" });
        } catch (error: unknown) {
          return res
            .status(500)
            .json({ message: "Failed to delete unauthorized user" });
        }
      } else {
      }

      if (!req.session) {
        return res.status(500).json({ message: "Session not initialized" });
      }

      // Set user in session
      req.session.userId = user.id;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            reject(err);
          } else resolve(undefined);
        });
      });

      // Get user's assigned clients to determine redirect
      const userClients = await storage.getUserClients(user.id);

      return res.json({
        ...user,
        assignedClients: userClients,
      });
    } catch (error: unknown) {
      return res.status(401).json({
        message: "Authentication failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
