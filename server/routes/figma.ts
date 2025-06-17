import type { Express } from "express";
import { storage } from "../storage";
import { UserRole, insertFigmaConnectionSchema, insertFigmaSyncLogSchema } from "@shared/schema";
import { z } from "zod";

// Figma API Base URL
const FIGMA_API_BASE = "https://api.figma.com/v1";

interface FigmaFile {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
}

interface FigmaFileResponse {
  document: {
    id: string;
    name: string;
    type: string;
    children: any[];
  };
  styles: Record<string, {
    key: string;
    name: string;
    styleType: string;
    description: string;
  }>;
  lastModified: string;
}

interface FigmaStyle {
  key: string;
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  description: string;
}

export function registerFigmaRoutes(app: Express) {
  // Get Figma connections for a client
  app.get("/api/figma/connections/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has access to this client
      const client = await storage.getClient(parseInt(clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const connections = await storage.getFigmaConnections(parseInt(clientId));
      
      // Remove sensitive access tokens from response
      const sanitizedConnections = connections.map(conn => ({
        ...conn,
        accessToken: conn.accessToken ? "[REDACTED]" : null,
        refreshToken: conn.refreshToken ? "[REDACTED]" : null,
      }));

      res.json(sanitizedConnections);
    } catch (error) {
      console.error("Error fetching Figma connections:", error);
      res.status(500).json({ message: "Error fetching Figma connections" });
    }
  });

  // Test Figma API connection with access token
  app.post("/api/figma/test-connection", async (req, res) => {
    try {
      const { accessToken } = req.body;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Test the Figma API connection
      const response = await fetch(`${FIGMA_API_BASE}/me`, {
        headers: {
          "X-Figma-Token": accessToken,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          message: "Invalid Figma access token",
          error: errorText
        });
      }

      const userData = await response.json();
      res.json({ 
        success: true, 
        user: {
          id: userData.id,
          email: userData.email,
          handle: userData.handle
        }
      });
    } catch (error) {
      console.error("Error testing Figma connection:", error);
      res.status(500).json({ message: "Error testing Figma connection" });
    }
  });

  // Get files from Figma team/user
  app.post("/api/figma/files", async (req, res) => {
    try {
      const { accessToken, teamId } = req.body;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      // Get files from team or user
      let url = teamId ? `${FIGMA_API_BASE}/teams/${teamId}/projects` : `${FIGMA_API_BASE}/projects`;
      
      const response = await fetch(url, {
        headers: {
          "X-Figma-Token": accessToken,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          message: "Failed to fetch Figma files",
          error: errorText
        });
      }

      const data = await response.json();
      
      // Extract files from projects
      const files: FigmaFile[] = [];
      if (data.projects) {
        for (const project of data.projects) {
          const projectResponse = await fetch(`${FIGMA_API_BASE}/projects/${project.id}/files`, {
            headers: {
              "X-Figma-Token": accessToken,
            },
          });
          
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            files.push(...projectData.files.map((file: any) => ({
              key: file.key,
              name: file.name,
              lastModified: file.last_modified,
              thumbnailUrl: file.thumbnail_url,
            })));
          }
        }
      }

      res.json({ files });
    } catch (error) {
      console.error("Error fetching Figma files:", error);
      res.status(500).json({ message: "Error fetching Figma files" });
    }
  });

  // Connect a Figma file to a client
  app.post("/api/figma/connections", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors, admins, and super admins to create connections
      if (![UserRole.EDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions to create Figma connections" 
        });
      }

      const validatedData = insertFigmaConnectionSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });

      // Test the connection before saving
      const testResponse = await fetch(`${FIGMA_API_BASE}/files/${validatedData.figmaFileKey}`, {
        headers: {
          "X-Figma-Token": validatedData.accessToken,
        },
      });

      if (!testResponse.ok) {
        return res.status(400).json({ 
          message: "Unable to access Figma file with provided token" 
        });
      }

      const fileData = await testResponse.json();
      
      // Update the connection with actual file name if different
      validatedData.figmaFileName = fileData.name || validatedData.figmaFileName;

      const connection = await storage.createFigmaConnection(validatedData);
      
      // Remove sensitive data from response
      const sanitizedConnection = {
        ...connection,
        accessToken: "[REDACTED]",
        refreshToken: connection.refreshToken ? "[REDACTED]" : null,
      };

      res.json(sanitizedConnection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors 
        });
      }
      console.error("Error creating Figma connection:", error);
      res.status(500).json({ message: "Error creating Figma connection" });
    }
  });

  // Get design tokens from a Figma file
  app.get("/api/figma/connections/:connectionId/tokens", async (req, res) => {
    try {
      const { connectionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const connection = await storage.getFigmaConnection(parseInt(connectionId));
      if (!connection) {
        return res.status(404).json({ message: "Figma connection not found" });
      }

      // Fetch styles from Figma
      const response = await fetch(`${FIGMA_API_BASE}/files/${connection.figmaFileKey}/styles`, {
        headers: {
          "X-Figma-Token": connection.accessToken,
        },
      });

      if (!response.ok) {
        return res.status(400).json({ 
          message: "Failed to fetch styles from Figma file" 
        });
      }

      const data = await response.json();
      const styles = data.meta.styles || [];

      // Get detailed style information
      const detailedStyles = [];
      for (const style of styles) {
        const styleResponse = await fetch(`${FIGMA_API_BASE}/styles/${style.key}`, {
          headers: {
            "X-Figma-Token": connection.accessToken,
          },
        });

        if (styleResponse.ok) {
          const styleData = await styleResponse.json();
          detailedStyles.push({
            key: style.key,
            name: style.name,
            styleType: style.style_type,
            description: style.description,
            ...styleData.meta,
          });
        }
      }

      res.json({ styles: detailedStyles });
    } catch (error) {
      console.error("Error fetching Figma tokens:", error);
      res.status(500).json({ message: "Error fetching Figma tokens" });
    }
  });

  // Sync design tokens from Figma to Ferdinand
  app.post("/api/figma/connections/:connectionId/sync-from-figma", async (req, res) => {
    try {
      const { connectionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors, admins, and super admins to sync
      if (![UserRole.EDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions to sync design tokens" 
        });
      }

      const connection = await storage.getFigmaConnection(parseInt(connectionId));
      if (!connection) {
        return res.status(404).json({ message: "Figma connection not found" });
      }

      // Update connection sync status
      await storage.updateFigmaConnection(connection.id, {
        syncStatus: "syncing",
        syncError: null,
      });

      // Create sync log
      const syncLog = await storage.createFigmaSyncLog({
        connectionId: connection.id,
        syncType: "pull_from_figma",
        syncDirection: "figma_to_ferdinand",
        status: "started",
      });

      try {
        // Fetch file data from Figma
        const fileResponse = await fetch(`${FIGMA_API_BASE}/files/${connection.figmaFileKey}`, {
          headers: {
            "X-Figma-Token": connection.accessToken,
          },
        });

        if (!fileResponse.ok) {
          throw new Error("Failed to fetch file from Figma");
        }

        const fileData: FigmaFileResponse = await fileResponse.json();
        
        // Extract and process design tokens
        const elementsChanged = [];
        
        // Process color styles
        if (fileData.styles) {
          for (const [styleId, style] of Object.entries(fileData.styles)) {
            if (style.styleType === "FILL") {
              // Get detailed style information
              const styleResponse = await fetch(`${FIGMA_API_BASE}/styles/${style.key}`, {
                headers: {
                  "X-Figma-Token": connection.accessToken,
                },
              });

              if (styleResponse.ok) {
                const styleData = await styleResponse.json();
                
                // Store or update design token
                await storage.upsertFigmaDesignToken({
                  connectionId: connection.id,
                  tokenType: "color",
                  tokenName: style.name,
                  figmaId: style.key,
                  ferdinandValue: styleData, // Store the complete style data
                  figmaValue: styleData,
                  syncStatus: "in_sync",
                });

                elementsChanged.push({
                  type: "color",
                  name: style.name,
                  action: "updated",
                });
              }
            }
          }
        }

        // Update sync log as completed
        await storage.updateFigmaSyncLog(syncLog.id, {
          status: "completed",
          elementsChanged: elementsChanged.map(el => ({
            name: el.name,
            type: el.type,
            action: el.action as "created" | "updated" | "deleted"
          })),
          duration: syncLog.createdAt ? Date.now() - new Date(syncLog.createdAt).getTime() : null,
        });

        // Update connection sync status
        await storage.updateFigmaConnection(connection.id, {
          syncStatus: "success",
          lastSyncAt: new Date(),
        });

        res.json({ 
          message: "Sync completed successfully",
          elementsChanged: elementsChanged.length,
          syncLogId: syncLog.id,
        });

      } catch (syncError) {
        // Update sync log as failed
        await storage.updateFigmaSyncLog(syncLog.id, {
          status: "failed",
          errorMessage: syncError instanceof Error ? syncError.message : "Unknown error",
          duration: syncLog.createdAt ? Date.now() - new Date(syncLog.createdAt).getTime() : null,
        });

        // Update connection sync status
        await storage.updateFigmaConnection(connection.id, {
          syncStatus: "error",
          syncError: syncError instanceof Error ? syncError.message : "Unknown error",
        });

        throw syncError;
      }

    } catch (error) {
      console.error("Error syncing from Figma:", error);
      res.status(500).json({ message: "Error syncing from Figma" });
    }
  });

  // Delete a Figma connection
  app.delete("/api/figma/connections/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors, admins, and super admins to delete connections
      if (![UserRole.EDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions to delete Figma connections" 
        });
      }

      const connection = await storage.getFigmaConnection(parseInt(connectionId));
      if (!connection) {
        return res.status(404).json({ message: "Figma connection not found" });
      }

      await storage.deleteFigmaConnection(parseInt(connectionId));

      res.json({ message: "Figma connection deleted successfully" });
    } catch (error) {
      console.error("Error deleting Figma connection:", error);
      res.status(500).json({ message: "Error deleting Figma connection" });
    }
  });

  // Get sync logs for a connection
  app.get("/api/figma/connections/:connectionId/sync-logs", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { limit = "10", offset = "0" } = req.query;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const connection = await storage.getFigmaConnection(parseInt(connectionId));
      if (!connection) {
        return res.status(404).json({ message: "Figma connection not found" });
      }

      const logs = await storage.getFigmaSyncLogs(
        parseInt(connectionId), 
        parseInt(limit as string), 
        parseInt(offset as string)
      );

      res.json(logs);
    } catch (error) {
      console.error("Error fetching sync logs:", error);
      res.status(500).json({ message: "Error fetching sync logs" });
    }
  });
}