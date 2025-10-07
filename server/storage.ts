import {
  type BrandAsset,
  brandAssets,
  type Client,
  type ConvertedAsset,
  clients,
  convertedAssets,
  type FeatureToggles,
  type FigmaConnection,
  type FigmaDesignToken,
  type FigmaSyncLog,
  figmaConnections,
  figmaDesignTokens,
  figmaSyncLogs,
  type HiddenSection,
  hiddenSections,
  type InsertBrandAsset,
  type InsertClient,
  type InsertColorAsset,
  type InsertConvertedAsset,
  type InsertFigmaConnection,
  type InsertFigmaDesignToken,
  type InsertFigmaSyncLog,
  type InsertFontAsset,
  type InsertHiddenSection,
  type InsertInspirationImage,
  type InsertInspirationSection,
  type InsertInvitation,
  type InsertTypeScale,
  type InsertUser,
  type InsertUserPersona,
  type InspirationImage,
  type InspirationSection,
  type Invitation,
  type insertTypeScaleSchemaExtended,
  inspirationImages,
  inspirationSections,
  invitations,
  type TypeScale,
  type TypeScaleDB,
  typeScales,
  USER_ROLES,
  type User,
  type UserPersona,
  type UserRoleType,
  userClients,
  userPersonas,
  users,
} from "@shared/schema";
import * as crypto from "crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "./db";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  getClient(id: number): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client>;
  touchClient(id: number): Promise<void>;
  deleteClient(id: number): Promise<void>;
  getClientAssets(clientId: number): Promise<BrandAsset[]>;
  getAsset(id: number): Promise<BrandAsset | undefined>;
  createAsset(
    asset: InsertBrandAsset | InsertFontAsset | InsertColorAsset
  ): Promise<BrandAsset>;
  updateAsset(
    id: number,
    asset: InsertBrandAsset | InsertFontAsset | InsertColorAsset
  ): Promise<BrandAsset>;
  deleteAsset(id: number): Promise<void>;
  // Converted assets methods
  getConvertedAssets(originalAssetId: number): Promise<ConvertedAsset[]>;
  createConvertedAsset(
    convertedAsset: InsertConvertedAsset
  ): Promise<ConvertedAsset>;
  getConvertedAsset(
    originalAssetId: number,
    format: string,
    isDarkVariant?: boolean
  ): Promise<ConvertedAsset | undefined>;
  // Add persona operations
  getClientPersonas(clientId: number): Promise<UserPersona[]>;
  getPersona(id: number): Promise<UserPersona | undefined>;
  createPersona(persona: InsertUserPersona): Promise<UserPersona>;
  updatePersona(id: number, persona: InsertUserPersona): Promise<UserPersona>;
  deletePersona(id: number): Promise<void>;
  // Add inspiration board methods
  getClientInspirationSections(clientId: number): Promise<InspirationSection[]>;
  getSectionImages(sectionId: number): Promise<InspirationImage[]>;
  createInspirationSection(
    section: InsertInspirationSection
  ): Promise<InspirationSection>;
  updateInspirationSection(
    id: number,
    section: InsertInspirationSection
  ): Promise<InspirationSection>;
  deleteInspirationSection(id: number): Promise<void>;
  createInspirationImage(
    image: InsertInspirationImage
  ): Promise<InspirationImage>;
  deleteInspirationImage(id: number): Promise<void>;
  // User management methods
  createUserWithRole(user: InsertUser & { role: UserRoleType }): Promise<User>;
  updateUserRole(id: number, role: UserRoleType): Promise<User>;
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
  updateTypeScale(
    id: number,
    typeScale: Partial<z.infer<typeof insertTypeScaleSchemaExtended>>
  ): Promise<TypeScale>;
  deleteTypeScale(id: number): Promise<void>;
  // Figma integration methods
  getFigmaConnections(clientId: number): Promise<FigmaConnection[]>;
  getFigmaConnection(id: number): Promise<FigmaConnection | undefined>;
  createFigmaConnection(
    connection: InsertFigmaConnection
  ): Promise<FigmaConnection>;
  updateFigmaConnection(
    id: number,
    data: Partial<InsertFigmaConnection>
  ): Promise<FigmaConnection>;
  deleteFigmaConnection(id: number): Promise<void>;
  createFigmaSyncLog(log: InsertFigmaSyncLog): Promise<FigmaSyncLog>;
  updateFigmaSyncLog(
    id: number,
    data: Partial<InsertFigmaSyncLog>
  ): Promise<FigmaSyncLog>;
  getFigmaSyncLogs(
    connectionId: number,
    limit: number,
    offset: number
  ): Promise<FigmaSyncLog[]>;
  upsertFigmaDesignToken(
    token: InsertFigmaDesignToken
  ): Promise<FigmaDesignToken>;
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
    return client as Client;
  }

  async getClients(): Promise<Client[]> {
    const rawClients = await db.select().from(clients);
    return rawClients as Client[];
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client as Client;
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return client as Client;
  }

  async touchClient(id: number): Promise<void> {
    await db
      .update(clients)
      .set({ updatedAt: new Date() })
      .where(eq(clients.id, id));
  }
  async deleteClient(id: number): Promise<void> {
    try {
      // Start a transaction to ensure all related data is deleted or nothing is deleted
      await db.transaction(async (tx) => {
        // 1. Delete user-client relationships
        await tx.delete(userClients).where(eq(userClients.clientId, id));

        // 2. Get all brand assets for this client
        const assets = await tx
          .select()
          .from(brandAssets)
          .where(eq(brandAssets.clientId, id));

        // 3. For each asset, delete its converted assets
        for (const asset of assets) {
          await tx
            .delete(convertedAssets)
            .where(eq(convertedAssets.originalAssetId, asset.id));
        }

        // 4. Delete all brand assets
        await tx.delete(brandAssets).where(eq(brandAssets.clientId, id));

        // 5. Get all inspiration sections
        const sections = await tx
          .select()
          .from(inspirationSections)
          .where(eq(inspirationSections.clientId, id));

        // 6. Delete all inspiration images for each section
        for (const section of sections) {
          await tx
            .delete(inspirationImages)
            .where(eq(inspirationImages.sectionId, section.id));
        }

        // 7. Delete all inspiration sections
        await tx
          .delete(inspirationSections)
          .where(eq(inspirationSections.clientId, id));

        // 8. Delete all user personas
        await tx.delete(userPersonas).where(eq(userPersonas.clientId, id));

        // 9. Finally, delete the client
        await tx.delete(clients).where(eq(clients.id, id));
      });
    } catch (error: unknown) {
      console.error(
        "Error in deleteClient transaction:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
    const [asset] = await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.id, id));
    return asset;
  }

  async createAsset(
    asset: InsertBrandAsset | InsertFontAsset | InsertColorAsset
  ) {
    try {
      console.log("Creating asset in database:", {
        clientId: asset.clientId,
        name: asset.name,
        category: asset.category,
        hasData: !!asset.data,
        hasFileData: !!asset.fileData,
      });

      const [newAsset] = await db.insert(brandAssets).values(asset).returning();
      console.log("Asset created successfully with ID:", newAsset.id);
      return newAsset;
    } catch (error: unknown) {
      console.error(
        "Database error in createAsset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      console.error("Asset data that failed:", JSON.stringify(asset, null, 2));
      throw error;
    }
  }

  async updateAsset(
    id: number,
    updateAsset: InsertBrandAsset | InsertFontAsset | InsertColorAsset
  ): Promise<BrandAsset> {
    const [asset] = await db
      .update(brandAssets)
      .set({
        ...updateAsset,
        updatedAt: new Date(), // Always update the timestamp on asset updates
      })
      .where(eq(brandAssets.id, id))
      .returning();
    return asset;
  }

  async deleteAsset(id: number): Promise<void> {
    // First, delete any converted assets related to this asset
    await db
      .delete(convertedAssets)
      .where(eq(convertedAssets.originalAssetId, id));
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

  async createConvertedAsset(
    convertedAsset: InsertConvertedAsset
  ): Promise<ConvertedAsset> {
    const [asset] = await db
      .insert(convertedAssets)
      .values(convertedAsset)
      .returning();
    return asset;
  }

  async getConvertedAsset(
    originalAssetId: number,
    format: string,
    isDarkVariant: boolean = false
  ): Promise<ConvertedAsset | undefined> {
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

  async updatePersona(
    id: number,
    updatePersona: InsertUserPersona
  ): Promise<UserPersona> {
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
  async getClientInspirationSections(
    clientId: number
  ): Promise<InspirationSection[]> {
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

  async createInspirationSection(
    section: InsertInspirationSection
  ): Promise<InspirationSection> {
    const [newSection] = await db
      .insert(inspirationSections)
      .values(section)
      .returning();
    return newSection;
  }

  async updateInspirationSection(
    id: number,
    section: InsertInspirationSection
  ): Promise<InspirationSection> {
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

  async createInspirationImage(
    image: InsertInspirationImage
  ): Promise<InspirationImage> {
    const [newImage] = await db
      .insert(inspirationImages)
      .values(image)
      .returning();
    return newImage;
  }

  async deleteInspirationImage(id: number): Promise<void> {
    await db.delete(inspirationImages).where(eq(inspirationImages.id, id));
  }
  async createUserWithRole(
    user: Omit<InsertUser, "role"> & { role: UserRoleType }
  ): Promise<User> {
    // Ensure role is one of the valid enum values from the database schema
    if (!USER_ROLES.includes(user.role)) {
      throw new Error(`Invalid role: ${user.role}`);
    }

    // Use type assertion to tell TypeScript this is a valid role
    const validRole = user.role;

    // Create a new user object with the validated role
    const userToInsert = {
      ...user,
      role: validRole,
    };

    const [newUser] = await db.insert(users).values(userToInsert).returning();
    return newUser;
  }
  async updateUserRole(id: number, role: UserRoleType): Promise<User> {
    // Ensure role is one of the valid enum values from the database schema
    if (!USER_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Use the validated role
    const validRole = role;

    const [updatedUser] = await db
      .update(users)
      .set({ role: validRole })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  async getUserClients(userId: number): Promise<Client[]> {
    // Get explicit user-client relationships
    const userClientRecords = await db
      .select()
      .from(userClients)
      .where(eq(userClients.userId, userId));

    // Collect all client IDs the user has access to
    const clientIds = userClientRecords.map((record) => record.clientId);

    if (clientIds.length === 0) {
      return [];
    }

    // Fetch the client records
    const clientRecords = await db
      .select()
      .from(clients)
      .where(inArray(clients.id, clientIds));

    // Transform the records to properly cast featureToggles
    return clientRecords.map((client) => ({
      ...client,
      featureToggles: client.featureToggles as FeatureToggles,
    }));
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
        used: false,
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
    const updateData: Record<string, unknown> = {
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

    console.log(
      `[PASSWORD RESET] Password updated successfully for user ID: ${id}`
    );
    return updatedUser;
  }

  // Hidden sections implementations
  async getClientHiddenSections(clientId: number): Promise<HiddenSection[]> {
    return await db
      .select()
      .from(hiddenSections)
      .where(eq(hiddenSections.clientId, clientId));
  }

  async createHiddenSection(
    section: InsertHiddenSection
  ): Promise<HiddenSection> {
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

  async deleteHiddenSection(
    clientId: number,
    sectionType: string
  ): Promise<void> {
    await db
      .delete(hiddenSections)
      .where(
        eq(hiddenSections.clientId, clientId) &&
          eq(hiddenSections.sectionType, sectionType)
      );
  }

  // Type scale implementations
  async getClientTypeScales(clientId: number): Promise<TypeScale[]> {
    const results = await db
      .select()
      .from(typeScales)
      .where(eq(typeScales.clientId, clientId))
      .orderBy(asc(typeScales.createdAt));

    // Map the database fields to the expected format
    return results.map(
      (typeScale) =>
        ({
          id: typeScale.id,
          clientId: typeScale.clientId,
          name: typeScale.name,
          unit: typeScale.unit,
          baseSize: typeScale.baseSize,
          scaleRatio: typeScale.scaleRatio,
          customRatio: typeScale.customRatio,
          bodyFontFamily: typeScale.bodyFontFamily,
          bodyFontWeight: typeScale.bodyFontWeight,
          bodyLetterSpacing: typeScale.bodyLetterSpacing,
          bodyColor: typeScale.bodyColor,
          headerFontFamily: typeScale.headerFontFamily,
          headerFontWeight: typeScale.headerFontWeight,
          headerLetterSpacing: typeScale.headerLetterSpacing,
          headerColor: typeScale.headerColor,
          responsiveSizes: typeScale.responsiveSizes,
          typeStyles: typeScale.typeStyles,
          exports: typeScale.exports,
          createdAt: typeScale.createdAt,
          updatedAt: typeScale.updatedAt,
          individualHeaderStyles: typeScale.individual_header_styles || {},
          individualBodyStyles: typeScale.individual_body_styles || {},
        }) as unknown as TypeScale
    );
  }

  async getTypeScale(id: number): Promise<TypeScale | undefined> {
    const [typeScale] = await db
      .select()
      .from(typeScales)
      .where(eq(typeScales.id, id));

    if (!typeScale) {
      return undefined;
    }

    // Map the database fields to the expected format
    return {
      id: typeScale.id,
      clientId: typeScale.clientId,
      name: typeScale.name,
      unit: typeScale.unit,
      baseSize: typeScale.baseSize,
      scaleRatio: typeScale.scaleRatio,
      customRatio: typeScale.customRatio,
      bodyFontFamily: typeScale.bodyFontFamily,
      bodyFontWeight: typeScale.bodyFontWeight,
      bodyLetterSpacing: typeScale.bodyLetterSpacing,
      bodyColor: typeScale.bodyColor,
      headerFontFamily: typeScale.headerFontFamily,
      headerFontWeight: typeScale.headerFontWeight,
      headerLetterSpacing: typeScale.headerLetterSpacing,
      headerColor: typeScale.headerColor,
      responsiveSizes: typeScale.responsiveSizes,
      typeStyles: typeScale.typeStyles,
      exports: typeScale.exports,
      createdAt: typeScale.createdAt,
      updatedAt: typeScale.updatedAt,
      individualHeaderStyles: typeScale.individual_header_styles || {},
      individualBodyStyles: typeScale.individual_body_styles || {},
    } as unknown as TypeScale;
  }

  async createTypeScale(insertTypeScale: InsertTypeScale): Promise<TypeScale> {
    const [typeScale] = await db
      .insert(typeScales)
      .values(insertTypeScale)
      .returning();

    // Map the database fields to the expected format
    return {
      id: typeScale.id,
      clientId: typeScale.clientId,
      name: typeScale.name,
      unit: typeScale.unit,
      baseSize: typeScale.baseSize,
      scaleRatio: typeScale.scaleRatio,
      customRatio: typeScale.customRatio,
      bodyFontFamily: typeScale.bodyFontFamily,
      bodyFontWeight: typeScale.bodyFontWeight,
      bodyLetterSpacing: typeScale.bodyLetterSpacing,
      bodyColor: typeScale.bodyColor,
      headerFontFamily: typeScale.headerFontFamily,
      headerFontWeight: typeScale.headerFontWeight,
      headerLetterSpacing: typeScale.headerLetterSpacing,
      headerColor: typeScale.headerColor,
      responsiveSizes: typeScale.responsiveSizes,
      typeStyles: typeScale.typeStyles,
      exports: typeScale.exports,
      createdAt: typeScale.createdAt,
      updatedAt: typeScale.updatedAt,
      individualHeaderStyles: typeScale.individual_header_styles || {},
      individualBodyStyles: typeScale.individual_body_styles || {},
    } as unknown as TypeScale;
  }

  async updateTypeScale(
    id: number,
    updateTypeScale: Partial<z.infer<typeof insertTypeScaleSchemaExtended>>
  ): Promise<TypeScale> {
    // Clean the data to remove any conflicting fields and ensure proper format
    const cleanedData = { ...updateTypeScale };

    // Remove any camelCase versions that conflict with database snake_case fields
    delete cleanedData["individualHeaderStyles" as keyof typeof cleanedData];
    delete cleanedData["individualBodyStyles" as keyof typeof cleanedData];

    // Map individual styles to correct database fields if they exist in the update
    if (updateTypeScale.individualHeaderStyles) {
      cleanedData.individual_header_styles = JSON.stringify(
        updateTypeScale.individualHeaderStyles
      );
    }
    if (updateTypeScale.individualBodyStyles) {
      cleanedData.individual_body_styles = JSON.stringify(
        updateTypeScale.individualBodyStyles
      );
    }

    // Set updatedAt field for the database (snake_case)
    (cleanedData as Record<string, unknown>).updatedAt = new Date();

    console.log(
      "Cleaned data for database update:",
      JSON.stringify(cleanedData, null, 2)
    );

    const [typeScale] = await db
      .update(typeScales)
      .set(cleanedData)
      .where(eq(typeScales.id, id))
      .returning();

    // Map the database fields back to the expected format
    return {
      id: typeScale.id,
      clientId: typeScale.clientId,
      name: typeScale.name,
      unit: typeScale.unit,
      baseSize: typeScale.baseSize,
      scaleRatio: typeScale.scaleRatio,
      customRatio: typeScale.customRatio,
      bodyFontFamily: typeScale.bodyFontFamily,
      bodyFontWeight: typeScale.bodyFontWeight,
      bodyLetterSpacing: typeScale.bodyLetterSpacing,
      bodyColor: typeScale.bodyColor,
      headerFontFamily: typeScale.headerFontFamily,
      headerFontWeight: typeScale.headerFontWeight,
      headerLetterSpacing: typeScale.headerLetterSpacing,
      headerColor: typeScale.headerColor,
      responsiveSizes: typeScale.responsiveSizes,
      typeStyles: typeScale.typeStyles,
      exports: typeScale.exports,
      createdAt: typeScale.createdAt,
      updatedAt: typeScale.updatedAt,
      individualHeaderStyles: typeScale.individual_header_styles || {},
      individualBodyStyles: typeScale.individual_body_styles || {},
    } as unknown as TypeScale;
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

  async createFigmaConnection(
    insertConnection: InsertFigmaConnection
  ): Promise<FigmaConnection> {
    const [connection] = await db
      .insert(figmaConnections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async updateFigmaConnection(
    id: number,
    updateData: Partial<InsertFigmaConnection>
  ): Promise<FigmaConnection> {
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
    await db
      .delete(figmaDesignTokens)
      .where(eq(figmaDesignTokens.connectionId, id));
    await db.delete(figmaConnections).where(eq(figmaConnections.id, id));
  }

  async createFigmaSyncLog(
    insertLog: InsertFigmaSyncLog
  ): Promise<FigmaSyncLog> {
    const [log] = await db.insert(figmaSyncLogs).values(insertLog).returning();
    return log;
  }

  async updateFigmaSyncLog(
    id: number,
    updateData: Partial<InsertFigmaSyncLog>
  ): Promise<FigmaSyncLog> {
    const [log] = await db
      .update(figmaSyncLogs)
      .set(updateData)
      .where(eq(figmaSyncLogs.id, id))
      .returning();
    return log;
  }

  async getFigmaSyncLogs(
    connectionId: number,
    limit: number,
    offset: number
  ): Promise<FigmaSyncLog[]> {
    return await db
      .select()
      .from(figmaSyncLogs)
      .where(eq(figmaSyncLogs.connectionId, connectionId))
      .orderBy(asc(figmaSyncLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async upsertFigmaDesignToken(
    insertToken: InsertFigmaDesignToken
  ): Promise<FigmaDesignToken> {
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
        .values({
          ...insertToken,
          ferdinandValue: insertToken.ferdinandValue ?? null,
        })
        .returning();
      return newToken;
    }
  }

  async getFigmaDesignTokens(
    connectionId: number
  ): Promise<FigmaDesignToken[]> {
    return await db
      .select()
      .from(figmaDesignTokens)
      .where(eq(figmaDesignTokens.connectionId, connectionId))
      .orderBy(
        asc(figmaDesignTokens.tokenType),
        asc(figmaDesignTokens.tokenName)
      );
  }
}

export const storage = new DatabaseStorage();

// Raw SQL query example:
// const typeScales = await db.execute(sql`SELECT * from type_scales WHERE client_id = ${clientId}`);

import type { TypeScale as TypeScaleSchema } from "@shared/schema";

// Map database row to TypeScale schema
export const mapTypeScale = (row: TypeScaleDB): TypeScaleSchema => {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    unit: row.unit || "px",
    baseSize: row.baseSize || 16,
    scaleRatio: row.scaleRatio || 1250,
    customRatio: row.customRatio || undefined,
    bodyFontFamily: row.bodyFontFamily || "",
    bodyFontWeight: row.bodyFontWeight || "400",
    bodyLetterSpacing: row.bodyLetterSpacing || 0,
    bodyColor: row.bodyColor || "#000000",
    headerFontFamily: row.headerFontFamily || "",
    headerFontWeight: row.headerFontWeight || "700",
    headerLetterSpacing: row.headerLetterSpacing || 0,
    headerColor: row.headerColor || "#000000",
    responsiveSizes: row.responsiveSizes
      ? JSON.parse(row.responsiveSizes as string)
      : undefined,
    typeStyles: row.typeStyles ? JSON.parse(row.typeStyles as string) : [],
    individualHeaderStyles: row.individual_header_styles
      ? JSON.parse(row.individual_header_styles as string)
      : {},
    individualBodyStyles: row.individual_body_styles
      ? JSON.parse(row.individual_body_styles as string)
      : {},
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
};

// Storage function to create a TypeScale
export const createTypeScaleStorage = async (
  typeScale: Omit<TypeScaleSchema, "id" | "createdAt" | "updatedAt">
): Promise<TypeScaleSchema> => {
  const [newTypeScale] = await db
    .insert(typeScales)
    .values({
      clientId: typeScale.clientId,
      name: typeScale.name,
      baseSize: typeScale.baseSize,
      bodyFontFamily: typeScale.bodyFontFamily,
      headerFontFamily: typeScale.headerFontFamily,
      typeStyles: JSON.stringify(typeScale.typeStyles),
      individual_header_styles: JSON.stringify(
        typeScale.individualHeaderStyles || {}
      ),
      individual_body_styles: JSON.stringify(
        typeScale.individualBodyStyles || {}
      ),
    })
    .returning();

  return mapTypeScale(newTypeScale);
};

// Storage function to update a TypeScale
export const updateTypeScaleStorage = async (
  id: number,
  data: Partial<
    Omit<TypeScaleSchema, "id" | "createdAt" | "updatedAt" | "clientId">
  >
): Promise<TypeScaleSchema> => {
  const [updatedTypeScale] = await db
    .update(typeScales)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.baseSize && { baseSize: data.baseSize }),
      ...(data.bodyFontFamily && { bodyFontFamily: data.bodyFontFamily }),
      ...(data.headerFontFamily && { headerFontFamily: data.headerFontFamily }),
      ...(data.typeStyles && { typeStyles: data.typeStyles }),
      ...(data.individualHeaderStyles && {
        individual_header_styles: JSON.stringify(data.individualHeaderStyles),
      }),
      ...(data.individualBodyStyles && {
        individual_body_styles: JSON.stringify(data.individualBodyStyles),
      }),
      // ...(data.exports && { exports: data.exports }),
    })
    .where(eq(typeScales.id, id))
    .returning();

  return mapTypeScale(updatedTypeScale);
};

export const getClientTypeScales = async (
  clientId: number
): Promise<TypeScale[]> => {
  const results = await db
    .select()
    .from(typeScales)
    .where(eq(typeScales.clientId, clientId))
    .orderBy(typeScales.createdAt);

  // Map the database fields to the expected format
  return results.map((typeScale) => ({
    ...typeScale,
    customRatio: typeScale.customRatio ?? undefined,
    bodyFontFamily: typeScale.bodyFontFamily ?? "",
    bodyFontWeight: typeScale.bodyFontWeight ?? "400",
    bodyLetterSpacing: typeScale.bodyLetterSpacing ?? 0,
    bodyColor: typeScale.bodyColor ?? "#000000",
    headerFontFamily: typeScale.headerFontFamily ?? "",
    headerFontWeight: typeScale.headerFontWeight ?? "700",
    headerLetterSpacing: typeScale.headerLetterSpacing ?? 0,
    headerColor: typeScale.headerColor ?? "#000000",
    responsiveSizes: typeScale.responsiveSizes as TypeScale["responsiveSizes"],
    typeStyles: typeScale.typeStyles as TypeScale["typeStyles"],
    exports: typeScale.exports as TypeScale["exports"],
    createdAt: typeScale.createdAt?.toISOString(),
    updatedAt: typeScale.updatedAt?.toISOString(),
    individualHeaderStyles: typeof typeScale.individual_header_styles === 'string'
      ? JSON.parse(typeScale.individual_header_styles)
      : typeScale.individual_header_styles || {},
    individualBodyStyles: typeof typeScale.individual_body_styles === 'string'
      ? JSON.parse(typeScale.individual_body_styles)
      : typeScale.individual_body_styles || {},
  }));
};

export const getTypeScale = async (id: number): Promise<TypeScale | null> => {
  const [typeScale] = await db
    .select()
    .from(typeScales)
    .where(eq(typeScales.id, id));

  if (!typeScale) {
    return null;
  }

  // Map the database fields to the expected format
  return {
    ...typeScale,
    customRatio: typeScale.customRatio ?? undefined,
    bodyFontFamily: typeScale.bodyFontFamily ?? "",
    bodyFontWeight: typeScale.bodyFontWeight ?? "400",
    bodyLetterSpacing: typeScale.bodyLetterSpacing ?? 0,
    bodyColor: typeScale.bodyColor ?? "#000000",
    headerFontFamily: typeScale.headerFontFamily ?? "",
    headerFontWeight: typeScale.headerFontWeight ?? "700",
    headerLetterSpacing: typeScale.headerLetterSpacing ?? 0,
    headerColor: typeScale.headerColor ?? "#000000",
    responsiveSizes: typeScale.responsiveSizes as TypeScale["responsiveSizes"],
    typeStyles: typeScale.typeStyles as TypeScale["typeStyles"],
    exports: typeScale.exports as TypeScale["exports"],
    createdAt: typeScale.createdAt?.toISOString(),
    updatedAt: typeScale.updatedAt?.toISOString(),
    individualHeaderStyles: typeof typeScale.individual_header_styles === 'string'
      ? JSON.parse(typeScale.individual_header_styles)
      : typeScale.individual_header_styles || {},
    individualBodyStyles: typeof typeScale.individual_body_styles === 'string'
      ? JSON.parse(typeScale.individual_body_styles)
      : typeScale.individual_body_styles || {},
  };
};
