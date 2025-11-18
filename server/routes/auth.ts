import { userClients } from "@shared/schema";
import type { Express } from "express";
import { db } from "../db";
import { auth as firebaseAuth } from "../firebase";
import { authRateLimit } from "../middlewares/rate-limit";
import { storage } from "../storage";

export function registerAuthRoutes(app: Express) {
  // Logout endpoint - no CSRF protection needed as logout is safe even if triggered externally
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
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
      const { idToken, invitationToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "No ID token provided" });
      }

      const decodedToken = await firebaseAuth.verifyIdToken(idToken);

      if (!decodedToken.email) {
        return res.status(400).json({ message: "No email found in token" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(decodedToken.email);

      // If user doesn't exist, check if they have a valid invitation
      if (!user) {
        if (!invitationToken) {
          return res.status(403).json({ message: "User not authorized" });
        }

        // Validate invitation
        const invitation = await storage.getInvitation(invitationToken);

        if (!invitation) {
          return res.status(403).json({ message: "Invalid invitation token" });
        }

        // Check if invitation is expired
        if (new Date(invitation.expiresAt) < new Date()) {
          return res.status(403).json({ message: "Invitation has expired" });
        }

        // Check if invitation has already been used
        if (invitation.used) {
          return res
            .status(403)
            .json({ message: "Invitation has already been used" });
        }

        // Check if invitation email matches the Google auth email
        if (invitation.email !== decodedToken.email) {
          return res
            .status(403)
            .json({ message: "Email does not match invitation" });
        }

        // Create new user with the role from the invitation
        user = await storage.createUserWithRole({
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email.split("@")[0],
          role: invitation.role as any,
        });

        // Associate user with the clients specified in the invitation
        if (invitation.clientIds && invitation.clientIds.length > 0) {
          for (const clientId of invitation.clientIds) {
            await db.insert(userClients).values({
              userId: user.id,
              clientId,
            });
          }
        }
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
      const assignedClients = await storage.getUserClients(user.id);

      return res.json({
        ...user,
        assignedClients,
      });
    } catch (error: unknown) {
      return res.status(401).json({
        message: "Authentication failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
