import type { Express, Request } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { auth as firebaseAuth } from "./firebase";
import { emailService } from "./email-service";
import * as schema from "@shared/schema";
import { 
  insertClientSchema, 
  insertUserSchema, 
  UserRole,
  User,
  insertFontAssetSchema,
  insertColorAssetSchema,
  insertUserPersonaSchema,
  userClients,
  insertUserClientSchema,
  insertInvitationSchema,
  users,
  invitations,
  clients
} from "@shared/schema";
import multer from "multer";
import { 
  insertInspirationSectionSchema, 
  insertInspirationImageSchema 
} from "@shared/schema";
import { updateClientOrderSchema } from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as fs from "fs";

// Add session augmentation for TypeScript
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Add request augmentation for clientId parameter
interface RequestWithClientId extends Request {
  clientId?: number;
}

const upload = multer();

// Design system type
interface DesignSystem {
  theme: {
    variant: 'professional' | 'tint' | 'vibrant';
    primary: string;
    appearance: 'light' | 'dark' | 'system';
    radius: number;
    animation: string;
  };
  typography: {
    primary: string;
    heading: string;
  };
  colors: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    'muted-foreground': string;
    card: string;
    'card-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    ring: string;
  };
}

export function registerRoutes(app: Express) {
  // Middleware to validate client ID
  const validateClientId = (req: RequestWithClientId, res: any, next: any) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    req.clientId = clientId;
    next();
  };

  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
  });
  
  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
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
      // Verify the Firebase ID token
      try {
        // Verify the Firebase ID token
        const decodedToken = await firebaseAuth.verifyIdToken(idToken);

        if (!decodedToken.email) {
          console.log("No email found in token");
          return res.status(400).json({ message: "No email found in token" });
        }

        console.log(`User authenticated with email: ${decodedToken.email}`);
        
        // Check if user exists
        console.log("Checking if user exists in database");
        const user = await storage.getUserByEmail(decodedToken.email);

        if (!user) {
          console.log("User does not exist, deleting from Firebase");
          try {
            await firebaseAuth.deleteUser(decodedToken.uid);
            console.log(`Deleted Firebase user with UID: ${decodedToken.uid}`);
            return res.status(403).json({ message: "User not authorized" });
          } catch (error) {
            console.error("Error deleting Firebase user:", error);
            return res.status(500).json({ message: "Failed to delete unauthorized user" });
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
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Error saving session:", err);
              reject(err);
            }
            else resolve(undefined);
          });
        });

        console.log("Authentication successful, sending user data");
        return res.json(user);
      } catch (tokenError) {
        console.error("Token verification error:", tokenError);
        return res.status(401).json({ 
          message: "Token verification failed",
          error: tokenError instanceof Error ? tokenError.message : "Unknown token error"
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(401).json({ 
        message: "Authentication failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

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

      const updatedUser = await storage.updateUserRole(req.session.userId, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Error updating user role" });
    }
  });


  // Client routes
  app.get("/api/clients", async (_req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Error fetching client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      await storage.deleteClient(id);
      res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Error deleting client" });
    }
  });

  // Add new route for updating client order
  app.patch("/api/clients/order", async (req, res) => {
    try {
      const { clientOrders } = updateClientOrderSchema.parse(req.body);
      // Update each client's display order
      await Promise.all(
        clientOrders.map(({ id, displayOrder }) =>
          storage.updateClient(id, { displayOrder })
        )
      );
      res.json({ message: "Client order updated successfully" });
    } catch (error) {
      console.error("Error updating client order:", error);
      res.status(500).json({ message: "Error updating client order" });
    }
  });

  // Update client information
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // If user is updating the client, record who made the change
      const userId = req.session.userId;
      if (userId) {
        req.body.lastEditedBy = userId;
        req.body.updatedAt = new Date();
      }

      // Update the client
      const updatedClient = await storage.updateClient(id, req.body);
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Error updating client" });
    }
  });


  // Asset routes
  app.get("/api/clients/:clientId/assets", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const assets = await storage.getClientAssets(clientId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ message: "Error fetching client assets" });
    }
  });

  // Handle both file uploads and other assets
  app.post("/api/clients/:clientId/assets", upload.array('fontFiles'), validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const { category } = req.body;

      // Font asset creation
      if (category === 'font') {
        const { name, source, weights, styles } = req.body;
        const parsedWeights = JSON.parse(weights);
        const parsedStyles = JSON.parse(styles);
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No font files uploaded" });
        }

        // Create the font asset data
        const fontAsset = {
          clientId,
          name,
          category: 'font' as const,
          fileData: files[0].buffer.toString('base64'),
          mimeType: files[0].mimetype,
          data: {
            source,
            weights: parsedWeights,
            styles: parsedStyles,
            sourceData: {
              files: files.map(file => ({
                fileName: file.originalname,
                fileData: file.buffer.toString('base64'),
                format: file.originalname.split('.').pop()?.toLowerCase() as "woff" | "woff2" | "otf" | "ttf" | "eot",
                weight: '400',
                style: 'normal'
              }))
            }
          }
        };

        const parsed = insertFontAssetSchema.safeParse(fontAsset);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid font data",
            errors: parsed.error.errors
          });
        }

        const asset = await storage.createAsset(parsed.data);
        return res.status(201).json(asset);
      }

      if (category === 'color') {
        // Handle color asset
        const colorAsset = {
          ...req.body,
          clientId,
          category: 'color' as const,
        };

        const parsed = insertColorAssetSchema.safeParse(colorAsset);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid color data",
            errors: parsed.error.errors
          });
        }

        const asset = await storage.createAsset(parsed.data);
        return res.status(201).json(asset);
      }

      // Default to logo asset
      const { name, type } = req.body;
      const files = req.files as Express.Multer.File[];
      const file = files[0];

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

      const logoAsset = {
        clientId,
        name,
        category: 'logo' as const,
        data: {
          type,
          format: fileExtension || 'png',
          fileName: file.originalname,
        },
        fileData: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      };

      const asset = await storage.createAsset(logoAsset);
      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      res.status(500).json({ message: "Error creating asset" });
    }
  });

  // Update asset endpoint
  app.patch("/api/clients/:clientId/assets/:assetId", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const assetId = parseInt(req.params.assetId);

      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to update this asset" });
      }

      let parsed;
      if (req.body.category === 'font') {
        parsed = insertFontAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else if (req.body.category === 'color') {
        parsed = insertColorAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else {
        return res.status(400).json({ message: "Invalid asset category" });
      }

      if (!parsed.success) {
        return res.status(400).json({
          message: `Invalid ${req.body.category} data`,
          errors: parsed.error.errors
        });
      }

      const updatedAsset = await storage.updateAsset(assetId, parsed.data);
      res.json(updatedAsset);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ message: "Error updating asset" });
    }
  });

  // Delete asset endpoint
  app.delete("/api/clients/:clientId/assets/:assetId", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const assetId = parseInt(req.params.assetId);

      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to delete this asset" });
      }

      await storage.deleteAsset(assetId);
      res.status(200).json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // User Persona routes
  app.get("/api/clients/:clientId/personas", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const personas = await storage.getClientPersonas(clientId);
      res.json(personas);
    } catch (error) {
      console.error("Error fetching client personas:", error);
      res.status(500).json({ message: "Error fetching client personas" });
    }
  });

  app.post("/api/clients/:clientId/personas", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const personaData = {
        ...req.body,
        clientId,
      };

      const parsed = insertUserPersonaSchema.safeParse(personaData);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid persona data",
          errors: parsed.error.errors
        });
      }

      const persona = await storage.createPersona(parsed.data);
      res.status(201).json(persona);
    } catch (error) {
      console.error("Error creating persona:", error);
      res.status(500).json({ message: "Error creating persona" });
    }
  });

  app.patch("/api/clients/:clientId/personas/:personaId", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const personaId = parseInt(req.params.personaId);

      const persona = await storage.getPersona(personaId);

      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }

      if (persona.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to update this persona" });
      }

      const parsed = insertUserPersonaSchema.safeParse({
        ...req.body,
        clientId,
      });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid persona data",
          errors: parsed.error.errors
        });
      }

      const updatedPersona = await storage.updatePersona(personaId, parsed.data);
      res.json(updatedPersona);
    } catch (error) {
      console.error("Error updating persona:", error);
      res.status(500).json({ message: "Error updating persona" });
    }
  });

  app.delete("/api/clients/:clientId/personas/:personaId", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const personaId = parseInt(req.params.personaId);

      const persona = await storage.getPersona(personaId);

      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }

      if (persona.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to delete this persona" });
      }

      await storage.deletePersona(personaId);
      res.status(200).json({ message: "Persona deleted successfully" });
    } catch (error) {
      console.error("Error deleting persona:", error);
      res.status(500).json({ message: "Error deleting persona" });
    }
  });

  // Serve asset files
  app.get("/api/assets/:assetId/file", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const asset = await storage.getAsset(assetId);

      if (!asset || !asset.fileData) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      const buffer = Buffer.from(asset.fileData, 'base64');
      res.send(buffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });

  // User Management Routes
  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
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
        name: req.body.name || req.body.email.split('@')[0], // Use part of email as name if not provided
        role: req.body.role || UserRole.STANDARD,
        clientIds: req.body.clientIds || undefined
      };

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(invitationData.email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists",
          code: "EMAIL_EXISTS"
        });
      }

      // Check if an invitation with this email already exists
      const existingInvitations = await db.query.invitations.findMany({
        where: eq(schema.invitations.email, invitationData.email)
      });

      // Only consider unused invitations as duplicates
      const pendingInvitation = existingInvitations.find(inv => !inv.used);
      if (pendingInvitation) {
        return res.status(400).json({
          message: "An invitation for this email already exists",
          code: "INVITATION_EXISTS",
          invitationId: pendingInvitation.id
        });
      }

      // Create the invitation
      const invitation = await storage.createInvitation(invitationData);

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get('host')}/signup?token=${invitation.token}`;

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
          console.error("Error fetching client data for invitation email:", err);
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
          logoUrl
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
        message: "User invited successfully"
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Error inviting user" });
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

  // Send password reset email to user
  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      console.log(`[PASSWORD RESET] Request received for user ID: ${req.params.id}`);

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        console.log(`[PASSWORD RESET] Invalid user ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`[PASSWORD RESET] User not found for ID: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`[PASSWORD RESET] Found user: ${user.email} (ID: ${user.id})`);

      // Generate a reset token that includes the user ID and expiration time
      const expirationTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now
      const tokenData = {
        userId: user.id,
        email: user.email,
        exp: expirationTime
      };

      // We'll encode this as a base64 string - in a real app you'd use a JWT or store in the database
      const resetToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');

      // Create the reset link
      const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
      console.log(`[PASSWORD RESET] Generated reset link: ${resetLink}`);

      // Send the password reset email
      console.log(`[PASSWORD RESET] Attempting to send email to: ${user.email}`);
      const emailSent = await emailService.sendPasswordResetEmail({
        to: user.email,
        resetLink,
        clientName: "Brand Guidelines Platform"
      });

      console.log(`[PASSWORD RESET] Email sent successfully: ${emailSent}`);

      res.json({ success: true, message: "Password reset email sent" });
    } catch (error) {
      console.error("Error sending password reset:", error);
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  // Handle password reset form submission
  app.post("/api/reset-password", async (req, res) => {
    try {
      console.log("[PASSWORD RESET] Processing password reset request");
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Validate password
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      try {
        // Decode the token
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        console.log("[PASSWORD RESET] Token data:", tokenData);

        // Validate token expiration
        if (!tokenData.exp || tokenData.exp < Date.now()) {
          console.log("[PASSWORD RESET] Token expired:", tokenData.exp, "<", Date.now());
          return res.status(400).json({ message: "Reset token has expired" });
        }

        // Get the user from the token
        const user = await storage.getUser(tokenData.userId);
        if (!user) {
          console.log("[PASSWORD RESET] User not found:", tokenData.userId);
          return res.status(404).json({ message: "User not found" });
        }

        // Verify the email matches
        if (user.email !== tokenData.email) {
          console.log("[PASSWORD RESET] Email mismatch:", user.email, "!==", tokenData.email);
          return res.status(400).json({ message: "Invalid reset token" });
        }

        console.log(`[PASSWORD RESET] Resetting password for user ${user.id} (${user.email})`);

        // In a real app, you would hash the password here before storing it
        // Now, actually update the user's password in the database
        await storage.updateUserPassword(user.id, password);

        console.log("[PASSWORD RESET] Password reset successfully for", user.email);

        // Send confirmation email
        await emailService.sendEmail({
          to: user.email,
          subject: "Your password has been reset",
          text: `Your password for Brand Guidelines Platform has been reset successfully. If you did not make this change, please contact support immediately.`
        });

        res.json({ success: true });
      } catch (tokenError) {
        console.error("[PASSWORD RESET] Token parsing error:", tokenError);
        return res.status(400).json({ message: "Invalid reset token format" });
      }
    } catch (error) {
      console.error("[PASSWORD RESET] Error processing reset:", error);
      res.status(500).json({ message: "An error occurred while resetting your password" });
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
      await Promise.all(userList.map(async (user) => {
        const userClients = await storage.getUserClients(user.id);
        assignments[user.id] = userClients;
      }));

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
        return res.status(401).json({ message: "User ID is required or user must be authenticated" });
      }

      // Check if this relationship already exists to prevent duplicates
      const existingRelationship = await db.select()
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
          userClient: existingRelationship[0]
        });
      }

      const parsed = insertUserClientSchema.safeParse({
        userId,
        clientId
      });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid user-client data",
          errors: parsed.error.errors
        });
      }

      // Verify user exists
      const userExists = await db.select()
        .from(users)
        .where(eq(users.id, userId));

      if (userExists.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify client exists
      const clientExists = await db.select()
        .from(clients)
        .where(eq(clients.id, clientId));

      if (clientExists.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }

      const [userClient] = await db.insert(userClients)
        .values(parsed.data)
        .returning();

      res.status(201).json(userClient);
    } catch (error) {
      console.error("Error creating user-client relationship:", error);
      // Return more detailed error message for debugging
      res.status(500).json({ 
        message: "Error creating user-client relationship", 
        error: error instanceof Error ? error.message : String(error)
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
      await db.delete(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        )
        .execute();

      // Verify relationship was removed
      const verifyDeletion = await db.select().from(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        );

      if (verifyDeletion.length > 0) {
        throw new Error("Failed to delete user-client relationship");
      }

      res.status(200).json({ message: "User-client relationship deleted successfully" });
    } catch (error) {
      console.error("Error deleting user-client relationship:", error);
      res.status(500).json({ message: "Error deleting user-client relationship" });
    }
  });

  // Get users for a specific client
  app.get("/api/clients/:clientId/users", validateClientId, async (req: RequestWithClientId, res) => {
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
      const userIds = userClientRows.map(row => row.userId);

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
  });

  // Invitation routes
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
        where: eq(schema.invitations.used, false)
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
                  primaryColor: client.primaryColor || undefined
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
            clientData
          };
        })
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
          errors: parsed.error.errors
        });
      }

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(parsed.data.email);
      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists",
          code: "EMAIL_EXISTS"
        });
      }

      // Check if an invitation with this email already exists
      const existingInvitations = await db.query.invitations.findMany({
        where: eq(schema.invitations.email, parsed.data.email)
      });

      // Only consider unused invitations as duplicates
      const pendingInvitation = existingInvitations.find(inv => !inv.used);
      if (pendingInvitation) {
        return res.status(400).json({
          message: "An invitation with this email already exists",
          code: "INVITATION_EXISTS",
          invitationId: pendingInvitation.id
        });
      }

      const invitation = await storage.createInvitation(parsed.data);

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get('host')}/signup?token=${invitation.token}`;

      // Get client information if a clientId is provided
      let clientName = "our platform";
      let logoUrl = undefined;

      if (req.body.clientIds && Array.isArray(req.body.clientIds) && req.body.clientIds.length > 0) {
        try {
          const client = await storage.getClient(req.body.clientIds[0]);
          if (client) {
            clientName = client.name;
            logoUrl = client.logo || undefined;
          }
        } catch (err) {
          console.error("Error fetching client data for invitation email:", err);
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
          logoUrl
        });

        console.log(`Invitation email sent to ${parsed.data.email}`);
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // We don't want to fail the entire invitation process if just the email fails
      }

      // Return the invitation with the token (this will be used to create the invitation link)
      res.status(201).json({
        ...invitation,
        inviteLink
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
        return res.status(400).json({ message: "Invitation has already been used" });
      }

      // Return the invitation data (but not the token)
      res.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        clientIds: invitation.clientIds,
        expiresAt: invitation.expiresAt
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
      const logoAsset = assets.find(asset => 
        asset.category === 'logo' && 
        asset.data && 
        typeof asset.data === 'object' && 
        'type' in asset.data && 
        asset.data.type === 'primary'
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
          primaryColor: client.primaryColor || "#0f172a"
        }
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

  // Resend invitation email
  app.post("/api/invitations/:id/resend", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Get the invitation from database
      const invitation = await db.query.invitations.findFirst({
        where: eq(schema.invitations.id, id)
      });

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // If invitation is already used, return error
      if (invitation.used) {
        return res.status(400).json({ message: "Invitation has already been used" });
      }

      // Calculate the invitation link
      const inviteLink = `${req.protocol}://${req.get('host')}/signup?token=${invitation.token}`;

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
          console.error("Error fetching client data for invitation email:", err);
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
          logoUrl
        });

        console.log(`Invitation email resent to ${invitation.email}`);

        // Return success
        res.json({ 
          message: "Invitation email resent successfully",
          inviteLink
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

  // Inspiration board routes
  app.get("/api/clients/:clientId/inspiration/sections", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const sections = await storage.getClientInspirationSections(clientId);
      const sectionsWithImages = await Promise.all(
        sections.map(async (section) => ({
          ...section,
          images: await storage.getSectionImages(section.id),
        }))
      );
      res.json(sectionsWithImages);
    } catch (error) {
      console.error("Error fetching inspiration sections:", error);
      res.status(500).json({ message: "Error fetching inspiration sections" });
    }
  });

  app.post("/api/clients/:clientId/inspiration/sections", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const sectionData = {
        ...req.body,
        clientId,
      };

      const parsed = insertInspirationSectionSchema.safeParse(sectionData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: parsed.error.errors,
        });
      }

      const section = await storage.createInspirationSection(parsed.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating inspiration section:", error);
      res.status(500).json({ message: "Error creating inspiration section" });
    }
  });

  app.patch("/api/clients/:clientId/inspiration/sections/:sectionId", validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const clientId = req.clientId!;
      const sectionId = parseInt(req.params.sectionId);
      const sectionData = {
        ...req.body,
        clientId,
      };

      const parsed = insertInspirationSectionSchema.safeParse(sectionData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: parsed.error.errors,
        });
      }

      const section = await storage.updateInspirationSection(sectionId, parsed.data);
      res.json(section);
    } catch (error) {
      console.error("Error updating inspiration section:", error);
      res.status(500).json({ message: "Error updating inspiration section" });
    }
  });

  app.post("/api/clients/:clientId/inspiration/sections/:sectionId/images", upload.single('image'), validateClientId, async (req: RequestWithClientId, res) => {
    try {
      const sectionId = parseInt(req.params.sectionId);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const base64Data = file.buffer.toString('base64');
      const imageData = {
        sectionId,
        url: `data:${file.mimetype};base64,${base64Data}`,
        fileData: base64Data,
        mimeType: file.mimetype,
        order: parseInt(req.body.order) || 0,
      };

      const parsed = insertInspirationImageSchema.safeParse(imageData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid image data",
          errors: parsed.error.errors,
        });
      }

      const image = await storage.createInspirationImage(parsed.data);
      res.status(201).json(image);
    } catch (error) {
      console.error("Error uploading inspiration image:", error);
      res.status(500).json({ message: "Error uploading inspiration image" });
    }
  });

  // Original client creation endpoint
  app.post("/api/clients", async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid client data",
          errors: parsed.error.errors
        });
      }

      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error creating client" });
    }
  });

  // Design System routes
  // Read the current theme.json file
  app.get("/api/design-system", async (req, res) => {
    try {
      // For development, we're temporarily removing authentication
      // In production, we'd want to check if user has admin rights

      // Read the theme.json file from the project root
      const themeData = fs.readFileSync('./theme.json', 'utf8');
      const parsedTheme = JSON.parse(themeData);

      // Default colors in case they're not in theme.json
      const defaultColors = {
        primary: parsedTheme.primary || 'hsl(205, 100%, 50%)',
        background: '#ffffff',
        foreground: '#000000',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        card: '#ffffff',
        'card-foreground': '#000000',
        accent: '#f1f5f9',
        'accent-foreground': '#0f172a',
        destructive: '#ef4444',
        'destructive-foreground': '#ffffff',
        border: '#e2e8f0',
        ring: parsedTheme.primary || 'hsl(205, 100%, 50%)',
      };

      // Construct design system object from theme.json and defaults
      // Create the design system response object
      const designSystem = {
        theme: {
          variant: parsedTheme.variant || 'professional',
          primary: parsedTheme.primary || 'hsl(205, 100%, 50%)',
          appearance: parsedTheme.appearance || 'light',
          radius: parsedTheme.radius || 0.5,
          animation: parsedTheme.animation || 'smooth',
        },
        typography: {
          primary: parsedTheme.font?.primary || 'roc-grotesk',
          heading: parsedTheme.font?.heading || 'ivypresto-display',
        },
        colors: parsedTheme.colors || defaultColors,
        // Include any extended typography settings from theme.json
        typography_extended: parsedTheme.typography_extended || {},
        // Include raw design tokens if they exist
        raw_tokens: parsedTheme.raw_tokens || {
          default_unit: 'rem',
          spacing: {
            spacing_xs: 0.25,
            spacing_sm: 0.5,
            spacing_md: 1,
            spacing_lg: 1.5,
            spacing_xl: 2,
            spacing_xxl: 3,
            spacing_xxxl: 4
          },
          radius: {
            radius_none: 0,
            radius_sm: 2,
            radius_md: 4,
            radius_lg: 8,
            radius_xl: 16,
            radius_full: 9999
          },
          transition: {
            transition_duration_fast: 150,
            transition_duration_base: 300,
            transition_duration_slow: 500,
            transition_ease_in: 'ease-in',
            transition_ease_out: 'ease-out',
            transition_ease_in_out: 'ease-in-out',
            transition_linear: 'linear'
          },
          border: {
            border_width_hairline: 1,
            border_width_thin: 2,
            border_width_medium: 4,
            border_width_thick: 8,
            border_style_solid: 'solid',
            border_style_dashed: 'dashed',
            border_style_dotted: 'dotted',
            border_style_double: 'double'
          },
          colors: {
            brand: {
              primary_base: 'blue',
              secondary_base: 'red',
              tertiary_base: 'green'
            },
            neutral: {
              neutral_0: '#ffffff',
              neutral_100: '#f8f9fa',
              neutral_200: '#e9ecef',
              neutral_300: '#dee2e6',
              neutral_400: '#ced4da',
              neutral_500: '#adb5bd',
              neutral_600: '#6c757d',
              neutral_700: '#495057',
              neutral_800: '#343a40',
              neutral_900: '#212529'
            },
            interactive: {
              success_base: '#28a745',
              warning_base: '#ffc107',
              error_base: '#dc3545',
              link_base: '#007bff'
            }
          }
        }
      } as DesignSystem & { typography_extended?: Record<string, string | number> };

      res.json(designSystem);
    } catch (error) {
      console.error("Error fetching design system:", error);
      res.status(500).json({ message: "Error fetching design system" });
    }
  });

  // Update design system
  app.patch("/api/design-system", async (req, res) => {
    try {
      // For development, we're temporarily removing authentication
      // In production, we'd want to check if user has admin rights

      const { theme, typography, colors, raw_tokens } = req.body;

      // Update raw-tokens.scss if raw_tokens are provided
      if (raw_tokens) {
        let rawTokensContent = `// This file is auto-generated by the design builder\n\n`;

        // Add default unit first
        if (raw_tokens.default_unit) {
          rawTokensContent += `// Default Unit\n`;
          rawTokensContent += `$default-unit: ${raw_tokens.default_unit};\n\n`;
        } else {
          rawTokensContent += `// Default Unit\n`;
          rawTokensContent += `$default-unit: rem;\n\n`;
        }

        // Add spacing tokens
        if (raw_tokens.spacing) {
          rawTokensContent += `// Spacing Tokens\n`;
          Object.entries(raw_tokens.spacing).forEach(([key, value]) => {
            rawTokensContent += `$${key}: ${value}#{$default-unit};\n`;
          });
          rawTokensContent += `\n`;
        }

        // Add radius tokens
        if (raw_tokens.radius) {
          rawTokensContent += `// Border Radius Tokens\n`;
          Object.entries(raw_tokens.radius).forEach(([key, value]) => {
            rawTokensContent += `$${key}: ${value}px;\n`;
          });
          rawTokensContent += `\n`;
        }

        // Add transition tokens
        if (raw_tokens.transition) {
          rawTokensContent += `// Transition Tokens\n`;
          Object.entries(raw_tokens.transition).forEach(([key, value]) => {
            if (typeof value === 'number') {
              rawTokensContent += `$${key}: ${value}ms;\n`;
            } else {
              rawTokensContent += `$${key}: ${value};\n`;
            }
          });
          rawTokensContent += `\n`;
        }
        
        // Add border tokens
        if (raw_tokens.border) {
          rawTokensContent += `// Border Tokens\n`;
          Object.entries(raw_tokens.border).forEach(([key, value]) => {
            if (key.includes('width')) {
              rawTokensContent += `$${key}: ${value}px;\n`;
            } else {
              rawTokensContent += `$${key}: ${value};\n`;
            }
          });
          rawTokensContent += `\n`;
        }
        
        // Add color tokens
        if (raw_tokens.colors) {
          rawTokensContent += `// Color Tokens\n`;
          
          if (raw_tokens.colors.brand) {
            rawTokensContent += `// Brand Colors\n`;
            Object.entries(raw_tokens.colors.brand).forEach(([key, value]) => {
              // Convert underscores to hyphens for variable names
              const formattedKey = key.replace(/_/g, '-');
              rawTokensContent += `$color-brand-${formattedKey}: ${value};\n`;
            });
            rawTokensContent += `\n`;
          }
          
          if (raw_tokens.colors.neutral) {
            rawTokensContent += `// Neutral Colors\n`;
            Object.entries(raw_tokens.colors.neutral).forEach(([key, value]) => {
              // Convert underscores to hyphens for variable names
              const formattedKey = key.replace(/_/g, '-');
              rawTokensContent += `$color-neutral-${formattedKey}: ${value};\n`;
            });
            rawTokensContent += `\n`;
          }
          
          if (raw_tokens.colors.interactive) {
            rawTokensContent += `// Interactive Colors\n`;
            Object.entries(raw_tokens.colors.interactive).forEach(([key, value]) => {
              // Convert underscores to hyphens for variable names
              const formattedKey = key.replace(/_/g, '-');
              rawTokensContent += `$color-interactive-${formattedKey}: ${value};\n`;
            });
            rawTokensContent += `\n`;
          }
        }

        fs.writeFileSync('./client/src/styles/_raw-tokens.scss', rawTokensContent);
      }

      // We need at least one section to update
      if (!theme && !typography && !colors && !raw_tokens) {
        return res.status(400).json({ message: "Invalid design system data" });
      }

      // Read existing theme.json to preserve any values not being updated
      let existingTheme: any = {};
      try {
        const themeData = fs.readFileSync('./theme.json', 'utf8');
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        console.error("Error reading existing theme.json:", error);
      }

      // Update the theme.json file
      const themeData = {
        ...existingTheme,
        variant: theme?.variant || existingTheme.variant || 'professional',
        primary: theme?.primary || existingTheme.primary || 'hsl(205, 100%, 50%)',
        appearance: theme?.appearance || existingTheme.appearance || 'light',
        radius: theme?.radius !== undefined ? theme.radius : (existingTheme.radius || 0.5),
        animation: theme?.animation || existingTheme.animation || 'smooth',
        font: {
          primary: typography?.primary || (existingTheme.font ? existingTheme.font.primary : 'roc-grotesk'),
          heading: typography?.heading || (existingTheme.font ? existingTheme.font.heading : 'ivypresto-display'),
        },
        // Store color system values in theme.json
        colors: colors || existingTheme.colors || {},
        // Store raw tokens in theme.json
        raw_tokens: raw_tokens || existingTheme.raw_tokens || {}
      };

      fs.writeFileSync('./theme.json', JSON.stringify(themeData, null, 2));

      // Return the updated design system
      res.json(req.body);
    } catch (error) {
      console.error("Error updating design system:", error);
      res.status(500).json({ message: "Error updating design system" });
    }
  });

  // Extended typography settings route
  app.patch("/api/design-system/typography", async (req, res) => {
    try {
      // For development, we're temporarily removing authentication
      // In production, we'd want to check if user has admin rights

      const typographySettings = req.body;

      if (!typographySettings || Object.keys(typographySettings).length === 0) {
        return res.status(400).json({ message: "No typography settings provided" });
      }

      // Read existing theme.json to get current settings
      let existingTheme: any = {};
      try {
        const themeData = fs.readFileSync('./theme.json', 'utf8');
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        console.error("Error reading existing theme.json:", error);
        return res.status(500).json({ message: "Error reading theme configuration" });
      }

      // Add or update the typography_extended property in theme.json
      const updatedTheme = {
        ...existingTheme,
        typography_extended: {
          ...(existingTheme.typography_extended || {}),
          ...typographySettings
        }
      };

      // Write updated theme back to theme.json
      fs.writeFileSync('./theme.json', JSON.stringify(updatedTheme, null, 2));

      // Return success response
      res.json({ 
        message: "Typography settings updated successfully", 
        settings: updatedTheme.typography_extended 
      });
    } catch (error) {
      console.error("Error updating typography settings:", error);
      res.status(500).json({ message: "Error updating typography settings" });
    }
  });
}