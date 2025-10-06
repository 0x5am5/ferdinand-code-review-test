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

  // Fetch user data from our backend
  const fetchUser = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/user");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (e: unknown) {
      console.error(
        "Error fetching user:",
        e instanceof Error ? e.message : "Unknown error"
      );
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle Firebase auth state changes
  useEffect(() => {
    setIsLoading(true);
    let unsubscribe: (() => void) | undefined;

    // First, try to fetch user from existing session (for dev auth bypass)
    fetchUser().then((hasUser) => {
      // Set up Firebase auth listener regardless of whether we have a session
      // This ensures Firebase auth still works when bypass is disabled
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);

        if (fbUser) {
          try {
            // Get the ID token
            const idToken = await fbUser.getIdToken();

            // Create session on backend
            const response = await fetch("/api/auth/google", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ idToken }),
            });

            if (response.ok) {
              // Fetch user data
              await fetchUser();
            } else {
              const data = await response.json();
              console.error("Failed to create session:", data);
              setError(new Error(data.message || "Authentication failed"));
              setIsLoading(false);
            }
          } catch (e: unknown) {
            console.error(
              "Auth processing error:",
              e instanceof Error ? e.message : "Unknown error"
            );
            setError(e instanceof Error ? e : new Error("Authentication failed"));
            setIsLoading(false);
          }
        } else if (!hasUser) {
          // User is not authenticated via Firebase and no existing session
          setUser(null);
          setIsLoading(false);
        }
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchUser]);

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
      console.error(
        "Google sign-in error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      const errorInstance =
        error instanceof Error
          ? error
          : new Error("Failed to sign in with Google");
      setError(errorInstance);

      toast({
        title: "Sign In Error",
        description: errorInstance.message,
        variant: "destructive",
      });

      throw error;
    }
  };

  const logout = async () => {
    try {
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
      console.error(
        "Logout error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      setError(error instanceof Error ? error : new Error("Logout failed"));

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
