import type { Express } from "express";
import { storage } from "../storage";
import { UserRole, users, userClients } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { emailService } from "../email-service";
import { validateClientId } from "server/middlewares/vaildateClientId";
import { RequestWithClientId } from "server/routes";

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
          .where(
            inArray(
              userClients.clientId,
              adminClients.map((c) => c.id),
            ),
          );

        const userIds = [...new Set(clientUsers.map((uc) => uc.userId))];

        allUsers = await db
          .select()
          .from(users)
          .where(
            and(
              inArray(users.id, userIds),
              sql`role NOT IN ('ADMIN', 'SUPER_ADMIN')`,
            ),
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
        where: eq(schema.invitations.email, invitationData.email),
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
      let logoUrl = undefined;

      if (invitationData.clientIds && invitationData.clientIds.length > 0) {
        try {
          const client = await storage.getClient(invitationData.clientIds[0]);
          if (client) {
            clientName = client.name;
            logoUrl = client.logo || undefined;
          }
        } catch (err) {
          console.error(
            "Error fetching client data for invitation email:",
            err,
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
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
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
    } catch (error) {
      console.error("Error inviting user:", error);
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
        role,
      );
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Error updating user role" });
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

      const resetToken = Buffer.from(JSON.stringify(tokenData)).toString(
        "base64",
      );
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
    } catch (error) {
      console.error("Error processing reset:", error);
      res
        .status(500)
        .json({ message: "An error occurred while resetting your password" });
    }
  });

  // Get clients for a user
  app.get("/api/users/:id/clients", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const clients = await storage.getUserClients(id);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching user clients:", error);
      res.status(500).json({ message: "Error fetching user clients" });
    }
  });

  // Get all client assignments for all users
  app.get("/api/users/client-assignments", async (req, res) => {
    try {
      // Get all users
      const userList = await storage.getUsers();

      // Create a map to store user assignments
      const assignments: Record<number, any[]> = {};

      // Get clients for each user
      await Promise.all(
        userList.map(async (user) => {
          const userClients = await storage.getUserClients(user.id);
          assignments[user.id] = userClients;
        }),
      );

      res.json(assignments);
    } catch (error) {
      console.error("Error fetching client assignments:", error);
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
            eq(userClients.clientId, clientId),
          ),
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
    } catch (error) {
      console.error("Error creating user-client relationship:", error);
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
      const userId = parseInt(req.params.userId);
      const clientId = parseInt(req.params.clientId);

      if (isNaN(userId) || isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid user or client ID" });
      }

      // Delete the user-client relationship
      await db
        .delete(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId),
          ),
        )
        .execute();

      // Verify relationship was removed
      const verifyDeletion = await db
        .select()
        .from(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId),
          ),
        );

      if (verifyDeletion.length > 0) {
        throw new Error("Failed to delete user-client relationship");
      }

      res
        .status(200)
        .json({ message: "User-client relationship deleted successfully" });
    } catch (error) {
      console.error("Error deleting user-client relationship:", error);
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
        const clientId = req.clientId!;

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
      } catch (error) {
        console.error("Error fetching client users:", error);
        res.status(500).json({ message: "Failed to fetch client users" });
      }
    },
  );
}
