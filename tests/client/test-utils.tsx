/**
 * Shared Frontend Test Utilities for Google Drive Integration
 *
 * This file provides reusable utilities for mocking:
 * - Server-Sent Events (SSE) for progress tracking
 * - OAuth flow for Google Drive connection
 * - Google Drive API responses
 * - Common test scenarios and mock data
 */

import { jest } from '@jest/globals';
import { TextEncoder } from 'util';

// Mock data types
export interface MockGoogleDriveConnection {
  id: number;
  userId: number;
  userEmail: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

export interface MockGoogleDriveToken {
  accessToken: string;
  expiresAt: string;
}

export interface MockSSEProgress {
  status: string;
  file?: string;
  progress: number;
  total: number;
  message: string;
  error?: string;
  assetId?: number;
}

// Default mock data
export const mockGoogleDriveConnection: MockGoogleDriveConnection = {
  id: 1,
  userId: 1,
  userEmail: 'test@example.com',
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  connectedAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
};

export const mockGoogleDriveToken: MockGoogleDriveToken = {
  accessToken: 'mock-access-token-12345',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

export const mockExpiredToken: MockGoogleDriveToken = {
  accessToken: 'expired-token-12345',
  expiresAt: new Date(Date.now() - 1000).toISOString(),
};

// SSE Mock Utilities
export class MockSSEStream {
  private chunks: string[] = [];
  private currentIndex = 0;

  constructor(chunks: string[] = []) {
    this.chunks = chunks;
  }

  addProgressUpdate(progress: MockSSEProgress) {
    this.chunks.push(`data: ${JSON.stringify(progress)}\n\n`);
  }

  addFinalResult(imported: number, failed: number, errors?: string[]) {
    const finalResult = {
      status: 'finished',
      imported,
      failed,
      errors,
    };
    this.chunks.push(`data: ${JSON.stringify(finalResult)}\n\n`);
  }

  createMockReader() {
    return {
      read: jest.fn().mockImplementation(async () => {
        if (this.currentIndex >= this.chunks.length) {
          return { done: true, value: new Uint8Array() };
        }

        const chunk = this.chunks[this.currentIndex];
        this.currentIndex++;
        
        return {
          done: false,
          value: new TextEncoder().encode(chunk),
        };
      }),
      releaseLock: jest.fn(),
    };
  }

  createMockResponse() {
    const reader = this.createMockReader();
    
    return {
      ok: true,
      body: {
        getReader: () => reader,
      },
    };
  }
}

// OAuth Mock Utilities
export class MockOAuthFlow {
  private originalWindowLocation: typeof window.location;
  private originalWindowHistory: typeof window.history;

  constructor() {
    this.originalWindowLocation = window.location;
    this.originalWindowHistory = window.history;
  }

  mockOAuthRedirect() {
    // Mock window.location.href for OAuth redirect - simplified to avoid JSDOM issues
    const mockLocation = {
      href: '',
      assign: jest.fn(),
      replace: jest.fn(),
    };
    
    // Store original location descriptor
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    if (originalDescriptor) {
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true,
      });
    } else {
      (window as any).location = mockLocation;
    }
  }

  mockOAuthCallback(status: 'success' | 'error', _reason?: string) {
    // Mock URL parameters for OAuth callback
    const mockUrl = new URL('http://localhost:3001/dashboard');
    mockUrl.searchParams.set('google_auth', status);
    if (_reason) {
      mockUrl.searchParams.set('reason', _reason);
    }

    // Mock window.location for OAuth callback using a simple approach
    (window as any).location = {
      href: mockUrl.toString(),
      search: mockUrl.search,
      searchParams: mockUrl.searchParams,
    };

    // Mock history.replaceState for URL cleanup
    (window as any).history = {
      ...window.history,
      replaceState: jest.fn(),
    };
  }

  restore() {
    delete (window as any).location;
    delete (window as any).history;
    (window as any).location = this.originalWindowLocation;
    (window as any).history = this.originalWindowHistory;
  }
}

// Fetch Mock Utilities
export class MockFetchResponses {
  private responses: Map<string, any> = new Map();

  setConnectionResponse(connection: MockGoogleDriveConnection | null) {
    if (connection) {
      this.responses.set('/api/google-drive/status', {
        ok: true,
        status: 200,
        json: async () => connection,
      });
    } else {
      this.responses.set('/api/google-drive/status', {
        ok: false,
        status: 404,
      });
    }
  }

  setTokenResponse(token: MockGoogleDriveToken | null) {
    if (token) {
      this.responses.set('/api/google-drive/token', {
        ok: true,
        status: 200,
        json: async () => token,
      });
    } else {
      this.responses.set('/api/google-drive/token', {
        ok: false,
        status: 404,
      });
    }
  }

  setOAuthUrlResponse(authUrl: string) {
    this.responses.set('/api/auth/google/url', {
      ok: true,
      status: 200,
      json: async () => ({ url: authUrl }),
    });
  }

  setImportResponse(sseStream: MockSSEStream) {
    this.responses.set('/api/google-drive/import', sseStream.createMockResponse());
  }

  setDisconnectResponse() {
    this.responses.set('/api/google-drive/disconnect', {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
  }

  setupFetchMock() {
    const mockFetch = jest.fn().mockImplementation((...args: any[]) => {
      const url = args[0] as string;
      const response = this.responses.get(url);
      if (response) {
        return Promise.resolve(response);
      }

      // Default response for unmocked endpoints
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });
    });

    global.fetch = mockFetch as any;
    return mockFetch;
  }
}

// Test Scenario Builders
export class TestScenarioBuilder {
  private fetchResponses: MockFetchResponses;
  private oauthFlow: MockOAuthFlow;

  constructor() {
    this.fetchResponses = new MockFetchResponses();
    this.oauthFlow = new MockOAuthFlow();
  }

  static create() {
    return new TestScenarioBuilder();
  }

  withConnectedDrive(overrides?: Partial<MockGoogleDriveConnection>) {
    const connection = { ...mockGoogleDriveConnection, ...overrides };
    this.fetchResponses.setConnectionResponse(connection);
    return this;
  }

  withDisconnectedDrive() {
    this.fetchResponses.setConnectionResponse(null);
    return this;
  }

  withValidToken(overrides?: Partial<MockGoogleDriveToken>) {
    const token = { ...mockGoogleDriveToken, ...overrides };
    this.fetchResponses.setTokenResponse(token);
    return this;
  }

  withExpiredToken() {
    this.fetchResponses.setTokenResponse(mockExpiredToken);
    return this;
  }

  withNoToken() {
    this.fetchResponses.setTokenResponse(null);
    return this;
  }

  withOAuthRedirect(authUrl: string = 'https://accounts.google.com/oauth/authorize?mock=true') {
    this.fetchResponses.setOAuthUrlResponse(authUrl);
    this.oauthFlow.mockOAuthRedirect();
    return this;
  }

  withOAuthSuccessCallback() {
    this.oauthFlow.mockOAuthCallback('success');
    return this;
  }

  withOAuthErrorCallback(reason: string = 'access_denied') {
    this.oauthFlow.mockOAuthCallback('error', reason);
    return this;
  }

  withImportProgress(progressUpdates: MockSSEProgress[], finalResult: { imported: number; failed: number; errors?: string[] }) {
    const sseStream = new MockSSEStream();
    
    progressUpdates.forEach(update => {
      sseStream.addProgressUpdate(update);
    });
    
    sseStream.addFinalResult(finalResult.imported, finalResult.failed, finalResult.errors);
    this.fetchResponses.setImportResponse(sseStream);
    return this;
  }

  withDisconnectCapability() {
    this.fetchResponses.setDisconnectResponse();
    return this;
  }

  withSuperAdminUser() {
    // Mock super admin user scenario
    return this;
  }

  withRegularAdminUser() {
    // Mock regular admin user scenario
    return this;
  }

  withStandardUser() {
    // Mock standard user scenario
    return this;
  }

  withGuestUser() {
    // Mock guest user scenario
    return this;
  }

  withUserRole(_role: string) {
    // Mock user role scenario
    return this;
  }

  withCurrentClient(_clientName: string) {
    // Mock current client scenario
    return this;
  }

  build() {
    const mockFetch = this.fetchResponses.setupFetchMock();
    
    return {
      mockFetch,
      cleanup: () => {
        this.oauthFlow.restore();
        jest.clearAllMocks();
      },
    };
  }
}

// Common test helpers
export const createMockProgressUpdates = (): MockSSEProgress[] => [
  {
    status: 'starting',
    file: 'test-file-1.pdf',
    progress: 0,
    total: 2,
    message: 'Starting import...',
  },
  {
    status: 'downloading',
    file: 'test-file-1.pdf',
    progress: 1,
    total: 2,
    message: 'Downloading test-file-1.pdf...',
  },
  {
    status: 'downloading',
    file: 'test-file-2.jpg',
    progress: 2,
    total: 2,
    message: 'Downloading test-file-2.jpg...',
  },
];

export const createMockFinalResult = () => ({
  imported: 2,
  failed: 0,
  errors: [],
});

export const createMockErrorResult = () => ({
  imported: 1,
  failed: 1,
  errors: ['Failed to download test-file-2.jpg: File too large'],
});

// Toast mock helper
export const mockToast = () => {
  const toast = jest.fn();
  jest.mock('@/hooks/use-toast', () => ({
    toast,
  }));
  return toast;
};

// Query client mock helper
export const createMockQueryClient = () => {
  const { QueryClient } = require('@tanstack/react-query');
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
};

// Component render wrapper helper
export const createTestWrapper = (queryClient: any) => {
  const { QueryClientProvider } = require('@tanstack/react-query');
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};