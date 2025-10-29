# Fix Reference-Only Assets Missing Google Drive Links

## Problem

When trying to download/view a reference-only asset, you get the error:
```json
{"message":"Reference-only asset without valid Google Drive link"}
```

This happens when a reference-only asset (Google Workspace file) was created but the `driveWebLink` field wasn't populated.

## Solution

There are two ways to fix this:

### Option 1: API Endpoint (Recommended - Real-time)

Call the admin endpoint to automatically fix all missing links:

```bash
curl -X POST http://localhost:3001/api/admin/fix-reference-assets \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" 
```

**Response:**
```json
{
  "message": "Migration complete: 3/3 assets fixed",
  "total": 3,
  "fixed": 3,
  "fixed_assets": [
    {
      "id": 620,
      "fileName": "document.docx",
      "webLink": "https://drive.google.com/file/d/1ABC123/view"
    }
  ],
  "skipped_assets": []
}
```

**Requirements:**
- Must be logged in as a Super Admin user
- Session cookie must be valid

### Option 2: Migration Script

Run the migration script to find and fix all problematic assets:

```bash
npx ts-node server/migrations/fix-reference-assets.ts
```

**Output:**
```
Starting reference asset migration...
This script will help fix reference-only assets with missing Google Drive links.

Assets that need fixing:
────────────────────────────────────────────────────────────────────────────────
✓ Fixed asset 620 (document.docx) → https://drive.google.com/file/d/1ABC123/view
✓ Fixed asset 621 (spreadsheet.xlsx) → https://drive.google.com/file/d/2DEF456/view
────────────────────────────────────────────────────────────────────────────────

Migration complete: 2/2 assets fixed
✓ All reference assets now have valid Google Drive links!
```

## How It Works

The fix automatically constructs the Google Drive web link from the existing `driveFileId`:
```
Base URL: https://drive.google.com/file/d/
File ID: 1ABC123 (stored in database)
Result: https://drive.google.com/file/d/1ABC123/view
```

Since asset 620 has `driveFileId`, the fix will generate the proper link.

## What to Do After Fixing

After running either fix method:

1. **Verify the fix:**
   ```bash
   # Try downloading/viewing the asset again
   curl http://localhost:3001/api/assets/620/download
   ```
   It should now redirect to Google Drive instead of showing the error.

2. **Test in the UI:**
   - Open the asset list
   - Click "view" or "download" on a reference-only asset
   - It should open Google Drive in a new tab

## Troubleshooting

### Still Getting the Error

1. Check if the asset has a `driveFileId`:
   ```sql
   SELECT id, driveFileId, driveWebLink FROM assets WHERE id = 620;
   ```

2. If `driveFileId` is NULL/empty:
   - The asset wasn't properly imported
   - You may need to re-import it from Google Drive

3. If the fix ran but still getting error:
   - Verify the database was actually updated:
     ```sql
     SELECT driveWebLink FROM assets WHERE id = 620;
     ```
   - Make sure you're not seeing cached data (clear browser cache)
   - Restart the server

### Permission Denied

If you get "Admin access required":
- You must be logged in as a Super Admin user
- Check your user role in the database:
  ```sql
  SELECT id, email, role FROM users WHERE id = <your-user-id>;
  ```

## Preventing This Issue

New reference-only assets should already have the proper `driveWebLink` set during import. This issue only affects:
- Assets created before the fix was implemented
- Assets where the Google API didn't return the webViewLink (rare)

To ensure new imports work correctly:
1. Verify Google Drive file picker returns metadata including `webViewLink`
2. Check `server/services/google-drive.ts` lines 94-97 and 113-116 for correct fields being requested
