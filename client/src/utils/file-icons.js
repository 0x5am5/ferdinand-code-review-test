import React from "react";
import { ExternalLink, FileIcon, ImageIcon } from "lucide-react";
const sizeClasses = {
    sm: { icon: "h-5 w-5", badge: "h-3 w-3" },
    md: { icon: "h-8 w-8", badge: "h-3 w-3" },
    lg: { icon: "h-16 w-16", badge: "h-4 w-4" },
};
/**
 * Get the appropriate icon for a file type with optional reference badge
 * @param fileType MIME type of the file
 * @param referenceOnly Whether this is a reference-only asset
 * @param size Icon size: sm (h-5 w-5), md (h-8 w-8), lg (h-16 w-16)
 * @returns React element with the appropriate icon
 */
export const getFileTypeIcon = (fileType, referenceOnly, size = "md") => {
    const { icon: iconClass, badge: badgeClass } = sizeClasses[size];
    if (fileType?.startsWith("image/")) {
        return React.createElement(ImageIcon, {
            className: `${iconClass} text-blue-500`,
        });
    }
    // Google Workspace file type icons with special styling for reference-only
    if (fileType === "application/vnd.google-apps.spreadsheet") {
        return React.createElement("div", { className: "relative inline-block" }, React.createElement(FileIcon, {
            className: `${iconClass} text-green-500`,
        }), referenceOnly &&
            React.createElement(ExternalLink, {
                className: `${badgeClass} text-blue-500 absolute -bottom-1 -right-1 bg-white rounded-full`,
            }));
    }
    if (fileType === "application/vnd.google-apps.document") {
        return React.createElement("div", { className: "relative inline-block" }, React.createElement(FileIcon, {
            className: `${iconClass} text-blue-500`,
        }), referenceOnly &&
            React.createElement(ExternalLink, {
                className: `${badgeClass} text-blue-500 absolute -bottom-1 -right-1 bg-white rounded-full`,
            }));
    }
    if (fileType === "application/vnd.google-apps.presentation") {
        return React.createElement("div", { className: "relative inline-block" }, React.createElement(FileIcon, {
            className: `${iconClass} text-orange-500`,
        }), referenceOnly &&
            React.createElement(ExternalLink, {
                className: `${badgeClass} text-blue-500 absolute -bottom-1 -right-1 bg-white rounded-full`,
            }));
    }
    return React.createElement(FileIcon, {
        className: `${iconClass} text-gray-500`,
    });
};
