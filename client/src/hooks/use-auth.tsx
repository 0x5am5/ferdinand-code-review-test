import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as FirebaseUser, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

  // Query for getting the user data from our backend
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    enabled: !!auth.currentUser, // Only run query when Firebase user exists
    initialData: null,
  });

  // Handle Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Get the ID token to pass to backend
        const idToken = await firebaseUser.getIdToken();
        
        // Call your backend to create/update user
        try {
          const response = await apiRequest("POST", "/api/auth/google", {
            idToken,
          });
          
          if (!response.ok) {
            throw new Error("Failed to authenticate with backend");
          }
          
          // Invalidate the user query to refetch latest data
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        } catch (error) {
          console.error("Backend auth error:", error);
          toast({
            title: "Authentication Error",
            description: "Failed to complete authentication process",
            variant: "destructive",
          });
        }
      } else {
        // User is signed out
        queryClient.setQueryData(["/api/user"], null);
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast({
        title: "Sign In Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      try {
        // Call our backend to clear session
        await apiRequest("POST", "/api/auth/logout", {});
      } catch (e) {
        console.error("Backend logout error:", e);
      }
      
      // Clear the local cache
      queryClient.setQueryData(["/api/user"], null);
      
      // Redirect to login
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        firebaseUser: auth.currentUser,
        isLoading,
        error,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
