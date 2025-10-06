import { brandAssets, slackWorkspaces } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { checkRateLimit, logSlackActivity } from "../../utils/slack-helpers";

export async function handleSearchCommand({ command, ack, respond }: any) {
  await ack();

  // Rate limiting
  const rateLimit = checkRateLimit(command.team_id, 15, 60000);
  if (!rateLimit.allowed) {
    await respond({
      text: `⏱️ Rate limit exceeded. You can make ${rateLimit.remaining} more requests after ${new Date(rateLimit.resetTime).toLocaleTimeString()}.`,
      response_type: "ephemeral",
    });
    return;
  }

  const query = command.text.trim();
  if (!query) {
    await respond({
      text: "🔍 Please provide a search term. Example: `/ferdinand-search blue logo`",
      response_type: "ephemeral",
    });
    return;
  }

  try {
    // Find the workspace
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.slackTeamId, command.team_id),
          eq(slackWorkspaces.isActive, true)
        )
      );

    if (!workspace) {
      await respond({
        text: "❌ This Slack workspace is not connected to Ferdinand. Please contact your admin to set up the integration.",
        response_type: "ephemeral",
      });
      return;
    }

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
    const groupedResults = searchResults.reduce(
      (acc, asset) => {
        if (!acc[asset.category]) {
          acc[asset.category] = [];
        }
        acc[asset.category].push(asset);
        return acc;
      },
      {} as Record<string, typeof searchResults>
    );

    const blocks: any[] = [
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
      const categoryIcon =
        {
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
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            const type = data?.type ? ` - ${data.type}` : "";
            return `• ${asset.name}${type}`;
          } catch {
            return `• ${asset.name}`;
          }
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            assetList +
            (assets.length > 5 ? `\n... and ${assets.length - 5} more` : ""),
        },
      });
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `💡 Use specific commands to get files: \`/ferdinand-logo\`, \`/ferdinand-colors\`, \`/ferdinand-fonts\``,
        },
      ],
    });

    await respond({
      blocks: blocks,
      response_type: "ephemeral",
    });

    logSlackActivity({
      userId: command.user_id,
      workspaceId: command.team_id,
      command: `/ferdinand-search ${query}`,
      assetIds: searchResults.map((asset) => asset.id),
      clientId: workspace.clientId,
      success: true,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error handling /ferdinand-search command:", error);
    await respond({
      text: "❌ Sorry, there was an error searching your assets. Please try again later.",
      response_type: "ephemeral",
    });
  }
}
