export async function apiRequest(method, path, data) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
        },
    };
    if (data && method !== "GET") {
        options.body = JSON.stringify(data);
    }
    const response = await fetch(path, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Return null for 204 No Content responses or if the response is empty
    if (response.status === 204 ||
        response.headers.get("content-length") === "0") {
        return null;
    }
    // Check if there's content to parse
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch (e) {
        throw new Error(`Invalid JSON response: ${text} ${e.message}`);
    }
}
export async function getSlackUserStatus() {
    return apiRequest("GET", "/api/slack/user-status");
}
