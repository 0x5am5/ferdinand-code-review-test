import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BackgroundPattern } from "@/components/brand-pattern";
import { BullLogo, FerdinandLogo } from "@/components/logos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const googleProvider = new GoogleAuthProvider();
  const { user } = useAuth();
  const [_location, _setLocation] = useLocation();

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      console.log("Login: Starting Google sign-in");
      const result = await signInWithPopup(auth, googleProvider);

      if (!result.user) {
        throw new Error("No user data returned");
      }

      console.log("Login: Getting ID token");
      const idToken = await result.user.getIdToken();

      console.log("Login: Sending token to backend");
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Server authentication failed");
      }

      console.log("Login: Authentication successful, redirecting");
      toast({
        title: "Welcome!",
        description: `Signed in as ${result.user.email}`,
      });

      // Use setTimeout to ensure the auth state has been updated
      setTimeout(() => {
        // Role-based redirection after login
        const userRole = data.role;
        if (userRole === "super_admin" || userRole === "admin") {
          window.location.href = "/dashboard";
        } else {
          // For editors, standard, and guest users, redirect to design builder
          window.location.href = "/design-builder";
        }
      }, 100);
    } catch (error: unknown) {
      console.error("Authentication error:", error);

      let errorMsg = "Authentication failed. Please try again.";

      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "auth/popup-blocked") {
          errorMsg = "Please allow popups for this site to sign in.";
        } else if (error.code === "auth/cancelled-popup-request") {
          errorMsg = "Sign-in was cancelled.";
        } else if (error.code === "auth/network-request-failed") {
          errorMsg = "Network error. Please check your connection.";
        } else if ("message" in error && typeof error.message === "string") {
          errorMsg = error.message;
        }
      }

      setErrorMessage(errorMsg);
      toast({
        title: "Sign In Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("Login: Auth state changed, user:", user);
    if (user) {
      console.log("Login: User detected, redirecting based on role");
      // Role-based redirection for existing sessions
      if (user.role === "super_admin" || user.role === "admin") {
        window.location.href = "/dashboard";
      } else {
        // For editors, standard, and guest users, redirect to design builder
        window.location.href = "/design-builder";
      }
    }
  }, [user]);

  return (
    <div className="min-h-screen w-full relative bg-background overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <BackgroundPattern className="w-full h-full object-cover" />
      </div>

      {/* Ferdinand Logo - Top Left */}
      <div className="absolute top-8 left-8 z-10">
        <FerdinandLogo className="h-8 text-foreground" />
      </div>

      {/* Main Content - Left Side */}
      <div className="relative z-10 flex flex-col justify-center min-h-screen max-w-2xl pl-8 md:pl-16 lg:pl-24">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="font-ivy font-light text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight">
              Your AI Design Team
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
              Your brand assets are centralized, up to date, and instantly
              accessible.
            </p>
          </div>

          <div className="space-y-4 max-w-sm">
            {errorMessage && (
              <Alert variant="destructive" className="w-full">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              variant="outline"
              className="text-base font-medium border-2 hover:bg-foreground hover:text-background"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Bull Logo - Bottom Left */}
      <div className="absolute bottom-8 left-5">
        <BullLogo />
      </div>

      {/* Footer - Bottom Right */}
      <div className="absolute bottom-8 right-8 z-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-end gap-2">
          <div>© 2025 Ferdinand by Green Bull Creative</div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-foreground">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
