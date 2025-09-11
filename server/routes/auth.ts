import type { Express } from "express";
import { auth as firebaseAuth } from "../firebase";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(
          "Error destroying session:",
          err instanceof Error ? err.message : "Unknown error"
        );
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Google Auth endpoint
  app.post("/api/auth/google", async (req, res) => {
    try {
      console.log("Received Google auth request");
      const { idToken } = req.body;

      if (!idToken) {
        console.log("No ID token provided");
        return res.status(400).json({ message: "No ID token provided" });
      }

      console.log("Verifying Firebase ID token");
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);

      if (!decodedToken.email) {
        console.log("No email found in token");
        return res.status(400).json({ message: "No email found in token" });
      }

      console.log(`User authenticated with email: ${decodedToken.email}`);

      // Check if user exists
      console.log("Checking if user exists in database");
      const user = await storage.getUserByEmail(decodedToken.email);

      console.log(user);

      if (!user) {
        console.log("User does not exist, deleting from Firebase");
        try {
          // await firebaseAuth.deleteUser(decodedToken.uid);
          console.log(`Deleted Firebase user with UID: ${decodedToken.uid}`);
          return res.status(403).json({ message: "User not authorized" });
        } catch (error: unknown) {
          console.error(
            "Error deleting Firebase user:",
            error instanceof Error ? error.message : "Unknown error"
          );
          return res
            .status(500)
            .json({ message: "Failed to delete unauthorized user" });
        }
      } else {
        console.log(`Found existing user with ID: ${user.id}`);
      }

      if (!req.session) {
        console.log("Session not initialized");
        return res.status(500).json({ message: "Session not initialized" });
      }

      // Set user in session
      console.log("Setting user in session");
      req.session.userId = user.id;

      console.log(req.session, user.id);

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error(
              "Error saving session:",
              err instanceof Error ? err.message : "Unknown error"
            );
            reject(err);
          } else resolve(undefined);
        });
      });

      console.log("Authentication successful, sending user data");

      // Get user's assigned clients to determine redirect
      const userClients = await storage.getUserClients(user.id);

      return res.json({
        ...user,
        assignedClients: userClients,
      });
    } catch (error: unknown) {
      console.error(
        "Auth error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return res.status(401).json({
        message: "Authentication failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
