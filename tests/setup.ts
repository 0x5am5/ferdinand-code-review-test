import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Firebase to prevent module-level document access errors
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: {},
  GoogleAuthProvider: class MockGoogleAuthProvider {
    addScope = vi.fn()
    setCustomParameters = vi.fn()
  },
}));

// Mock import.meta.env for Jest
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

// Mock fetch globally
global.fetch = vi.fn();

// Mock Response globally with proper implementation
global.Response = class MockResponse {
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
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
