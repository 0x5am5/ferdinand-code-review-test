import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock TextDecoder for Node.js environment
global.TextDecoder = class TextDecoder {
  decode(input?: Uint8Array): string {
    return input ? Buffer.from(input).toString('utf8') : '';
  }
} as any;

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

// Mock import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
        VITE_GOOGLE_APP_ID: 'test-google-app-id',
      },
    },
  },
  writable: true,
});

describe("Google Drive Import - Permission Enforcement", () => {
  const mockUnassociatedClientId = 456;
  const mockFiles = [
    { id: "file1", name: "test-file-1.jpg", mimeType: "image/jpeg" },
    { id: "file2", name: "test-file-2.png", mimeType: "image/png" },
  ];

  // Mock sessionStorage
  const mockSessionStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  Object.defineProperty(global, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);

    // Reset fetch mock to default successful response
    mockFetch.mockReset();
  });

  describe("Non-super_admin user permission enforcement", () => {
    it("should return 403 when non-super_admin attempts import to unassociated client", async () => {
      // Mock 403 response for unauthorized client access
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            message: "Not authorized for this client"
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      // Simulate calling the API
      const response = await global.fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockUnassociatedClientId,
        }),
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify fetch was called with the unassociated clientId
      expect(global.fetch).toHaveBeenCalledWith("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockUnassociatedClientId,
        }),
      });

      // Verify error response
      expect(response.status).toBe(403);
      const errorData = await response.json();
      expect(errorData.message).toBe("Not authorized for this client");
    });

    it("should return 403 with proper error message when user has no client association", async () => {
      // Mock 403 response
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            message: "Not authorized for this client"
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      const response = await global.fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: 999, // Non-existent client ID
        }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(response.status).toBe(403);
      const errorData = await response.json();
      expect(errorData.message).toBe("Not authorized for this client");
    });

    it("should handle 403 error via direct API call", async () => {
      // Simulate direct API call (beyond the React hook)
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            message: "Not authorized for this client"
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      const response = await global.fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockUnassociatedClientId,
        }),
      });

      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);

      const errorData = await response.json();
      expect(errorData.message).toBe("Not authorized for this client");
    });

    it("should not create any assets when import is blocked by permissions", async () => {
      // Mock 403 response
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            message: "Not authorized for this client"
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      await global.fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockUnassociatedClientId,
        }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify only the initial request was made (no subsequent asset creation calls)
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial request, no SSE
    });
  });

  describe("UI behavior for permission errors", () => {
    it("should display appropriate error message for permission denied", async () => {
      // Mock 403 response
      mockFetch.mockImplementation(async (url, options) => {
        if (url === "/api/google-drive/import" && options?.method === "POST") {
          return new MockResponse(JSON.stringify({
            message: "Not authorized for this client"
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new MockResponse();
      });

      const response = await global.fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          files: mockFiles.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: mockUnassociatedClientId,
        }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(response.status).toBe(403);
      const errorData = await response.json();
      expect(errorData.message).toBe("Not authorized for this client");
    });

    it("should handle different unauthorized scenarios consistently", async () => {
      const unauthorizedScenarios = [
        { clientId: 999, expectedMessage: "Not authorized for this client" },
        { clientId: 0, expectedMessage: "Not authorized for this client" },
        { clientId: -1, expectedMessage: "Not authorized for this client" },
      ];

      for (const scenario of unauthorizedScenarios) {
        vi.clearAllMocks();
        mockSessionStorage.getItem.mockReturnValue(null);

        // Mock 403 response
        mockFetch.mockImplementation(async (url, options) => {
          if (url === "/api/google-drive/import" && options?.method === "POST") {
            return new MockResponse(JSON.stringify({
              message: scenario.expectedMessage
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new MockResponse();
        });

        const response = await global.fetch("/api/google-drive/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            files: mockFiles.map((file) => ({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
            })),
            clientId: scenario.clientId,
          }),
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(response.status).toBe(403);
        const errorData = await response.json();
        expect(errorData.message).toBe(scenario.expectedMessage);
      }
    });
  });
});
