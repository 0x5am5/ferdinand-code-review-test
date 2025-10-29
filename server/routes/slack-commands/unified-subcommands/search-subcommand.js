import { brandAssets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
export async function handleSearchSubcommand({ respond, variant, workspace, auditLog, }) {
    const query = variant; // variant contains the search query for search subcommand
    // Search across all brand assets
    const allAssets = await db
        .select()
        .from(brandAssets)
        .where(eq(brandAssets.clientId, workspace.clientId));
    if (allAssets.length === 0) {
        await respond({
            text: "📂 No assets found for your organization.",
            response_type: "ephemeral",
        });
        return;
    }
    // Simple text search across name and category
    const searchResults = allAssets.filter((asset) => {
        const searchText = `${asset.name} ${asset.category}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
    });
    if (searchResults.length === 0) {
        await respond({
            text: `🔍 No assets found matching "${query}". Try searching for: logo, color, font, or specific asset names.`,
            response_type: "ephemeral",
        });
        return;
    }
    // Group results by category
    const groupedResults = searchResults.reduce((acc, asset) => {
        if (!acc[asset.category]) {
            acc[asset.category] = [];
        }
        acc[asset.category].push(asset);
        return acc;
    }, {});
    const blocks = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `🔍 **Search Results for "${query}"** (${searchResults.length} matches)`,
            },
        },
    ];
    // Add results by category
    Object.entries(groupedResults).forEach(([category, assets]) => {
        const categoryIcon = {
            logo: "🏷️",
            color: "🎨",
            font: "📝",
            typography: "📝",
        }[category] || "📁";
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${categoryIcon} **${category.toUpperCase()}** (${assets.length})`,
            },
        });
        const assetList = assets
            .slice(0, 5)
            .map((asset) => {
            try {
                const data = typeof asset.data === "string"
                    ? JSON.parse(asset.data)
                    : asset.data;
                const type = data?.type ? ` - ${data.type}` : "";
                return `• ${asset.name}${type}`;
            }
            catch {
                return `• ${asset.name}`;
            }
        })
            .join("\n");
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: assetList +
                    (assets.length > 5 ? `\n... and ${assets.length - 5} more` : ""),
            },
        });
    });
    blocks.push({
        type: "context",
        elements: [
            {
                type: "mrkdwn",
                text: `💡 Use specific commands to get files: \`/ferdinand logo\`, \`/ferdinand color\`, \`/ferdinand font\``,
            },
        ],
    });
    await respond({
        blocks: blocks,
        response_type: "ephemeral",
    });
    auditLog.assetIds = searchResults.map((asset) => asset.id);
}
