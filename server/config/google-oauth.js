import { OAuth2Client } from "google-auth-library";
// Google OAuth2 scopes required for Drive access
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive"];
// Initialize OAuth2 client
export const oauth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
});
/**
 * Generate OAuth URL for Google authentication
 */
export const generateAuthUrl = (state) => {
    return oauth2Client.generateAuthUrl({
        access_type: "offline", // Get refresh token for long-term access
        scope: GOOGLE_SCOPES,
        prompt: "consent", // Force consent screen to get refresh token
        state, // Pass state to retrieve after auth (usually clientId)
    });
};
/**
 * Exchange auth code for tokens
 */
export const getTokensFromCode = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};
/**
 * Set credentials for OAuth2 client
 */
export const setCredentials = (tokens) => {
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
};
/**
 * Get auth client for Drive API
 */
export const getAuthenticatedClient = () => {
    return oauth2Client;
};
