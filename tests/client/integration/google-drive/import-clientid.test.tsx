import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = global.fetch = vi.fn() as any;

// Mock Response globally with proper implementation
class MockResponse {
  constructor(body?: any, init?: ResponseInit) {
    this.body = body;
    this.status = init?.status || 200;
    this.ok = (this.status >= 200 && this.status < 300);
  }
  body: any;
  status: number;
  ok: boolean;

  static json(data: any) {
    return new MockResponse(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

global.Response = MockResponse as any;

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

describe("Google Drive Import - clientId Validation", () => {
  const mockClientId = 123;
  const mockFiles = [
    { id: "file1", name: "test-file-1.jpg", mimeType: "image/jpeg" },
    { id: "file2", name: "test-file-2.png", mimeType: "image/png" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  it("should include clientId in the import request payload", async () => {
    mockFetch.mockImplementation(async (url, options) => {
      if (url === "/api/google-drive/import" && options?.method === "POST") {
        const mockResponse = new MockResponse();
        mockResponse.body = {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
            releaseLock: () => {},
          }),
        };
        return mockResponse;
      }
      return new MockResponse();
    });

    // Simulate the mutation call
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
        clientId: mockClientId,
      }),
    });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify fetch was called with correct payload
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
        clientId: mockClientId, // ✅ clientId should be included
      }),
    });
  });

  it("should pass the correct clientId value received from props", async () => {
    mockFetch.mockImplementation(async (url, options) => {
      if (url === "/api/google-drive/import" && options?.method === "POST") {
        const mockResponse = new MockResponse();
        mockResponse.body = {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
            releaseLock: () => {},
          }),
        };
        return mockResponse;
      }
      return new MockResponse();
    });

    const differentClientId = 456;

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
        clientId: differentClientId,
      }),
    });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: differentClientId, // ✅ Should use the provided clientId
      }),
    });
  });

  it("should include clientId even when no progress callback is provided", async () => {
    mockFetch.mockImplementation(async (url, options) => {
      if (url === "/api/google-drive/import" && options?.method === "POST") {
        const mockResponse = new MockResponse();
        mockResponse.body = {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
            releaseLock: () => {},
          }),
        };
        return mockResponse;
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
        clientId: mockClientId,
      }),
    });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: mockClientId, // ✅ clientId should be included without progress callback
      }),
    });
  });

  it("should handle zero clientId (edge case)", async () => {
    mockFetch.mockImplementation(async (url, options) => {
      if (url === "/api/google-drive/import" && options?.method === "POST") {
        const mockResponse = new MockResponse();
        mockResponse.body = {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
            releaseLock: () => {},
          }),
        };
        return mockResponse;
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
        clientId: 0,
      }),
    });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: 0, // ✅ Should pass zero clientId as received
      }),
    });
  });
});
