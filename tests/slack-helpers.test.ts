import { describe, it, expect, beforeEach } from 'vitest';
import type { BrandAsset } from '@shared/schema';
import {
  findBestLogoMatch,
  generateAssetDownloadUrl,
  formatAssetInfo,
  formatColorInfo,
  formatFontInfo,
  filterColorAssetsByVariant,
  filterFontAssetsByVariant,
  generateColorSwatchUrl,
  checkRateLimit,
  generateGoogleFontCSS,
  generateAdobeFontCSS,
  hasUploadableFiles,
} from '../server/utils/slack-helpers';

// Mock brand assets for testing
const mockLogoAssets: BrandAsset[] = [
  {
    id: 1,
    clientId: 1,
    name: 'Main Logo',
    category: 'logo',
    data: JSON.stringify({ type: 'main', format: 'svg' }),
    fileData: 'mock-file-data',
    mimeType: 'image/svg+xml',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    clientId: 1,
    name: 'Dark Logo',
    category: 'logo',
    data: JSON.stringify({ type: 'dark', format: 'png' }),
    fileData: 'mock-file-data',
    mimeType: 'image/png',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    clientId: 1,
    name: 'Square Brand Mark',
    category: 'logo',
    data: JSON.stringify({ type: 'square', format: 'svg' }),
    fileData: 'mock-file-data',
    mimeType: 'image/svg+xml',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockColorAssets: BrandAsset[] = [
  {
    id: 4,
    clientId: 1,
    name: 'Brand Primary Colors',
    category: 'color',
    data: JSON.stringify({
      type: 'brand',
      colors: [
        { name: 'Primary Blue', hex: '#007bff', rgb: '0, 123, 255', usage: 'Primary actions and links' },
        { name: 'Secondary Orange', hex: '#fd7e14', rgb: '253, 126, 20', usage: 'Secondary actions' },
      ],
    }),
    fileData: null,
    mimeType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 5,
    clientId: 1,
    name: 'Neutral Grays',
    category: 'color',
    data: JSON.stringify({
      type: 'neutral',
      colors: [
        { name: 'Dark Gray', hex: '#343a40', rgb: '52, 58, 64', usage: 'Text and headings' },
        { name: 'Light Gray', hex: '#f8f9fa', rgb: '248, 249, 250', usage: 'Backgrounds' },
      ],
    }),
    fileData: null,
    mimeType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 6,
    clientId: 1,
    name: 'Interactive States',
    category: 'color',
    data: JSON.stringify({
      type: 'interactive',
      colors: [
        { name: 'Success Green', hex: '#28a745', rgb: '40, 167, 69', usage: 'Success messages' },
        { name: 'Danger Red', hex: '#dc3545', rgb: '220, 53, 69', usage: 'Error states' },
      ],
    }),
    fileData: null,
    mimeType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockFontAssets: BrandAsset[] = [
  {
    id: 7,
    clientId: 1,
    name: 'Body Text Font',
    category: 'font',
    data: JSON.stringify({
      source: 'google',
      usage: 'body',
      weights: ['400', '500'],
      styles: ['normal', 'italic'],
      sourceData: {
        files: [
          { format: 'woff2', weight: '400', style: 'normal' },
        ],
      },
    }),
    fileData: null,
    mimeType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 8,
    clientId: 1,
    name: 'Header Display Font',
    category: 'font',
    data: JSON.stringify({
      source: 'adobe',
      usage: 'header',
      weights: ['600', '700', '800'],
      styles: ['normal'],
      sourceData: {
        files: [
          { format: 'woff2', weight: '700', style: 'normal' },
        ],
      },
    }),
    fileData: null,
    mimeType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('Slack Helpers', () => {
  describe('findBestLogoMatch', () => {
    it('should return all assets when no query provided', () => {
      const result = findBestLogoMatch(mockLogoAssets, '');
      expect(result).toHaveLength(3);
    });

    it('should find exact type matches', () => {
      const result = findBestLogoMatch(mockLogoAssets, 'dark');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Dark Logo');
    });

    it('should find name matches when no type match', () => {
      const result = findBestLogoMatch(mockLogoAssets, 'square');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Square Brand Mark');
    });

    it('should use synonym matching', () => {
      const result = findBestLogoMatch(mockLogoAssets, 'icon');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Square Brand Mark');
    });

    it('should return all assets if no matches found', () => {
      const result = findBestLogoMatch(mockLogoAssets, 'nonexistent');
      expect(result).toHaveLength(3);
    });
  });

  describe('generateAssetDownloadUrl', () => {
    const baseUrl = 'https://test.example.com';

    it('should generate basic download URL', () => {
      const url = generateAssetDownloadUrl(123, 456, baseUrl);
      expect(url).toContain('/api/assets/123/file');
      expect(url).toContain('clientId=456');
    });

    it('should include format parameter', () => {
      const url = generateAssetDownloadUrl(123, 456, baseUrl, { format: 'png' });
      expect(url).toContain('format=png');
    });

    it('should include variant parameter', () => {
      const url = generateAssetDownloadUrl(123, 456, baseUrl, { variant: 'dark' });
      expect(url).toContain('variant=dark');
    });

    it('should include size parameter', () => {
      const url = generateAssetDownloadUrl(123, 456, baseUrl, { size: 512 });
      expect(url).toContain('size=512');
    });
  });

  describe('formatAssetInfo', () => {
    it('should format logo asset info correctly', () => {
      const result = formatAssetInfo(mockLogoAssets[0]);
      expect(result.title).toBe('Main Logo');
      expect(result.type).toBe('main');
      expect(result.format).toBe('SVG');
      expect(result.description).toContain('Primary brand logo');
    });

    it('should handle malformed data gracefully', () => {
      const badAsset: BrandAsset = {
        ...mockLogoAssets[0],
        data: 'invalid json',
      };
      const result = formatAssetInfo(badAsset);
      expect(result.title).toBe('Main Logo');
      expect(result.type).toBe('main');
      expect(result.format).toBe('UNKNOWN');
    });

    it('should handle missing data', () => {
      const assetWithoutData: BrandAsset = {
        ...mockLogoAssets[0],
        data: null,
      };
      const result = formatAssetInfo(assetWithoutData);
      expect(result.title).toBe('Main Logo');
      expect(result.type).toBe('main');
      expect(result.format).toBe('UNKNOWN');
    });
  });

  describe('formatColorInfo', () => {
    it('should format color asset info correctly', () => {
      const result = formatColorInfo(mockColorAssets[0]);
      expect(result.title).toBe('Brand Primary Colors');
      expect(result.colors).toHaveLength(2);
      expect(result.colors[0].name).toBe('Primary Blue');
      expect(result.colors[0].hex).toBe('#007bff');
      expect(result.colors[0].rgb).toBe('0, 123, 255');
      expect(result.colors[0].usage).toBe('Primary actions and links');
      expect(result.swatchUrl).toBeDefined();
    });

    it('should handle empty color data', () => {
      const emptyColorAsset: BrandAsset = {
        ...mockColorAssets[0],
        data: JSON.stringify({ colors: [] }),
      };
      const result = formatColorInfo(emptyColorAsset);
      expect(result.colors).toHaveLength(0);
    });

    it('should handle malformed color data', () => {
      const badColorAsset: BrandAsset = {
        ...mockColorAssets[0],
        data: 'invalid json',
      };
      const result = formatColorInfo(badColorAsset);
      expect(result.colors).toHaveLength(0);
    });
  });

  describe('filterColorAssetsByVariant', () => {
    it('should return all assets when no variant provided', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, '');
      expect(result).toHaveLength(3);
    });

    it('should filter brand colors correctly', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, 'brand');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Brand Primary Colors');
    });

    it('should filter neutral colors correctly', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, 'neutral');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Neutral Grays');
    });

    it('should filter interactive colors correctly', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, 'interactive');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Interactive States');
    });

    it('should handle partial matches', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, 'gray');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Neutral Grays');
    });

    it('should return empty array for no matches', () => {
      const result = filterColorAssetsByVariant(mockColorAssets, 'nonexistent');
      expect(result).toHaveLength(0); // Returns empty when no matches
    });
  });

  describe('filterFontAssetsByVariant', () => {
    it('should return all assets when no variant provided', () => {
      const result = filterFontAssetsByVariant(mockFontAssets, '');
      expect(result).toHaveLength(2);
    });

    it('should filter body fonts correctly', () => {
      const result = filterFontAssetsByVariant(mockFontAssets, 'body');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Body Text Font');
    });

    it('should filter header fonts correctly', () => {
      const result = filterFontAssetsByVariant(mockFontAssets, 'header');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Header Display Font');
    });

    it('should handle keyword matching', () => {
      const result = filterFontAssetsByVariant(mockFontAssets, 'display');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Header Display Font');
    });

    it('should return empty array for no matches', () => {
      const result = filterFontAssetsByVariant(mockFontAssets, 'nonexistent');
      expect(result).toHaveLength(0); // Returns empty when no matches
    });
  });

  describe('formatFontInfo', () => {
    it('should format font asset info correctly', () => {
      const result = formatFontInfo(mockFontAssets[0]);
      expect(result.title).toBe('Body Text Font');
      expect(result.source).toBe('google');
      expect(result.weights).toEqual(['400', '500']);
      expect(result.styles).toEqual(['normal', 'italic']);
      expect(result.usage).toBe('body');
      expect(result.files).toHaveLength(1);
    });

    it('should handle missing data gracefully', () => {
      const fontAssetWithoutData: BrandAsset = {
        ...mockFontAssets[0],
        data: null,
      };
      const result = formatFontInfo(fontAssetWithoutData);
      expect(result.title).toBe('Body Text Font');
      expect(result.source).toBe('custom');
      expect(result.weights).toEqual(['400']);
      expect(result.styles).toEqual(['normal']);
    });

    it('should handle malformed font data', () => {
      const badFontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: 'invalid json',
      };
      const result = formatFontInfo(badFontAsset);
      expect(result.title).toBe('Body Text Font');
      expect(result.source).toBe('unknown');
      expect(result.weights).toEqual(['400']);
      expect(result.styles).toEqual(['normal']);
    });
  });

  describe('generateColorSwatchUrl', () => {
    it('should generate URL for single color', () => {
      const colors = [{ name: 'Blue', hex: '#007bff' }];
      const url = generateColorSwatchUrl(colors);
      expect(url).toContain('007bff');
      expect(url).toContain('400x100');
    });

    it('should generate URL for multiple colors', () => {
      const colors = [
        { name: 'Blue', hex: '#007bff' },
        { name: 'Red', hex: '#dc3545' },
      ];
      const url = generateColorSwatchUrl(colors);
      expect(url).toContain('600x120');
      expect(url).toContain('007bff');
    });

    it('should handle colors without names', () => {
      const colors = [{ hex: '#007bff' }];
      const url = generateColorSwatchUrl(colors);
      expect(url).toBeDefined();
      expect(url).toContain('007bff');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store before each test
      // This is a bit tricky since the store is internal, but we can test the behavior
    });

    it('should allow requests within limit', () => {
      const result = checkRateLimit('test-workspace', 10, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track multiple requests from same workspace', () => {
      checkRateLimit('test-workspace-2', 3, 60000);
      checkRateLimit('test-workspace-2', 3, 60000);
      const result = checkRateLimit('test-workspace-2', 3, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should block requests when limit exceeded', () => {
      const workspaceId = 'test-workspace-limit';
      // Make requests up to the limit
      for (let i = 0; i < 2; i++) {
        checkRateLimit(workspaceId, 2, 60000);
      }

      // This should be blocked
      const result = checkRateLimit(workspaceId, 2, 60000);
      expect(result.allowed).toBe(false);
    });

    it('should reset rate limit after window expires', () => {
      const workspaceId = 'test-workspace-reset';

      // Use a very short window for testing
      checkRateLimit(workspaceId, 1, 1); // 1ms window

      // Wait for window to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = checkRateLimit(workspaceId, 1, 60000);
          expect(result.allowed).toBe(true);
          resolve(undefined);
        }, 10);
      });
    });

    it('should handle different workspaces independently', () => {
      const result1 = checkRateLimit('workspace-1', 1, 60000);
      const result2 = checkRateLimit('workspace-2', 1, 60000);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('generateGoogleFontCSS', () => {
    it('should generate Google Font CSS with correct URL', () => {
      const css = generateGoogleFontCSS('Roboto', ['400', '700']);
      expect(css).toContain('https://fonts.googleapis.com/css2');
      expect(css).toContain('family=Roboto');
      expect(css).toContain('wght@400;700');
    });

    it('should generate link tag HTML', () => {
      const css = generateGoogleFontCSS('Open Sans', ['300', '500']);
      expect(css).toContain('<link href=');
      expect(css).toContain('rel="stylesheet">');
    });

    it('should generate CSS import statement', () => {
      const css = generateGoogleFontCSS('Lato', ['400']);
      expect(css).toContain('@import url');
    });

    it('should generate usage example', () => {
      const css = generateGoogleFontCSS('Inter', ['400', '600']);
      expect(css).toContain("font-family: 'Inter'");
      expect(css).toContain('font-weight: 400');
    });

    it('should handle font names with spaces', () => {
      const css = generateGoogleFontCSS('Source Sans Pro', ['400']);
      expect(css).toContain('Source+Sans+Pro');
    });
  });

  describe('generateAdobeFontCSS', () => {
    it('should generate Adobe Font CSS with project ID', () => {
      const css = generateAdobeFontCSS('abc123', 'proxima-nova');
      expect(css).toContain('https://use.typekit.net/abc123.css');
    });

    it('should include link tag HTML', () => {
      const css = generateAdobeFontCSS('xyz789', 'futura-pt');
      expect(css).toContain('<link rel="stylesheet"');
      expect(css).toContain('href=');
    });

    it('should generate usage example', () => {
      const css = generateAdobeFontCSS('test123', 'proxima-nova');
      expect(css).toContain("font-family: 'proxima-nova'");
    });
  });

  describe('hasUploadableFiles', () => {
    it('should return true for font with file source and files', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: JSON.stringify({
          source: 'file',
          sourceData: {
            files: [
              { format: 'woff2', weight: '400', style: 'normal' },
            ],
          },
        }),
      };
      expect(hasUploadableFiles(fontAsset)).toBe(true);
    });

    it('should return false for Google font', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: JSON.stringify({
          source: 'google',
          sourceData: {
            files: [
              { format: 'woff2', weight: '400', style: 'normal' },
            ],
          },
        }),
      };
      expect(hasUploadableFiles(fontAsset)).toBe(false);
    });

    it('should return false for Adobe font', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: JSON.stringify({
          source: 'adobe',
          sourceData: {
            files: [
              { format: 'woff2', weight: '400', style: 'normal' },
            ],
          },
        }),
      };
      expect(hasUploadableFiles(fontAsset)).toBe(false);
    });

    it('should return true for custom font with files but no explicit source', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: JSON.stringify({
          sourceData: {
            files: [
              { format: 'woff2', weight: '400', style: 'normal' },
            ],
          },
        }),
      };
      expect(hasUploadableFiles(fontAsset)).toBe(true);
    });

    it('should return false for font without files', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: JSON.stringify({
          source: 'file',
          sourceData: {
            files: [],
          },
        }),
      };
      expect(hasUploadableFiles(fontAsset)).toBe(false);
    });

    it('should return false for malformed data', () => {
      const fontAsset: BrandAsset = {
        ...mockFontAssets[0],
        data: 'invalid json',
      };
      expect(hasUploadableFiles(fontAsset)).toBe(false);
    });
  });
});