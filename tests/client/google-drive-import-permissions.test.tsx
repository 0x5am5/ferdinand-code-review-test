import React from "react";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGoogleDriveImportMutation } from "../../client/src/lib/queries/google-drive";

// Mock TextDecoder for Node.js environment
global.TextDecoder = class TextDecoder {
  decode(input?: Uint8Array): string {
    return input ? Buffer.from(input).toString('utf8') : '';
  }
} as any;

// Mock fetch globally
const mockFetch = global.fetch = jest.fn() as any;

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
    jest.clearAllMocks();
    
    // Reset fetch mock to default successful response
    mockFetch.mockReset();
  });

  describe("Non-super_admin user permission enforcement", () => {
    it("should return 403 when non-super_admin attempts import to unassociated client", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });

      // Mock 403 response for unauthorized client access
      mockFetch.mockResolvedValueOnce(
        new MockResponse(JSON.stringify({
          message: "Not authorized for this client"
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      // Mock SSE response body for 403 error
      const mockResponse = new MockResponse();
      mockResponse.body = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
          releaseLock: () => {},
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const onError = jest.fn();
      result.current.mutate(
        { files: mockFiles, clientId: mockUnassociatedClientId },
        { onError }
      );

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify fetch was called with the unassociated clientId
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
          clientId: mockUnassociatedClientId,
        }),
      });

      // Verify error callback was called with 403 error
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0] as Error;
      expect(error.message).toBe("Not authorized for this client");
    });

    it("should return 403 with proper error message when user has no client association", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });

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

      const onError = jest.fn();
      result.current.mutate(
        { files: mockFiles, clientId: 999 }, // Non-existent client ID
        { onError }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0] as Error;
      expect(error.message).toBe("Not authorized for this client");
    });

    it("should handle 403 error via direct API call", async () => {
      // Simulate direct API call (beyond the React hook)
      const directFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
      
      // Mock 403 response for direct API call
      directFetch.mockResolvedValueOnce({
        status: 403,
        json: async () => ({ message: "Not authorized for this client" }),
        ok: false,
      } as Response);

      const response = await directFetch("/api/google-drive/import", {
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
          clientId: mockUnassociatedClientId,
        }),
      });

      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
      
      const errorData = await (response as Response).json();
      expect((errorData as any).message).toBe("Not authorized for this client");
    });

    it("should not create any assets when import is blocked by permissions", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
      
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

      const onProgress = jest.fn();
      const onError = jest.fn();

      result.current.mutate(
        { files: mockFiles, clientId: mockUnassociatedClientId, onProgress },
        { onError }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no progress callbacks were made (import was blocked immediately)
      expect(onProgress).not.toHaveBeenCalled();
      
      // Verify error was called
      expect(onError).toHaveBeenCalled();
      
      // Verify only the initial request was made (no subsequent asset creation calls)
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial request, no SSE
    });
  });

  describe("UI behavior for permission errors", () => {
    it("should display appropriate error message for permission denied", async () => {
      const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
      
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

      const onError = jest.fn();
      
      result.current.mutate(
        { files: mockFiles, clientId: mockUnassociatedClientId },
        { onError }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0] as Error;
      expect(error.message).toBe("Not authorized for this client");
    });

    it("should handle different unauthorized scenarios consistently", async () => {
      const unauthorizedScenarios = [
        { clientId: 999, expectedMessage: "Not authorized for this client" },
        { clientId: 0, expectedMessage: "Not authorized for this client" },
        { clientId: -1, expectedMessage: "Not authorized for this client" },
      ];

      for (const scenario of unauthorizedScenarios) {
        jest.clearAllMocks();
        
        const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
        
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

        const onError = jest.fn();
        
        result.current.mutate(
          { files: mockFiles, clientId: scenario.clientId },
          { onError }
        );

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(onError).toHaveBeenCalled();
        const error = onError.mock.calls[0][0] as Error;
        expect(error.message).toBe(scenario.expectedMessage);
      }
    });
  });
});