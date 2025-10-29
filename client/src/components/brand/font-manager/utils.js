import { FontSource } from "@shared/schema";
// Convert Google Fonts variant format to readable weights
export const convertGoogleFontVariants = (variants) => {
    return variants
        .filter((variant) => !variant.includes("italic"))
        .map((variant) => (variant === "regular" ? "400" : variant))
        .filter((variant) => /^\d+$/.test(variant))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
};
// Convert Google Fonts category to our format
export const convertGoogleFontCategory = (category) => {
    switch (category.toLowerCase()) {
        case "sans-serif":
            return "Sans Serif";
        case "serif":
            return "Serif";
        case "display":
            return "Display";
        case "handwriting":
            return "Handwriting";
        case "monospace":
            return "Monospace";
        default:
            return "Sans Serif";
    }
};
// Generate Google Font URL with proper formatting
export const generateGoogleFontUrl = (fontName, weights = ["400"], styles = ["normal"]) => {
    const family = fontName.replace(/\s+/g, "+");
    const weightStr = weights.join(";");
    // Handle italic styles properly
    if (styles.includes("italic")) {
        // For italic, we need to specify both normal (0) and italic (1) for each weight
        const italicParams = weights
            .map((weight) => `0,${weight};1,${weight}`)
            .join(";");
        return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${italicParams}&display=swap`;
    }
    else {
        // For normal style only
        return `https://fonts.googleapis.com/css2?family=${family}:wght@${weightStr}&display=swap`;
    }
};
// Parse font asset from BrandAsset to FontData
export const parseFontAsset = (asset) => {
    try {
        const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        return {
            id: asset.id,
            name: asset.name,
            source: data.source || FontSource.GOOGLE,
            weights: data.weights || ["400"],
            styles: data.styles || ["normal"],
            sourceData: data.sourceData || {},
        };
    }
    catch (error) {
        console.error("Error parsing font asset:", error instanceof Error ? error.message : "Unknown error");
        return null;
    }
};
