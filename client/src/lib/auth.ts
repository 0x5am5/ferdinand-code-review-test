import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { apiRequest } from "./queryClient";

export async function signInWithGoogle() {
  try {
    // Add debugging information
    console.log("Starting Google sign-in process");
    console.log("Current origin:", window.location.origin);

    const result = await signInWithPopup(auth, googleProvider);
    console.log("Sign-in successful, getting token");

    const idToken = await result.user.getIdToken();
    console.log("Got token, sending to backend");

    await apiRequest("POST", "/api/auth/login", {
      token: idToken,
      email: result.user.email,
      name: result.user.displayName,
    });

    console.log("Backend authentication complete");
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      customData: error.customData
    });
    throw new Error(
      error.code === "auth/unauthorized-domain" 
        ? "This domain is not authorized. Please check Firebase configuration."
        : error.message || "Failed to sign in with Google"
    );
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    await apiRequest("POST", "/api/auth/logout", {});
  } catch (error: any) {
    console.error("Sign out error:", error);
    throw new Error(error.message || "Failed to sign out");
  }
}