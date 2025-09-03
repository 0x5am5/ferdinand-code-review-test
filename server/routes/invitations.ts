import type { Express } from "express";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailService } from "../email-service";
import { insertInvitationSchema, invitations, UserRole } from "@shared/schema";

export function registerInvitationRoutes(app: Express) {
  // Get all pending invitations
  app.get("/api/invitations", async (req, res) => {
    try {
      // Make sure the user is authenticated
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the user to check their role
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only allow admins and super admins to view all invitations
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get all pending invitations
      const pendingInvitations = await db.query.invitations.findMany({
        where: eq(invitations.used, false),
      });

      // Enhance invitations with client data
      const enhancedInvitations = await Promise.all(
        pendingInvitations.map(async (invitation) => {
          let clientData = undefined;

          if (invitation.clientIds && invitation.clientIds.length > 0) {
            try {
              const client = await storage.getClient(invitation.clientIds[0]);
              if (client) {
                clientData = {
                  name: client.name,
                  logoUrl: client.logo || undefined,
                  primaryColor: client.primaryColor || undefined,
                };
              }
            } catch (err) {
              console.error("Error fetching client data for invitation:", err);
            }
          }

          // Exclude token from response
          const { token, ...safeInvitation } = invitation;

          return {
            ...safeInvitation,
            clientData,
          };
        }),
      );

      res.json(enhancedInvitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Error fetching invitations" });
    }
  });

  // Create a new invitation
  app.post("/api/invitations", async (req, res) => {
    try {
      const parsed = insertInvitationSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid invitation data",
          errors: parsed.error.errors,
        });
      }

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(parsed.data.email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists",
          code: "EMAIL_EXISTS",
        });
      }

      // Check if an invitation with this email already exists
      const existingInvitations = await db.query.invitations.findMany({
        where: eq(invitations.email, parsed.data.email),
      });

      // Only consider unused invitations as duplicates
      const pendingInvitation = existingInvitations.find((inv) => !inv.used);
      if (pendingInvitation) {
        return res.status(400).json({
          message: "An invitation with this email already exists",
          code: "INVITATION_EXISTS",
          invitationId: pendingInvitation.id,
        });
      }

      const invitation = await storage.createInvitation(parsed.data);

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get("host")}/signup?token=${invitation.token}`;

      // Get client information if a clientId is provided
      let clientName = "our platform";
      let logoUrl = undefined;

      if (
        req.body.clientIds &&
        Array.isArray(req.body.clientIds) &&
        req.body.clientIds.length > 0
      ) {
        try {
          const client = await storage.getClient(req.body.clientIds[0]);
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
          to: parsed.data.email,
          inviteLink,
          clientName,
          role: parsed.data.role,
          expiration: "7 days",
          logoUrl,
        });

        console.log(`Invitation email sent to ${parsed.data.email}`);
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // We don't want to fail the entire invitation process if just the email fails
      }

      // Return the invitation with the token (this will be used to create the invitation link)
      res.status(201).json({
        ...invitation,
        inviteLink,
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Error creating invitation" });
    }
  });

  // Get invitation by token (used when a user clicks on an invitation link)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitation(token);

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation is expired
      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if invitation has already been used
      if (invitation.used) {
        return res
          .status(400)
          .json({ message: "Invitation has already been used" });
      }

      // Return the invitation data (but not the token)
      res.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        clientIds: invitation.clientIds,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Error fetching invitation" });
    }
  });

  // Get client data for invitation
  app.get("/api/invitations/:token/client", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitation(token);

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation is expired
      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // If no clientIds, return empty response
      if (!invitation.clientIds || invitation.clientIds.length === 0) {
        return res.json({ clientData: null });
      }

      // Get the first client (for branding purposes)
      const clientId = invitation.clientIds[0];
      const client = await storage.getClient(clientId);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Fetch logo asset if available
      let logoUrl = null;
      const assets = await storage.getClientAssets(clientId);
      const logoAsset = assets.find(
        (asset) =>
          asset.category === "logo" &&
          asset.data &&
          typeof asset.data === "object" &&
          "type" in asset.data &&
          asset.data.type === "primary",
      );

      if (logoAsset) {
        logoUrl = `/api/assets/${logoAsset.id}/file`;
      }

      // Return client data with logo URL
      res.json({
        clientData: {
          name: client.name,
          logoUrl,
          // Use a default color if primaryColor is not available
          primaryColor: client.primaryColor || "#0f172a",
        },
      });
    } catch (error) {
      console.error("Error fetching client for invitation:", error);
      res.status(500).json({ message: "Error fetching client for invitation" });
    }
  });

  // Mark invitation as used (called after user registration is complete)
  app.post("/api/invitations/:id/use", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      const invitation = await storage.markInvitationAsUsed(id);
      res.json({ message: "Invitation marked as used", invitation });
    } catch (error) {
      console.error("Error updating invitation:", error);
      res.status(500).json({ message: "Error updating invitation" });
    }
  });

  // Delete invitation
  app.delete("/api/invitations/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Get the current user to check permissions
      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only super admins and admins can delete invitations
      if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check if invitation exists
      const invitation = await db.query.invitations.findFirst({
        where: eq(invitations.id, id),
      });

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Delete the invitation
      await db.delete(invitations).where(eq(invitations.id, id));

      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: "Error deleting invitation" });
    }
  });

  // Resend invitation email
  app.post("/api/invitations/:id/resend", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Get the invitation from database
      const invitation = await db.query.invitations.findFirst({
        where: eq(invitations.id, id),
      });

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // If invitation is already used, return error
      if (invitation.used) {
        return res
          .status(400)
          .json({ message: "Invitation has already been used" });
      }

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get("host")}/signup?token=${invitation.token}`;

      // Get client information if a clientId is provided
      let clientName = "our platform";
      let logoUrl = undefined;

      if (invitation.clientIds && invitation.clientIds.length > 0) {
        try {
          const client = await storage.getClient(invitation.clientIds[0]);
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

      // Send the invitation email
      try {
        await emailService.resendInvitationEmail({
          to: invitation.email,
          inviteLink,
          clientName,
          role: invitation.role,
          expiration: "7 days",
          logoUrl,
        });

        console.log(`Invitation email resent to ${invitation.email}`);

        // Return success
        res.json({
          message: "Invitation email resent successfully",
          inviteLink,
        });
      } catch (emailError) {
        console.error("Failed to resend invitation email:", emailError);
        res.status(500).json({ message: "Failed to resend invitation email" });
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Error resending invitation" });
    }
  });
}
