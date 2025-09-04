import type { User } from "@shared/schema";
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useToast } from "@/hooks/use-toast";
import { auth, googleProvider } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: Error | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user data from our backend with retry logic
  const fetchUser = useCallback(async (retryCount = 0) => {
    try {
      const response = await fetch("/api/user");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Error fetching user:", e);
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        console.log(`Retrying fetchUser (attempt ${retryCount + 1})`);
        setTimeout(() => fetchUser(retryCount + 1), 1000 * 2 ** retryCount);
        return;
      }
      setUser(null);
    } finally {
      if (retryCount === 0) {
        setIsLoading(false);
      }
    }
  }, []);

  // Handle Firebase auth state changes
  useEffect(() => {
    console.log("Setting up auth state listener");
    setIsLoading(true);

    let debounceTimer: NodeJS.Timeout | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("Auth state changed:", fbUser?.email);
      setFirebaseUser(fbUser);

      // Clear any existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce the auth processing to prevent rapid fire
      debounceTimer = setTimeout(async () => {
        if (fbUser) {
          try {
            // Get the ID token
            const idToken = await fbUser.getIdToken();
            console.log("ID token obtained, creating session...");

            // Create session on backend with timeout and better error handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch("/api/auth/google", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ idToken }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              console.log("Session created successfully");
              // Fetch user data
              await fetchUser();
            } else {
              const data = await response
                .json()
                .catch(() => ({ message: "Unknown server error" }));
              console.error("Failed to create session:", data);
              setError(new Error(data.message || "Authentication failed"));
              setIsLoading(false);
            }
          } catch (e: unknown) {
            console.error("Auth processing error:", e);
            // More specific error handling
            if (e.name === "AbortError") {
              console.error("Auth request timed out");
              setError(
                new Error("Authentication request timed out. Please try again.")
              );
            } else if (e.message === "Failed to fetch") {
              console.error("Network error during authentication");
              setError(
                new Error(
                  "Network error. Please check your connection and try again."
                )
              );
            } else {
              setError(e);
            }
            setIsLoading(false);
          }
        } else {
          // User is not authenticated
          setUser(null);
          setIsLoading(false);
        }
      }, 500); // 500ms debounce
    });

    return () => {
      console.log("Cleaning up auth listener");
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribe();
    };
  }, [fetchUser]); // Remove fetchUser dependency to prevent infinite re-renders

  const signInWithGoogle = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);

      // Auth state listener will handle the session creation and user fetching

      toast({
        title: "Sign In Successful",
        description: `Signed in as ${result.user?.email}`,
      });
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);
      setError(error);

      toast({
        title: "Sign In Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });

      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log("Logging out...");
      await signOut(auth);

      // Clear session on backend
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      setUser(null);

      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });

      // Redirect to login
      window.location.href = "/login";
    } catch (error: unknown) {
      console.error("Logout error:", error);
      setError(
        error instanceof Error ? error : new Error("Unknown logout error")
      );

      toast({
        title: "Logout Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const contextValue: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    error,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  // Wait until auth is initialized before returning context
  if (context.isLoading) {
    return {
      ...context,
      user: null,
      firebaseUser: null,
    };
  }

  return context;
}
