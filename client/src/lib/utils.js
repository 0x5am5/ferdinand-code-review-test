import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch (err) {
        console.error("Failed to copy to clipboard:", err);
        return false;
    }
}
/**
 * Lightens a hex color by a specified percentage
 * @param color - The color to lighten (hex format: #RRGGBB)
 * @param amount - The percentage to lighten the color by (0-100)
 * @returns The lightened color in hex format
 */
export function lightenColor(color, amount = 20) {
    // Default to white if color is undefined
    if (!color)
        return "#ffffff";
    try {
        // Remove the hash if it exists
        color = color.replace("#", "");
        // Parse the hex values to get R, G, B components
        let r = parseInt(color.substring(0, 2), 16);
        let g = parseInt(color.substring(2, 4), 16);
        let b = parseInt(color.substring(4, 6), 16);
        // Lighten each component
        r = Math.min(255, Math.floor(r + (255 - r) * (amount / 100)));
        g = Math.min(255, Math.floor(g + (255 - g) * (amount / 100)));
        b = Math.min(255, Math.floor(b + (255 - b) * (amount / 100)));
        // Convert back to hex and ensure each component has two digits
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    catch (e) {
        console.error("Error lightening color:", e);
        return color; // Return the original color if there's an error
    }
}
/**
 * Darkens a hex color by a specified percentage
 * @param color - The color to darken (hex format: #RRGGBB)
 * @param amount - The percentage to darken the color by (0-100)
 * @returns The darkened color in hex format
 */
export function darkenColor(color, amount = 20) {
    // Default to black if color is undefined
    if (!color)
        return "#000000";
    try {
        // Remove the hash if it exists
        color = color.replace("#", "");
        // Parse the hex values to get R, G, B components
        let r = parseInt(color.substring(0, 2), 16);
        let g = parseInt(color.substring(2, 4), 16);
        let b = parseInt(color.substring(4, 6), 16);
        // Darken each component
        r = Math.max(0, Math.floor(r * (1 - amount / 100)));
        g = Math.max(0, Math.floor(g * (1 - amount / 100)));
        b = Math.max(0, Math.floor(b * (1 - amount / 100)));
        // Convert back to hex and ensure each component has two digits
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    catch (e) {
        console.error("Error darkening color:", e);
        return color; // Return the original color if there's an error
    }
}
