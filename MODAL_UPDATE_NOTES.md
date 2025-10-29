# Asset Detail Modal Icon Update

## Update Summary

Updated `client/src/components/assets/asset-detail-modal.tsx` to use the shared `getFileTypeIcon` utility function for consistent Google Workspace file type icon display.

## What Changed

### Before
- Reference-only assets showed generic `ExternalLink` icon (blue, h-24 w-24)
- Non-image files showed generic `FileIcon` (gray, h-24 w-24)
- Icons were hardcoded and didn't match asset-list.tsx display

### After
- Reference-only assets show correct file type icons:
  - Google Sheets → Green FileIcon
  - Google Docs → Blue FileIcon
  - Google Slides → Orange FileIcon
- Non-image files show correct type-specific icons
- Large icons (h-16 w-16) appropriate for modal preview
- Consistent display across all asset components

## Technical Implementation

### New Shared Utility: `client/src/utils/file-icons.ts`

```typescript
export const getFileTypeIcon = (
  fileType: string,
  referenceOnly?: boolean,
  size: "sm" | "md" | "lg" = "md"
) => {
  // Returns properly styled React element with:
  // - Dynamic sizing (sm: h-5 w-5, md: h-8 w-8, lg: h-16 w-16)
  // - Google Workspace type detection
  // - Reference badge overlay
}
```

### Components Updated

1. **asset-list.tsx**
   - Imports `getFileTypeIcon` from utility
   - Removed duplicate function definition
   - Uses shared function in grid view (lg size)
   - Uses shared function in list view (sm size)

2. **asset-detail-modal.tsx** (NEW)
   - Imports `getFileTypeIcon` from utility
   - Line 294: `{getFileTypeIcon(asset.fileType, true, "lg")}` for reference assets
   - Line 309: `{getFileTypeIcon(asset.fileType, false, "lg")}` for regular files

## Benefits

✅ **Consistency** - Same icons everywhere assets are displayed
✅ **Maintainability** - Single source of truth for icon logic
✅ **Scalability** - Easy to add new file types
✅ **Flexibility** - Reusable size parameter for different contexts

## Testing

Verify in asset detail modal:
- [ ] Google Sheets reference shows green icon
- [ ] Google Docs reference shows blue icon
- [ ] Google Slides reference shows orange icon
- [ ] Regular files show appropriate icons
- [ ] Icons size matches modal preview area
- [ ] Reference-only assets display correct type icon (not generic external link)

## Files Modified

- `client/src/utils/file-icons.ts` - NEW shared utility
- `client/src/components/assets/asset-list.tsx` - Updated to import from utility
- `client/src/components/assets/asset-detail-modal.tsx` - Updated to use shared utility
