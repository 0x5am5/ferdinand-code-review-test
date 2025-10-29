import { describe, expect, it } from "vitest";
import { autoSelectCategory, determineAssetCategory, findCategoryIdByName, getSupportedExtensionsForCategory, isSupportedFileType, } from "../asset-categorization";
describe("Asset Categorization", () => {
    // Mock categories for testing
    const mockCategories = [
        { id: 1, name: "Documents", slug: "documents" },
        { id: 2, name: "Spreadsheets", slug: "spreadsheets" },
        { id: 3, name: "Slide Decks", slug: "slide-decks" },
        { id: 4, name: "Design Assets", slug: "design-assets" },
        { id: 5, name: "Photography", slug: "photography" },
    ];
    describe("determineAssetCategory", () => {
        it("should categorize PDF files as Documents", () => {
            const file = new File(["content"], "test.pdf", {
                type: "application/pdf",
            });
            expect(determineAssetCategory(file)).toBe("Documents");
        });
        it("should categorize Word files as Documents", () => {
            const file = new File(["content"], "test.docx", {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            expect(determineAssetCategory(file)).toBe("Documents");
        });
        it("should categorize Excel files as Spreadsheets", () => {
            const file = new File(["content"], "test.xlsx", {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            expect(determineAssetCategory(file)).toBe("Spreadsheets");
        });
        it("should categorize PowerPoint files as Slide Decks", () => {
            const file = new File(["content"], "test.pptx", {
                type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            });
            expect(determineAssetCategory(file)).toBe("Slide Decks");
        });
        it("should categorize SVG files as Design Assets (prioritized over Photography)", () => {
            const file = new File(["content"], "test.svg", { type: "image/svg+xml" });
            expect(determineAssetCategory(file)).toBe("Design Assets");
        });
        it("should categorize Photoshop files as Design Assets", () => {
            const file = new File(["content"], "test.psd", {
                type: "image/vnd.adobe.photoshop",
            });
            expect(determineAssetCategory(file)).toBe("Design Assets");
        });
        it("should categorize JPEG files as Photography", () => {
            const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
            expect(determineAssetCategory(file)).toBe("Photography");
        });
        it("should categorize PNG files as Photography", () => {
            const file = new File(["content"], "test.png", { type: "image/png" });
            expect(determineAssetCategory(file)).toBe("Photography");
        });
        it("should fallback to file extension when MIME type is unknown", () => {
            const file = new File(["content"], "test.pdf", {
                type: "application/octet-stream",
            });
            expect(determineAssetCategory(file)).toBe("Documents");
        });
        it("should return null for unsupported file types", () => {
            const file = new File(["content"], "test.xyz", {
                type: "application/unknown",
            });
            expect(determineAssetCategory(file)).toBe(null);
        });
        it("should handle case insensitive file extensions", () => {
            const file = new File(["content"], "test.PDF", { type: "" });
            expect(determineAssetCategory(file)).toBe("Documents");
        });
    });
    describe("findCategoryIdByName", () => {
        it("should find category ID by name", () => {
            expect(findCategoryIdByName("Documents", mockCategories)).toBe(1);
            expect(findCategoryIdByName("Photography", mockCategories)).toBe(5);
        });
        it("should handle case insensitive matching", () => {
            expect(findCategoryIdByName("documents", mockCategories)).toBe(1);
            expect(findCategoryIdByName("PHOTOGRAPHY", mockCategories)).toBe(5);
        });
        it("should return null for unknown category", () => {
            expect(findCategoryIdByName("Unknown Category", mockCategories)).toBe(null);
        });
        it("should return null for null input", () => {
            expect(findCategoryIdByName(null, mockCategories)).toBe(null);
        });
    });
    describe("autoSelectCategory", () => {
        it("should automatically select the correct category ID", () => {
            const file = new File(["content"], "test.pdf", {
                type: "application/pdf",
            });
            expect(autoSelectCategory(file, mockCategories)).toBe(1);
        });
        it("should return null for unsupported file types", () => {
            const file = new File(["content"], "test.xyz", {
                type: "application/unknown",
            });
            expect(autoSelectCategory(file, mockCategories)).toBe(null);
        });
    });
    describe("getSupportedExtensionsForCategory", () => {
        it("should return all extensions for Documents", () => {
            const extensions = getSupportedExtensionsForCategory("Documents");
            expect(extensions).toContain(".pdf");
            expect(extensions).toContain(".doc");
            expect(extensions).toContain(".docx");
            expect(extensions).toContain(".txt");
        });
        it("should return all extensions for Photography", () => {
            const extensions = getSupportedExtensionsForCategory("Photography");
            expect(extensions).toContain(".jpg");
            expect(extensions).toContain(".jpeg");
            expect(extensions).toContain(".png");
            expect(extensions).toContain(".gif");
        });
        it("should return all extensions for Design Assets", () => {
            const extensions = getSupportedExtensionsForCategory("Design Assets");
            expect(extensions).toContain(".svg");
            expect(extensions).toContain(".psd");
            expect(extensions).toContain(".ai");
        });
    });
    describe("isSupportedFileType", () => {
        it("should return true for supported file types", () => {
            const pdfFile = new File(["content"], "test.pdf", {
                type: "application/pdf",
            });
            expect(isSupportedFileType(pdfFile)).toBe(true);
            const jpgFile = new File(["content"], "test.jpg", { type: "image/jpeg" });
            expect(isSupportedFileType(jpgFile)).toBe(true);
        });
        it("should return false for unsupported file types", () => {
            const file = new File(["content"], "test.xyz", {
                type: "application/unknown",
            });
            expect(isSupportedFileType(file)).toBe(false);
        });
    });
});
