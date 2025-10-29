/**
 * Utility functions for automatic asset categorization based on file types
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
 * @param file - The file to categorize
 * @returns The determined category or null if unable to categorize
 */
export function determineAssetCategory(file) {
    // First try MIME type
    const mimeType = file.type.toLowerCase();
    if (mimeType &&
        FILE_TYPE_CATEGORIES[mimeType]) {
        return FILE_TYPE_CATEGORIES[mimeType];
    }
    // Fallback to file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.substring(fileName.lastIndexOf("."));
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
 * @param file - The file to categorize
 * @param categories - Available categories from the system
 * @returns The category ID or null if unable to categorize
 */
export function autoSelectCategory(file, categories) {
    const categoryName = determineAssetCategory(file);
    return findCategoryIdByName(categoryName, categories);
}
/**
 * Gets all supported file extensions for a given category
 * @param category - The category to get extensions for
 * @returns Array of file extensions for the category
 */
export function getSupportedExtensionsForCategory(category) {
    const extensions = [];
    Object.entries(FILE_EXTENSION_CATEGORIES).forEach(([ext, cat]) => {
        if (cat === category) {
            extensions.push(ext);
        }
    });
    return extensions;
}
/**
 * Checks if a file type is supported for automatic categorization
 * @param file - The file to check
 * @returns True if the file can be automatically categorized
 */
export function isSupportedFileType(file) {
    return determineAssetCategory(file) !== null;
}
/**
 * Gets a human-readable description of why a file was categorized a certain way
 * @param file - The file that was categorized
 * @returns Description of the categorization logic
 */
export function getCategorizationReason(file) {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const extension = fileName.substring(fileName.lastIndexOf("."));
    // Check MIME type first
    if (mimeType &&
        FILE_TYPE_CATEGORIES[mimeType]) {
        return `Automatically categorized by MIME type: ${mimeType}`;
    }
    // Check file extension
    if (extension &&
        FILE_EXTENSION_CATEGORIES[extension]) {
        return `Automatically categorized by file extension: ${extension}`;
    }
    return "File type not recognized for automatic categorization";
}
/**
 * Validates if a file extension is supported by the system
 * @param extension - The file extension to check (with or without dot)
 * @returns True if the extension is supported
 */
export function isSupportedExtension(extension) {
    const normalizedExt = extension.startsWith(".") ? extension : `.${extension}`;
    return normalizedExt.toLowerCase() in FILE_EXTENSION_CATEGORIES;
}
/**
 * Gets all supported file extensions across all categories
 * @returns Array of all supported file extensions
 */
export function getAllSupportedExtensions() {
    return Object.keys(FILE_EXTENSION_CATEGORIES);
}
/**
 * Checks if a category name is valid in the system
 * @param categoryName - The category name to validate
 * @returns True if the category is valid
 */
export function isValidCategory(categoryName) {
    const validCategories = [
        "Documents",
        "Spreadsheets",
        "Slide Decks",
        "Design Assets",
        "Photography",
    ];
    return validCategories.includes(categoryName);
}
