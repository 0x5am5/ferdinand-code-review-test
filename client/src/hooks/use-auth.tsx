import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

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
  const fetchUser = async () => {
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
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Firebase auth state changes
  useEffect(() => {
    console.log("Setting up auth state listener");
    setIsLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("Auth state changed:", fbUser?.email);
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Get the ID token
          const idToken = await fbUser.getIdToken();
          console.log("ID token obtained, creating session...");

          // Create session on backend
          const response = await fetch("/api/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            console.log("Session created successfully");
            // Fetch user data
            await fetchUser();
          } else {
            const data = await response.json();
            console.error("Failed to create session:", data);
            setError(new Error(data.message || "Authentication failed"));
            setIsLoading(false);
          }
        } catch (e: any) {
          console.error("Auth processing error:", e);
          setError(e);
          setIsLoading(false);
        }
      } else {
        // User is not authenticated
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      console.log("Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error("Logout error:", error);
      setError(error);

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
`