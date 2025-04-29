
import type { Express } from "express";
import { storage } from "../storage";
import { UserRole, users, userClients } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { emailService } from "../email-service";

export function registerUserRoutes(app: Express) {
  // Get current user
  app.get("/api/user", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      let allUsers;
      if (currentUser.role === UserRole.SUPER_ADMIN) {
        allUsers = await db.select().from(users);
      } else if (currentUser.role === UserRole.ADMIN) {
        const adminClients = await storage.getUserClients(currentUser.id);
        const clientUsers = await db
          .select()
          .from(userClients)
          .where(inArray(userClients.clientId, adminClients.map((c) => c.id)));

        const userIds = [...new Set(clientUsers.map((uc) => uc.userId))];

        allUsers = await db
          .select()
          .from(users)
          .where(
            and(
              inArray(users.id, userIds),
              sql`role NOT IN ('ADMIN', 'SUPER_ADMIN')`
            )
          );
      } else {
        allUsers = [currentUser];
      }

      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Update user role
  app.patch("/api/users/:id/role", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { role } = req.body;
      if (!role || !Object.values(UserRole).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Error updating user role" });
    }
  });

  // Send password reset email
  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const expirationTime = Date.now() + 24 * 60 * 60 * 1000;
      const tokenData = {
        userId: user.id,
        email: user.email,
        exp: expirationTime,
      };

      const resetToken = Buffer.from(JSON.stringify(tokenData)).toString("base64");
      const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetLink,
        clientName: "Brand Guidelines Platform",
      });

      res.json({ success: true, message: "Password reset email sent" });
    } catch (error) {
      console.error("Error sending password reset:", error);
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  // Handle password reset
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const tokenData = JSON.parse(Buffer.from(token, "base64").toString());

      if (!tokenData.exp || tokenData.exp < Date.now()) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      const user = await storage.getUser(tokenData.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.email !== tokenData.email) {
        return res.status(400).json({ message: "Invalid reset token" });
      }

      await storage.updateUserPassword(user.id, password);

      await emailService.sendEmail({
        to: user.email,
        subject: "Your password has been reset",
        text: `Your password for Brand Guidelines Platform has been reset successfully. If you did not make this change, please contact support immediately.`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing reset:", error);
      res.status(500).json({ message: "An error occurred while resetting your password" });
    }
  });
}
