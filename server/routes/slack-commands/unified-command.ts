import { brandAssets, slackWorkspaces } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { nlpProcessor } from "../../utils/nlp-processor";
import { checkRateLimit, logSlackActivity } from "../../utils/slack-helpers";
import { handleColorSubcommand } from "./unified-subcommands/color-subcommand";
import { handleFontSubcommand } from "./unified-subcommands/font-subcommand";
import { handleHelpSubcommand } from "./unified-subcommands/help-subcommand";
import { handleLogoSubcommand } from "./unified-subcommands/logo-subcommand";
import { handleSearchSubcommand } from "./unified-subcommands/search-subcommand";

export async function handleUnifiedCommand({
  command,
  ack,
  respond,
  client,
}: any) {
  await ack();

  // Send immediate acknowledgment to prevent timeout
  await respond({
    text: "🔄 Processing your request...",
    response_type: "ephemeral",
  });

  // Rate limiting
  const rateLimit = checkRateLimit(command.team_id, 15, 60000);
  if (!rateLimit.allowed) {
    await respond({
      text: `⏱️ Rate limit exceeded. You can make ${rateLimit.remaining} more requests after ${new Date(rateLimit.resetTime).toLocaleTimeString()}.`,
      response_type: "ephemeral",
    });
    return;
  }

  const input = command.text.trim();
  if (!input) {
    // Show help if no arguments provided
    await respond({
      text:
        "🎨 **Ferdinand - Your AI Brand Assistant**\n\n" +
        "Ask me for brand assets in natural language! Examples:\n\n" +
        '• `"I need our dark logo for a presentation"`\n' +
        '• `"Show me our brand colors with hex codes"`\n' +
        '• `"What fonts should I use for headers?"`\n' +
        '• `"Get me the square version of our logo"`\n' +
        '• `"Find me typography for body text"`\n' +
        '• `"I need our main logo in high quality"`\n\n' +
        "**Traditional commands still work:**\n" +
        "• `/ferdinand logo [variant]` - Get logo files\n" +
        "• `/ferdinand color [variant]` - Get brand colors\n" +
        "• `/ferdinand font [variant]` - Get typography info\n" +
        "• `/ferdinand search <query>` - Search all assets\n" +
        "• `/ferdinand help` - Show detailed help\n\n" +
        "💡 **Tip:** Just describe what you need - Ferdinand understands natural language!",
      response_type: "ephemeral",
    });
    return;
  }

  // First try traditional parsing for backwards compatibility
  const parts = input.split(/\s+/);
  const firstWord = parts[0].toLowerCase();
  let subcommand = "";
  let variant = "";
  let isTraditionalCommand = false;

  // Check if it's a traditional command format
  if (
    [
      "color",
      "colors",
      "font",
      "fonts",
      "logo",
      "logos",
      "search",
      "help",
    ].includes(firstWord)
  ) {
    subcommand = firstWord;
    variant = parts.slice(1).join(" ").trim();
    isTraditionalCommand = true;
  }

  const auditLog = {
    userId: command.user_id,
    workspaceId: command.team_id,
    command: `/ferdinand ${input}`,
    assetIds: [] as number[],
    clientId: 0,
    success: false,
    timestamp: new Date(),
  };

  try {
    // Find the workspace (common for all subcommands except help)
    let workspace = null;
    if (!isTraditionalCommand || subcommand !== "help") {
      [workspace] = await db
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
        logSlackActivity({ ...auditLog, error: "Workspace not found" });
        return;
      }

      auditLog.clientId = workspace.clientId;
    }

    // If not a traditional command, use natural language processing
    if (!isTraditionalCommand) {
      // Gather asset context for the NLP processor
      const [logoAssets, colorAssets, fontAssets] = await Promise.all([
        db
          .select()
          .from(brandAssets)
          .where(
            and(
              eq(brandAssets.clientId, workspace?.clientId),
              eq(brandAssets.category, "logo")
            )
          ),
        db
          .select()
          .from(brandAssets)
          .where(
            and(
              eq(brandAssets.clientId, workspace?.clientId),
              eq(brandAssets.category, "color")
            )
          ),
        db
          .select()
          .from(brandAssets)
          .where(
            and(
              eq(brandAssets.clientId, workspace?.clientId),
              eq(brandAssets.category, "font")
            )
          ),
      ]);

      // Process natural language input
      const processedCommand = await nlpProcessor.processCommand(
        input,
        {
          logos: logoAssets,
          colors: colorAssets,
          fonts: fontAssets,
        },
        command.team_id
      );

      // Map processed command to traditional format
      subcommand = processedCommand.intent;
      variant = processedCommand.variant || "";

      // Log the NLP processing for debugging
      console.log(
        `[NLP] Input: "${input}" -> Intent: ${processedCommand.intent}, Variant: ${processedCommand.variant}, Confidence: ${processedCommand.confidence}`
      );

      // If confidence is very low, suggest better phrasing
      if (processedCommand.confidence < 0.4) {
        await respond({
          text:
            `🤔 I'm not quite sure what you're looking for. Try being more specific:\n\n` +
            `• "show me our dark logo" or "I need the square logo"\n` +
            `• "what are our brand colors?" or "show me our color palette"\n` +
            `• "what fonts do we use?" or "typography for headers"\n` +
            `• "help" for more examples\n\n` +
            `Your request: "${input}"`,
          response_type: "ephemeral",
        });
        logSlackActivity({
          ...auditLog,
          error: `Low confidence NLP result: ${processedCommand.confidence}`,
        });
        return;
      }

      // Add confidence info to response for medium confidence
      if (processedCommand.confidence < 0.7) {
        await respond({
          text: `🔍 I think you're asking for **${subcommand}** assets${variant ? ` (${variant})` : ""}. Processing your request...`,
          response_type: "ephemeral",
        });
      }
    }

    // Route to appropriate handler based on subcommand
    switch (subcommand) {
      case "color":
      case "colors":
        await handleColorSubcommand({
          command,
          respond,
          client,
          variant,
          workspace,
          auditLog,
        });
        break;

      case "font":
      case "fonts":
        await handleFontSubcommand({
          command,
          respond,
          client,
          variant,
          workspace,
          auditLog,
        });
        break;

      case "logo":
      case "logos":
        await handleLogoSubcommand({
          command,
          respond,
          client,
          variant,
          workspace,
          auditLog,
        });
        break;

      case "search":
        if (!variant) {
          await respond({
            text: "🔍 Please provide a search term. Example: `/ferdinand search blue logo`",
            response_type: "ephemeral",
          });
          return;
        }
        await handleSearchSubcommand({
          command,
          respond,
          variant,
          workspace,
          auditLog,
        });
        break;

      case "help":
        await handleHelpSubcommand({ command, respond, auditLog });
        break;

      default:
        await respond({
          text:
            `❌ Unknown command: "${subcommand}"\n\n` +
            "Available commands: `color`, `font`, `logo`, `search`, `help`\n" +
            "Type `/ferdinand` with no arguments to see usage examples.",
          response_type: "ephemeral",
        });
        logSlackActivity({
          ...auditLog,
          error: `Unknown subcommand: ${subcommand}`,
        });
        return;
    }

    auditLog.success = true;
    logSlackActivity(auditLog);
  } catch (error) {
    console.error("Error handling /ferdinand command:", error);
    await respond({
      text: "❌ Sorry, there was an error processing your request. Please try again later.",
      response_type: "ephemeral",
    });

    logSlackActivity({
      ...auditLog,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
