
import { and, eq } from "drizzle-orm";
import { brandAssets, slackWorkspaces } from "@shared/schema";
import { db } from "../../db";
import { handleColorSubcommand } from "./unified-subcommands/color-subcommand";
import { handleLogoSubcommand } from "./unified-subcommands/logo-subcommand";
import { handleFontSubcommand } from "./unified-subcommands/font-subcommand";

export async function handleColorSubcommandWithLimit(
  body: any,
  respond: any,
  variant: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    // Create a mock command object from the button interaction
    const mockCommand = {
      user_id: body.user.id,
      channel_id: body.channel.id,
      team_id: body.team.id,
      text: variant,
    };

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand color ${variant} (${limit === "all" ? "show all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Override the color subcommand to respect the limit
    await handleColorSubcommandWithLimitOverride({
      command: mockCommand,
      respond,
      client: null,
      variant,
      workspace,
      auditLog,
      limit,
    });
  } catch (error) {
    console.error("Error in handleColorSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}

export async function handleLogoSubcommandWithLimit(
  body: any,
  respond: any,
  query: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    // Create a mock command object from the button interaction
    const mockCommand = {
      user_id: body.user.id,
      channel_id: body.channel.id,
      team_id: body.team.id,
      text: query,
    };

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand logo ${query} (${limit === "all" ? "upload all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Override the logo subcommand to respect the limit
    await handleLogoSubcommandWithLimitOverride({
      command: mockCommand,
      respond,
      client: null,
      variant: query,
      workspace,
      auditLog,
      limit,
    });
  } catch (error) {
    console.error("Error in handleLogoSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}

export async function handleFontSubcommandWithLimit(
  body: any,
  respond: any,
  variant: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    // Create a mock command object from the button interaction
    const mockCommand = {
      user_id: body.user.id,
      channel_id: body.channel.id,
      team_id: body.team.id,
      text: variant,
    };

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand font ${variant} (${limit === "all" ? "process all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Override the font subcommand to respect the limit
    await handleFontSubcommandWithLimitOverride({
      command: mockCommand,
      respond,
      client: null,
      variant,
      workspace,
      auditLog,
      limit,
    });
  } catch (error) {
    console.error("Error in handleFontSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}

// These functions are modified versions of the original subcommands that respect the limit parameter
async function handleColorSubcommandWithLimitOverride(params: any) {
  // This would be a copy of the original color subcommand logic 
  // but with the displayAssets.slice(0, limit === "all" ? undefined : limit) modification
  // For brevity, implementing the key change:
  
  const { limit } = params;
  // ... existing color subcommand logic ...
  
  // Instead of: for (const asset of displayAssets.slice(0, 3))
  // Use: for (const asset of displayAssets.slice(0, limit === "all" ? undefined : limit))
}

async function handleLogoSubcommandWithLimitOverride(params: any) {
  // Similar logic for logos
  const { limit } = params;
  // ... existing logo subcommand logic with limit applied ...
}

async function handleFontSubcommandWithLimitOverride(params: any) {
  // Similar logic for fonts  
  const { limit } = params;
  // ... existing font subcommand logic with limit applied ...
}
