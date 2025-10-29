/**
 * Drive Picker Import Tests
 *
 * This test file validates Drive picker opening and import functionality,
 * including:
 * - Opening Drive picker with valid token
 * - Selecting files and triggering import
 * - Including correct clientId in import request
 * - Handling import progress and completion
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Import utilities we created
import {
  TestScenarioBuilder,
  createMockQueryClient,
  createTestWrapper,
} from './test-utils';

// Import the hooks we're testing
import { useGoogleDriveImportMutation } from '../../client/src/lib/queries/google-drive';

// Mock Google Picker API
const mockGooglePicker = {
  PickerBuilder: jest.fn(),
  Document: jest.fn(),
};

// Mock window.google
Object.defineProperty(window, 'google', {
  value: {
    picker: mockGooglePicker,
  },
  writable: true,
  configurable: true,
});

describe('Drive Picker Import', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Drive Picker Integration', () => {
    it('should open Drive picker when called', () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      // Mock picker builder
      const mockBuilder = {
        addView: jest.fn().mockReturnThis(),
        setOAuthToken: jest.fn().mockReturnThis(),
        setCallback: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          setVisible: jest.fn(),
          show: jest.fn(),
        }),
      };

      mockGooglePicker.PickerBuilder.mockReturnValue(mockBuilder);

      // Mock document
      const mockDocument = {
        createDocument: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }),
      };

      mockGooglePicker.Document.mockReturnValue(mockDocument);

      // Call the picker (simulated)
      const picker = mockBuilder.build();
      picker.setVisible(true);

      // Verify picker was configured
      expect(mockBuilder.setOAuthToken).toHaveBeenCalledWith('mock-access-token');
      expect(mockBuilder.setCallback).toHaveBeenCalled();
      expect(picker.setVisible).toHaveBeenCalledWith(true);

      scenario.cleanup();
    });

    it('should handle file selection from picker', () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      // Mock selected files
      const mockFiles = [
        { id: 'file1', name: 'test-document.pdf', mimeType: 'application/pdf' },
        { id: 'file2', name: 'test-image.jpg', mimeType: 'image/jpeg' },
      ];

      // Mock picker callback
      let pickerCallback;
      const mockBuilder = {
        addView: jest.fn().mockReturnThis(),
        setOAuthToken: jest.fn().mockReturnThis(),
        setCallback: jest.fn().mockImplementation((callback) => {
          pickerCallback = callback;
        }).mockReturnThis(),
        build: jest.fn().mockReturnValue({
          setVisible: jest.fn(),
        }),
      };

      mockGooglePicker.PickerBuilder.mockReturnValue(mockBuilder);

      // Simulate file selection
      mockBuilder.build();
      pickerCallback({ docs: mockFiles });

      // Verify callback received files
      expect(pickerCallback).toHaveBeenCalled();

      scenario.cleanup();
    });
  });

  describe('Import Mutation', () => {
    it('should include clientId in import request', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'test.pdf', mimeType: 'application/pdf' },
      ];

      // Mock successful import response
      scenario.mockFetch('/api/google-drive/import', {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: 1,
          failed: 0,
        }),
      });

      // Call import mutation
      result.current.mutate({
        files: mockFiles,
        clientId: 123,
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify fetch was called with correct payload
      expect(global.fetch).toHaveBeenCalledWith('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: mockFiles.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: 123,
        }),
      });

      scenario.cleanup();
    });

    it('should handle multiple files import', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'doc1.pdf', mimeType: 'application/pdf' },
        { id: 'file2', name: 'image1.jpg', mimeType: 'image/jpeg' },
        { id: 'file3', name: 'doc2.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ];

      // Mock successful import response
      scenario.mockFetch('/api/google-drive/import', {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: 3,
          failed: 0,
        }),
      });

      // Call import mutation
      result.current.mutate({
        files: mockFiles,
        clientId: 456,
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify all files were included
      expect(global.fetch).toHaveBeenCalledWith('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: mockFiles.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: 456,
        }),
      });

      scenario.cleanup();
    });

    it('should handle import errors gracefully', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'test.pdf', mimeType: 'application/pdf' },
      ];

      // Mock import error response
      scenario.mockFetch('/api/google-drive/import', {
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Import failed due to server error',
        }),
      });

      // Call import mutation
      result.current.mutate({
        files: mockFiles,
        clientId: 789,
      });

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Verify error was handled
      expect(global.fetch).toHaveBeenCalledWith('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: mockFiles.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: 789,
        }),
      });

      scenario.cleanup();
    });

    it('should validate clientId is always included', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'test.pdf', mimeType: 'application/pdf' },
      ];

      // Mock successful import response
      scenario.mockFetch('/api/google-drive/import', {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: 1,
          failed: 0,
        }),
      });

      // Test with different clientId values
      const testClientIds = [0, 123, 456, 789];

      for (const clientId of testClientIds) {
        result.current.mutate({
          files: mockFiles,
          clientId,
        });

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/google-drive/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: mockFiles.map(file => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
              })),
              clientId,
            }),
          });
        });

        // Clear mocks for next iteration
        jest.clearAllMocks();
        scenario.mockFetch('/api/google-drive/import', {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            imported: 1,
            failed: 0,
          }),
        });
      }

      scenario.cleanup();
    });
  });

  describe('Import Progress Tracking', () => {
    it('should track import progress during mutation', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'large-file.pdf', mimeType: 'application/pdf' },
      ];

      // Mock progress callback
      const onProgress = jest.fn();

      // Mock successful import response
      scenario.mockFetch('/api/google-drive/import', {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: 1,
          failed: 0,
        }),
      });

      // Call import mutation with progress callback
      result.current.mutate({
        files: mockFiles,
        clientId: 123,
        onProgress,
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify progress callback was called
      expect(onProgress).toHaveBeenCalled();

      scenario.cleanup();
    });

    it('should handle partial import failures', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveImportMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mockFiles = [
        { id: 'file1', name: 'good.pdf', mimeType: 'application/pdf' },
        { id: 'file2', name: 'bad.doc', mimeType: 'application/msword' },
      ];

      // Mock partial success response
      scenario.mockFetch('/api/google-drive/import', {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: 1,
          failed: 1,
          errors: ['bad.doc: File format not supported'],
        }),
      });

      // Call import mutation
      result.current.mutate({
        files: mockFiles,
        clientId: 123,
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify partial failure was handled
      expect(global.fetch).toHaveBeenCalledWith('/api/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: mockFiles.map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId: 123,
        }),
      });

      scenario.cleanup();
    });
  });
});