/**
 * Server-side utility functions for automatic asset categorization based on file types
 */
// File type to category mapping
const FILE_TYPE_CATEGORIES = {
    // Documents
    "application/pdf": "Documents",
    "application/msword": "Documents",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documents",
    "text/plain": "Documents",
    "text/rtf": "Documents",
    "application/rtf": "Documents",
    // Spreadsheets
    "application/vnd.ms-excel": "Spreadsheets",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Spreadsheets",
    "text/csv": "Spreadsheets",
    // Slide Decks
    "application/vnd.ms-powerpoint": "Slide Decks",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Slide Decks",
    // Design Assets (prioritized over Photography for ambiguous types)
    "application/illustrator": "Design Assets",
    "application/vnd.adobe.illustrator": "Design Assets",
    "application/x-illustrator": "Design Assets",
    "image/svg+xml": "Design Assets", // SVG prioritized as Design Asset
    "application/x-photoshop": "Design Assets",
    "application/photoshop": "Design Assets",
    "application/x-sketch": "Design Assets",
    "application/figma": "Design Assets",
    "application/eps": "Design Assets",
    "application/postscript": "Design Assets",
    "application/x-eps": "Design Assets",
    // Photography
    "image/jpeg": "Photography",
    "image/jpg": "Photography",
    "image/png": "Photography",
    "image/gif": "Photography",
    "image/webp": "Photography",
    "image/tiff": "Photography",
    "image/bmp": "Photography",
};
// File extension to category mapping (fallback for MIME types)
const FILE_EXTENSION_CATEGORIES = {
    // Documents
    ".pdf": "Documents",
    ".doc": "Documents",
    ".docx": "Documents",
    ".txt": "Documents",
    ".rtf": "Documents",
    // Spreadsheets
    ".xls": "Spreadsheets",
    ".xlsx": "Spreadsheets",
    ".csv": "Spreadsheets",
    // Slide Decks
    ".ppt": "Slide Decks",
    ".pptx": "Slide Decks",
    // Design Assets
    ".ai": "Design Assets",
    ".svg": "Design Assets", // SVG prioritized as Design Asset
    ".psd": "Design Assets",
    ".sketch": "Design Assets",
    ".fig": "Design Assets",
    ".eps": "Design Assets",
    // Photography
    ".jpg": "Photography",
    ".jpeg": "Photography",
    ".png": "Photography",
    ".gif": "Photography",
    ".webp": "Photography",
    ".tiff": "Photography",
    ".bmp": "Photography",
};
/**
 * Determines the appropriate category for a file based on its MIME type and extension
 * @param fileName - The file name to categorize
 * @param mimeType - The MIME type of the file
 * @returns The determined category or null if unable to categorize
 */
export function determineAssetCategory(fileName, mimeType) {
    // First try MIME type
    const normalizedMimeType = mimeType.toLowerCase();
    if (normalizedMimeType &&
        FILE_TYPE_CATEGORIES[normalizedMimeType]) {
        return FILE_TYPE_CATEGORIES[normalizedMimeType];
    }
    // Fallback to file extension
    const normalizedFileName = fileName.toLowerCase();
    const extension = normalizedFileName.substring(normalizedFileName.lastIndexOf("."));
    if (extension &&
        FILE_EXTENSION_CATEGORIES[extension]) {
        return FILE_EXTENSION_CATEGORIES[extension];
    }
    return null; // Unable to categorize
}
/**
 * Finds the category ID that matches the determined category name
 * @param categoryName - The name of the category to find
 * @param categories - Available categories from the system
 * @returns The category ID or null if not found
 */
export function findCategoryIdByName(categoryName, categories) {
    if (!categoryName)
        return null;
    const category = categories.find((cat) => cat.name.toLowerCase() === categoryName.toLowerCase());
    return category?.id || null;
}
/**
 * Automatically selects the appropriate category for a file
 * @param fileName - The file name to categorize
 * @param mimeType - The MIME type of the file
 * @param categories - Available categories from the system
 * @returns The category ID or null if unable to categorize
 */
export function autoSelectCategory(fileName, mimeType, categories) {
    const categoryName = determineAssetCategory(fileName, mimeType);
    return findCategoryIdByName(categoryName, categories);
}
/**
 * Gets a human-readable description of why a file was categorized a certain way
 * @param fileName - The file name that was categorized
 * @param mimeType - The MIME type of the file
 * @returns Description of the categorization logic
 */
export function getCategorizationReason(fileName, mimeType) {
    const normalizedMimeType = mimeType.toLowerCase();
    const normalizedFileName = fileName.toLowerCase();
    const extension = normalizedFileName.substring(normalizedFileName.lastIndexOf("."));
    // Check MIME type first
    if (normalizedMimeType &&
        FILE_TYPE_CATEGORIES[normalizedMimeType]) {
        return `Automatically categorized by MIME type: ${normalizedMimeType}`;
    }
    // Check file extension
    if (extension &&
        FILE_EXTENSION_CATEGORIES[extension]) {
        return `Automatically categorized by file extension: ${extension}`;
    }
    return "File type not recognized for automatic categorization";
}
/**
 * Checks if a file type is supported for automatic categorization
 * @param fileName - The file name to check
 * @param mimeType - The MIME type of the file
 * @returns True if the file can be automatically categorized
 */
export function isSupportedFileType(fileName, mimeType) {
    return determineAssetCategory(fileName, mimeType) !== null;
}
