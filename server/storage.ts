import { 
  type User, type Client, type BrandAsset,
  type InsertUser, type InsertClient, type InsertBrandAsset,
  users, clients, brandAssets
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

    return assets.map(asset => ({
      ...asset,
      // Parse JSON data if it's a string
      data: typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data
    }));
  }

  async getAsset(id: number): Promise<BrandAsset | undefined> {
    const [asset] = await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.id, id));

    if (!asset) return undefined;

    return {
      ...asset,
      // Parse JSON data if it's a string
      data: typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data
    };
  }

  async createAsset(insertAsset: InsertBrandAsset): Promise<BrandAsset> {
    // Ensure data is stored as a JSON string
    const assetToInsert = {
      ...insertAsset,
      data: typeof insertAsset.data === 'string' 
        ? insertAsset.data 
        : JSON.stringify(insertAsset.data)
    };

    const [asset] = await db
      .insert(brandAssets)
      .values(assetToInsert)
      .returning();

    return {
      ...asset,
      // Parse JSON data for the returned asset
      data: typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data
    };
  }
}

export const storage = new DatabaseStorage();