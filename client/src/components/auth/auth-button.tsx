import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AuthButtonProps {
  collapsed?: boolean;
}

export function AuthButton({ collapsed = false }: AuthButtonProps) {
  const { user, signInWithGoogle, logout } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    // Prevent multiple clicks
    if (isLoading) return;

    setIsLoading(true);
    try {
      console.log("AuthButton: Initiating Google sign-in");
      await signInWithGoogle();
      // Success toast is shown in the useAuth hook
    } catch (error: unknown) {
      console.error(
        "AuthButton: Sign-in error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Authentication Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      console.log("AuthButton: Logging out");
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (error: unknown) {
      console.error(
        "AuthButton: Logout error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonProps = collapsed
    ? {
        size: "icon" as const,
        className: "w-full",
      }
    : {
        className: "",
      };

  if (!user) {
    return (
      <Button
        onClick={handleSignIn}
        variant="outline"
        {...buttonProps}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
        ) : (
          <LogIn className="button--auth" />
        )}
        {!collapsed && (isLoading ? "Signing in..." : "Sign in with Google")}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      {...buttonProps}
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
      ) : (
        <LogOut className="button--auth" />
      )}
      {!collapsed && (isLoading ? "Signing out..." : "Sign out")}
    </Button>
  );
}
