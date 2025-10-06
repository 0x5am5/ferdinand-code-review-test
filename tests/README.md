# File Asset System Tests

This directory contains comprehensive tests for the File Asset Management System (Phase 2).

## Test Files

### `file-assets.test.ts`
Full integration test suite using Jest. Covers:
- File upload (single and multi-file)
- File size validation
- Category and tag assignment during upload
- Asset listing with pagination
- Filtering by category, tag, and visibility
- Asset retrieval and download
- Asset metadata updates
- Soft deletion
- Category management (CRUD)
- Tag management (CRUD)
- Permission system validation

**To run (requires Jest setup):**
```bash
npm test tests/file-assets.test.ts
```

### `file-assets-manual.ts`
Manual test script that can be run without Jest. Tests the same functionality but with simpler assertions.

**To run:**
```bash
# Make sure server is running first
npm run dev

# In another terminal:
npx tsx tests/file-assets-manual.ts
```

**Configuration:**
- Update `TEST_CLIENT_ID` in the file to match your test client
- Ensure dev auth bypass is enabled OR provide valid session cookies

## Test Coverage

### Upload Endpoints
- ✅ POST `/api/clients/:clientId/file-assets/upload`
  - File upload validation
  - Size limit enforcement (500MB)
  - MIME type validation
  - Category/tag assignment
  - Visibility settings

### Asset Management
- ✅ GET `/api/clients/:clientId/file-assets`
  - Pagination (limit/offset)
  - Category filtering
  - Tag filtering
  - Visibility filtering
- ✅ GET `/api/clients/:clientId/file-assets/:assetId`
  - Asset metadata retrieval
  - Permission validation
- ✅ GET `/api/clients/:clientId/file-assets/:assetId/download`
  - File streaming
  - Content headers
- ✅ PATCH `/api/clients/:clientId/file-assets/:assetId`
  - Metadata updates
  - Category reassignment
  - Tag reassignment
- ✅ DELETE `/api/clients/:clientId/file-assets/:assetId`
  - Soft deletion
  - Verification of deletion

### Category Management
- ✅ GET `/api/clients/:clientId/file-asset-categories`
  - System defaults + client-specific
- ✅ POST `/api/clients/:clientId/file-asset-categories` (admin only)
- ✅ PATCH `/api/clients/:clientId/file-asset-categories/:categoryId` (admin only)
  - Protection of system defaults
- ✅ DELETE `/api/clients/:clientId/file-asset-categories/:categoryId` (admin only)

### Tag Management
- ✅ GET `/api/clients/:clientId/file-asset-tags`
- ✅ POST `/api/clients/:clientId/file-asset-tags`
- ✅ DELETE `/api/clients/:clientId/file-asset-tags/:tagId` (admin only)

### Permission System
- ✅ Authentication enforcement
- ✅ Client isolation
- ✅ Role-based access control
  - Guest: View shared assets only
  - Standard: CRUD own assets, view shared
  - Editor: CRUD own assets, edit shared
  - Admin: Full access
  - Super Admin: Full access

## Running Tests

### Prerequisites
1. PostgreSQL database running
2. Environment variables configured
3. Server running on `http://localhost:3001`
4. Valid test client in database

### Quick Start
```bash
# Start the development server
npm run dev

# In another terminal, run manual tests
npx tsx tests/file-assets-manual.ts
```

### Expected Output
```
🧪 Starting File Asset API Manual Tests

API Base: http://localhost:3001/api
Test Client ID: 1

✅ Upload file successfully
✅ List assets with pagination
✅ Get single asset by ID
✅ Download asset file
✅ Create asset category
✅ List asset categories
✅ Create asset tag
✅ List asset tags
✅ Update asset metadata
✅ Filter assets by visibility
✅ Soft delete asset
✅ Delete test category
✅ Delete test tag

📊 Test Summary:
Total: 13
Passed: 13
Failed: 0

✅ All tests passed!
```

## Test Data Cleanup

The manual test script automatically cleans up test data after running:
- Uploaded test files are soft-deleted
- Test categories are removed
- Test tags are removed

## Troubleshooting

### Authentication Errors
If you get 401 errors:
- Ensure dev auth bypass is enabled in the server configuration
- OR provide valid session cookies in the test script

### Permission Errors (403)
Some tests require admin permissions:
- Category creation/update/delete
- Tag deletion
- These tests will be skipped with a warning if not admin

### File Upload Errors
If file uploads fail:
- Check the `uploads/` directory exists and is writable
- Verify storage configuration in `server/storage/config.ts`
- Check file size doesn't exceed 500MB limit

### Database Errors
If you get database errors:
- Ensure database migrations have been run: `npm run db:push`
- Verify test client exists in the database
- Check PostgreSQL connection

## Adding New Tests

To add new tests to the manual script:

```typescript
await runTest('Test name', async () => {
  const response = await fetch(`${API_BASE}/your-endpoint`);
  const data = await response.json();

  assertEqual(response.status, 200, 'Request failed');
  assert(data.someProperty, 'Property not found');
});
```

## Future Enhancements

- [ ] Add performance benchmarks (upload speed, query performance)
- [ ] Add concurrent upload tests
- [ ] Add large file upload tests (100MB+)
- [ ] Add multipart upload tests
- [ ] Add search functionality tests (Phase 4)
- [ ] Add thumbnail generation tests (Phase 5)
- [ ] Add signed URL expiration tests
- [ ] Add rate limiting tests
