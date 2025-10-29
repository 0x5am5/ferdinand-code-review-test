export function parseBrandAssetData(logo) {
    try {
        if (!logo.data) {
            console.warn("Logo data is missing:", logo);
            return null;
        }
        const data = typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
        if (!data.type || !data.format) {
            console.warn("Invalid logo data format:", data);
            return null;
        }
        return data;
    }
    catch (error) {
        console.error("Error parsing logo data:", error, logo);
        return null;
    }
}
export function getSecureAssetUrl(assetId, clientId, options = {}) {
    const { format, size, variant, preserveRatio = true, preserveVector = false, } = options;
    const url = new URL(`/api/assets/${assetId}/file`, window.location.origin);
    url.searchParams.append("clientId", clientId.toString());
    url.searchParams.append("t", Date.now().toString());
    if (variant === "dark")
        url.searchParams.append("variant", "dark");
    if (format)
        url.searchParams.append("format", format);
    if (size) {
        url.searchParams.append("size", size.toString());
        url.searchParams.append("preserveRatio", preserveRatio.toString());
    }
    if (preserveVector)
        url.searchParams.append("preserveVector", "true");
    console.log(`Generated download URL for asset ${assetId}: ${url.toString()}`);
    return url.toString();
}
