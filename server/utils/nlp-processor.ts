
import OpenAI from 'openai';
import type { BrandAsset } from '@shared/schema';
import { costMonitor } from './nlp-cost-monitor';

interface ProcessedCommand {
  intent: 'logo' | 'color' | 'font' | 'search' | 'help' | 'unknown';
  variant?: string;
  query?: string;
  confidence: number;
}

interface AssetContext {
  logos: BrandAsset[];
  colors: BrandAsset[];
  fonts: BrandAsset[];
}

export class NLPProcessor {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured. Natural language processing will be disabled.');
      this.openai = null as any;
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async processCommand(input: string, assetContext: AssetContext, workspaceId?: string): Promise<ProcessedCommand> {
    // If OpenAI is not configured, fall back to basic parsing
    if (!this.openai) {
      return this.fallbackProcessing(input);
    }

    // Check cost limits if workspace ID is provided
    if (workspaceId) {
      const limitCheck = costMonitor.checkLimits(workspaceId);
      if (!limitCheck.allowed) {
        console.warn(`NLP request blocked for workspace ${workspaceId}: ${limitCheck.reason}`);
        return this.fallbackProcessing(input);
      }
    }

    try {
      const systemPrompt = this.buildSystemPrompt(assetContext);
      const userPrompt = `Parse this brand asset request: "${input}"`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 150,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        return this.fallbackProcessing(input);
      }

      // Record successful usage
      if (workspaceId) {
        costMonitor.recordUsage(workspaceId);
      }

      return this.parseAIResponse(result, input);</old_str>
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.fallbackProcessing(input);
    }
  }

  private buildSystemPrompt(assetContext: AssetContext): string {
    const logoTypes = this.extractAssetVariants(assetContext.logos);
    const colorTypes = this.extractAssetVariants(assetContext.colors);
    const fontTypes = this.extractAssetVariants(assetContext.fonts);

    return `You are a brand asset assistant. Parse user requests and respond with JSON in this exact format:
{
  "intent": "logo|color|font|search|help",
  "variant": "specific_variant_or_null",
  "query": "original_user_input",
  "confidence": 0.0-1.0
}

Available assets for this organization:
LOGOS: ${logoTypes.join(', ') || 'main, horizontal, vertical, square, dark, light'}
COLORS: ${colorTypes.join(', ') || 'brand, neutral, interactive'}
FONTS: ${fontTypes.join(', ') || 'body, header, display'}

Rules:
- Intent MUST be one of: logo, color, font, search, help
- For logos: map requests like "dark logo", "square version", "horizontal layout" to appropriate variants
- For colors: map requests like "brand colors", "palette", "hex codes" to color intent
- For fonts: map requests like "typography", "typeface", "font files" to font intent
- Use "search" for general queries that don't clearly fit logo/color/font
- Use "help" for help requests
- Confidence should be high (0.8+) for clear requests, lower for ambiguous ones
- Always return valid JSON, nothing else`;
  }

  private extractAssetVariants(assets: BrandAsset[]): string[] {
    const variants = new Set<string>();
    
    assets.forEach(asset => {
      try {
        const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
        if (data?.type) {
          variants.add(data.type);
        }
        if (data?.category) {
          variants.add(data.category);
        }
        if (data?.usage) {
          variants.add(data.usage);
        }
        
        // Add asset name variants
        const nameWords = asset.name.toLowerCase().split(/\s+/);
        nameWords.forEach(word => {
          if (word.length > 2) {
            variants.add(word);
          }
        });
      } catch {
        // Ignore parsing errors
      }
    });

    return Array.from(variants).slice(0, 10); // Limit to prevent prompt bloat
  }

  private parseAIResponse(response: string, originalInput: string): ProcessedCommand {
    try {
      const parsed = JSON.parse(response.trim());
      
      // Validate the response structure
      if (!parsed.intent || !['logo', 'color', 'font', 'search', 'help'].includes(parsed.intent)) {
        return this.fallbackProcessing(originalInput);
      }

      return {
        intent: parsed.intent,
        variant: parsed.variant || undefined,
        query: originalInput,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5))
      };
    } catch {
      return this.fallbackProcessing(originalInput);
    }
  }

  private fallbackProcessing(input: string): ProcessedCommand {
    const lowerInput = input.toLowerCase();
    
    // Logo detection
    if (lowerInput.includes('logo') || lowerInput.includes('brand mark') || lowerInput.includes('icon')) {
      const variant = this.extractLogoVariant(lowerInput);
      return { intent: 'logo', variant, query: input, confidence: 0.7 };
    }
    
    // Color detection
    if (lowerInput.includes('color') || lowerInput.includes('palette') || lowerInput.includes('hex') || 
        lowerInput.includes('rgb') || lowerInput.includes('brand colors')) {
      const variant = this.extractColorVariant(lowerInput);
      return { intent: 'color', variant, query: input, confidence: 0.7 };
    }
    
    // Font detection
    if (lowerInput.includes('font') || lowerInput.includes('typography') || lowerInput.includes('typeface') ||
        lowerInput.includes('text style')) {
      const variant = this.extractFontVariant(lowerInput);
      return { intent: 'font', variant, query: input, confidence: 0.7 };
    }
    
    // Help detection
    if (lowerInput.includes('help') || lowerInput.includes('how') || lowerInput.includes('what can')) {
      return { intent: 'help', query: input, confidence: 0.9 };
    }
    
    // Default to search for everything else
    return { intent: 'search', query: input, confidence: 0.5 };
  }

  private extractLogoVariant(input: string): string | undefined {
    const variants = ['dark', 'light', 'square', 'horizontal', 'vertical', 'main', 'primary'];
    return variants.find(variant => input.includes(variant));
  }

  private extractColorVariant(input: string): string | undefined {
    const variants = ['brand', 'primary', 'neutral', 'interactive', 'secondary'];
    return variants.find(variant => input.includes(variant));
  }

  private extractFontVariant(input: string): string | undefined {
    const variants = ['body', 'header', 'heading', 'display', 'text'];
    return variants.find(variant => input.includes(variant));
  }
}

export const nlpProcessor = new NLPProcessor();
