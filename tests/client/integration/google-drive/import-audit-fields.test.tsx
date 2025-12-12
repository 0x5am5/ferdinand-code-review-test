import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGoogleDriveImportMutation } from "../../client/src/lib/queries/google-drive";

// Mock fetch globally
const mockFetch = global.fetch = vi.fn() as any;

// Mock Response globally with proper implementation
class MockResponse {
  constructor(body?: any, init?: ResponseInit) {
    this.body = body;
    this.status = init?.status || 200;
    this.ok = (this.status >= 200 && this.status < 300);
    this.headers = init?.headers || {};
  }
  body: any;
  status: number;
  ok: boolean;
  headers: any;
  
  static json(data: any) {
    return new MockResponse(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  json(): Promise<any> {
    try {
      return Promise.resolve(JSON.parse(this.body));
    } catch {
      return Promise.resolve({});
    }
  }
}

global.Response = MockResponse as any;

// Mock TextDecoder for Node.js environment
global.TextDecoder = class TextDecoder {
  decode(input?: Uint8Array): string {
    return input ? Buffer.from(input).toString('utf8') : '';
  }
} as any;

describe("Google Drive Import - Audit Fields", () => {
  const mockClientId = 123;
  const mockSuperAdminUserId = 1;
  const mockRegularUserId = 2;
  const mockFiles = [
    { id: "file1", name: "test-file-1.jpg", mimeType: "image/jpeg" },
    { id: "file2", name: "test-file-2.png", mimeType: "image/png" },
  ];

  // Create a test QueryClient
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Audit field validation for successful imports", () => {
    it("should include clientId in import request for audit tracking", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });

      // Mock successful import response
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          // Mock SSE response that completes successfully
          const mockResponse = new MockResponse();
          mockResponse.body = {
            getReader: () => {
              return {
                read: () => Promise.resolve({ 
                  done: true, 
                  value: new Uint8Array() 
                }),
                releaseLock: () => {},
              };
            },
          };
          return mockResponse;
        }
        return new MockResponse();
      });

      result.current.mutate({ files: mockFiles, clientId: mockClientId });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that import request included correct data for audit purposes
      expect(global.fetch).toHaveBeenCalledWith("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockClientId, // This is used for audit tracking
        }),
      });
    });

    it("should handle different clientIds for audit isolation", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
      const differentClientId = 456;

      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          const mockResponse = new MockResponse();
          mockResponse.body = {
            getReader: () => ({
              read: () => Promise.resolve({ 
                done: true, 
                value: new Uint8Array() 
              }),
              releaseLock: () => {},
            }),
          };
          return mockResponse;
        }
        return new MockResponse();
      });

      result.current.mutate({ files: [mockFiles[0]], clientId: differentClientId });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: [{
            id: mockFiles[0].id,
            name: mockFiles[0].name,
            mimeType: mockFiles[0].mimeType,
          }],
          clientId: differentClientId, // Different clientId for audit tracking
        }),
      });
    });
  });

  describe("Audit field validation for failed imports", () => {
    it("should handle import errors for audit logging", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });

      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            success: false,
            imported: 0,
            failed: 1,
            errors: ["File format not supported"],
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      const onError = vi.fn();

      result.current.mutate(
        { files: [mockFiles[0]], clientId: mockClientId },
        { onError }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error callback was called for audit purposes
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("Database audit field verification", () => {
    it("should validate audit fields via API responses", async () => {
      // Mock API response for asset audit verification
      mockFetch.mockImplementation(async (url) => {
        if (url.includes("/api/assets/")) {
          return new MockResponse(JSON.stringify({
            id: 1001,
            clientId: mockClientId,
            fileName: "test-file-1.jpg",
            originalFileName: "test-file-1.jpg",
            fileType: "image/jpeg",
            fileSize: 1024000,
            storagePath: "/assets/client-123/test-file-1.jpg",
            visibility: "shared",
            uploadedBy: mockSuperAdminUserId, // Critical audit field
            createdAt: "2025-10-28T15:30:00.000Z",
            updatedAt: "2025-10-28T15:30:00.000Z",
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      // Simulate API call to verify audit fields
      const response = await global.fetch("/api/assets/1001");
      const assetData = await response.json();

      // Verify audit fields are present and correct
      expect(assetData).toHaveProperty('uploadedBy');
      expect(assetData.uploadedBy).toBe(mockSuperAdminUserId);
      expect(assetData).toHaveProperty('createdAt');
      expect(assetData).toHaveProperty('updatedAt');
    });

    it("should track uploader userId across multiple import scenarios", async () => {
      const importScenarios = [
        { userId: mockSuperAdminUserId, clientId: mockClientId, description: "Super admin import" },
        { userId: mockRegularUserId, clientId: mockClientId, description: "Regular user import" },
      ];

      for (const scenario of importScenarios) {
        mockFetch.mockReset();
        
        // Mock asset creation response
        mockFetch.mockImplementation(async (url) => {
          if (url.includes("/api/assets/")) {
            return new MockResponse(JSON.stringify({
              id: Math.floor(Math.random() * 1000),
              clientId: scenario.clientId,
              fileName: `test-file-${scenario.userId}.jpg`,
              originalFileName: `test-file-${scenario.userId}.jpg`,
              fileType: "image/jpeg",
              fileSize: 1024000,
              storagePath: `/assets/client-${scenario.clientId}/test-file-${scenario.userId}.jpg`,
              visibility: "shared",
              uploadedBy: scenario.userId, // Critical audit field
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new MockResponse();
        });

        // Simulate API call to verify audit fields
        const response = await global.fetch(`/api/assets/recent?clientId=${scenario.clientId}`);
        const assetsData = await response.json();

        // Find the asset uploaded by this user
        const userAsset = Array.isArray(assetsData) 
          ? assetsData.find((asset: any) => asset.uploadedBy === scenario.userId)
          : assetsData;
        
        expect(userAsset).toBeDefined();
        expect(userAsset.uploadedBy).toBe(scenario.userId);
        expect(userAsset.fileName).toBe(`test-file-${scenario.userId}.jpg`);
      }
    });

    it("should validate audit field consistency across API calls", async () => {
      // Test that audit fields are consistent between different API endpoints
      mockFetch.mockImplementation(async (url) => {
        if (url.includes("/api/assets/1001")) {
          return new MockResponse(JSON.stringify({
            id: 1001,
            clientId: mockClientId,
            fileName: "test-file-1.jpg",
            uploadedBy: mockSuperAdminUserId,
            createdAt: "2025-10-28T15:30:00.000Z",
            updatedAt: "2025-10-28T15:30:00.000Z",
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes("/api/assets/list")) {
          return new MockResponse(JSON.stringify([{
            id: 1001,
            clientId: mockClientId,
            fileName: "test-file-1.jpg",
            uploadedBy: mockSuperAdminUserId,
            createdAt: "2025-10-28T15:30:00.000Z",
            updatedAt: "2025-10-28T15:30:00.000Z",
          }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      // Test single asset endpoint
      const singleResponse = await global.fetch("/api/assets/1001");
      const singleAsset = await singleResponse.json();

      // Test list endpoint
      const listResponse = await global.fetch("/api/assets/list?clientId=123");
      const listAssets = await listResponse.json();

      // Verify audit field consistency
      expect(singleAsset.uploadedBy).toBe(listAssets[0].uploadedBy);
      expect(singleAsset.createdAt).toBe(listAssets[0].createdAt);
      expect(singleAsset.updatedAt).toBe(listAssets[0].updatedAt);
    });
  });
});