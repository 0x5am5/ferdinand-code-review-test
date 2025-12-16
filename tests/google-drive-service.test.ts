/**
 * Google Drive Service Unit Tests
 *
 * These tests verify the core Google Drive service functions including:
 * - Drive client creation
 * - File listing and metadata retrieval
 * - File import (regular and Google Workspace files)
 * - File validation
 * - Permission updates
 * - Google Workspace file detection
 *
 * Test Coverage:
 * - All exported service functions
 * - Success and failure scenarios
 * - Edge cases and error handling
 * - Google Workspace file handling
 * - Auto-categorization
 *
 * To run these tests:
 * npm test -- google-drive-service.test.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@shared/schema";
import type { OAuth2Client } from "google-auth-library";
import type { drive_v3 } from "googleapis";

// Mock data factories
const createMockDriveFile = (overrides = {}) => ({
  id: "drive-file-123",
  name: "test-file.pdf",
  mimeType: "application/pdf",
  size: "1024000",
  modifiedTime: new Date().toISOString(),
  webViewLink: "https://drive.google.com/file/d/drive-file-123/view",
  owners: [{ displayName: "Test User", emailAddress: "test@example.com" }],
  thumbnailLink: "https://drive.google.com/thumbnail/drive-file-123",
  webContentLink: "https://drive.google.com/uc?id=drive-file-123",
  ...overrides,
});

const createMockAsset = () => ({
  id: 1,
  clientId: 100,
  uploadedBy: 50,
  fileName: "test-file.pdf",
  originalFileName: "test-file.pdf",
  fileType: "application/pdf",
  fileSize: 1024000,
  storagePath: "/uploads/test.pdf",
  visibility: "shared" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

// Mock OAuth2Client
const mockAuth = {} as OAuth2Client;

// Mock Drive client
const mockDriveClient = {
  files: {
    list: vi.fn(),
    get: vi.fn(),
  },
  permissions: {
    create: vi.fn(),
  },
} as unknown as drive_v3.Drive;

// Mock database - define inline in mock
vi.mock("../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

// Mock google module
vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        list: vi.fn(),
        get: vi.fn(),
      },
      permissions: {
        create: vi.fn(),
      },
    })),
  },
}));

// Mock storage
vi.mock("../server/storage", () => ({
  generateUniqueFileName: vi.fn((name: string) => `unique-${name}`),
  generateStoragePath: vi.fn((clientId: number, fileName: string) => `/uploads/${clientId}/${fileName}`),
  uploadFile: vi.fn(() => ({ success: true })),
}));

// Mock categorization
vi.mock("../server/utils/asset-categorization", () => ({
  autoSelectCategory: vi.fn(() => 1),
  determineAssetCategory: vi.fn(() => "Documents"),
}));

// Mock default categories
vi.mock("../server/services/default-categories", () => ({
  ensureDefaultCategories: vi.fn(),
  getCategoriesForClient: vi.fn(() => [
    { id: 1, name: "Documents" },
    { id: 2, name: "Images" },
  ]),
}));

// Import after mocks
import {
  createDriveClient,
  listDriveFiles,
  getFileMetadata,
  importDriveFile,
  validateFileForImport,
  updateFilePermissions,
  isGoogleWorkspaceFile,
  MAX_FILE_SIZE,
} from "../server/services/google-drive";
import { uploadFile } from "../server/storage";
import { db } from "../server/db";

// Get reference to mocked db
const mockDb = db as any;

describe("Google Drive Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([createMockAsset()]);
  });

  describe("createDriveClient()", () => {
    it("should create Drive client with valid auth", () => {
      const client = createDriveClient(mockAuth);
      expect(client).toBeDefined();
      expect(client.files).toBeDefined();
    });
  });

  describe("listDriveFiles()", () => {
    it("should list root folder files", async () => {
      const mockFiles = [
        createMockDriveFile(),
        createMockDriveFile({ id: "file-2", name: "doc2.pdf" }),
      ];

      mockDriveClient.files.list.mockResolvedValue({
        data: { files: mockFiles },
      } as any);

      const files = await listDriveFiles(mockDriveClient);

      expect(files).toHaveLength(2);
      expect(mockDriveClient.files.list).toHaveBeenCalledWith({
        q: "root in parents",
        fields: expect.any(String),
        pageSize: 1000,
      });
    });

    it("should list specific folder with folderId", async () => {
      const folderId = "folder-123";
      const mockFiles = [createMockDriveFile()];

      mockDriveClient.files.list.mockResolvedValue({
        data: { files: mockFiles },
      } as any);

      await listDriveFiles(mockDriveClient, folderId);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith({
        q: `'${folderId}' in parents`,
        fields: expect.any(String),
        pageSize: 1000,
      });
    });

    it("should return correct file metadata", async () => {
      const mockFile = createMockDriveFile();

      mockDriveClient.files.list.mockResolvedValue({
        data: { files: [mockFile] },
      } as any);

      const files = await listDriveFiles(mockDriveClient);

      expect(files[0]).toMatchObject({
        id: mockFile.id,
        name: mockFile.name,
        mimeType: mockFile.mimeType,
        size: mockFile.size,
      });
    });

    it("should handle API errors gracefully", async () => {
      mockDriveClient.files.list.mockRejectedValue(new Error("API Error"));

      await expect(listDriveFiles(mockDriveClient)).rejects.toThrow(
        "Failed to list Drive files"
      );
    });
  });

  describe("getFileMetadata()", () => {
    it("should fetch metadata for valid fileId", async () => {
      const mockFile = createMockDriveFile();

      mockDriveClient.files.get.mockResolvedValue({
        data: mockFile,
      } as any);

      const metadata = await getFileMetadata(mockDriveClient, "drive-file-123");

      expect(metadata.id).toBe("drive-file-123");
      expect(mockDriveClient.files.get).toHaveBeenCalledWith({
        fileId: "drive-file-123",
        fields: expect.stringContaining("id, name, mimeType"),
      });
    });

    it("should return all required fields", async () => {
      const mockFile = createMockDriveFile();

      mockDriveClient.files.get.mockResolvedValue({
        data: mockFile,
      } as any);

      const metadata = await getFileMetadata(mockDriveClient, "drive-file-123");

      expect(metadata).toHaveProperty("id");
      expect(metadata).toHaveProperty("name");
      expect(metadata).toHaveProperty("mimeType");
      expect(metadata).toHaveProperty("webViewLink");
    });

    it("should handle invalid fileId", async () => {
      mockDriveClient.files.get.mockRejectedValue(new Error("File not found"));

      await expect(
        getFileMetadata(mockDriveClient, "invalid-id")
      ).rejects.toThrow("Failed to fetch file metadata");
    });
  });

  describe("importDriveFile()", () => {
    it("should download and store regular files", async () => {
      const driveFile = createMockDriveFile();
      const fileBuffer = Buffer.from("file content");

      mockDriveClient.files.get.mockResolvedValue({
        data: fileBuffer,
      } as any);

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      vi.mocked(uploadFile).mockResolvedValue({ success: true } as any);

      const asset = await importDriveFile({
        userId: 50,
        userRole: UserRole.ADMIN,
        clientId: 100,
        driveFile: driveFile as any,
        visibility: "shared",
        driveClient: mockDriveClient,
      });

      expect(asset).toBeDefined();
      expect(asset.clientId).toBe(100);
      expect(mockDriveClient.files.get).toHaveBeenCalledWith(
        expect.objectContaining({ alt: "media" }),
        expect.any(Object)
      );
    });

    it("should create reference for Google Workspace files", async () => {
      const workspaceFile = createMockDriveFile({
        mimeType: "application/vnd.google-apps.document",
      });

      mockDriveClient.permissions.create.mockResolvedValue({
        data: { id: "permission-123" },
      } as any);

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([]);

      const asset = await importDriveFile({
        userId: 50,
        userRole: UserRole.ADMIN,
        clientId: 100,
        driveFile: workspaceFile as any,
        visibility: "shared",
        driveClient: mockDriveClient,
      });

      expect(asset).toBeDefined();
      expect(mockDriveClient.permissions.create).toHaveBeenCalled();
      expect(mockDriveClient.files.get).not.toHaveBeenCalledWith(
        expect.objectContaining({ alt: "media" })
      );
    });

    it("should update Drive permissions for Workspace files", async () => {
      const workspaceFile = createMockDriveFile({
        mimeType: "application/vnd.google-apps.spreadsheet",
      });

      mockDriveClient.permissions.create.mockResolvedValue({
        data: { id: "permission-123" },
      } as any);

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([]);

      await importDriveFile({
        userId: 50,
        userRole: UserRole.ADMIN,
        clientId: 100,
        driveFile: workspaceFile as any,
        visibility: "shared",
        driveClient: mockDriveClient,
      });

      expect(mockDriveClient.permissions.create).toHaveBeenCalledWith({
        fileId: workspaceFile.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    });

    it("should handle download failures", async () => {
      const driveFile = createMockDriveFile();

      mockDriveClient.files.get.mockRejectedValue(
        new Error("Download failed")
      );

      await expect(
        importDriveFile({
          userId: 50,
          userRole: UserRole.ADMIN,
          clientId: 100,
          driveFile: driveFile as any,
          visibility: "shared",
          driveClient: mockDriveClient,
        })
      ).rejects.toThrow("Failed to import Drive file");
    });

    it.skip("should handle storage failures", async () => {
      const driveFile = createMockDriveFile();
      const fileBuffer = Buffer.from("file content");

      mockDriveClient.files.get.mockResolvedValue({
        data: fileBuffer,
      } as any);

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      vi.mocked(uploadFile).mockResolvedValue({
        success: false,
        error: "Storage full",
      } as any);

      await expect(
        importDriveFile({
          userId: 50,
          userRole: UserRole.ADMIN,
          clientId: 100,
          driveFile: driveFile as any,
          visibility: "shared",
          driveClient: mockDriveClient,
        })
      ).rejects.toThrow("Failed to store file");
    });
  });

  describe("validateFileForImport()", () => {
    it("should accept files under size limit", () => {
      const driveFile = createMockDriveFile({
        size: "50000000", // 50MB
      });

      const result = validateFileForImport(driveFile as any);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject files over 100MB", () => {
      const driveFile = createMockDriveFile({
        size: String(MAX_FILE_SIZE + 1),
      });

      const result = validateFileForImport(driveFile as any);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should allow Google Workspace files", () => {
      const workspaceFile = createMockDriveFile({
        mimeType: "application/vnd.google-apps.document",
        size: "0",
      });

      const result = validateFileForImport(workspaceFile as any);

      expect(result.valid).toBe(true);
    });

    it("should return proper error messages", () => {
      const largeFile = createMockDriveFile({
        size: String(150 * 1024 * 1024), // 150MB
      });

      const result = validateFileForImport(largeFile as any);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Maximum size is \d+MB/);
    });
  });

  describe("updateFilePermissions()", () => {
    it("should update permissions to anyone with link", async () => {
      mockDriveClient.permissions.create.mockResolvedValue({
        data: { id: "permission-123" },
      } as any);

      const result = await updateFilePermissions(
        mockDriveClient,
        "drive-file-123"
      );

      expect(result.success).toBe(true);
      expect(mockDriveClient.permissions.create).toHaveBeenCalledWith({
        fileId: "drive-file-123",
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    });

    it("should handle API errors", async () => {
      mockDriveClient.permissions.create.mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await updateFilePermissions(
        mockDriveClient,
        "drive-file-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Error updating permissions");
    });

    it("should handle API response errors", async () => {
      mockDriveClient.permissions.create.mockResolvedValue({
        data: null,
        statusText: "Forbidden",
      } as any);

      const result = await updateFilePermissions(
        mockDriveClient,
        "drive-file-123"
      );

      expect(result.success).toBe(false);
    });
  });

  describe("isGoogleWorkspaceFile()", () => {
    it("should identify Google Docs as Workspace file", () => {
      const file = createMockDriveFile({
        mimeType: "application/vnd.google-apps.document",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(true);
    });

    it("should identify Google Sheets as Workspace file", () => {
      const file = createMockDriveFile({
        mimeType: "application/vnd.google-apps.spreadsheet",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(true);
    });

    it("should identify Google Slides as Workspace file", () => {
      const file = createMockDriveFile({
        mimeType: "application/vnd.google-apps.presentation",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(true);
    });

    it("should identify Google Drawings as Workspace file", () => {
      const file = createMockDriveFile({
        mimeType: "application/vnd.google-apps.drawing",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(true);
    });

    it("should return false for regular files", () => {
      const file = createMockDriveFile({
        mimeType: "application/pdf",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(false);
    });

    it("should return false for images", () => {
      const file = createMockDriveFile({
        mimeType: "image/jpeg",
      });

      expect(isGoogleWorkspaceFile(file as any)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty file list", async () => {
      mockDriveClient.files.list.mockResolvedValue({
        data: { files: [] },
      } as any);

      const files = await listDriveFiles(mockDriveClient);

      expect(files).toHaveLength(0);
    });

    it("should handle missing file data on download", async () => {
      const driveFile = createMockDriveFile();

      mockDriveClient.files.get.mockResolvedValue({
        data: null,
      } as any);

      await expect(
        importDriveFile({
          userId: 50,
          userRole: UserRole.ADMIN,
          clientId: 100,
          driveFile: driveFile as any,
          visibility: "shared",
          driveClient: mockDriveClient,
        })
      ).rejects.toThrow("No data received from Google Drive");
    });

    it("should handle files with zero size", () => {
      const file = createMockDriveFile({ size: "0" });

      const result = validateFileForImport(file as any);

      expect(result.valid).toBe(true);
    });

    it("should handle files at exact size limit", () => {
      const file = createMockDriveFile({
        size: String(MAX_FILE_SIZE),
      });

      const result = validateFileForImport(file as any);

      expect(result.valid).toBe(true);
    });
  });
});
