import { 
  type User, type Client, type BrandAsset, type UserPersona,
  type InsertUser, type InsertClient, type InsertBrandAsset, type InsertUserPersona,
  type InspirationSection, type InspirationImage, type Invitation,
  type InsertInspirationSection, type InsertInspirationImage, type InsertInvitation,
  type InsertFontAsset, type InsertColorAsset, type UserClient,
  users, clients, brandAssets, userPersonas, inspirationSections, inspirationImages, invitations, userClients,
  UserRole
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, inArray } from "drizzle-orm";
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
    await db.delete(clients).where(eq(clients.id, id));
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

  async createAsset(insertAsset: InsertBrandAsset | InsertFontAsset | InsertColorAsset): Promise<BrandAsset> {
    const [asset] = await db
      .insert(brandAssets)
      .values(insertAsset)
      .returning();
    return asset;
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
}

export const storage = new DatabaseStorage();