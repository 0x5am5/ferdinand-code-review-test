import {
  type Client,
  clients,
  insertUserClientSchema,
  invitations,
  type User,
  UserRole,
  userClients,
  users,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Express } from "express";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { db } from "../db";
import { emailService } from "../email-service";
import { storage } from "../storage";

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
    } catch (error: unknown) {
      console.error(
        "Error fetching user:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  // Get current user's assigned clients
  app.get("/api/user/clients", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const clients = await storage.getUserClients(req.session.userId);
      res.json(clients);
    } catch (error: unknown) {
      console.error(
        "Error fetching user clients:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching user clients" });
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

      let allUsers: (typeof users.$inferSelect)[];
      if (currentUser.role === UserRole.SUPER_ADMIN) {
        allUsers = await db.select().from(users);
      } else if (currentUser.role === UserRole.ADMIN) {
        // Admin users can see all users in their organization (same clients)
        // including super_admins, but cannot modify super_admin roles
        const adminClients = await storage.getUserClients(currentUser.id);
        const clientUsers = await db
          .select()
          .from(userClients)
          .where(
            inArray(
              userClients.clientId,
              adminClients.map((c) => c.id)
            )
          );

        const userIds = Array.from(new Set(clientUsers.map((uc) => uc.userId)));
        // Include the current admin user even if they don't have client assignments
        if (!userIds.includes(currentUser.id)) {
          userIds.push(currentUser.id);
        }

        allUsers = await db
          .select()
          .from(users)
          .where(inArray(users.id, userIds));
      } else {
        allUsers = [currentUser];
      }

      res.json(allUsers);
    } catch (error: unknown) {
      console.error(
        "Error fetching users:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Create a new user (with invite)
  app.post("/api/users", async (req, res) => {
    try {
      // For user invitation, we'll use the invitations system which already has email handling
      // and proper error validation

      // Create an invitation with the provided user data
      const invitationData = {
        email: req.body.email,
        name: req.body.name || req.body.email.split("@")[0], // Use part of email as name if not provided
        role: req.body.role || UserRole.STANDARD,
        clientIds: req.body.clientIds || undefined,
      };

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(invitationData.email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists",
          code: "EMAIL_EXISTS",
        });
      }

      // Check if an invitation with this email already exists
      const existingInvitations = await db.query.invitations.findMany({
        where: eq(invitations.email, invitationData.email),
      });

      // Only consider unused invitations as duplicates
      const pendingInvitation = existingInvitations.find((inv) => !inv.used);
      if (pendingInvitation) {
        return res.status(400).json({
          message: "An invitation for this email already exists",
          code: "INVITATION_EXISTS",
          invitationId: pendingInvitation.id,
        });
      }

      // Create the invitation
      const invitation = await storage.createInvitation(invitationData);

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get("host")}/signup?token=${invitation.token}`;

      // Get client information if a clientId is provided
      let clientName = "our platform";
      let logoUrl: string | undefined;

      if (invitationData.clientIds && invitationData.clientIds.length > 0) {
        try {
          const client = await storage.getClient(invitationData.clientIds[0]);
          if (client) {
            clientName = client.name;
            // Get favicon from brand assets for email
            try {
              const assets = await storage.getClientAssets(
                invitationData.clientIds[0]
              );
              const logoAssets = assets.filter(
                (asset) => asset.category === "logo"
              );
              const findLogoByType = (types: string[]) => {
                for (const type of types) {
                  const logo = logoAssets.find((asset) => {
                    if (!asset.data) return false;
                    try {
                      const data =
                        typeof asset.data === "string"
                          ? JSON.parse(asset.data)
                          : asset.data;
                      return data?.type === type;
                    } catch (_e) {
                      return false;
                    }
                  });
                  if (logo) return logo;
                }
                return null;
              };
              const logoAsset =
                findLogoByType(["favicon", "square", "horizontal", "main"]) ||
                logoAssets[0];
              logoUrl = logoAsset
                ? `/api/assets/${logoAsset.id}/file`
                : undefined;
            } catch (_e) {
              logoUrl = undefined;
            }
          }
        } catch (err: unknown) {
          console.error(
            "Error fetching client data for invitation email:",
            err instanceof Error ? err.message : "Unknown error"
          );
          // Continue with default values if client fetch fails
        }
      }

      // Send invitation email
      try {
        await emailService.sendInvitationEmail({
          to: invitationData.email,
          inviteLink,
          clientName,
          role: invitationData.role,
          expiration: "7 days",
          logoUrl,
        });

        console.log(`Invitation email sent to ${invitationData.email}`);
      } catch (emailError: unknown) {
        console.error(
          "Failed to send invitation email:",
          emailError instanceof Error ? emailError.message : "Unknown error"
        );
        // We don't want to fail the entire invitation process if just the email fails
      }

      // Return success with the invitation data
      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        clientIds: invitation.clientIds,
        inviteLink,
        message: "User invited successfully",
      });
    } catch (error: unknown) {
      console.error(
        "Error inviting user:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error inviting user" });
    }
  });

  // Update current user's role
  app.patch("/api/users/role", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { role } = req.body;
      if (!role || !Object.values(UserRole).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(
        req.session.userId,
        role
      );
      res.json(updatedUser);
    } catch (error: unknown) {
      console.error(
        "Error updating user role:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error updating user role" });
    }
  });

  // Update user role
  app.patch("/api/users/:id/role", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { role } = req.body;
      if (!role || !Object.values(UserRole).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Get the current user making the request
      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: "Current user not found" });
      }

      // Get the target user being modified
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Role-based restrictions
      if (currentUser.role === UserRole.ADMIN) {
        // Admins cannot assign super_admin or admin roles
        if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
          return res.status(403).json({
            message: "Only super admins can assign admin roles",
          });
        }

        // Admins cannot modify super_admin users
        if (targetUser.role === UserRole.SUPER_ADMIN) {
          return res.status(403).json({
            message: "You cannot modify super admin roles",
          });
        }

        // Admins cannot change their own role
        if (targetUser.id === currentUser.id) {
          return res.status(403).json({
            message: "You cannot change your own role",
          });
        }
      } else if (currentUser.role !== UserRole.SUPER_ADMIN) {
        // Only super admins and admins can change roles
        return res.status(403).json({
          message: "Insufficient permissions to change user roles",
        });
      }

      const updatedUser = await storage.updateUserRole(id, role);
      res.json(updatedUser);
    } catch (error: unknown) {
      console.error(
        "Error updating user role:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error updating user role" });
    }
  });

  // Send password reset email
  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) {
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

      const resetToken = Buffer.from(JSON.stringify(tokenData)).toString(
        "base64"
      );
      const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetLink,
        clientName: "Brand Guidelines Platform",
      });

      res.json({ success: true, message: "Password reset email sent" });
    } catch (error: unknown) {
      console.error(
        "Error sending password reset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  // Handle password reset
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res
          .status(400)
          .json({ message: "Token and new password are required" });
      }

      if (password.length < 8) {
        return res
          .status(400)
          .json({ message: "Password must be at least 8 characters" });
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
    } catch (error: unknown) {
      console.error(
        "Error processing reset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res
        .status(500)
        .json({ message: "An error occurred while resetting your password" });
    }
  });

  // Get clients for a user
  app.get("/api/users/:id/clients", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const clients = await storage.getUserClients(id);
      res.json(clients);
    } catch (error: unknown) {
      console.error(
        "Error fetching user clients:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching user clients" });
    }
  });

  // Get all client assignments for all users
  app.get("/api/users/client-assignments", async (_req, res) => {
    try {
      // Get all users
      const userList = await storage.getUsers();

      // Create a map to store user assignments
      const assignments: Record<number, Client[]> = {};

      // Get clients for each user
      await Promise.all(
        userList.map(async (user: User) => {
          const userClients = await storage.getUserClients(user.id);
          assignments[user.id] = userClients;
        })
      );

      res.json(assignments);
    } catch (error: unknown) {
      console.error(
        "Error fetching client assignments:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching client assignments" });
    }
  });

  // Create user-client relationship
  app.post("/api/user-clients", async (req, res) => {
    try {
      let { userId, clientId } = req.body;

      // If userId is not provided, use the current user's ID
      if (!userId && req.session.userId) {
        userId = req.session.userId;
      } else if (!userId) {
        return res.status(401).json({
          message: "User ID is required or user must be authenticated",
        });
      }

      // Check if this relationship already exists to prevent duplicates
      const existingRelationship = await db
        .select()
        .from(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        );

      if (existingRelationship.length > 0) {
        return res.status(409).json({
          message: "This user is already associated with this client",
          userClient: existingRelationship[0],
        });
      }

      const parsed = insertUserClientSchema.safeParse({
        userId,
        clientId,
      });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid user-client data",
          errors: parsed.error.errors,
        });
      }

      // Verify user exists
      const userExists = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (userExists.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify client exists
      const clientExists = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId));

      if (clientExists.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }

      const [userClient] = await db
        .insert(userClients)
        .values(parsed.data)
        .returning();

      res.status(201).json(userClient);
    } catch (error: unknown) {
      console.error(
        "Error creating user-client relationship:",
        error instanceof Error ? error.message : "Unknown error"
      );
      // Return more detailed error message for debugging
      res.status(500).json({
        message: "Error creating user-client relationship",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Delete user-client relationship
  app.delete("/api/user-clients/:userId/:clientId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const clientId = parseInt(req.params.clientId, 10);

      if (Number.isNaN(userId) || Number.isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid user or client ID" });
      }

      // Delete the user-client relationship
      await db
        .delete(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        )
        .execute();

      // Verify relationship was removed
      const verifyDeletion = await db
        .select()
        .from(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        );

      if (verifyDeletion.length > 0) {
        throw new Error("Failed to delete user-client relationship");
      }

      res
        .status(200)
        .json({ message: "User-client relationship deleted successfully" });
    } catch (error: unknown) {
      console.error(
        "Error deleting user-client relationship:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res
        .status(500)
        .json({ message: "Error deleting user-client relationship" });
    }
  });

  // Get users for a specific client
  app.get(
    "/api/clients/:clientId/users",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        // Query all users who have this client assigned
        const userClientRows = await db
          .select()
          .from(userClients)
          .where(eq(userClients.clientId, clientId));

        if (userClientRows.length === 0) {
          return res.json([]);
        }

        // Get user IDs from the relationships
        const userIds = userClientRows.map((row) => row.userId);

        // Fetch the actual user details
        const userList = await db
          .select()
          .from(users)
          .where(inArray(users.id, userIds));

        res.json(userList);
      } catch (error: unknown) {
        console.error(
          "Error fetching client users:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Failed to fetch client users" });
      }
    }
  );
}
