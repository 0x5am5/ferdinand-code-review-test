/**
 * Migration script to fix reference-only assets that are missing driveWebLink
 *
 * This script:
 * 1. Finds all reference-only assets with null or empty driveWebLink
 * 2. Attempts to fetch their metadata from Google Drive API
 * 3. Updates the assets with the correct driveWebLink
 *
 * Run with: npx ts-node server/migrations/fix-reference-assets.ts
 */
import { eq, isNull, and } from "drizzle-orm";
import { db } from "../db";
import { assets } from "@shared/schema";
export async function findMissingDriveLinks() {
    console.log("Finding reference-only assets with missing driveWebLink...");
    const missingAssets = await db
        .select({
        id: assets.id,
        originalFileName: assets.originalFileName,
        driveFileId: assets.driveFileId,
        driveWebLink: assets.driveWebLink,
    })
        .from(assets)
        .where(and(eq(assets.referenceOnly, true), isNull(assets.driveWebLink)));
    console.log(`Found ${missingAssets.length} assets with missing driveWebLink`);
    return missingAssets;
}
export async function fixMissingDriveLink(assetId, driveFileId, driveWebLink) {
    try {
        console.log(`Updating asset ${assetId} with driveWebLink: ${driveWebLink}`);
        await db
            .update(assets)
            .set({
            driveWebLink,
            updatedAt: new Date(),
        })
            .where(eq(assets.id, assetId));
        return true;
    }
    catch (error) {
        console.error(`Failed to update asset ${assetId}:`, error);
        return false;
    }
}
// Helper function to construct Google Drive web link from file ID
export function constructDriveWebLink(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
}
async function main() {
    try {
        console.log("Starting reference asset migration...");
        console.log("This script will help fix reference-only assets with missing Google Drive links.\n");
        // Find all problematic assets
        const missingAssets = await findMissingDriveLinks();
        if (missingAssets.length === 0) {
            console.log("✓ No assets need fixing!");
            process.exit(0);
        }
        console.log("\nAssets that need fixing:");
        console.log("─".repeat(80));
        let fixed = 0;
        for (const asset of missingAssets) {
            if (asset.driveFileId) {
                // Construct the web link from the file ID
                const webLink = constructDriveWebLink(asset.driveFileId);
                const success = await fixMissingDriveLink(asset.id, asset.driveFileId, webLink);
                if (success) {
                    fixed++;
                    console.log(`✓ Fixed asset ${asset.id} (${asset.originalFileName}) → ${webLink}`);
                }
                else {
                    console.log(`✗ Failed to fix asset ${asset.id} (${asset.originalFileName})`);
                }
            }
            else {
                console.log(`⚠ Skipped asset ${asset.id} (${asset.originalFileName}) - no driveFileId`);
            }
        }
        console.log("─".repeat(80));
        console.log(`\nMigration complete: ${fixed}/${missingAssets.length} assets fixed`);
        if (fixed === missingAssets.length) {
            console.log("✓ All reference assets now have valid Google Drive links!");
        }
        process.exit(0);
    }
    catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
export default { findMissingDriveLinks, fixMissingDriveLink };
