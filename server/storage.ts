import { 
  type User, type Client, type BrandAsset,
  type InsertUser, type InsertClient, type InsertBrandAsset,
  users, clients, brandAssets, LogoType
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getClient(id: number): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  getClientAssets(clientId: number): Promise<BrandAsset[]>;
  getAsset(id: number): Promise<BrandAsset | undefined>;
  createAsset(asset: InsertBrandAsset): Promise<BrandAsset>;
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

  async getClientAssets(clientId: number): Promise<BrandAsset[]> {
    const assets = await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.clientId, clientId));

    return assets.map(asset => {
      if (asset.category === 'logo') {
        try {
          const parsedData = typeof asset.data === 'string' 
            ? JSON.parse(asset.data) 
            : asset.data;

          // Validate logo data
          if (!parsedData || typeof parsedData !== 'object') {
            console.error('Invalid logo data structure:', { id: asset.id, data: parsedData });
            return null;
          }

          // Ensure all required fields exist
          if (!parsedData.type || !parsedData.format || !parsedData.fileName) {
            console.error('Missing required logo fields:', { id: asset.id, data: parsedData });
            return null;
          }

          // Validate logo type
          if (!Object.values(LogoType).includes(parsedData.type)) {
            console.error('Invalid logo type:', { id: asset.id, type: parsedData.type });
            return null;
          }

          // Return asset with parsed data
          return {
            ...asset,
            data: parsedData
          };
        } catch (error) {
          console.error('Error processing logo asset:', { id: asset.id, error });
          return null;
        }
      }
      return asset;
    }).filter(Boolean) as BrandAsset[];
  }

  async getAsset(id: number): Promise<BrandAsset | undefined> {
    const [asset] = await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.id, id));

    if (!asset) return undefined;

    if (asset.category === 'logo') {
      try {
        const parsedData = typeof asset.data === 'string' 
          ? JSON.parse(asset.data) 
          : asset.data;

        if (!parsedData || !parsedData.type || !parsedData.format) {
          console.error('Invalid logo data structure:', { id: asset.id, data: parsedData });
          return undefined;
        }

        return {
          ...asset,
          data: parsedData
        };
      } catch (error) {
        console.error('Error processing logo asset:', { id: asset.id, error });
        return undefined;
      }
    }

    return asset;
  }

  async createAsset(insertAsset: InsertBrandAsset): Promise<BrandAsset> {
    if (insertAsset.category === 'logo') {
      // Parse and validate logo data
      const logoData = typeof insertAsset.data === 'string' 
        ? JSON.parse(insertAsset.data)
        : insertAsset.data;

      // Validate required fields
      if (!logoData || !logoData.type || !logoData.format || !logoData.fileName) {
        throw new Error('Invalid logo data structure: missing required fields');
      }

      // Validate logo type
      if (!Object.values(LogoType).includes(logoData.type)) {
        throw new Error(`Invalid logo type: ${logoData.type}`);
      }

      // Create a new asset with stringified data
      const assetToInsert = {
        ...insertAsset,
        data: JSON.stringify(logoData)
      };

      const [asset] = await db
        .insert(brandAssets)
        .values(assetToInsert)
        .returning();

      // Return asset with parsed data
      return {
        ...asset,
        data: logoData
      };
    }

    // For non-logo assets
    const [asset] = await db
      .insert(brandAssets)
      .values(insertAsset)
      .returning();

    return asset;
  }
}

export const storage = new DatabaseStorage();