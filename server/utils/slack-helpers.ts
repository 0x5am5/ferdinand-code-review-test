import type { BrandAsset } from "@shared/schema";
import { slackAuditLogs, insertSlackAuditLogSchema } from "@shared/schema";
import { WebClient } from "@slack/web-api";
import { db } from "../db";
import fetch from "node-fetch";

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

// Upload file to Slack
export async function uploadFileToSlack(
  client: WebClient,
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
    // Fetch the file from the URL
    const response = await fetch(options.fileUrl);
    if (!response.ok) {
      console.error(`Failed to fetch file from ${options.fileUrl}: ${response.statusText}`);
      return false;
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());

    // First try to upload to the channel
    try {
      const result = await client.files.uploadV2({
        channel_id: options.channelId,
        file: fileBuffer,
        filename: options.filename,
        title: options.title,
        initial_comment: options.initialComment,
        filetype: options.filetype,
      });

      return result.ok === true;
    } catch (channelError: any) {
      // If channel upload fails due to channel access issues, try DM to user
      const isChannelAccessError = channelError.data?.error === 'not_in_channel' || 
                                   channelError.data?.error === 'channel_not_found';
      
      if (isChannelAccessError && options.userId) {
        console.log(`Bot cannot access channel (${channelError.data?.error}), falling back to DM to user ${options.userId}`);

        try {
          // Open DM conversation with user first
          const conversationResponse = await client.conversations.open({
            users: options.userId,
          });
          
          if (!conversationResponse.ok || !conversationResponse.channel?.id) {
            throw new Error("Failed to open DM conversation");
          }
          
          const dmChannelId = conversationResponse.channel.id;
          
          // Try uploading to DM using the new uploadV2 method
          const dmResult = await client.files.uploadV2({
            channel_id: dmChannelId,
            file: fileBuffer,
            filename: options.filename,
            title: options.title,
            initial_comment: options.initialComment + "\n\n💡 _File sent via DM since the bot isn't added to the channel. Add the bot to the channel for channel uploads._",
            filetype: options.filetype,
          });

          return dmResult.ok === true;
        } catch (dmError: any) {
          console.log(`DM upload also failed, sending download link instead: ${dmError.message}`);

          try {
            // Try opening DM conversation again for text message
            const conversationResponse = await client.conversations.open({
              users: options.userId,
            });
            
            if (conversationResponse.ok && conversationResponse.channel?.id) {
              // Send download link as message to DM
              const messageResult = await client.chat.postMessage({
                channel: conversationResponse.channel.id,
                text: `📎 *${options.title || options.filename}*\n${options.initialComment}\n\n🔗 Download: ${options.fileUrl}\n\n💡 _The bot couldn't upload the file directly. Add the bot to the channel for file uploads._`,
              });

              return messageResult.ok === true;
            } else {
              console.log("Failed to open DM conversation for download link");
              return false;
            }
          } catch (linkError: any) {
            console.log(`Download link message also failed: ${linkError.message}`);
            return false;
          }
        }
      }

      // Re-throw if it's not a channel access issue or no userId provided
      throw channelError;
    }
  } catch (error) {
    console.error("Error uploading file to Slack:", error);
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
  // Use a simple placeholder service to generate color swatches
  // Format: https://via.placeholder.com/600x100/FF0000/FFFFFF?text=Red+%23FF0000

  if (colors.length === 1) {
    const color = colors[0];
    const hexClean = color.hex.replace('#', '');
    const text = encodeURIComponent(`${color.name || 'Color'} ${color.hex}`);
    return `https://via.placeholder.com/400x100/${hexClean}/FFFFFF?text=${text}`;
  }

  // For multiple colors, create a combined palette
  const colorStripes = colors.slice(0, 5).map(c => c.hex.replace('#', '')).join('-');
  const colorNames = colors.slice(0, 5).map(c => c.name || c.hex).join(', ');
  const text = encodeURIComponent(`Palette: ${colorNames}`);

  // Create a multi-color gradient effect
  return `https://via.placeholder.com/600x120/${colorStripes.split('-')[0]}/FFFFFF?text=${text}`;
}

// Format color information for Slack display
export function formatColorInfo(colorAsset: BrandAsset): {
  title: string;
  colors: Array<{ name: string; hex: string; rgb?: string; usage?: string; }>;
  swatchUrl?: string;
} {
  try {
    const data = typeof colorAsset.data === "string" ? JSON.parse(colorAsset.data) : colorAsset.data;

    if (!data?.colors || !Array.isArray(data.colors)) {
      return {
        title: colorAsset.name,
        colors: [],
      };
    }

    const colors = data.colors.map((color: any) => ({
      name: color.name || color.label || 'Unnamed',
      hex: color.hex || color.value || '#000000',
      rgb: color.rgb,
      usage: color.usage || color.description,
    }));

    const swatchUrl = generateColorSwatchUrl(colors);

    return {
      title: colorAsset.name,
      colors,
      swatchUrl,
    };
  } catch (error) {
    console.error("Error parsing color asset data:", error);
    return {
      title: colorAsset.name,
      colors: [],
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

// Filter font assets by variant (body, header)
export function filterFontAssetsByVariant(
  fontAssets: BrandAsset[],
  variant: string = ""
): BrandAsset[] {
  if (!variant.trim()) {
    return fontAssets;
  }

  const variantLower = variant.toLowerCase();

  // Body fonts - typically for body text, paragraphs, readable content
  const bodyKeywords = ['body', 'text', 'paragraph', 'content', 'readable', 'sans', 'regular'];

  // Header fonts - typically for headlines, titles, display text
  const headerKeywords = ['header', 'heading', 'title', 'display', 'headline', 'hero', 'serif'];

  let targetKeywords: string[] = [];

  if (bodyKeywords.some(keyword => variantLower.includes(keyword))) {
    targetKeywords = bodyKeywords;
  } else if (headerKeywords.some(keyword => variantLower.includes(keyword))) {
    targetKeywords = headerKeywords;
  } else {
    // If no match found, try direct variant matching
    return fontAssets.filter((asset) => {
      const assetName = asset.name.toLowerCase();
      return assetName.includes(variantLower);
    });
  }

  return fontAssets.filter((asset) => {
    const assetName = asset.name.toLowerCase();

    // Check asset name against keywords
    const nameMatch = targetKeywords.some(keyword => assetName.includes(keyword));

    // Also check inside the font data for usage or type
    try {
      const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      const usage = data?.usage?.toLowerCase() || '';
      const type = data?.type?.toLowerCase() || '';
      const category = data?.category?.toLowerCase() || '';

      const dataMatch = targetKeywords.some(keyword =>
        usage.includes(keyword) || type.includes(keyword) || category.includes(keyword)
      );

      return nameMatch || dataMatch;
    } catch {
      return nameMatch;
    }
  });
}

// Format font information for Slack display
export function formatFontInfo(fontAsset: BrandAsset): {
  title: string;
  source: string;
  weights: string[];
  styles: string[];
  usage?: string;
  files?: Array<{ format: string; weight: string; style: string; }>;
} {
  try {
    const data = typeof fontAsset.data === "string" ? JSON.parse(fontAsset.data) : fontAsset.data;

    return {
      title: fontAsset.name,
      source: data?.source || 'unknown',
      weights: data?.weights || ['400'],
      styles: data?.styles || ['normal'],
      usage: data?.usage,
      files: data?.sourceData?.files || [],
    };
  } catch (error) {
    console.error("Error parsing font asset data:", error);
    return {
      title: fontAsset.name,
      source: 'unknown',
      weights: ['400'],
      styles: ['normal'],
    };
  }
}