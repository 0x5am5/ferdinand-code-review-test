# Automatic Asset Categorization Implementation

## Overview
This document outlines the implementation plan for automatically determining asset categories based on file types when users upload documents to the asset manager.

## Current System Analysis

### Available Categories
- Documents
- Spreadsheets  
- Slide Decks
- Design Assets
- Photography

### Current Upload Flow
1. Files are uploaded via `asset-upload.tsx`
2. Users manually select categories from a dropdown
3. Categories are stored in the `assetCategories` table
4. File type information is available via `file.type` (MIME type) and `file.name`

## Implementation Plan

### 1. Create Utility Function (`client/src/lib/asset-categorization.ts`)

```typescript
/**
 * Utility functions for automatic asset categorization based on file types
 */

// File type to category mapping
const FILE_TYPE_CATEGORIES = {
  // Documents
  'application/pdf': 'Documents',
  'application/msword': 'Documents',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documents',
  'text/plain': 'Documents',
  'text/rtf': 'Documents',
  'application/rtf': 'Documents',
  
  // Spreadsheets
  'application/vnd.ms-excel': 'Spreadsheets',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheets',
  'text/csv': 'Spreadsheets',
  
  // Slide Decks
  'application/vnd.ms-powerpoint': 'Slide Decks',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Slide Decks',
  
  // Design Assets (prioritized over Photography for ambiguous types)
  'application/illustrator': 'Design Assets',
  'application/vnd.adobe.illustrator': 'Design Assets',
  'application/x-illustrator': 'Design Assets',
  'image/svg+xml': 'Design Assets', // SVG prioritized as Design Asset
  'image/vnd.adobe.photoshop': 'Design Assets',
  'application/x-photoshop': 'Design Assets',
  'application/photoshop': 'Design Assets',
  'image/vnd.adobe.photoshop': 'Design Assets',
  'application/x-sketch': 'Design Assets',
  'application/figma': 'Design Assets',
  'application/eps': 'Design Assets',
  'application/postscript': 'Design Assets',
  'application/x-eps': 'Design Assets',
  
  // Photography
  'image/jpeg': 'Photography',
  'image/jpg': 'Photography',
  'image/png': 'Photography',
  'image/gif': 'Photography',
  'image/webp': 'Photography',
  'image/tiff': 'Photography',
  'image/bmp': 'Photography',
} as const;

// File extension to category mapping (fallback for MIME types)
const FILE_EXTENSION_CATEGORIES = {
  // Documents
  '.pdf': 'Documents',
  '.doc': 'Documents',
  '.docx': 'Documents',
  '.txt': 'Documents',
  '.rtf': 'Documents',
  
  // Spreadsheets
  '.xls': 'Spreadsheets',
  '.xlsx': 'Spreadsheets',
  '.csv': 'Spreadsheets',
  
  // Slide Decks
  '.ppt': 'Slide Decks',
  '.pptx': 'Slide Decks',
  
  // Design Assets
  '.ai': 'Design Assets',
  '.svg': 'Design Assets', // SVG prioritized as Design Asset
  '.psd': 'Design Assets',
  '.sketch': 'Design Assets',
  '.fig': 'Design Assets',
  '.eps': 'Design Assets',
  
  // Photography
  '.jpg': 'Photography',
  '.jpeg': 'Photography',
  '.png': 'Photography',
  '.gif': 'Photography',
  '.webp': 'Photography',
  '.tiff': 'Photography',
  '.bmp': 'Photography',
} as const;

type AssetCategory = 'Documents' | 'Spreadsheets' | 'Slide Decks' | 'Design Assets' | 'Photography';

/**
 * Determines the appropriate category for a file based on its MIME type and extension
 * @param file - The file to categorize
 * @returns The determined category or null if unable to categorize
 */
export function determineAssetCategory(file: File): AssetCategory | null {
  // First try MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType && FILE_TYPE_CATEGORIES[mimeType as keyof typeof FILE_TYPE_CATEGORIES]) {
    return FILE_TYPE_CATEGORIES[mimeType as keyof typeof FILE_TYPE_CATEGORIES];
  }
  
  // Fallback to file extension
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  
  if (extension && FILE_EXTENSION_CATEGORIES[extension as keyof typeof FILE_EXTENSION_CATEGORIES]) {
    return FILE_EXTENSION_CATEGORIES[extension as keyof typeof FILE_EXTENSION_CATEGORIES];
  }
  
  return null; // Unable to categorize
}

/**
 * Finds the category ID that matches the determined category name
 * @param categoryName - The name of the category to find
 * @param categories - Available categories from the system
 * @returns The category ID or null if not found
 */
export function findCategoryIdByName(
  categoryName: AssetCategory | null,
  categories: Array<{ id: number; name: string; slug: string }>
): number | null {
  if (!categoryName) return null;
  
  const category = categories.find(cat => 
    cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  
  return category?.id || null;
}

/**
 * Automatically selects the appropriate category for a file
 * @param file - The file to categorize
 * @param categories - Available categories from the system
 * @returns The category ID or null if unable to categorize
 */
export function autoSelectCategory(
  file: File,
  categories: Array<{ id: number; name: string; slug: string }>
): number | null {
  const categoryName = determineAssetCategory(file);
  return findCategoryIdByName(categoryName, categories);
}

/**
 * Gets all supported file extensions for a given category
 * @param category - The category to get extensions for
 * @returns Array of file extensions for the category
 */
export function getSupportedExtensionsForCategory(category: AssetCategory): string[] {
  const extensions: string[] = [];
  
  Object.entries(FILE_EXTENSION_CATEGORIES).forEach(([ext, cat]) => {
    if (cat === category) {
      extensions.push(ext);
    }
  });
  
  return extensions;
}

/**
 * Checks if a file type is supported for automatic categorization
 * @param file - The file to check
 * @returns True if the file can be automatically categorized
 */
export function isSupportedFileType(file: File): boolean {
  return determineAssetCategory(file) !== null;
}
```

### 2. Update Asset Upload Component (`client/src/components/assets/asset-upload.tsx`)

Key changes needed:
- Import the categorization utility functions
- Add automatic category selection when files are added
- Update the `addFiles` function to auto-select categories
- Provide visual feedback when categories are automatically selected

```typescript
// Add to imports
import { autoSelectCategory, isSupportedFileType } from "@/lib/asset-categorization";

// Update the addFiles function to include automatic categorization
const addFiles = useCallback((newFiles: File[]) => {
  const filePreviews: FilePreview[] = newFiles.map((file) => {
    const preview = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
    
    // Auto-select category if available
    const autoCategoryId = autoSelectCategory(file, categories);
    
    return { 
      file, 
      preview,
      autoCategory: autoCategoryId 
    };
  });

  setFiles((prev) => [...prev, ...filePreviews]);
  
  // If we have auto-selected categories and no categories are currently selected,
  // set the first auto-selected category as the default
  const autoCategories = filePreviews
    .map(fp => fp.autoCategory)
    .filter(Boolean);
    
  if (autoCategories.length > 0 && selectedCategories.length === 0) {
    // Use the most common auto-selected category
    const categoryCounts = autoCategories.reduce((acc, catId) => {
      acc[catId] = (acc[catId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const mostCommonCategoryId = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    setSelectedCategories([parseInt(mostCommonCategoryId)]);
  }
}, [categories, selectedCategories]);
```

### 3. Update Asset Detail Modal (`client/src/components/assets/asset-detail-modal.tsx`)

Key changes needed:
- Add automatic category selection when new assets are created
- Pre-select categories based on file type when the modal opens for new uploads

```typescript
// Add to imports
import { determineAssetCategory, findCategoryIdByName } from "@/lib/asset-categorization";

// Add effect to auto-select category for new assets
useEffect(() => {
  if (asset) {
    setSelectedCategories(asset.categories?.map((c) => c.id) || []);
    setSelectedTags(asset.tags?.map((t) => t.id) || []);
    setVisibility(asset.visibility);
  } else if (initialFile) {
    // For new uploads, auto-select category based on file type
    const autoCategory = determineAssetCategory(initialFile);
    const categoryId = findCategoryIdByName(autoCategory, categories);
    
    if (categoryId) {
      setSelectedCategories([categoryId]);
    }
  }
}, [asset, initialFile, categories]);
```

### 4. Update Server-Side Upload Logic (`server/routes/file-assets.ts`)

Key changes needed:
- Add automatic categorization during upload if no categories are specified
- This ensures that files uploaded via API also get categorized

```typescript
// Add after line 1257 in the upload endpoint
// Auto-categorize if no categories provided
if (categoryIds.length === 0) {
  const { determineAssetCategoryFromMimeType } = await import("../utils/asset-categorization");
  const autoCategory = determineAssetCategoryFromMimeType(file.mimetype, file.originalname);
  
  if (autoCategory) {
    // Find the category ID for the auto-detected category
    const [autoCategoryRecord] = await db
      .select()
      .from(assetCategories)
      .where(
        and(
          eq(assetCategories.name, autoCategory),
          or(
            isNull(assetCategories.clientId),
            eq(assetCategories.clientId, clientId)
          )
        )
      );
    
    if (autoCategoryRecord) {
      categoryIds.push(autoCategoryRecord.id);
    }
  }
}
```

### 5. Create Server-Side Utility (`server/utils/asset-categorization.ts`)

Create a server-side version of the categorization logic for API uploads.

## Testing Strategy

### Unit Tests
- Test file type detection for all supported MIME types
- Test file extension fallback logic
- Test edge cases (unknown file types, missing extensions)
- Test category name matching (case insensitive)

### Integration Tests
- Test automatic categorization during file upload
- Test category pre-selection in asset detail modal
- Test server-side categorization for API uploads

### Manual Testing
- Upload various file types and verify correct categorization
- Test files with multiple possible categories (SVG)
- Test files with no clear category
- Test bulk uploads with mixed file types

## Edge Cases Handled

1. **Unknown File Types**: Returns null, allowing manual selection
2. **Missing MIME Types**: Falls back to file extension
3. **Case Sensitivity**: All comparisons are case-insensitive
4. **Multiple Categories**: Prioritizes Design Assets for SVG files
5. **Missing Extensions**: Gracefully handles files without extensions
6. **Custom Categories**: Works with client-specific categories via name matching

## Performance Considerations

- Categorization logic is synchronous and fast
- Minimal memory overhead with simple lookup objects
- No external dependencies required
- Caches category lookups to avoid repeated database queries

## Future Enhancements

1. **Machine Learning**: Could add ML-based categorization for ambiguous files
2. **User Preferences**: Allow users to customize categorization rules
3. **Content Analysis**: Analyze file contents for better categorization
4. **Batch Processing**: Optimize for bulk uploads with mixed file types

## Deployment Notes

- No database migrations required
- Backward compatible with existing manual categorization
- Can be rolled out incrementally
- No breaking changes to existing APIs