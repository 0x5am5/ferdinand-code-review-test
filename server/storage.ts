import { 
  type User, type Client, type BrandAsset, type UserPersona,
  type InsertUser, type InsertClient, type InsertBrandAsset, type InsertUserPersona,
  users, clients, brandAssets, userPersonas
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
  updateAsset(id: number, asset: InsertBrandAsset): Promise<BrandAsset>;
  deleteAsset(id: number): Promise<void>;
  // Add persona operations
  getClientPersonas(clientId: number): Promise<UserPersona[]>;
  getPersona(id: number): Promise<UserPersona | undefined>;
  createPersona(persona: InsertUserPersona): Promise<UserPersona>;
  updatePersona(id: number, persona: InsertUserPersona): Promise<UserPersona>;
  deletePersona(id: number): Promise<void>;
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
    return await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.clientId, clientId));
  }

  async getAsset(id: number): Promise<BrandAsset | undefined> {
    const [asset] = await db.select().from(brandAssets).where(eq(brandAssets.id, id));
    return asset;
  }

  async createAsset(insertAsset: InsertBrandAsset): Promise<BrandAsset> {
    const [asset] = await db
      .insert(brandAssets)
      .values(insertAsset)
      .returning();
    return asset;
  }

  async updateAsset(id: number, updateAsset: InsertBrandAsset): Promise<BrandAsset> {
    const [asset] = await db
      .update(brandAssets)
      .set(updateAsset)
      .where(eq(brandAssets.id, id))
      .returning();
    return asset;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(brandAssets).where(eq(brandAssets.id, id));
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
}

export const storage = new DatabaseStorage();