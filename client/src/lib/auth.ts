import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";
import { useToast } from "@/hooks/use-toast";

export async function signInWithGoogle() {
  try {
    console.log("Starting Google sign-in process");
    console.log("Current origin:", window.location.origin);
    console.log("Auth configuration:", {
      currentUser: auth.currentUser,
      providerData: auth.currentUser?.providerData,
    });

    const result = await signInWithPopup(auth, googleProvider);
    console.log("Sign-in successful, getting token");

    const idToken = await result.user.getIdToken();
    console.log("Got token, sending to backend");

    const response = await apiRequest("POST", "/api/auth/login", {
      token: idToken,
      email: result.user.email,
      name: result.user.displayName,
    });

    const userData = await response.json();

    // Update the user data in React Query cache
    queryClient.setQueryData(["/api/auth/me"], userData);

    // Redirect to dashboard
    window.location.href = "/dashboard";

    console.log("Backend authentication complete");
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      customData: error.customData,
      stack: error.stack
    });

    let errorMessage = "Failed to sign in with Google";

    switch (error.code) {
      case "auth/unauthorized-domain":
        errorMessage = `This domain (${window.location.hostname}) is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized domains`;
        break;
      case "auth/operation-not-allowed":
        errorMessage = "Google sign-in is not enabled. Please enable it in Firebase Console > Authentication > Sign-in method";
        break;
      case "auth/configuration-not-found":
        errorMessage = "Firebase configuration is incorrect. Please check your Firebase project settings";
        break;
      case "auth/internal-error":
        errorMessage = "Authentication service encountered an error. Please try again later";
        break;
      default:
        errorMessage = error.message || "Failed to sign in with Google";
    }

    throw new Error(errorMessage);
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    await apiRequest("POST", "/api/auth/logout", {});
    // Clear the user data from React Query cache
    queryClient.setQueryData(["/api/auth/me"], null);
    // Redirect to login page
    window.location.href = "/login";
  } catch (error: any) {
    console.error("Sign out error:", error);
    throw new Error(error.message || "Failed to sign out");
  }
}