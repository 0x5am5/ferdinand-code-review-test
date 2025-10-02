import type { BrandAsset } from "@shared/schema";
import { slackAuditLogs, insertSlackAuditLogSchema } from "@shared/schema";
import { WebClient } from "@slack/web-api";
import { db } from "../db";
import fetch from "node-fetch";
import { decrypt } from "../utils/crypto";

interface SlackFileUpload {
  token: string;
  channels: string;
  filename: string;
  title?: string;
  initial_comment?: string;
  file?: Buffer;
  filetype?: string;
}

// Fuzzy matching for logo variants
export function findBestLogoMatch(
  assets: BrandAsset[],
  query: string = ""
): BrandAsset[] {
  if (!query.trim()) {
    return assets;
  }

  const queryLower = query.toLowerCase();

  // Handle dark variant queries specially
  if (queryLower === "dark" || queryLower === "white" || queryLower === "inverse") {
    const darkVariantMatches = assets.filter((asset) => {
      try {
        const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        return data?.hasDarkVariant === true;
      } catch {
        return false;
      }
    });
    
    if (darkVariantMatches.length > 0) {
      return darkVariantMatches;
    }
  }

  // Direct type matches (highest priority)
  const typeMatches = assets.filter((asset) => {
    try {
      const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      const type = data?.type?.toLowerCase() || "main";
      return type === queryLower;
    } catch {
      return false;
    }
  });

  if (typeMatches.length > 0) {
    return typeMatches;
  }

  // Fuzzy name matches (medium priority)
  const nameMatches = assets.filter((asset) =>
    asset.name.toLowerCase().includes(queryLower)
  );

  if (nameMatches.length > 0) {
    return nameMatches;
  }

  // Variant synonyms (fallback)
  const synonyms: Record<string, string[]> = {
    dark: ["dark", "inverse", "white"],
    light: ["light", "primary", "main", "standard"],
    square: ["square", "icon", "mark"],
    horizontal: ["horizontal", "landscape", "wide"],
    vertical: ["vertical", "stacked", "portrait"],
    main: ["main", "primary", "default", "standard"],
  };

  for (const [type, words] of Object.entries(synonyms)) {
    if (words.some(word => queryLower.includes(word))) {
      const synonymMatches = assets.filter((asset) => {
        try {
          const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
          return data?.type?.toLowerCase() === type;
        } catch {
          return false;
        }
      });

      if (synonymMatches.length > 0) {
        return synonymMatches;
      }
    }
  }

  // Return all if no matches found
  return assets;
}

// Generate downloadable asset URL
export function generateAssetDownloadUrl(
  assetId: number,
  clientId: number,
  baseUrl: string,
  options: {
    format?: string;
    variant?: "dark" | "light";
    size?: number;
  } = {}
): string {
  const url = new URL(`/api/assets/${assetId}/file`, baseUrl);
  url.searchParams.append("clientId", clientId.toString());

  if (options.format) {
    url.searchParams.append("format", options.format);
  }
  if (options.variant) {
    url.searchParams.append("variant", options.variant);
  }
  if (options.size) {
    url.searchParams.append("size", options.size.toString());
  }

  return url.toString();
}

// Decrypt bot token from encrypted storage
export function decryptBotToken(encryptedToken: string): string {
  try {
    const encryptedData = JSON.parse(encryptedToken);
    return decrypt(encryptedData);
  } catch (error) {
    console.error("Failed to decrypt bot token:", error);
    throw new Error("Invalid bot token format");
  }
}

// Upload file to Slack using workspace-specific token
export async function uploadFileToSlack(
  botToken: string,
  options: {
    channelId: string;
    userId?: string;
    fileUrl: string;
    filename: string;
    title?: string;
    initialComment?: string;
    filetype?: string;
  }
): Promise<boolean> {
  try {
    console.log(`[SLACK UPLOAD] Attempting to upload ${options.filename} to channel ${options.channelId}`);

    // Create a new WebClient instance with the workspace-specific token
    const client = new WebClient(botToken);

    // First, let's check what channels/conversations the bot has access to
    try {
      const authTest = await client.auth.test();
      console.log(`[SLACK UPLOAD] Bot user ID: ${authTest.user_id}, Team: ${authTest.team}`);
    } catch (authError: any) {
      console.error(`[SLACK UPLOAD] Auth test failed:`, authError);
    }

    // Fetch the file from the URL
    console.log(`[SLACK UPLOAD] Fetching file from URL: ${options.fileUrl}`);
    const response = await fetch(options.fileUrl);
    if (!response.ok) {
      console.error(`[SLACK UPLOAD] Failed to fetch file from ${options.fileUrl}: ${response.statusText}`);
      return false;
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[SLACK UPLOAD] File fetched successfully, size: ${fileBuffer.length} bytes`);

    // First try to upload to the channel
    try {
      console.log(`[SLACK UPLOAD] Attempting channel upload with uploadV2...`);
      const result = await client.files.uploadV2({
        channel_id: options.channelId,
        file: fileBuffer,
        filename: options.filename,
        title: options.title,
        initial_comment: options.initialComment,
        filetype: options.filetype,
      });

      console.log(`[SLACK UPLOAD] Channel upload result:`, { ok: result.ok, error: result.error });
      return result.ok === true;
    } catch (channelError: any) {
      console.error(`[SLACK UPLOAD] Channel upload failed:`, {
        error: channelError.data?.error,
        message: channelError.message,
        channelId: options.channelId
      });

      // If channel upload fails due to channel access issues, try DM to user
      const isChannelAccessError = channelError.data?.error === 'not_in_channel' ||
                                   channelError.data?.error === 'channel_not_found' ||
                                   channelError.data?.error === 'access_denied' ||
                                   channelError.data?.error === 'missing_scope';

      if (isChannelAccessError && options.userId) {
        console.log(`[SLACK UPLOAD] Bot cannot access channel (${channelError.data?.error}), falling back to DM to user ${options.userId}`);

        try {
          // Open DM conversation with user first
          console.log(`[SLACK UPLOAD] Opening DM conversation with user ${options.userId}...`);
          const conversationResponse = await client.conversations.open({
            users: options.userId,
          });

          console.log(`[SLACK UPLOAD] DM conversation result:`, {
            ok: conversationResponse.ok,
            channelId: conversationResponse.channel?.id,
            error: conversationResponse.error
          });

          if (!conversationResponse.ok || !conversationResponse.channel?.id) {
            console.log(`[SLACK UPLOAD] Failed to open DM conversation:`, conversationResponse.error);
            return false;
          }

          const dmChannelId = conversationResponse.channel.id;

          // Try uploading to DM using the new uploadV2 method
          console.log(`[SLACK UPLOAD] Attempting DM upload to ${dmChannelId}...`);
          const dmResult = await client.files.uploadV2({
            channel_id: dmChannelId,
            file: fileBuffer,
            filename: options.filename,
            title: options.title,
            initial_comment: options.initialComment + "\n\n💡 _File sent via DM since the bot doesn't have access to post in the original channel. To get files directly in channels, please ensure the Ferdinand bot has proper channel permissions._",
            filetype: options.filetype,
          });

          console.log(`[SLACK UPLOAD] DM upload result:`, { ok: dmResult.ok, error: dmResult.error });
          if (dmResult.ok) {
            console.log(`[SLACK UPLOAD] Successfully uploaded file to DM for user ${options.userId}`);
            return true;
          }

          throw new Error(`DM upload failed: ${dmResult.error}`);
        } catch (dmError: any) {
          console.error(`[SLACK UPLOAD] DM upload failed:`, dmError.message || dmError);

          // Final fallback: try to send just a message with download link
          try {
            console.log(`[SLACK UPLOAD] Attempting download link fallback...`);
            const conversationResponse = await client.conversations.open({
              users: options.userId,
            });

            if (conversationResponse.ok && conversationResponse.channel?.id) {
              const messageResult = await client.chat.postMessage({
                channel: conversationResponse.channel.id,
                text: `📎 **${options.title || options.filename}**\n\n🔗 Download: ${options.fileUrl}\n\n⚠️ _The bot couldn't upload the file directly. This might be due to missing permissions. Please contact your admin to check the bot's permissions._`,
              });

              console.log(`[SLACK UPLOAD] Download link result:`, { ok: messageResult.ok, error: messageResult.error });
              if (messageResult.ok) {
                console.log(`[SLACK UPLOAD] Sent download link via DM to user ${options.userId}`);
                return true;
              }
            } else {
              console.log(`[SLACK UPLOAD] Failed to open DM conversation for download link:`, conversationResponse.error);
            }
          } catch (linkError: any) {
            console.error(`[SLACK UPLOAD] Download link message also failed:`, linkError.message || linkError);
          }

          return false;
        }
      }

      // Re-throw if it's not a channel access issue or no userId provided
      console.error(`[SLACK UPLOAD] Channel upload failed with non-access error or no userId provided: ${channelError.data?.error}`);
      throw channelError;
    }
  } catch (error: any) {
    console.error("[SLACK UPLOAD] Error uploading file to Slack:", error.message || error);
    return false;
  }
}

// Format asset information for Slack blocks
export function formatAssetInfo(asset: BrandAsset): {
  title: string;
  description: string;
  type: string;
  format: string;
} {
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    const type = data?.type || "main";
    const format = data?.format || "unknown";

    const typeDescriptions: Record<string, string> = {
      main: "Primary brand logo - use for most applications",
      horizontal: "Wide format logo - ideal for headers and banners",
      vertical: "Stacked logo - perfect for tight spaces",
      square: "Compact logo - great for avatars and icons",
      app_icon: "App store optimized - for mobile applications",
      favicon: "Web browser icon - smallest format",
    };

    return {
      title: asset.name,
      description: typeDescriptions[type] || "Brand logo asset",
      type,
      format: format.toUpperCase(),
    };
  } catch {
    return {
      title: asset.name,
      description: "Brand logo asset",
      type: "main",
      format: "UNKNOWN",
    };
  }
}

// Validate Slack signature for security
export function validateSlackRequest(
  signingSecret: string,
  requestSignature: string,
  timestamp: string,
  body: string
): boolean {
  const crypto = require("crypto");

  // Create the basestring
  const basestring = `v0:${timestamp}:${body}`;

  // Create the signature
  const mySignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(basestring)
    .digest("hex")}`;

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(requestSignature, "utf8")
  );
}

// Rate limiting store (in-memory for now, could move to Redis)
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimit>();

export function checkRateLimit(
  workspaceId: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `workspace:${workspaceId}`;

  let rateLimit = rateLimitStore.get(key);

  if (!rateLimit || now > rateLimit.resetTime) {
    rateLimit = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, rateLimit);
  }

  rateLimit.count++;

  return {
    allowed: rateLimit.count <= maxRequests,
    remaining: Math.max(0, maxRequests - rateLimit.count),
    resetTime: rateLimit.resetTime,
  };
}

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, rateLimit]) => {
    if (now > rateLimit.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, 60000); // Clean up every minute

// Create audit log entry
export interface AuditLogEntry {
  userId: string;
  workspaceId: string;
  ferdinandUserId?: number;
  command: string;
  assetIds: number[];
  clientId: number;
  success: boolean;
  error?: string;
  responseTimeMs?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Enhanced audit logger that persists to database
export async function logSlackActivity(entry: AuditLogEntry): Promise<void> {
  // Log to console for immediate visibility
  const timestamp = entry.timestamp.toISOString();
  console.log(`[SLACK AUDIT] ${timestamp} - User ${entry.userId} in workspace ${entry.workspaceId} executed "${entry.command}" - Success: ${entry.success} - Assets: [${entry.assetIds.join(", ")}] - Client: ${entry.clientId}${entry.responseTimeMs ? ` - ${entry.responseTimeMs}ms` : ''}`);

  if (entry.error) {
    console.error(`[SLACK ERROR] ${entry.error}`);
  }

  // Persist to database (skip for commands without valid client ID)
  if (entry.clientId > 0) {
    try {
      const auditData = {
        slackUserId: entry.userId,
        slackWorkspaceId: entry.workspaceId,
        ferdinandUserId: entry.ferdinandUserId || null,
        clientId: entry.clientId,
        command: entry.command,
        assetIds: entry.assetIds.length > 0 ? entry.assetIds : undefined,
        success: entry.success,
        errorMessage: entry.error || undefined,
        responseTimeMs: entry.responseTimeMs || undefined,
        metadata: entry.metadata || {},
      };

      const parsed = insertSlackAuditLogSchema.safeParse(auditData);
      if (parsed.success) {
        await db.insert(slackAuditLogs).values(parsed.data);
      } else {
        console.error("[SLACK AUDIT] Failed to validate audit log data:", parsed.error.errors);
      }
    } catch (dbError) {
      console.error("[SLACK AUDIT] Failed to persist audit log to database:", dbError);
      // Don't throw error to avoid breaking the main functionality
    }
  } else {
    console.log("[SLACK AUDIT] Skipping database persistence for command without valid client ID");
  }
}

// Generate a simple color palette image URL using a placeholder service
export function generateColorSwatchUrl(colors: Array<{ name?: string; hex: string; }>): string {
  if (colors.length === 0) {
    return "https://via.placeholder.com/400x100/CCCCCC/000000?text=No+Colors";
  }

  if (colors.length === 1) {
    const color = colors[0];
    const hexClean = color.hex.replace('#', '');
    // Ensure hex is valid 6-character format
    const validHex = hexClean.length === 6 ? hexClean : 'CCCCCC';
    const colorName = (color.name || 'Color').replace(/[^a-zA-Z0-9\s]/g, '');
    const text = encodeURIComponent(`${colorName}`);
    return `https://via.placeholder.com/400x100/${validHex}/FFFFFF?text=${text}`;
  }

  // For multiple colors, just use the first color as background
  const firstColor = colors[0];
  const hexClean = firstColor.hex.replace('#', '');
  const validHex = hexClean.length === 6 ? hexClean : 'CCCCCC';
  const text = encodeURIComponent(`${colors.length} Colors`);
  return `https://via.placeholder.com/600x120/${validHex}/FFFFFF?text=${text}`;
}

// Format color information for Slack display
export function formatColorInfo(colorAsset: BrandAsset): {
  title: string;
  colors: Array<{ name: string; hex: string; rgb?: string; usage?: string; category?: string; pantone?: string; }>;
  swatchUrl?: string;
  category?: string;
} {
  try {
    const data = typeof colorAsset.data === "string" ? JSON.parse(colorAsset.data) : colorAsset.data;

    if (!data?.colors || !Array.isArray(data.colors)) {
      return {
        title: colorAsset.name,
        colors: [],
        category: data?.category || 'color',
      };
    }

    // Map all colors, handling various color data formats
    const colors = data.colors
      .filter((color: any) => {
        // Only filter out colors that are truly empty or explicitly unnamed
        const name = color.name || color.label || color.title || '';
        const hex = color.hex || color.value || color.color || '';
        return hex && hex.trim() !== '' && hex !== '#000000';
      })
      .map((color: any) => ({
        name: color.name || color.label || color.title || 'Color',
        hex: color.hex || color.value || color.color || '#000000',
        rgb: color.rgb,
        usage: color.usage || color.description,
        category: color.category || data.category || 'color',
        pantone: color.pantone,
      }));

    const swatchUrl = generateColorSwatchUrl(colors);

    return {
      title: colorAsset.name,
      colors,
      swatchUrl,
      category: data?.category || 'color',
    };
  } catch (error) {
    console.error("Error parsing color asset data:", error);
    return {
      title: colorAsset.name,
      colors: [],
      category: 'color',
    };
  }
}

// Filter color assets by variant (brand, neutral, interactive)
export function filterColorAssetsByVariant(
  colorAssets: BrandAsset[],
  variant: string = ""
): BrandAsset[] {
  if (!variant.trim()) {
    return colorAssets;
  }

  const variantLower = variant.toLowerCase();

  // Brand colors - typically primary brand colors, logos, main identity
  const brandKeywords = ['brand', 'primary', 'main', 'identity', 'logo'];

  // Neutral colors - typically grays, blacks, whites, backgrounds
  const neutralKeywords = ['neutral', 'gray', 'grey', 'black', 'white', 'background', 'text', 'surface'];

  // Interactive colors - typically buttons, links, states, actions
  const interactiveKeywords = ['interactive', 'button', 'link', 'action', 'hover', 'active', 'focus', 'state'];

  let targetKeywords: string[] = [];

  if (brandKeywords.some(keyword => variantLower.includes(keyword))) {
    targetKeywords = brandKeywords;
  } else if (neutralKeywords.some(keyword => variantLower.includes(keyword))) {
    targetKeywords = neutralKeywords;
  } else if (interactiveKeywords.some(keyword => variantLower.includes(keyword))) {
    targetKeywords = interactiveKeywords;
  } else {
    // If no match found, try direct variant matching
    return colorAssets.filter((asset) => {
      const assetName = asset.name.toLowerCase();
      return assetName.includes(variantLower);
    });
  }

  return colorAssets.filter((asset) => {
    const assetName = asset.name.toLowerCase();

    // Check asset name against keywords
    const nameMatch = targetKeywords.some(keyword => assetName.includes(keyword));

    // Also check inside the color data for category or type
    try {
      const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      const category = data?.category?.toLowerCase() || '';
      const type = data?.type?.toLowerCase() || '';
      const categoryMatch = targetKeywords.some(keyword =>
        category.includes(keyword) || type.includes(keyword)
      );

      return nameMatch || categoryMatch;
    } catch {
      return nameMatch;
    }
  });
}

// Filter font assets by variant (brand, body, header)
export function filterFontAssetsByVariant(
  assets: any[],
  variant: string
): any[] {
  if (!variant) return assets;

  const lowerVariant = variant.toLowerCase();
  return assets.filter((asset) => {
    const name = asset.name.toLowerCase();
    const subcategory = asset.subcategory?.toLowerCase() || "";

    // Try to parse data to get additional context
    let fontCategory = "";
    let fontUsage = "";
    let fontFamily = "";
    let fontSource = "";
    try {
      const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      fontCategory = data?.category?.toLowerCase() || "";
      fontUsage = data?.usage?.toLowerCase() || "";
      fontFamily = data?.sourceData?.fontFamily?.toLowerCase() || "";
      fontSource = data?.source?.toLowerCase() || "";
    } catch {
      // Ignore parsing errors
    }

    // Broader matching for font variants including source and family
    return (
      name.includes(lowerVariant) ||
      subcategory.includes(lowerVariant) ||
      fontCategory.includes(lowerVariant) ||
      fontUsage.includes(lowerVariant) ||
      fontFamily.includes(lowerVariant) ||
      fontSource.includes(lowerVariant) ||
      // Common font type mappings
      (lowerVariant === "body" && (name.includes("body") || fontUsage.includes("body") || fontCategory.includes("body"))) ||
      (lowerVariant === "header" && (name.includes("header") || name.includes("heading") || fontUsage.includes("header") || fontCategory.includes("header"))) ||
      (lowerVariant === "brand" && (name.includes("brand") || fontUsage.includes("brand") || fontCategory.includes("brand"))) ||
      (lowerVariant === "google" && fontSource === "google") ||
      (lowerVariant === "adobe" && fontSource === "adobe")
    );
  });
}

// Format font information for Slack display
export function formatFontInfo(fontAsset: BrandAsset): {
  title: string;
  source: string;
  weights: string[];
  styles: string[];
  usage?: string;
  category?: string;
  files?: Array<{ format: string; weight: string; style: string; }>;
} {
  try {
    const data = typeof fontAsset.data === "string" ? JSON.parse(fontAsset.data) : fontAsset.data;
    
    console.log(`[FONT DEBUG] Processing font ${fontAsset.name}, data:`, JSON.stringify(data, null, 2));

    // Handle different data structures - be more flexible with source detection
    let source = data?.source || 'custom';
    
    // If source is not explicitly set, try to infer from the data structure or name
    if (source === 'custom' || !source) {
      // Check if it's likely a Google font
      const fontName = fontAsset.name.toLowerCase();
      const commonGoogleFonts = ['inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'source sans pro', 'raleway', 'nunito', 'ubuntu'];
      
      if (commonGoogleFonts.some(gFont => fontName.includes(gFont))) {
        source = 'google';
        console.log(`[FONT DEBUG] Inferred Google font for ${fontAsset.name}`);
      } else if (data?.sourceData?.projectId) {
        source = 'adobe';
        console.log(`[FONT DEBUG] Detected Adobe font for ${fontAsset.name}`);
      } else if (data?.sourceData?.files && data.sourceData.files.length > 0) {
        source = 'file';
        console.log(`[FONT DEBUG] Detected custom file font for ${fontAsset.name}`);
      }
    }

    const weights = Array.isArray(data?.weights) ? data.weights : ['400'];
    const styles = Array.isArray(data?.styles) ? data.styles : ['normal'];
    const usage = data?.usage || data?.subcategory || '';

    // Extract files information for custom fonts
    let files = [];
    if (data?.sourceData?.files) {
      files = data.sourceData.files;
    } else if (data?.files) {
      files = data.files;
    }

    // Determine category based on asset name and data
    let category = '';
    const assetName = fontAsset.name.toLowerCase();
    const subcategory = data?.subcategory?.toLowerCase() || '';

    if (assetName.includes('brand') || assetName.includes('primary') || assetName.includes('logo')) {
      category = 'brand';
    } else if (assetName.includes('body') || assetName.includes('text') || subcategory.includes('body')) {
      category = 'body';
    } else if (assetName.includes('header') || assetName.includes('heading') || assetName.includes('display') || subcategory.includes('header')) {
      category = 'header';
    }

    console.log(`[FONT DEBUG] Final font info for ${fontAsset.name}: source=${source}, weights=${weights.join(',')}, styles=${styles.join(',')}`);

    return {
      title: fontAsset.name,
      source,
      weights,
      styles,
      usage,
      category,
      files,
    };
  } catch (error) {
    console.error("Error parsing font asset data:", error);
    return {
      title: fontAsset.name,
      source: 'unknown',
      weights: ['400'],
      styles: ['normal'],
      category: 'unknown',
    };
  }
}

// Generate CSS code for Google Fonts
export function generateGoogleFontCSS(fontFamily: string, weights: string[]): string {
  const familyParam = fontFamily.replace(/\s+/g, '+');
  const weightsParam = weights.join(';');
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightsParam}&display=swap`;

  return `/* Google Font: ${fontFamily} */
/* Add this to your HTML <head> */
<link href="${url}" rel="stylesheet">

/* Or add this to your CSS */
@import url('${url}');

/* Use in CSS */
.your-element {
  font-family: '${fontFamily}', sans-serif;
  font-weight: ${weights[0] || '400'};
}`;
}

// Generate CSS code for Adobe Fonts
export function generateAdobeFontCSS(projectId: string, fontFamily: string): string {
  return `/* Add this to your HTML <head> */
<link rel="stylesheet" href="https://use.typekit.net/${projectId}.css">

/* Use in CSS */
.your-element {
  font-family: '${fontFamily}', sans-serif;
}`;
}

// Check if font has uploadable files
export function hasUploadableFiles(fontAsset: BrandAsset): boolean {
  try {
    const data = typeof fontAsset.data === "string" ? JSON.parse(fontAsset.data) : fontAsset.data;
    
    // Check multiple conditions for uploadable files
    const hasSourceFiles = data?.source === 'file' && data?.sourceData?.files && data.sourceData.files.length > 0;
    const hasCustomFiles = data?.sourceData?.files && data.sourceData.files.length > 0 && data?.source !== 'google' && data?.source !== 'adobe';
    
    console.log(`[FONT DEBUG] hasUploadableFiles for ${fontAsset.name}: source=${data?.source}, hasFiles=${!!(data?.sourceData?.files && data.sourceData.files.length > 0)}, result=${hasSourceFiles || hasCustomFiles}`);
    
    return hasSourceFiles || hasCustomFiles;
  } catch {
    return false;
  }
}