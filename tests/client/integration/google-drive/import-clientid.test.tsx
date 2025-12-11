import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGoogleDriveImportMutation } from "../../client/src/lib/queries/google-drive";

// Mock fetch globally
const mockFetch = global.fetch = jest.fn() as any;

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
    
    // Mock successful fetch response
    const mockResponse = new MockResponse();
    mockResponse.body = {
      getReader: () => ({
        read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
        releaseLock: () => {},
      }),
    };
    
    mockFetch.mockResolvedValue(mockResponse);
  });

  it("should include clientId in the import request payload", async () => {
    const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });

    // Mock the mutation function
    const mockMutate = result.current.mutate;
    
    // Call the mutation with test data - the mutation should trigger fetch
    mockMutate({ files: mockFiles, clientId: mockClientId });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify fetch was called with correct payload
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
        clientId: mockClientId, // ✅ clientId should be included
      }),
    });
  });

  it("should pass the correct clientId value received from props", async () => {
    const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
    const mockMutate = result.current.mutate;
    const differentClientId = 456;

    mockMutate({ files: mockFiles, clientId: differentClientId });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: differentClientId, // ✅ Should use the provided clientId
      }),
    });
  });

  it("should include clientId even when no progress callback is provided", async () => {
    const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
    const mockMutate = result.current.mutate;

    mockMutate({ files: mockFiles, clientId: mockClientId });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: mockClientId, // ✅ clientId should be included without progress callback
      }),
    });
  });

  it("should handle zero clientId (edge case)", async () => {
    const { result } = renderHook(() => useGoogleDriveImportMutation(), { wrapper });
    const mockMutate = result.current.mutate;

    mockMutate({ files: mockFiles, clientId: 0 });

    // Wait for the next tick to allow async operations
    await new Promise(resolve => setTimeout(resolve, 0));

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
        clientId: 0, // ✅ Should pass zero clientId as received
      }),
    });
  });
});