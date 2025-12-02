import { insertInvitationSchema, invitations, UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { db } from "../db";
import { emailService } from "../email-service";
import { invitationRateLimit } from "../middlewares/rate-limit";
import { requireMinimumRole } from "../middlewares/requireMinimumRole";
import { csrfProtection } from "../middlewares/security-headers";
import { storage } from "../storage";
import {
  EmailServiceError,
  ERROR_MESSAGES,
  ErrorResponse,
} from "../utils/errorResponse";

// Helper function to get client favicon/logo for email invitations
async function getClientLogoUrl(clientId: number): Promise<string | null> {
  try {
    const assets = await storage.getClientAssets(clientId);
    const logoAssets = assets.filter((asset) => asset.category === "logo");

    // Priority: favicon -> square -> horizontal -> main -> any logo
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
          } catch (error) {
            console.error(
              `Failed to parse logo data for asset ${asset.id}:`,
              error
            );
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
    return logoAsset ? `/api/assets/${logoAsset.id}/file` : null;
  } catch (error) {
    console.error(`Error fetching logo for client ${clientId}:`, error);
    return null;
  }
}

export function registerInvitationRoutes(app: Express) {
  // Get all pending invitations
  app.get(
    "/api/invitations",
    requireMinimumRole(UserRole.ADMIN),
    async (_req, res) => {
      try {
        // Get all pending invitations
        const pendingInvitations = await db
          .select()
          .from(invitations)
          .where(eq(invitations.used, false));

        // Enhance invitations with client data
        const enhancedInvitations = await Promise.all(
          pendingInvitations.map(
            async (invitation: typeof invitations.$inferSelect) => {
              let clientData:
                | { name: string; logoUrl?: string; primaryColor?: string }
                | undefined;

              if (invitation.clientIds && invitation.clientIds.length > 0) {
                try {
                  const client = await storage.getClient(
                    invitation.clientIds[0]
                  );
                  if (client) {
                    const logoUrl = await getClientLogoUrl(
                      invitation.clientIds[0]
                    );
                    clientData = {
                      name: client.name,
                      logoUrl: logoUrl || undefined,
                      primaryColor: client.primaryColor || undefined,
                    };
                  }
                } catch (err: unknown) {
                  console.error(
                    "Error fetching client data for invitation:",
                    err instanceof Error ? err.message : "Unknown error"
                  );
                }
              }

              // Exclude token from response
              const { ...safeInvitation } = invitation;

              return {
                ...safeInvitation,
                clientData,
              };
            }
          )
        );

        res.json(enhancedInvitations);
      } catch (error: unknown) {
        console.error(
          "Error fetching invitations:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching invitations" });
      }
    }
  );

  // Create a new invitation
  app.post(
    "/api/invitations",
    csrfProtection,
    invitationRateLimit,
    requireMinimumRole(UserRole.ADMIN),
    async (req, res) => {
      try {
        const parsed = insertInvitationSchema.safeParse(req.body);

        if (!parsed.success) {
          return ErrorResponse.validationError(
            res,
            ERROR_MESSAGES.VALIDATION_ERROR,
            parsed.error.errors
          );
        }

        // Check if a user with this email already exists
        const existingUser = await storage.getUserByEmail(parsed.data.email);
        if (existingUser) {
          return ErrorResponse.conflict(
            res,
            ERROR_MESSAGES.EMAIL_EXISTS,
            "EMAIL_EXISTS"
          );
        }

        // Check if an invitation with this email already exists
        const existingInvitations = await db
          .select()
          .from(invitations)
          .where(eq(invitations.email, parsed.data.email));

        // Only consider unused invitations as duplicates
        const pendingInvitation = existingInvitations.find(
          (inv: typeof invitations.$inferSelect) => !inv.used
        );
        if (pendingInvitation) {
          return ErrorResponse.conflict(
            res,
            ERROR_MESSAGES.INVITATION_EXISTS,
            "INVITATION_EXISTS",
            { invitationId: pendingInvitation.id }
          );
        }

        const invitation = await storage.createInvitation(parsed.data);

        // Calculate the invitation link
        const inviteLink = `${req.protocol}://${req.get("host")}/signup?token=${invitation.token}`;

        // Get client information if a clientId is provided
        let clientName = "our platform";
        let logoUrl: string | undefined;

        if (
          req.body.clientIds &&
          Array.isArray(req.body.clientIds) &&
          req.body.clientIds.length > 0
        ) {
          try {
            const client = await storage.getClient(req.body.clientIds[0]);
            if (client) {
              clientName = client.name;
              logoUrl =
                (await getClientLogoUrl(req.body.clientIds[0])) || undefined;
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
            to: parsed.data.email,
            inviteLink,
            clientName,
            expiration: "7 days",
            logoUrl,
          });

          console.log(`Invitation email sent to ${parsed.data.email}`);
        } catch (emailError: unknown) {
          console.error(
            "Failed to send invitation email:",
            emailError instanceof Error ? emailError.message : "Unknown error"
          );

          // If it's a structured EmailServiceError, return it to the frontend
          if (emailError instanceof EmailServiceError) {
            return ErrorResponse.badRequest(
              res,
              emailError.message,
              emailError.code,
              emailError.details
            );
          }

          // For unexpected email errors, return a generic email error
          return ErrorResponse.badRequest(
            res,
            ERROR_MESSAGES.EMAIL_SERVICE_FAILED,
            "EMAIL_SERVICE_FAILED"
          );
        }

        // Return the invitation with the token (this will be used to create the invitation link)
        res.status(201).json({
          ...invitation,
          inviteLink,
        });
      } catch (error: unknown) {
        console.error(
          "Error creating invitation:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return ErrorResponse.internalError(res, ERROR_MESSAGES.INTERNAL_ERROR);
      }
    }
  );

  // Get invitation by token (used when a user clicks on an invitation link)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitation(token);

      if (!invitation) {
        return ErrorResponse.notFound(res, ERROR_MESSAGES.INVITATION_NOT_FOUND);
      }

      // Check if invitation is expired
      if (new Date(invitation.expiresAt) < new Date()) {
        return ErrorResponse.badRequest(
          res,
          ERROR_MESSAGES.INVITATION_EXPIRED,
          "INVITATION_EXPIRED"
        );
      }

      // Check if invitation has already been used
      if (invitation.used) {
        return ErrorResponse.badRequest(
          res,
          ERROR_MESSAGES.INVITATION_USED,
          "INVITATION_USED"
        );
      }

      // Return the invitation data (but not the token)
      res.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        clientIds: invitation.clientIds,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: unknown) {
      console.error(
        "Error fetching invitation:",
        error instanceof Error ? error.message : "Unknown error"
      );
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

      // Fetch favicon logo asset for email display
      const logoUrl = await getClientLogoUrl(clientId);

      // Return client data with logo URL
      res.json({
        clientData: {
          name: client.name,
          logoUrl,
          // Use a default color if primaryColor is not available
          primaryColor: client.primaryColor || "#0f172a",
        },
      });
    } catch (error: unknown) {
      console.error(
        "Error fetching client for invitation:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching client for invitation" });
    }
  });

  // Mark invitation as used (called after user registration is complete)
  app.post("/api/invitations/:id/use", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      const invitation = await storage.markInvitationAsUsed(id);
      res.json({ message: "Invitation marked as used", invitation });
    } catch (error: unknown) {
      console.error(
        "Error updating invitation:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error updating invitation" });
    }
  });

  // Delete invitation
  app.delete(
    "/api/invitations/:id",
    requireMinimumRole(UserRole.ADMIN),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ message: "Invalid invitation ID" });
        }

        // Check if invitation exists
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(eq(invitations.id, id))
          .limit(1);

        if (!invitation) {
          return res.status(404).json({ message: "Invitation not found" });
        }

        // Delete the invitation
        await db.delete(invitations).where(eq(invitations.id, id));

        res.json({ message: "Invitation deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting invitation:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting invitation" });
      }
    }
  );

  // Resend invitation email
  app.post("/api/invitations/:id/resend", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Get the invitation from database
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, id))
        .limit(1);

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
      let logoUrl: string | undefined;

      if (invitation.clientIds && invitation.clientIds.length > 0) {
        try {
          const client = await storage.getClient(invitation.clientIds[0]);
          if (client) {
            clientName = client.name;
            logoUrl =
              (await getClientLogoUrl(invitation.clientIds[0])) || undefined;
          }
        } catch (err: unknown) {
          console.error(
            "Error fetching client data for invitation email:",
            err instanceof Error ? err.message : "Unknown error"
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
          expiration: "7 days",
          logoUrl,
        });

        console.log(`Invitation email resent to ${invitation.email}`);

        // Return success
        res.json({
          message: "Invitation email resent successfully",
          inviteLink,
        });
      } catch (emailError: unknown) {
        console.error(
          "Failed to resend invitation email:",
          emailError instanceof Error ? emailError.message : "Unknown error"
        );

        // If it's a structured EmailServiceError, return it to the frontend
        if (emailError instanceof EmailServiceError) {
          return ErrorResponse.badRequest(
            res,
            emailError.message,
            emailError.code,
            emailError.details
          );
        }

        // For unexpected email errors, return a generic email error
        return ErrorResponse.internalError(
          res,
          ERROR_MESSAGES.EMAIL_SERVICE_FAILED
        );
      }
    } catch (error: unknown) {
      console.error(
        "Error resending invitation:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error resending invitation" });
    }
  });

  // Get pending invitations for a specific client
  app.get(
    "/api/clients/:clientId/invitations",
    requireMinimumRole(UserRole.ADMIN),
    async (req, res) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);
        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        // For admins (non-super_admin), check if they have access to this client
        if (req.session?.userId) {
          const user = await storage.getUser(req.session.userId);
          if (user && user.role === UserRole.ADMIN) {
            const userClients = await storage.getUserClients(user.id);
            const hasAccess = userClients.some(
              (client) => client.id === clientId
            );

            if (!hasAccess) {
              return res
                .status(403)
                .json({ message: "Access denied to this client" });
            }
          }
        }

        // Get all pending invitations for this client
        const allPendingInvitations = await db
          .select()
          .from(invitations)
          .where(eq(invitations.used, false));

        // Filter invitations for the specific client
        const clientInvitations = allPendingInvitations.filter(
          (invitation: typeof invitations.$inferSelect) =>
            invitation.clientIds?.includes(clientId)
        );

        // Enhance invitations with client data
        const enhancedInvitations = await Promise.all(
          clientInvitations.map(
            async (invitation: typeof invitations.$inferSelect) => {
              let clientData:
                | { name: string; logoUrl?: string; primaryColor?: string }
                | undefined;

              if (invitation.clientIds && invitation.clientIds.length > 0) {
                try {
                  const client = await storage.getClient(
                    invitation.clientIds[0]
                  );
                  if (client) {
                    const logoUrl = await getClientLogoUrl(client.id);
                    clientData = {
                      name: client.name,
                      logoUrl: logoUrl || undefined,
                      primaryColor: client.primaryColor || undefined,
                    };
                  }
                } catch (clientError: unknown) {
                  console.error(
                    "Error fetching client data for invitation:",
                    clientError instanceof Error
                      ? clientError.message
                      : "Unknown error"
                  );
                }
              }

              return {
                ...invitation,
                clientData,
              };
            }
          )
        );

        res.json(enhancedInvitations);
      } catch (error: unknown) {
        console.error(
          "Error fetching client invitations:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching invitations" });
      }
    }
  );
}
