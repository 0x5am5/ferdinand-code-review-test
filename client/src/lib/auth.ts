import { signOut as firebaseSignOut, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { apiRequest, queryClient } from "./queryClient";

export async function signInWithGoogle() {
  try {
    // Sign in with Google popup
    console.log("Starting Google sign-in process");
    const userCredential = await signInWithPopup(auth, googleProvider);

    console.log("Google sign-in successful, getting ID token");
    // Get the ID token
    const idToken = await userCredential.user.getIdToken();

    console.log("Sending token to backend");
    // Send the token to our backend
    await apiRequest("POST", "/api/auth/google", { idToken });

    console.log("Authentication completed successfully");
    // Refresh the user data
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  } catch (error: unknown) {
    console.error("Google sign-in error:", error);

    let errorMessage = "";

    if (error && typeof error === "object" && "code" in error) {
      console.error("Error code:", error.code);
      console.error(
        "Error message:",
        "message" in error ? error.message : "Unknown error"
      );

      switch (error.code) {
        case "auth/unauthorized-domain":
          errorMessage = `This domain (${window.location.hostname}) is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized domains`;
          break;
        case "auth/operation-not-allowed":
          errorMessage =
            "Google sign-in is not enabled. Please enable it in Firebase Console > Authentication > Sign-in method";
          break;
        case "auth/configuration-not-found":
          errorMessage =
            "Firebase configuration is incorrect. Please check your Firebase project settings";
          break;
        case "auth/internal-error":
          errorMessage =
            "Authentication service encountered an error. Please try again later";
          break;
        default:
          errorMessage =
            error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
              ? error.message
              : "Failed to sign in with Google";
      }
    } else {
      errorMessage = "Failed to sign in with Google";
    }

    throw new Error(errorMessage);
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    // Call the logout endpoint to destroy the session
    await apiRequest("POST", "/api/auth/logout", {});
    // Clear the user data from React Query cache
    queryClient.setQueryData(["/api/user"], null);
    // Redirect to login page
    window.location.href = "/login";
  } catch (error: unknown) {
    console.error("Sign out error:", error);
    const errorMessage =
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Failed to sign out";
    throw new Error(errorMessage);
  }
}
