/**
 * Manual Test Script for File Asset API
 *
 * Run this script to manually test the file asset endpoints:
 * npx tsx tests/file-assets-manual.ts
 *
 * Prerequisites:
 * - Server running on http://localhost:3001
 * - Dev auth bypass enabled OR valid session cookie
 */

// File and path imports removed - not used in this test script

const API_BASE = 'http://localhost:3001/api';
const TEST_CLIENT_ID = 1; // Update with your test client ID

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - startTime,
    });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function main() {
  console.log('🧪 Starting File Asset API Manual Tests\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test Client ID: ${TEST_CLIENT_ID}\n`);

  let testAssetId: number;
  let testCategoryId: number;
  let testTagId: number;

  // Test 1: Upload a file
  await runTest('Upload file successfully', async () => {
    const formData = new FormData();

    // Create a simple test file
    const testContent = 'Test file content for integration testing';
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-file.txt');
    formData.append('visibility', 'shared');

    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    assertEqual(response.status, 201, `Upload failed: ${JSON.stringify(data)}`);
    assert(data.id, 'Asset ID not returned');
    assert(data.fileName, 'File name not returned');
    assertEqual(data.originalFileName, 'test-file.txt', 'Original filename mismatch');

    testAssetId = data.id;
  });

  // Test 2: List assets
  await runTest('List assets with pagination', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets?limit=10&offset=0`
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'List failed');
    assert(Array.isArray(data.assets), 'Assets not an array');
    assert(typeof data.total === 'number', 'Total not a number');
    assert(typeof data.limit === 'number', 'Limit not a number');
    assert(typeof data.offset === 'number', 'Offset not a number');
  });

  // Test 3: Get single asset
  await runTest('Get single asset by ID', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/${testAssetId}`
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'Get asset failed');
    assertEqual(data.id, testAssetId, 'Asset ID mismatch');
  });

  // Test 4: Download asset
  await runTest('Download asset file', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/${testAssetId}/download`
    );

    assertEqual(response.status, 200, 'Download failed');
    assert(
      response.headers.get('Content-Type'),
      'Content-Type header missing'
    );
    assert(
      response.headers.get('Content-Disposition')?.includes('attachment'),
      'Content-Disposition not set to attachment'
    );

    const content = await response.arrayBuffer();
    assert(content.byteLength > 0, 'Downloaded file is empty');
  });

  // Test 5: Create category (admin only)
  await runTest('Create asset category', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-categories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Category',
          slug: 'test-category',
          isDefault: false,
        }),
      }
    );

    const data = await response.json();

    // May fail if user is not admin
    if (response.status === 403) {
      console.log('  ⚠️  Skipped - requires admin role');
      return;
    }

    assertEqual(response.status, 201, 'Create category failed');
    assert(data.id, 'Category ID not returned');
    testCategoryId = data.id;
  });

  // Test 6: List categories
  await runTest('List asset categories', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-categories`
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'List categories failed');
    assert(Array.isArray(data), 'Categories not an array');
  });

  // Test 7: Create tag
  await runTest('Create asset tag', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-tags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Tag',
          slug: 'test-tag',
        }),
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      console.log('  ⚠️  Skipped - requires authentication');
      return;
    }

    assertEqual(response.status, 201, 'Create tag failed');
    assert(data.id, 'Tag ID not returned');
    testTagId = data.id;
  });

  // Test 8: List tags
  await runTest('List asset tags', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-tags`
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'List tags failed');
    assert(Array.isArray(data), 'Tags not an array');
  });

  // Test 9: Update asset metadata
  await runTest('Update asset metadata', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/${testAssetId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: 'private',
        }),
      }
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'Update asset failed');
    assertEqual(data.visibility, 'private', 'Visibility not updated');
  });

  // Test 10: Filter assets by visibility
  await runTest('Filter assets by visibility', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets?visibility=private`
    );

    const data = await response.json();
    assertEqual(response.status, 200, 'Filter failed');
    assert(Array.isArray(data.assets), 'Assets not an array');
  });

  // Test 11: Delete asset
  await runTest('Soft delete asset', async () => {
    const response = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/${testAssetId}`,
      {
        method: 'DELETE',
      }
    );

    assertEqual(response.status, 200, 'Delete failed');

    // Verify asset is no longer accessible
    const getResponse = await fetch(
      `${API_BASE}/clients/${TEST_CLIENT_ID}/file-assets/${testAssetId}`
    );
    assert(
      getResponse.status === 403 || getResponse.status === 404,
      'Deleted asset still accessible'
    );
  });

  // Test 12: Cleanup - delete test category
  if (testCategoryId) {
    await runTest('Delete test category', async () => {
      const response = await fetch(
        `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-categories/${testCategoryId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.status === 403) {
        console.log('  ⚠️  Skipped - requires admin role');
        return;
      }

      assertEqual(response.status, 200, 'Delete category failed');
    });
  }

  // Test 13: Cleanup - delete test tag
  if (testTagId) {
    await runTest('Delete test tag', async () => {
      const response = await fetch(
        `${API_BASE}/clients/${TEST_CLIENT_ID}/file-asset-tags/${testTagId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.status === 403) {
        console.log('  ⚠️  Skipped - requires admin role');
        return;
      }

      assertEqual(response.status, 200, 'Delete tag failed');
    });
  }

  // Print summary
  console.log('\n📊 Test Summary:');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);

  if (results.some((r) => !r.passed)) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
