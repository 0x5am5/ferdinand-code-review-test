import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { apiRequest } from "./queryClient";

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();

  await apiRequest("POST", "/api/auth/login", {
    token: idToken,
    email: result.user.email,
    name: result.user.displayName,
  });
}

export async function signOut() {
  await firebaseSignOut(auth);
  await apiRequest("POST", "/api/auth/logout", {});
}