// Build confirmation blocks for large font result sets
export function buildFontConfirmationBlocks(matchedFonts, variant, workspaceClientId) {
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `📝 Found *${matchedFonts.length} fonts*${variant ? ` for "${variant}"` : ""}.`,
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `📋 This is a large number of fonts to process. Would you like to:\n\n• *Process all ${matchedFonts.length} fonts* (files and usage code)\n• *Narrow your search* with more specific terms like "brand", "body", or "header"\n• *Process just the first 3* for a quick overview`,
            },
        },
        {
            type: "actions",
            elements: [
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: `Process All ${matchedFonts.length}`,
                    },
                    style: "primary",
                    action_id: "process_all_fonts",
                    value: `${workspaceClientId}|${variant || ""}|all`,
                },
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Process First 3",
                    },
                    action_id: "process_limited_fonts",
                    value: `${workspaceClientId}|${variant || ""}|3`,
                },
            ],
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "💡 *Tip:* Try `/ferdinand-fonts brand` or `/ferdinand-fonts body` for more targeted results.",
                },
            ],
        },
    ];
}
// Build processing message for font processing
export function buildFontProcessingMessage(matchedFonts, variant) {
    const fontNames = matchedFonts.map((asset) => asset.name).join(", ");
    return variant
        ? `📝 Found *${matchedFonts.length} fonts* for "${variant}": ${fontNames}\n\n🔄 Processing font files and usage code...`
        : `📝 Found *${matchedFonts.length} fonts*: ${fontNames}\n\n🔄 Processing font files and usage code...`;
}
// Build summary message after font processing
export function buildFontSummaryMessage(uploadedFiles, sentCodeBlocks, variant, responseTime, totalFonts, limit) {
    let summaryText = `✅ *Font processing complete!*\n`;
    if (uploadedFiles > 0) {
        summaryText += `📁 ${uploadedFiles} font file${uploadedFiles > 1 ? "s" : ""} uploaded\n`;
    }
    if (sentCodeBlocks > 0) {
        summaryText += `💻 ${sentCodeBlocks} usage code${sentCodeBlocks > 1 ? "s" : ""} provided\n`;
    }
    if (variant) {
        summaryText += `🔍 Filtered by: "${variant}"\n`;
    }
    if (limit !== "all" && totalFonts && totalFonts > limit) {
        summaryText += `💡 Showing ${limit} of ${totalFonts} results.\n`;
    }
    if (responseTime) {
        summaryText += `⏱️ Response time: ${responseTime}ms`;
    }
    else {
        summaryText += `⏱️ Total fonts processed: ${uploadedFiles + sentCodeBlocks}`;
    }
    return summaryText;
}
// Check if we should show confirmation for large result sets
export function shouldShowFontConfirmation(fontCount) {
    return fontCount > 3;
}
