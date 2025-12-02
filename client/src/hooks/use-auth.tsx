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
  useRef,
  useState,
} from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/api";
import { auth, googleProvider } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";

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
  const isLoggingOutRef = useRef(false);

  // Fetch user data from our backend
  const fetchUser = useCallback(async (): Promise<boolean> => {
    try {
      const data = await apiFetch<User>("/api/user");
      setUser(data);
      return true;
    } catch (error: unknown) {
      console.error("Failed to fetch user:", error);
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
        // Skip auth sync if we're in the middle of logging out
        if (isLoggingOutRef.current) {
          return;
        }

        setFirebaseUser(fbUser);

        if (fbUser) {
          try {
            // Get the ID token
            const idToken = await fbUser.getIdToken();

            // Create session on backend
            try {
              await apiRequest("POST", "/api/auth/google", { idToken });
              // Fetch user data
              await fetchUser();
            } catch (authError: unknown) {
              setError(
                authError instanceof Error
                  ? authError
                  : new Error("Authentication failed")
              );
              setIsLoading(false);
            }
          } catch (e: unknown) {
            setError(
              e instanceof Error ? e : new Error("Authentication failed")
            );
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
      // Set flag to prevent auth state listener from re-syncing during logout
      isLoggingOutRef.current = true;

      await signOut(auth);

      // Clear session on backend using apiRequest (includes proper CSRF headers)
      await apiRequest("POST", "/api/auth/logout", {});

      // Clear the user data from React Query cache
      queryClient.setQueryData(["/api/user"], null);
      setUser(null);
      setFirebaseUser(null);

      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
      // Redirect to home
      window.location.href = "/";
    } catch (error: unknown) {
      // Reset logout flag on error
      isLoggingOutRef.current = false;
      setError(error instanceof Error ? error : new Error("Logout failed"));

      toast({
        title: "Logout Error",
        description:
          error instanceof Error ? error.message : "Failed to sign out",
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

  return context;
}
