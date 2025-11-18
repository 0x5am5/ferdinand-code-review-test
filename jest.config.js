export default {
  projects: [
    {
      displayName: 'server',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^server/(.*)$': '<rootDir>/server/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
          },
        ],
      },
      testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.js', '**/tests/server/**/*.test.ts'],
      collectCoverageFrom: [
        'server/**/*.ts',
        '!server/index.ts',
        '!server/**/*.d.ts',
      ],
      setupFiles: ['dotenv/config'],
    },
    {
      displayName: 'server-js',
      testEnvironment: 'node',
      testMatch: ['**/tests/server/**/*.test.js'],
      collectCoverageFrom: [
        'server/**/*.ts',
        '!server/index.ts',
        '!server/**/*.d.ts',
      ],
      setupFiles: ['dotenv/config'],
      globals: {
        require: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        jest: 'readonly',
      },
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/src/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              jsx: 'react-jsx',
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            },
            diagnostics: false, // Disable TypeScript diagnostics for tests
          },
        ],
      },
      testMatch: ['**/client/**/*.test.{ts,tsx}'],
      collectCoverageFrom: [
        'client/src/**/*.{ts,tsx}',
        '!client/src/**/*.d.ts',
        '!client/src/main.tsx',
      ],
    },
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
