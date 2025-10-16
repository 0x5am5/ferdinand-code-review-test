import type { Express } from "express";
import { auth as firebaseAuth } from "../firebase";
import { authRateLimit } from "../middlewares/rate-limit";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Logout endpoint - no CSRF protection needed as logout is safe even if triggered externally
  app.post("/api/auth/logout", (req, res) => {
    console.log("=== LOGOUT REQUEST RECEIVED ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Session ID:", req.sessionID);
    console.log("Session User ID:", req.session?.userId);

    req.session.destroy((err) => {
      if (err) {
        console.error(
          "=== LOGOUT SESSION DESTROY ERROR ===",
          err instanceof Error ? err.message : "Unknown error"
        );
        return res.status(500).json({ message: "Logout failed" });
      }
      console.log("=== LOGOUT SUCCESSFUL - Session destroyed ===");

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
