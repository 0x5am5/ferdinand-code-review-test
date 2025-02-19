import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { apiRequest } from "./queryClient";

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();

    await apiRequest("POST", "/api/auth/login", {
      token: idToken,
      email: result.user.email,
      name: result.user.displayName,
    });
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    throw new Error(error.message || "Failed to sign in with Google");
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