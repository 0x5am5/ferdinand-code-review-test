import { logSlackActivity } from "../../utils/slack-helpers";

export async function handleHelpCommand({ command, ack, respond }: any) {
  await ack();

  const helpBlocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🎨 Ferdinand Brand Asset Bot*\nAccess your brand assets directly in Slack!",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📋 Available Commands:*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🏷️ \`/ferdinand-logo [variant]\`
Get logo files. Optional variants: \`dark\`, \`light\`, \`square\`, \`horizontal\`, \`vertical\`, \`main\`
Example: \`/ferdinand-logo dark\`

🎨 \`/ferdinand-colors [variant]\`
View your brand color palette with visual swatches
Optional variants: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors
Example: \`/ferdinand-colors brand\`

📝 \`/ferdinand-fonts [variant]\`
Get typography specifications and font information
Optional variants: \`body\`, \`header\` or leave empty for all fonts
Example: \`/ferdinand-fonts body\`

🔍 \`/ferdinand-search <query>\`
Search across all your brand assets
Example: \`/ferdinand-search blue logo\`

❓ \`/ferdinand-help\`
Show this help message`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*💡 Tips:*\n• **Logo variants:** Use 'dark', 'square', 'horizontal', etc. for specific logo types\n• **Color variants:** Use 'brand', 'neutral', 'interactive' to filter color palettes\n• **Font variants:** Use 'body' for text fonts or 'header' for display fonts\n• **Search:** Try searching by color names, asset types, or specific terms\n• **Files:** Logo files are automatically uploaded to your channel for easy access",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "⚡ Powered by Ferdinand Brand Management System",
        },
      ],
    },
  ];

  await respond({
    blocks: helpBlocks,
    response_type: "ephemeral",
  });

  logSlackActivity({
    userId: command.user_id,
    workspaceId: command.team_id,
    command: "/ferdinand-help",
    assetIds: [],
    clientId: 0,
    success: true,
    timestamp: new Date(),
  });
}
