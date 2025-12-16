import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import type { MockedFunction } from 'vitest';
import {
  apiRequest,
  brandAssetApi,
  sectionMetadataApi,
  type SectionMetadata,
} from "../../client/src/lib/api";

// Mock fetch globally
global.fetch = vi.fn() as MockedFunction<typeof fetch>;

describe("apiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("should make a GET request with correct parameters", async () => {
      const mockResponse = { data: "test" };
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await apiRequest("GET", "/api/test");

      expect(global.fetch).toHaveBeenCalledWith("/api/test", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      expect(result).toEqual(mockResponse);
    });

    it("should make a POST request with body", async () => {
      const mockResponse = { id: 1 };
      const requestData = { name: "test" };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await apiRequest("POST", "/api/test", requestData);

      expect(global.fetch).toHaveBeenCalledWith("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestData),
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle 204 No Content responses", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        })
      );

      const result = await apiRequest("DELETE", "/api/test/1");

      expect(result).toBeNull();
    });

    it("should handle empty response bodies", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response("", {
          status: 200,
          headers: { "Content-Length": "0" },
        })
      );

      const result = await apiRequest("GET", "/api/test");

      expect(result).toBeNull();
    });

    it("should respect custom credentials option", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await apiRequest("GET", "/api/test", undefined, {
        credentials: "omit",
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/test", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
      });
    });
  });

  describe("error handling", () => {
    it("should throw error with message from JSON response", async () => {
      const errorResponse = { message: "Custom error message" };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(apiRequest("GET", "/api/test")).rejects.toThrow(
        "Custom error message"
      );
    });

    it("should throw default error when JSON parsing fails", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response("not json", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
      );

      await expect(apiRequest("GET", "/api/test")).rejects.toThrow(
        "HTTP error! status: 500"
      );
    });

    it("should throw error for invalid JSON in successful response", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response("invalid json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(apiRequest("GET", "/api/test")).rejects.toThrow(
        /Invalid JSON response/
      );
    });
  });
});

describe("sectionMetadataApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should fetch section metadata for a client", async () => {
      const mockMetadata: SectionMetadata[] = [
        { sectionType: "logo-primary", description: "Primary logo" },
        { sectionType: "brand-fonts", description: "Brand fonts" },
      ];

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockMetadata), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await sectionMetadataApi.list(123);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/section-metadata",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
      expect(result).toEqual(mockMetadata);
    });
  });

  describe("update", () => {
    it("should update section metadata", async () => {
      const mockResponse = {
        sectionType: "logo-primary",
        description: "Updated description",
      };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await sectionMetadataApi.update(
        123,
        "logo-primary",
        "Updated description"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/section-metadata/logo-primary",
        expect.objectContaining({
          method: "PUT",
          credentials: "include",
          body: JSON.stringify({ description: "Updated description" }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });
});

describe("brandAssetApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateDescription", () => {
    it("should update brand asset description", async () => {
      const mockResponse = {
        id: 456,
        description: "New description",
      };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await brandAssetApi.updateDescription(
        123,
        456,
        "New description"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/brand-assets/456/description",
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({ description: "New description" }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle errors when updating description", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Permission denied" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(
        brandAssetApi.updateDescription(123, 456, "New description")
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("delete", () => {
    it("should delete brand asset without variant", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        })
      );

      const result = await brandAssetApi.delete(123, 456);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/brand-assets/456",
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
        })
      );
      expect(result).toBeNull();
    });

    it("should delete brand asset light variant", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        })
      );

      await brandAssetApi.delete(123, 456, "light");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/brand-assets/456",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should delete brand asset dark variant with query parameter", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        })
      );

      await brandAssetApi.delete(123, 456, "dark");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clients/123/brand-assets/456?variant=dark",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should handle errors when deleting asset", async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Asset not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(brandAssetApi.delete(123, 456)).rejects.toThrow(
        "Asset not found"
      );
    });
  });
});
