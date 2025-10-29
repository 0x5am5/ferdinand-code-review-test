/**
 * Service to manage default asset categories for clients
 */
import { assetCategories, insertAssetCategorySchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
// Default category definitions
const DEFAULT_CATEGORIES = [
    {
        name: "Documents",
        slug: "documents",
        isDefault: true,
    },
    {
        name: "Spreadsheets",
        slug: "spreadsheets",
        isDefault: true,
    },
    {
        name: "Slide Decks",
        slug: "slide-decks",
        isDefault: true,
    },
    {
        name: "Design Assets",
        slug: "design-assets",
        isDefault: true,
    },
    {
        name: "Photography",
        slug: "photography",
        isDefault: true,
    },
];
/**
 * Ensures that all default categories exist in the system
 * Creates them if they don't exist
 */
export async function ensureDefaultCategories() {
    try {
        console.log("Checking for default categories...");
        for (const categoryDef of DEFAULT_CATEGORIES) {
            // Check if category already exists
            const [existing] = await db
                .select()
                .from(assetCategories)
                .where(eq(assetCategories.slug, categoryDef.slug));
            if (!existing) {
                console.log(`Creating default category: ${categoryDef.name}`);
                const categoryData = insertAssetCategorySchema.parse({
                    name: categoryDef.name,
                    slug: categoryDef.slug,
                    isDefault: categoryDef.isDefault,
                    clientId: null, // System-wide categories have no clientId
                });
                await db.insert(assetCategories).values(categoryData);
                console.log(`Created default category: ${categoryDef.name} (ID: ${categoryDef.slug})`);
            }
        }
        console.log("Default categories check completed");
    }
    catch (error) {
        console.error("Error ensuring default categories:", error);
        throw error;
    }
}
/**
 * Gets all default categories (system-wide)
 */
export async function getDefaultCategories() {
    return await db
        .select()
        .from(assetCategories)
        .where(eq(assetCategories.isDefault, true));
}
/**
 * Gets all available categories for a client (default + client-specific)
 */
export async function getCategoriesForClient(clientId) {
    const { or, isNull, eq } = await import("drizzle-orm");
    return await db
        .select()
        .from(assetCategories)
        .where(or(isNull(assetCategories.clientId), eq(assetCategories.clientId, clientId)));
}
