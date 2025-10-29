/**
 * Frontend permission checking utilities
 * Maps to backend permission logic in server/utils/asset-permissions.ts
 */
/**
 * Check what permissions the current user has for an asset
 */
export function checkAssetPermissions(userRole, userId, asset) {
    const isSuperAdmin = userRole === "super_admin";
    const isAdmin = userRole === "admin";
    const isEditor = userRole === "editor";
    const isOwner = asset.uploadedBy === userId;
    // Guest permissions
    if (userRole === "guest") {
        return {
            canRead: asset.visibility === "shared",
            canWrite: false,
            canDelete: false,
        };
    }
    // Standard user permissions
    if (userRole === "standard") {
        return {
            canRead: asset.visibility === "shared" || isOwner,
            canWrite: isOwner,
            canDelete: isOwner,
        };
    }
    // Editor permissions
    if (isEditor) {
        return {
            canRead: asset.visibility === "shared" || isOwner,
            canWrite: isOwner || asset.visibility === "shared", // Can edit shared assets
            canDelete: isOwner, // Cannot delete others' assets
        };
    }
    // Admin and Super Admin permissions
    if (isAdmin || isSuperAdmin) {
        return {
            canRead: true,
            canWrite: true,
            canDelete: true,
        };
    }
    // Default: no permissions
    return {
        canRead: false,
        canWrite: false,
        canDelete: false,
    };
}
/**
 * Check if user can upload assets
 */
export function canUploadAssets(userRole) {
    // Everyone except guests can upload
    return userRole !== "guest";
}
/**
 * Check if user can manage categories (admin-only)
 */
export function canManageCategories(userRole) {
    return userRole === "admin" || userRole === "super_admin";
}
/**
 * Check if user can create tags
 */
export function canCreateTags(userRole) {
    // Everyone except guests can create tags
    return userRole !== "guest";
}
/**
 * Check if user can delete a tag
 */
export function canDeleteTag(userRole, userId, tagCreatorId) {
    const isSuperAdmin = userRole === "super_admin";
    const isAdmin = userRole === "admin";
    const isCreator = tagCreatorId === userId;
    return isSuperAdmin || isAdmin || isCreator;
}
/**
 * Check if user can change asset visibility
 */
export function canChangeVisibility(userRole, userId, asset) {
    // Guests cannot change visibility
    if (userRole === "guest") {
        return false;
    }
    const isSuperAdmin = userRole === "super_admin";
    const isAdmin = userRole === "admin";
    const isOwner = asset.uploadedBy === userId;
    return isSuperAdmin || isAdmin || isOwner;
}
