export async function handleHelpSubcommand({ respond, auditLog, }) {
    const helpBlocks = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*🎨 Ferdinand Brand Asset Bot*\nYour AI-powered brand assistant in Slack!",
            },
        },
        {
            type: "divider",
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*🗣️ Natural Language Commands:*",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `Just ask Ferdinand naturally! Examples:

💬 \`"I need our dark logo for a presentation"\`
💬 \`"Show me our brand colors"\`
💬 \`"What fonts do we use for headers?"\`
💬 \`"Find me the square version of our logo"\`
💬 \`"I need our color palette with hex codes"\`
💬 \`"Get me our main logo in high quality"\`
💬 \`"What typography should I use for body text?"\``,
            },
        },
        {
            type: "divider",
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*📋 Traditional Commands (Still Work):*",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `🏷️ \`/ferdinand logo [variant]\` - Get logo files
🎨 \`/ferdinand color [variant]\` - View color palettes  
📝 \`/ferdinand font [variant]\` - Get typography info
🔍 \`/ferdinand search <query>\` - Search all assets
❓ \`/ferdinand help\` - Show this help`,
            },
        },
        {
            type: "divider",
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: '*💡 Pro Tips:*\n• **Be specific:** "dark logo" works better than just "logo"\n• **Ask naturally:** Ferdinand understands conversational requests\n• **Multiple formats:** Get assets in different sizes and formats\n• **File delivery:** Assets are uploaded directly to your channel\n• **Smart search:** Ferdinand knows your brand\'s available assets',
            },
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "🤖 Powered by Ferdinand Brand Management System + AI",
                },
            ],
        },
    ];
    await respond({
        blocks: helpBlocks,
        response_type: "ephemeral",
    });
    auditLog.clientId = 0; // Help doesn't need client ID
}
