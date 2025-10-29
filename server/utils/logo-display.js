// Build confirmation blocks for large logo result sets
export function buildLogoConfirmationBlocks(matchedLogos, query, workspaceClientId) {
    // Check if any logos have dark variants
    const darkVariantCount = matchedLogos.filter((logo) => {
        try {
            const data = typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
            return data?.hasDarkVariant === true;
        }
        catch {
            return false;
        }
    }).length;
    const variantInfo = darkVariantCount > 0 ? ` (${darkVariantCount} with dark variants)` : "";
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `🏷️ Found *${matchedLogos.length} logo files*${query ? ` matching "${query}"` : ""}${variantInfo}.`,
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `📁 This will upload many files to your channel. Would you like to:\n\n• *Upload all ${matchedLogos.length} logos* (may flood the channel)\n• *Narrow your search* with terms like "dark", "square", "horizontal"\n• *Upload just the first 3* for a quick preview`,
            },
        },
        {
            type: "actions",
            elements: [
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: `Upload All ${matchedLogos.length}`,
                    },
                    style: "primary",
                    action_id: "upload_all_logos",
                    value: `${workspaceClientId}|${query || ""}|all`,
                },
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Upload First 3",
                    },
                    action_id: "upload_limited_logos",
                    value: `${workspaceClientId}|${query || ""}|3`,
                },
            ],
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "💡 *Tip:* Try `/ferdinand-logo dark`, `/ferdinand-logo square`, or `/ferdinand-logo horizontal` for specific variants.",
                },
            ],
        },
    ];
}
// Build processing message for logo uploads
export function buildLogoProcessingMessage(matchedLogos, query) {
    // Check for dark variants in the matched logos
    const darkVariantCount = matchedLogos.filter((logo) => {
        try {
            const data = typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
            return data?.hasDarkVariant === true;
        }
        catch {
            return false;
        }
    }).length;
    // Calculate total files to upload
    const isDarkQuery = query === "dark" || query === "white" || query === "inverse";
    const totalFiles = isDarkQuery
        ? matchedLogos.length
        : matchedLogos.length + darkVariantCount; // Light + dark variants
    const variantNote = isDarkQuery && darkVariantCount > 0
        ? " (dark variants)"
        : darkVariantCount > 0
            ? ` (${darkVariantCount} with dark variants)`
            : "";
    return `🔄 Preparing ${totalFiles} file${totalFiles > 1 ? "s" : ""} from ${matchedLogos.length} logo${matchedLogos.length > 1 ? "s" : ""}${query ? ` for "${query}"` : ""}${variantNote}... Files will appear shortly!`;
}
// Build summary message after logo uploads
export function buildLogoSummaryMessage(successfulUploads, totalLogos, query, responseTime) {
    let summaryText = `✅ *${successfulUploads} logo${successfulUploads > 1 ? "s" : ""} uploaded successfully!*`;
    if (successfulUploads < totalLogos) {
        summaryText += `\n💡 Some files were sent via DM due to channel permissions.`;
    }
    if (query) {
        summaryText += `\n🔍 Search: "${query}" (${totalLogos} match${totalLogos > 1 ? "es" : ""})`;
    }
    if (successfulUploads < totalLogos) {
        summaryText += `\n💡 Some uploads may have failed. Try narrowing your search for better results.`;
    }
    if (responseTime) {
        summaryText += `\n⏱️ Response time: ${responseTime}ms`;
    }
    return summaryText;
}
// Check if we should show confirmation for large result sets
export function shouldShowLogoConfirmation(logoCount) {
    return logoCount > 3;
}
