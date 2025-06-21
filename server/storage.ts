import { 
  type User, type Client, type BrandAsset, type UserPersona,
  type InsertUser, type InsertClient, type InsertBrandAsset, type InsertUserPersona,
  type InspirationSection, type InspirationImage, type Invitation,
  type InsertInspirationSection, type InsertInspirationImage, type InsertInvitation,
  type InsertFontAsset, type InsertColorAsset, type UserClient,
  type ConvertedAsset, type InsertConvertedAsset, type HiddenSection, type InsertHiddenSection,
  type TypeScale, type InsertTypeScale,
  type FigmaConnection, type FigmaSyncLog, type FigmaDesignToken,
  type InsertFigmaConnection, type InsertFigmaSyncLog, type InsertFigmaDesignToken,
  users, clients, brandAssets, userPersonas, inspirationSections, inspirationImages, invitations, userClients,
  convertedAssets, hiddenSections, typeScales, figmaConnections, figmaSyncLogs, figmaDesignTokens, UserRole
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, inArray, and, desc } from "drizzle-orm";
import * as crypto from "crypto";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  getClient(id: number): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  getClientAssets(clientId: number): Promise<BrandAsset[]>;
  getAsset(id: number): Promise<BrandAsset | undefined>;
  createAsset(asset: InsertBrandAsset | InsertFontAsset | InsertColorAsset): Promise<BrandAsset>;
  updateAsset(id: number, asset: InsertBrandAsset | InsertFontAsset | InsertColorAsset): Promise<BrandAsset>;
  deleteAsset(id: number): Promise<void>;
  // Converted assets methods
  getConvertedAssets(originalAssetId: number): Promise<ConvertedAsset[]>;
  createConvertedAsset(convertedAsset: InsertConvertedAsset): Promise<ConvertedAsset>;
  getConvertedAsset(originalAssetId: number, format: string, isDarkVariant?: boolean): Promise<ConvertedAsset | undefined>;
  // Add persona operations
  getClientPersonas(clientId: number): Promise<UserPersona[]>;
  getPersona(id: number): Promise<UserPersona | undefined>;
  createPersona(persona: InsertUserPersona): Promise<UserPersona>;
  updatePersona(id: number, persona: InsertUserPersona): Promise<UserPersona>;
  deletePersona(id: number): Promise<void>;
  // Add inspiration board methods
  getClientInspirationSections(clientId: number): Promise<InspirationSection[]>;
  getSectionImages(sectionId: number): Promise<InspirationImage[]>;
  createInspirationSection(section: InsertInspirationSection): Promise<InspirationSection>;
  updateInspirationSection(id: number, section: InsertInspirationSection): Promise<InspirationSection>;
  deleteInspirationSection(id: number): Promise<void>;
  createInspirationImage(image: InsertInspirationImage): Promise<InspirationImage>;
  deleteInspirationImage(id: number): Promise<void>;
  // User management methods
  createUserWithRole(user: InsertUser & {role:string}): Promise<User>;
  updateUserRole(id: number, role: string): Promise<User>;
  getUserClients(userId: number): Promise<Client[]>;
  // Invitation methods
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitation(token: string): Promise<Invitation | undefined>;
  markInvitationAsUsed(id: number): Promise<Invitation>;
  // Password management
  updateUserPassword(id: number, password: string): Promise<User>;
  // Hidden sections methods
  getClientHiddenSections(clientId: number): Promise<HiddenSection[]>;
  createHiddenSection(section: InsertHiddenSection): Promise<HiddenSection>;
  deleteHiddenSection(clientId: number, sectionType: string): Promise<void>;
  // Type scale methods
  getClientTypeScales(clientId: number): Promise<TypeScale[]>;
  getTypeScale(id: number): Promise<TypeScale | undefined>;
  createTypeScale(typeScale: InsertTypeScale): Promise<TypeScale>;
  updateTypeScale(id: number, typeScale: Partial<InsertTypeScale>): Promise<TypeScale>;
  deleteTypeScale(id: number): Promise<void>;
  // Figma integration methods
  getFigmaConnections(clientId: number): Promise<FigmaConnection[]>;
  getFigmaConnection(id: number): Promise<FigmaConnection | undefined>;
  createFigmaConnection(connection: InsertFigmaConnection): Promise<FigmaConnection>;
  updateFigmaConnection(id: number, data: Partial<InsertFigmaConnection>): Promise<FigmaConnection>;
  deleteFigmaConnection(id: number): Promise<void>;
  createFigmaSyncLog(log: InsertFigmaSyncLog): Promise<FigmaSyncLog>;
  updateFigmaSyncLog(id: number, data: Partial<InsertFigmaSyncLog>): Promise<FigmaSyncLog>;
  getFigmaSyncLogs(connectionId: number, limit: number, offset: number): Promise<FigmaSyncLog[]>;
  upsertFigmaDesignToken(token: InsertFigmaDesignToken): Promise<FigmaDesignToken>;
  getFigmaDesignTokens(connectionId: number): Promise<FigmaDesignToken[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(data)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }
  async deleteClient(id: number): Promise<void> {
    try {
      // Start a transaction to ensure all related data is deleted or nothing is deleted
      await db.transaction(async (tx) => {
        // 1. Delete user-client relationships
        await tx.delete(userClients).where(eq(userClients.clientId, id));

        // 2. Get all brand assets for this client
        const assets = await tx.select().from(brandAssets).where(eq(brandAssets.clientId, id));

        // 3. For each asset, delete its converted assets
        for (const asset of assets) {
          await tx.delete(convertedAssets).where(eq(convertedAssets.originalAssetId, asset.id));
        }

        // 4. Delete all brand assets
        await tx.delete(brandAssets).where(eq(brandAssets.clientId, id));

        // 5. Get all inspiration sections
        const sections = await tx.select().from(inspirationSections).where(eq(inspirationSections.clientId, id));

        // 6. Delete all inspiration images for each section
        for (const section of sections) {
          await tx.delete(inspirationImages).where(eq(inspirationImages.sectionId, section.id));
        }

        // 7. Delete all inspiration sections
        await tx.delete(inspirationSections).where(eq(inspirationSections.clientId, id));

        // 8. Delete all user personas
        await tx.delete(userPersonas).where(eq(userPersonas.clientId, id));

        // 9. Finally, delete the client
        await tx.delete(clients).where(eq(clients.id, id));
      });
    } catch (error) {
      console.error("Error in deleteClient transaction:", error);
      throw error;
    }
  }

  async getClientAssets(clientId: number): Promise<BrandAsset[]> {
    return await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.clientId, clientId));
  }

  async getAsset(id: number): Promise<BrandAsset | undefined> {
    const [asset] = await db.select().from(brandAssets).where(eq(brandAssets.id, id));
    return asset;
  }

  async createAsset(asset: any) {
    try {
      console.log("Creating asset in database:", {
        clientId: asset.clientId,
        name: asset.name,
        category: asset.category,
        hasData: !!asset.data,
        hasFileData: !!asset.fileData
      });

      const [newAsset] = await db.insert(brandAssets).values(asset).returning();
      console.log("Asset created successfully with ID:", newAsset.id);
      return newAsset;
    } catch (error) {
      console.error("Database error in createAsset:", error);
      console.error("Asset data that failed:", JSON.stringify(asset, null, 2));
      throw error;
    }
  }

  async updateAsset(id: number, updateAsset: InsertBrandAsset | InsertFontAsset | InsertColorAsset): Promise<BrandAsset> {
    const [asset] = await db
      .update(brandAssets)
      .set(updateAsset)
      .where(eq(brandAssets.id, id))
      .returning();
    return asset;
  }

  async deleteAsset(id: number): Promise<void> {
    // First, delete any converted assets related to this asset
    await db.delete(convertedAssets).where(eq(convertedAssets.originalAssetId, id));
    // Then delete the original asset
    await db.delete(brandAssets).where(eq(brandAssets.id, id));
  }

  // Converted assets implementations
  async getConvertedAssets(originalAssetId: number): Promise<ConvertedAsset[]> {
    return await db
      .select()
      .from(convertedAssets)
      .where(eq(convertedAssets.originalAssetId, originalAssetId));
  }

  async createConvertedAsset(convertedAsset: InsertConvertedAsset): Promise<ConvertedAsset> {
    const [asset] = await db
      .insert(convertedAssets)
      .values(convertedAsset)
      .returning();
    return asset;
  }

  async getConvertedAsset(originalAssetId: number, format: string, isDarkVariant: boolean = false): Promise<ConvertedAsset | undefined> {
    const [asset] = await db
      .select()
      .from(convertedAssets)
      .where(
        and(
          eq(convertedAssets.originalAssetId, originalAssetId),
          eq(convertedAssets.format, format),
          eq(convertedAssets.isDarkVariant, isDarkVariant)
        )
      );
    return asset;
  }

  // Implement persona operations
  async getClientPersonas(clientId: number): Promise<UserPersona[]> {
    return await db
      .select()
      .from(userPersonas)
      .where(eq(userPersonas.clientId, clientId));
  }

  async getPersona(id: number): Promise<UserPersona | undefined> {
    const [persona] = await db
      .select()
      .from(userPersonas)
      .where(eq(userPersonas.id, id));
    return persona;
  }

  async createPersona(insertPersona: InsertUserPersona): Promise<UserPersona> {
    const [persona] = await db
      .insert(userPersonas)
      .values(insertPersona)
      .returning();
    return persona;
  }

  async updatePersona(id: number, updatePersona: InsertUserPersona): Promise<UserPersona> {
    const [persona] = await db
      .update(userPersonas)
      .set(updatePersona)
      .where(eq(userPersonas.id, id))
      .returning();
    return persona;
  }

  async deletePersona(id: number): Promise<void> {
    await db.delete(userPersonas).where(eq(userPersonas.id, id));
  }
  // Implement inspiration board methods
  async getClientInspirationSections(clientId: number): Promise<InspirationSection[]> {
    return await db
      .select()
      .from(inspirationSections)
      .where(eq(inspirationSections.clientId, clientId))
      .orderBy(asc(inspirationSections.order));
  }

  async getSectionImages(sectionId: number): Promise<InspirationImage[]> {
    return await db
      .select()
      .from(inspirationImages)
      .where(eq(inspirationImages.sectionId, sectionId))
      .orderBy(asc(inspirationImages.order));
  }

  async createInspirationSection(section: InsertInspirationSection): Promise<InspirationSection> {
    const [newSection] = await db
      .insert(inspirationSections)
      .values(section)
      .returning();
    return newSection;
  }

  async updateInspirationSection(id: number, section: InsertInspirationSection): Promise<InspirationSection> {
    const [updatedSection] = await db
      .update(inspirationSections)
      .set(section)
      .where(eq(inspirationSections.id, id))
      .returning();
    return updatedSection;
  }

  async deleteInspirationSection(id: number): Promise<void> {
    await db.delete(inspirationSections).where(eq(inspirationSections.id, id));
  }

  async createInspirationImage(image: InsertInspirationImage): Promise<InspirationImage> {
    const [newImage] = await db
      .insert(inspirationImages)
      .values(image)
      .returning();
    return newImage;
  }

  async deleteInspirationImage(id: number): Promise<void> {
    await db.delete(inspirationImages).where(eq(inspirationImages.id, id));
  }
  async createUserWithRole(user: Omit<InsertUser, 'role'> & {role: string}):Promise<User>{
    // Ensure role is one of the valid enum values from the database schema
    if (!["super_admin", "admin", "standard", "guest"].includes(user.role)) {
      throw new Error(`Invalid role: ${user.role}`);
    }

    // Use type assertion to tell TypeScript this is a valid role
    const validRole = user.role as "super_admin" | "admin" | "standard" | "guest";

    // Create a new user object with the validated role
    const userToInsert = {
      ...user,
      role: validRole
    };

    const [newUser] = await db.insert(users).values(userToInsert).returning();
    return newUser;
  }
  async updateUserRole(id: number, role: string): Promise<User> {
    // Ensure role is one of the valid enum values from the database schema
    if (!["super_admin", "admin", "standard", "guest"].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Use type assertion to tell TypeScript this is a valid role
    const validRole = role as "super_admin" | "admin" | "standard" | "guest";

    const [updatedUser] = await db
      .update(users)
      .set({ role: validRole })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  async getUserClients(userId:number):Promise<Client[]>{
    const userClientRecords = await db
      .select()
      .from(userClients)
      .where(eq(userClients.userId, userId));

    if (userClientRecords.length === 0) {
      return [];
    }

    // Get all client IDs from the user-client relationships
    const clientIds = userClientRecords.map(record => record.clientId);

    // Fetch the client records
    return await db
      .select()
      .from(clients)
      .where(inArray(clients.id, clientIds));
  }

  // Implement invitation methods
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    // Generate a random token (UUID)
    const token = crypto.randomUUID();

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation with token and expiration
    const [newInvitation] = await db
      .insert(invitations)
      .values({
        ...invitation,
        token,
        expiresAt,
        used: false
      })
      .returning();

    return newInvitation;
  }

  async getInvitation(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token));

    return invitation;
  }

  async markInvitationAsUsed(id: number): Promise<Invitation> {
    const [updatedInvitation] = await db
      .update(invitations)
      .set({ used: true })
      .where(eq(invitations.id, id))
      .returning();

    return updatedInvitation;
  }

  async updateUserPassword(id: number, password: string): Promise<User> {
    console.log(`[PASSWORD RESET] Updating password for user ID: ${id}`);

    // In a real application, we would hash the password before storing
    // For this demo, we'll just update it directly
    const updateData: Record<string, any> = {
      password: password,
    };

    // Also update the last login time
    if (users.lastLogin) {
      updateData.lastLogin = new Date();
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    console.log(`[PASSWORD RESET] Password updated successfully for user ID: ${id}`);
    return updatedUser;
  }

  // Hidden sections implementations
  async getClientHiddenSections(clientId: number): Promise<HiddenSection[]> {
    return await db
      .select()
      .from(hiddenSections)
      .where(eq(hiddenSections.clientId, clientId));
  }

  async createHiddenSection(section: InsertHiddenSection): Promise<HiddenSection> {
    // Check if a record already exists for this client and section type
    const [existingSection] = await db
      .select()
      .from(hiddenSections)
      .where(
        eq(hiddenSections.clientId, section.clientId) && 
        eq(hiddenSections.sectionType, section.sectionType)
      );

    if (existingSection) {
      // If it already exists, return it without creating a duplicate
      return existingSection;
    }

    // Otherwise create a new hidden section record
    const [newSection] = await db
      .insert(hiddenSections)
      .values(section)
      .returning();

    return newSection;
  }

  async deleteHiddenSection(clientId: number, sectionType: string): Promise<void> {
    await db
      .delete(hiddenSections)
      .where(
        eq(hiddenSections.clientId, clientId) && 
        eq(hiddenSections.sectionType, sectionType)
      );
  }

  // Type scale implementations
  async getClientTypeScales(clientId: number): Promise<TypeScale[]> {
    return await db
      .select()
      .from(typeScales)
      .where(eq(typeScales.clientId, clientId))
      .orderBy(asc(typeScales.createdAt));
  }

  async getTypeScale(id: number): Promise<TypeScale | undefined> {
    const [typeScale] = await db
      .select()
      .from(typeScales)
      .where(eq(typeScales.id, id));
    return typeScale;
  }

  async createTypeScale(insertTypeScale: InsertTypeScale): Promise<TypeScale> {
    const [typeScale] = await db
      .insert(typeScales)
      .values({
          clientId: insertTypeScale.clientId,
          name: insertTypeScale.name,
          description: insertTypeScale.description,
          baseFontSize: insertTypeScale.baseFontSize,
          bodyFontFamily: insertTypeScale.bodyFontFamily,
          headerFontFamily: insertTypeScale.headerFontFamily,
          typeStyles: JSON.stringify(insertTypeScale.typeStyles),
          individualHeaderStyles: JSON.stringify(insertTypeScale.individualHeaderStyles || {}),
          individualBodyStyles: JSON.stringify(insertTypeScale.individualBodyStyles || {}),
      })
      .returning();
    return typeScale;
  }

  async updateTypeScale(id: number, updateTypeScale: Partial<InsertTypeScale>): Promise<TypeScale> {
    const [typeScale] = await db
      .update(typeScales)
      .set({
          name: updateTypeScale.name,
          description: updateTypeScale.description,
          baseFontSize: updateTypeScale.baseFontSize,
          bodyFontFamily: updateTypeScale.bodyFontFamily,
          headerFontFamily: updateTypeScale.headerFontFamily,
          typeStyles: JSON.stringify(updateTypeScale.typeStyles),
          individualHeaderStyles: JSON.stringify(updateTypeScale.individualHeaderStyles || {}),
          individualBodyStyles: JSON.stringify(updateTypeScale.individualBodyStyles || {}),
      })
      .where(eq(typeScales.id, id))
      .returning();
    return typeScale;
  }

  async deleteTypeScale(id: number): Promise<void> {
    await db.delete(typeScales).where(eq(typeScales.id, id));
  }

  // Figma integration methods
  async getFigmaConnections(clientId: number): Promise<FigmaConnection[]> {
    return await db
      .select()
      .from(figmaConnections)
      .where(eq(figmaConnections.clientId, clientId))
      .orderBy(asc(figmaConnections.createdAt));
  }

  async getFigmaConnection(id: number): Promise<FigmaConnection | undefined> {
    const [connection] = await db
      .select()
      .from(figmaConnections)
      .where(eq(figmaConnections.id, id));
    return connection;
  }

  async createFigmaConnection(insertConnection: InsertFigmaConnection): Promise<FigmaConnection> {
    const [connection] = await db
      .insert(figmaConnections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async updateFigmaConnection(id: number, updateData: Partial<InsertFigmaConnection>): Promise<FigmaConnection> {
    const [connection] = await db
      .update(figmaConnections)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(figmaConnections.id, id))
      .returning();
    return connection;
  }

  async deleteFigmaConnection(id: number): Promise<void> {
    // Delete related sync logs and design tokens first
    await db.delete(figmaSyncLogs).where(eq(figmaSyncLogs.connectionId, id));
    await db.delete(figmaDesignTokens).where(eq(figmaDesignTokens.connectionId, id));
    await db.delete(figmaConnections).where(eq(figmaConnections.id, id));
  }

  async createFigmaSyncLog(insertLog: InsertFigmaSyncLog): Promise<FigmaSyncLog> {
    const [log] = await db
      .insert(figmaSyncLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async updateFigmaSyncLog(id: number, updateData: Partial<InsertFigmaSyncLog>): Promise<FigmaSyncLog> {
    const [log] = await db
      .update(figmaSyncLogs)
      .set(updateData)
      .where(eq(figmaSyncLogs.id, id))
      .returning();
    return log;
  }

  async getFigmaSyncLogs(connectionId: number, limit: number, offset: number): Promise<FigmaSyncLog[]> {
    return await db
      .select()
      .from(figmaSyncLogs)
      .where(eq(figmaSyncLogs.connectionId, connectionId))
      .orderBy(asc(figmaSyncLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async upsertFigmaDesignToken(insertToken: InsertFigmaDesignToken): Promise<FigmaDesignToken> {
    // Try to find existing token
    const [existingToken] = await db
      .select()
      .from(figmaDesignTokens)
      .where(
        and(
          eq(figmaDesignTokens.connectionId, insertToken.connectionId),
          eq(figmaDesignTokens.tokenName, insertToken.tokenName),
          eq(figmaDesignTokens.tokenType, insertToken.tokenType)
        )
      );

    if (existingToken) {
      // Update existing token
      const [updatedToken] = await db
        .update(figmaDesignTokens)
        .set({ ...insertToken, updatedAt: new Date() })
        .where(eq(figmaDesignTokens.id, existingToken.id))
        .returning();
      return updatedToken;
    } else {
      // Create new token
      const [newToken] = await db
        .insert(figmaDesignTokens)
        .values([insertToken])
        .returning();
      return newToken;
    }
  }

  async getFigmaDesignTokens(connectionId: number): Promise<FigmaDesignToken[]> {
    return await db
      .select()
      .from(figmaDesignTokens)
      .where(eq(figmaDesignTokens.connectionId, connectionId))
      .orderBy(asc(figmaDesignTokens.tokenType), asc(figmaDesignTokens.tokenName));
  }
}

export const storage = new DatabaseStorage();

// Raw SQL query example:
// const typeScales = await db.execute(sql`SELECT * from type_scales WHERE client_id = ${clientId}`);

import { type TypeScale as TypeScaleSchema } from "@shared/schema";

// Map database row to TypeScale schema
export const mapTypeScale = (row: any): TypeScaleSchema => {
  return {
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      description: row.description,
      baseFontSize: row.base_font_size,
      bodyFontFamily: row.body_font_family,
      headerFontFamily: row.header_font_family,
      typeStyles: row.type_styles ? JSON.parse(row.type_styles) : [],
      individualHeaderStyles: row.individual_header_styles ? JSON.parse(row.individual_header_styles) : {},
      individualBodyStyles: row.individual_body_styles ? JSON.parse(row.individual_body_styles) : {},
      exports: row.exports ? JSON.parse(row.exports) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
  };
};

// Storage function to create a TypeScale
export const createTypeScaleStorage = async (typeScale: Omit<TypeScaleSchema, 'id' | 'createdAt' | 'updatedAt'>): Promise<TypeScaleSchema> => {
  const [newTypeScale] = await db.insert(typeScales).values({
      clientId: typeScale.clientId,
      name: typeScale.name,
      description: typeScale.description,
      baseFontSize: typeScale.baseFontSize,
      bodyFontFamily: typeScale.bodyFontFamily,
      headerFontFamily: typeScale.headerFontFamily,
      typeStyles: JSON.stringify(typeScale.typeStyles),
      individualHeaderStyles: JSON.stringify(typeScale.individualHeaderStyles || {}),
      individualBodyStyles: JSON.stringify(typeScale.individualBodyStyles || {}),
  }).returning();

  return mapTypeScale(newTypeScale);
};

// Storage function to update a TypeScale
export const updateTypeScaleStorage = async (id: number, data: Partial<Omit<TypeScaleSchema, 'id' | 'createdAt' | 'updatedAt' | 'clientId'>>): Promise<TypeScaleSchema> => {
  const [updatedTypeScale] = await db
      .update(typeScales)
      .set({
          ...(data.name && { name: data.name }),
          ...(data.description && { description: data.description }),
          ...(data.baseFontSize && { base_font_size: data.baseFontSize }),
          ...(data.bodyFontFamily && { body_font_family: data.bodyFontFamily }),
          ...(data.headerFontFamily && { header_font_family: data.headerFontFamily }),
          ...(data.typeStyles && { type_styles: JSON.stringify(data.typeStyles) }),
          ...(data.individualHeaderStyles && { individual_header_styles: JSON.stringify(data.individualHeaderStyles) }),
          ...(data.individualBodyStyles && { individual_body_styles: JSON.stringify(data.individualBodyStyles) }),
          ...(data.exports && { exports: JSON.stringify(data.exports) }),
      })
      .where(eq(typeScales.id, id))
      .returning();

  return mapTypeScale(updatedTypeScale);
};

export async function saveTypeScale(typeScale: {
  clientId: number;
  name: string;
  baseSize: number;
  scaleRatio: number;
  unit: string;
  bodyFontFamily?: string;
  bodyFontWeight?: string;
  bodyLetterSpacing?: number;
  bodyColor?: string;
  headerFontFamily?: string;
  headerFontWeight?: string;
  headerLetterSpacing?: number;
  headerColor?: string;
  individualHeaderStyles?: any;
  individualBodyStyles?: any;
}) {
  const result = await db.insert(typeScales).values({
    ...typeScale,
    individualHeaderStyles: typeScale.individualHeaderStyles ? JSON.stringify(typeScale.individualHeaderStyles) : null,
    individualBodyStyles: typeScale.individualBodyStyles ? JSON.stringify(typeScale.individualBodyStyles) : null,
  }).returning();

  // Parse the JSON strings back to objects for the response
  const parsedResult = {
    ...result[0],
    individualHeaderStyles: result[0].individualHeaderStyles ? JSON.parse(result[0].individualHeaderStyles) : {},
    individualBodyStyles: result[0].individualBodyStyles ? JSON.parse(result[0].individualBodyStyles) : {}
  };

  return parsedResult;
}

export async function updateTypeScale(id: number, updates: {
  name?: string;
  baseSize?: number;
  scaleRatio?: number;
  unit?: string;
  bodyFontFamily?: string;
  bodyFontWeight?: string;
  bodyLetterSpacing?: number;
  bodyColor?: string;
  headerFontFamily?: string;
  headerFontWeight?: string;
  headerLetterSpacing?: number;
  headerColor?: string;
  individualHeaderStyles?: any;
  individualBodyStyles?: any;
}) {
  const result = await db.update(typeScales)
    .set({
      ...updates,
      individualHeaderStyles: updates.individualHeaderStyles ? JSON.stringify(updates.individualHeaderStyles) : undefined,
      individualBodyStyles: updates.individualBodyStyles ? JSON.stringify(updates.individualBodyStyles) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(typeScales.id, id))
    .returning();

  // Parse the JSON strings back to objects for the response
  const parsedResult = {
    ...result[0],
    individualHeaderStyles: result[0].individualHeaderStyles ? JSON.parse(result[0].individualHeaderStyles) : {},
    individualBodyStyles: result[0].individualBodyStyles ? JSON.parse(result[0].individualBodyStyles) : {}
  };

  return parsedResult;
}