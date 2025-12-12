/**
 * Google Drive Security Validation Tests
 *
 * These tests verify security measures for Google Drive imports including:
 * - File size and type validation
 * - Rate limiting enforcement
 * - SSE data leak prevention
 * - Access token security
 * - CORS security
 * - Audit logging verification
 * - Permission validation
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const request = require('supertest');
const { db } = require('../../server/db');
const { 
  users, 
  googleDriveConnections, 
  userClients,
  clients,
  assets,
  UserRole 
} = require('../../shared/schema');
const { app } = require('../../server');

let superAdminUser;
let regularUser;
let testClient;
let unauthorizedClient;
let superAdminAuth;
let regularUserAuth;

beforeEach(async () => {
  // Create test users
  [superAdminUser] = await db.insert(users).values({
    email: "super-admin@test.com",
    name: "Super Admin",
    role: UserRole.SUPER_ADMIN,
  }).returning();

  [regularUser] = await db.insert(users).values({
    email: "regular@test.com", 
    name: "Regular User",
    role: UserRole.ADMIN,
  }).returning();

  // Create test clients
  [testClient] = await db.insert(clients).values({
    name: "Test Client",
    description: "Test client for security validation",
  }).returning();

  [unauthorizedClient] = await db.insert(clients).values({
    name: "Unauthorized Client",
    description: "Client user should not access",
  }).returning();

  // Grant regular user access to test client only
  await db.insert(userClients).values({
    userId: regularUser.id,
    clientId: testClient.id,
  });

  // Create mock sessions
  const session = require("express-session")();
  superAdminAuth = { session: { userId: superAdminUser.id } };
  regularUserAuth = { session: { userId: regularUser.id } };
});

afterEach(async () => {
  // Clean up test data
  await db.delete(assets);
  await db.delete(googleDriveConnections);
  await db.delete(userClients);
  await db.delete(clients);
  await db.delete(users);
});

describe("Google Drive Security Validation", () => {
  describe("File Size Validation", () => {
    it("should reject files exceeding 100MB limit", async () => {
      const oversizedFile = {
        id: "test-file-id",
        name: "oversized-file.pdf",
        mimeType: "application/pdf",
        size: (150 * 1024 * 1024).toString(), // 150MB
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [oversizedFile],
          clientId: testClient.id,
        });

      expect(response.status).toBe(500);
      expect(response.text).toContain("File too large");
    });

    it("should accept files within 100MB limit", async () => {
      const validFile = {
        id: "test-file-id",
        name: "valid-file.pdf",
        mimeType: "application/pdf",
        size: (50 * 1024 * 1024).toString(), // 50MB
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      // Mock successful Google Drive download
      const mockDriveClient = {
        files: {
          get: vi.fn().mockResolvedValue({
            data: Buffer.alloc(50 * 1024 * 1024) // 50MB buffer
          })
        }
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: testClient.id,
        });

      // Should not fail due to file size
      expect(response.status).not.toBe(500);
    });
  });

  describe("MIME Type Validation", () => {
    it("should reject Google Workspace files", async () => {
      const googleDocFile = {
        id: "test-doc-id",
        name: "document.gdoc",
        mimeType: "application/vnd.google-apps.document",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [googleDocFile],
          clientId: testClient.id,
        });

      expect(response.status).toBe(500);
      expect(response.text).toContain("Google Workspace files");
    });

    it("should reject disallowed MIME types", async () => {
      const executableFile = {
        id: "test-exe-id",
        name: "malware.exe",
        mimeType: "application/x-executable",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [executableFile],
          clientId: testClient.id,
        });

      expect(response.status).toBe(500);
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce import rate limit", async () => {
      const validFile = {
        id: "test-file-id",
        name: "test.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      // Make 51 requests (exceeds 50/hour limit)
      const promises = Array(51).fill(null).map(() =>
        request(app)
          .post("/api/google-drive/import")
          .set(superAdminAuth)
          .send({
            files: [validFile],
            clientId: testClient.id,
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it("should include rate limit headers", async () => {
      const validFile = {
        id: "test-file-id",
        name: "test.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: testClient.id,
        });

      expect(response.headers).toHaveProperty("x-ratelimit-limit");
      expect(response.headers).toHaveProperty("x-ratelimit-remaining");
    });
  });

  describe("SSE Data Leak Prevention", () => {
    it("should not expose sensitive file paths in SSE", async () => {
      const validFile = {
        id: "test-file-id",
        name: "sensitive-document.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: testClient.id,
        });

      // Check that SSE response doesn't expose internal paths
      expect(response.text).not.toContain("/storage/");
      expect(response.text).not.toContain("internal");
    });

    it("should sanitize error messages in SSE", async () => {
      const fileWithSystemError = {
        id: "test-file-id",
        name: "error-trigger.txt",
        mimeType: "text/plain",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [fileWithSystemError],
          clientId: testClient.id,
        });

      // Error messages should be sanitized
      expect(response.text).not.toContain("internal server error");
      expect(response.text).not.toContain("stack trace");
      expect(response.text).not.toContain("database");
    });
  });

  describe("Access Token Security", () => {
    it("should not expose raw tokens in responses", async () => {
      // Mock Google Drive connection
      await db.insert(googleDriveConnections).values({
        userId: superAdminUser.id,
        encryptedAccessToken: "encrypted-token",
        encryptedRefreshToken: "encrypted-refresh",
        tokenExpiresAt: new Date(Date.now() + 3600000),
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });

      const response = await request(app)
        .get("/api/google-drive/token")
        .set(superAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("refreshToken");
      expect(response.body).not.toHaveProperty("encryptedAccessToken");
    });

    it("should limit token exposure in connection status", async () => {
      // Mock Google Drive connection
      await db.insert(googleDriveConnections).values({
        userId: superAdminUser.id,
        encryptedAccessToken: "encrypted-token",
        encryptedRefreshToken: "encrypted-refresh", 
        tokenExpiresAt: new Date(Date.now() + 3600000),
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });

      const response = await request(app)
        .get("/api/google-drive/status")
        .set(superAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("encryptedAccessToken");
      expect(response.body).not.toHaveProperty("encryptedRefreshToken");
    });
  });

  describe("CORS Security", () => {
    it("should not use wildcard CORS for SSE endpoints", async () => {
      const validFile = {
        id: "test-file-id",
        name: "test.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: testClient.id,
        });

      // Check that CORS is properly restricted
      expect(response.headers["access-control-allow-origin"]).not.toBe("*");
    });
  });

  describe("Audit Logging", () => {
    it("should record correct uploader userId", async () => {
      const validFile = {
        id: "test-file-id",
        name: "audit-test.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      // Mock successful import
      const mockAsset = {
        id: 123,
        uploadedBy: superAdminUser.id,
        fileName: "audit-test.pdf",
        originalFileName: "audit-test.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        storagePath: "/test/path",
        visibility: "shared",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database insert to capture audit data
      const originalInsert = db.insert;
      let capturedData = null;
      
      (db.insert) = vi.fn().mockImplementation((table) => ({
        values: vi.fn().mockImplementation((data) => {
          capturedData = data;
          return {
            returning: vi.fn().mockResolvedValue([mockAsset])
          };
        })
      }));

      await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: testClient.id,
        });

      // Restore original function
      db.insert = originalInsert;

      expect(capturedData).toHaveProperty("uploadedBy", superAdminUser.id);
      expect(capturedData.uploadedBy).toBe(superAdminUser.id);
    });

    it("should log import failures for audit trail", async () => {
      const invalidFile = {
        id: "test-file-id",
        name: "failure-test.exe",
        mimeType: "application/x-executable",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      // Mock console.error to capture audit logs
      const originalConsoleError = console.error;
      let capturedError = null;
      
      console.error = vi.fn().mockImplementation((...args) => {
        capturedError = args;
      });

      await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [invalidFile],
          clientId: testClient.id,
        });

      // Restore original console.error
      console.error = originalConsoleError;

      expect(capturedError).not.toBeNull();
      expect(capturedError[0]).toContain("Failed to import file");
      expect(capturedError[0]).toContain("failure-test.exe");
    });
  });

  describe("Permission Validation", () => {
    it("should prevent unauthorized client access", async () => {
      const validFile = {
        id: "test-file-id",
        name: "unauthorized.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(regularUserAuth)
        .send({
          files: [validFile],
          clientId: unauthorizedClient.id, // User doesn't have access
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Not authorized for this client");
    });

    it("should allow super admin to bypass client restrictions", async () => {
      const validFile = {
        id: "test-file-id", 
        name: "admin-bypass.pdf",
        mimeType: "application/pdf",
        size: "1024",
        modifiedTime: "2023-01-01T00:00:00.000Z",
        webViewLink: "https://drive.google.com/file/d/test",
      };

      const response = await request(app)
        .post("/api/google-drive/import")
        .set(superAdminAuth)
        .send({
          files: [validFile],
          clientId: unauthorizedClient.id, // Super admin should access any client
        });

      // Should not be blocked by client permissions
      expect(response.status).not.toBe(403);
    });
  });
});