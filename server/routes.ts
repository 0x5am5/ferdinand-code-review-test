import type { Express, Request } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { auth as firebaseAuth } from "./firebase";
import { 
  insertClientSchema, 
  insertUserSchema, 
  UserRole,
  insertFontAssetSchema,
  insertColorAssetSchema,
  insertUserPersonaSchema,
  userClients,
  insertUserClientSchema,
  insertInvitationSchema,
  users,
  invitations
} from "@shared/schema";
import multer from "multer";
import { 
  insertInspirationSectionSchema, 
  insertInspirationImageSchema 
} from "@shared/schema";
import { updateClientOrderSchema } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

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

  // Google Auth endpoint
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "No ID token provided" });
      }

      // Verify the Firebase ID token
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);

      if (!decodedToken.email) {
        return res.status(400).json({ message: "No email found in token" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(decodedToken.email);

      if (!user) {
        // Create new user with guest role by default
        try {
          user = await storage.createUser({
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0],
            role: UserRole.GUEST,
          });
        } catch (error) {
          console.error("Error creating user:", error);
          return res.status(500).json({ message: "Failed to create user" });
        }
      }

      if (!req.session) {
        return res.status(500).json({ message: "Session not initialized" });
      }

      // Set user in session
      req.session.userId = user.id;
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      return res.json(user);
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
      const parsed = insertUserSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: parsed.error.errors
        });
      }
      
      // Create user with specified role or default to standard
      const user = await storage.createUserWithRole({
        ...parsed.data,
        role: req.body.role || UserRole.STANDARD
      });
      
      // If clientIds provided, create user-client relationships
      if (req.body.clientIds && Array.isArray(req.body.clientIds)) {
        await Promise.all(
          req.body.clientIds.map((clientId: number) => 
            db.insert(userClients).values({
              userId: user.id,
              clientId: clientId
            })
          )
        );
      }
      
      // Here you would normally trigger an email invitation
      // using an email service provider
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
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
      
      const [userClient] = await db.insert(userClients)
        .values(parsed.data)
        .returning();
      
      res.status(201).json(userClient);
    } catch (error) {
      console.error("Error creating user-client relationship:", error);
      res.status(500).json({ message: "Error creating user-client relationship" });
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
        .where(eq(userClients.userId, userId))
        .execute();
        
      // Verify relationship was removed
      const verifyDeletion = await db.select().from(userClients)
        .where(
          eq(userClients.userId, userId) && 
          eq(userClients.clientId, clientId)
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

  // Invitation routes
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
      
      const invitation = await storage.createInvitation(parsed.data);
      
      // If clientIds provided, also store this information for later use
      if (req.body.clientIds && Array.isArray(req.body.clientIds)) {
        // We don't need to do anything here since createInvitation already handles this
        // The clientIds will be used when the user accepts the invitation
      }
      
      // Return the invitation with the token (this will be used to create the invitation link)
      res.status(201).json({
        ...invitation,
        inviteLink: `${req.protocol}://${req.get('host')}/signup?token=${invitation.token}`
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
}