import { defineConfig } from 'vitest/config';
 import react from '@vitejs/plugin-react';
 import path from 'path';

 export default defineConfig({
   plugins: [react()],
   test: {
     globals: true,  // Enable global APIs (describe, it, expect)
     environment: 'node',  // Default for server tests
    include: ['tests/**/*.test.{ts,js}'],
     setupFiles: ['./tests/setup-env.js'],
     alias: {
       '@': path.resolve(__dirname, './client/src'),
       '@shared': path.resolve(__dirname, './shared'),
       'server': path.resolve(__dirname, './server'),
     },
      // Projects configuration for different test types
      projects: [
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['tests/**/*.test.ts', 'tests/**/*.test.js'],
            exclude: ['tests/client/**'],
            setupFiles: ['./tests/setup-env.js'],
          },
        },
       {
         extends: true,
         test: {
           name: 'client',
           environment: 'jsdom',
           include: ['tests/client/**/*.test.{ts,tsx}', 'client/**/*.test.{ts,tsx}'],
           setupFiles: ['./tests/setup.ts'],
         },
       },
     ],
   },
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './client/src'),
       '@shared': path.resolve(__dirname, './shared'),
     },
   },
 });