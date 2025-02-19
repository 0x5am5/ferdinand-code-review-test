import { 
  type User, type Client, type BrandAsset,
  type InsertUser, type InsertClient, type InsertBrandAsset 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getClient(id: number): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  getBrandAssets(clientId: number): Promise<BrandAsset[]>;
  createBrandAsset(asset: InsertBrandAsset): Promise<BrandAsset>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clients: Map<number, Client>;
  private brandAssets: Map<number, BrandAsset>;
  private currentUserId: number;
  private currentClientId: number;
  private currentAssetId: number;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.brandAssets = new Map();
    this.currentUserId = 1;
    this.currentClientId = 1;
    this.currentAssetId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.currentClientId++;
    const client: Client = { 
      ...insertClient, 
      id, 
      createdAt: new Date().toISOString()
    };
    this.clients.set(id, client);
    return client;
  }

  async getBrandAssets(clientId: number): Promise<BrandAsset[]> {
    return Array.from(this.brandAssets.values()).filter(
      (asset) => asset.clientId === clientId
    );
  }

  async createBrandAsset(insertAsset: InsertBrandAsset): Promise<BrandAsset> {
    const id = this.currentAssetId++;
    const asset: BrandAsset = { ...insertAsset, id };
    this.brandAssets.set(id, asset);
    return asset;
  }
}

export const storage = new MemStorage();
