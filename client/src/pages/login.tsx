
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, ArrowRight } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const googleProvider = new GoogleAuthProvider();
  
  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result.user) {
        throw new Error("No user data returned");
      }

      const idToken = await result.user.getIdToken();
      
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
      
      toast({
        title: "Welcome!",
        description: `Signed in as ${result.user.email}`,
      });
      
      window.location.href = "/dashboard";
      
    } catch (error: any) {
      console.error("Authentication error:", error);
      
      let errorMsg = "Authentication failed. Please try again.";
      
      if (error.code === "auth/popup-blocked") {
        errorMsg = "Please allow popups for this site to sign in.";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMsg = "Sign-in was cancelled.";
      } else if (error.code === "auth/network-request-failed") {
        errorMsg = "Network error. Please check your connection.";
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Ferdinand
          </CardTitle>
          <CardDescription className="text-center pt-2">
            Your brand guidelines platform
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {errorMessage && (
            <Alert variant="destructive" className="w-full mb-2">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Sign in with Google
              </>
            )}
          </Button>
          
          <div className="w-full pt-4">
            <p className="text-sm text-center text-muted-foreground">
              First time here? Sign in to automatically create your account
              <ArrowRight className="h-3 w-3 inline-block ml-1" />
            </p>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-center text-muted-foreground flex justify-center">
          <p>Secure authentication powered by Firebase</p>
        </CardFooter>
      </Card>
    </div>
  );
}
