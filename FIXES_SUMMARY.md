# Google Drive Reference Assets - Fixes Summary

## Issues Fixed

### Issue 1: Download Endpoint Error - "Empty value provided for input HTTP label: Key"

**Problem:**
When users uploaded Google Drive files as reference-only assets, the download endpoint would fail with AWS SDK error: `"Empty value provided for input HTTP label: Key."` This occurred because:
- Reference-only assets have `storagePath = ""` (empty string) per schema design
- Download endpoints attempted to call `downloadFile("")` 
- AWS S3/R2 clients threw validation errors when receiving empty `Key` parameter

**Root Cause:**
The reference-only check was performed AFTER attempting to validate permissions, but the actual storage download attempt would fail when the storagePath was empty.

**Solution Implemented:**
Updated three download endpoints to check for `referenceOnly` flag BEFORE attempting to download from storage:

1. `/api/assets/:assetId/download` (global endpoint, line 575-597)
2. `/api/clients/:clientId/file-assets/:assetId/download` (client-scoped endpoint, line 1752-1774)
3. `/api/public/assets/:token` (public link endpoint, line 2279-2299)

**Changes:**
- Check if asset is `referenceOnly` immediately after permission validation
- If reference-only with valid `driveWebLink`, redirect to Google Drive (302)
- If reference-only without valid link, return 400 error
- Only attempt storage download for non-reference assets
- Validate `storagePath` is not empty before calling storage backend

---

### Issue 2: Asset Icon Types Not Displaying Correctly

**Problem:**
Google Workspace files (Docs, Sheets, Slides) showed generic file icons instead of their specific colored icons in the asset list. The function existed but wasn't being used consistently.

**Solution Implemented:**
Enhanced the `getFileTypeIcon` function with size support and updated all usages:

**Changes in `client/src/components/assets/asset-list.tsx`:**

1. **Enhanced `getFileTypeIcon` function** (lines 175-219):
   - Added `size` parameter with three options: `"sm" | "md" | "lg"`
   - Dynamic icon/badge sizing based on context
   - Sizes:
     - `sm`: h-5 w-5 icons (list view)
     - `md`: h-8 w-8 icons (default)
     - `lg`: h-16 w-16 icons (grid view)
   - Fixed `relative` positioning to use `inline-block` for better alignment

2. **Grid View Update** (lines 419-436):
   - Reference-only assets now use `getFileTypeIcon(asset.fileType, true, "lg")`
   - Regular non-image assets use `getFileTypeIcon(asset.fileType, false, "lg")`
   - Large icons appropriate for grid card display

3. **List View Update** (line 636):
   - Uses `getFileTypeIcon(asset.fileType, asset.referenceOnly, "sm")`
   - Small icons appropriate for table cell display

**Result:**
- Google Sheets files now show green icons
- Google Docs files now show blue icons
- Google Slides files now show orange icons
- Reference-only assets display external link badge overlay
- Icons scale appropriately for their context (grid vs list view)

---

## Files Modified

### Backend Files
- **`server/routes/file-assets.ts`**
  - Lines 575-597: Global download endpoint fix
  - Lines 1752-1774: Client-scoped download endpoint fix
  - Lines 2279-2299: Public download endpoint fix

### Frontend Files
- **`client/src/utils/file-icons.ts`** (NEW)
  - Shared utility function for consistent icon display across components
  - Supports size variants: `sm`, `md`, `lg`
  - Handles all Google Workspace file types with proper colors
  - Includes reference-only badge overlay

- **`client/src/components/assets/asset-list.tsx`**
  - Line 42: Imports `getFileTypeIcon` from shared utility
  - Lines 419-436: Updated grid view to use shared icon function
  - Line 636: Updated list view to use shared icon function
  - Removed duplicate icon function definition

- **`client/src/components/assets/asset-detail-modal.tsx`**
  - Line 44: Imports `getFileTypeIcon` from shared utility
  - Lines 294, 309: Updated preview section to use shared icon function
  - Reference-only assets now display correct file type icon instead of generic external link icon

---

## Testing Recommendations

1. **Download Reference Assets:**
   - Upload a Google Workspace file (Docs, Sheets, Slides) as reference-only
   - Click download/view button
   - Should redirect to Google Drive instead of throwing an error

2. **Icon Display:**
   - Verify Google Sheets files show green file icons in both grid and list views
   - Verify Google Docs files show blue file icons
   - Verify Google Slides files show orange file icons
   - Verify reference-only assets show external link badge on icons
   - Verify icons are appropriately sized in grid (large) vs list (small) views

3. **Regular Assets:**
   - Upload regular files and verify they download normally
   - Icon display should remain consistent with previous behavior

---

## Notes

- All changes maintain backward compatibility
- No database schema changes required
- Reference-only flag was already in schema, just needed proper endpoint handling
- Google Drive file type detection uses standard MIME types:
  - `application/vnd.google-apps.spreadsheet` → Google Sheets
  - `application/vnd.google-apps.document` → Google Docs
  - `application/vnd.google-apps.presentation` → Google Slides
