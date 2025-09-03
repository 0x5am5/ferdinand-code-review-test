/// <reference types="react" />

declare global {
  interface Window {
    // Add any custom window properties here
  }

  const React: typeof import('react');
}

// This ensures this file is treated as a module
export {}
