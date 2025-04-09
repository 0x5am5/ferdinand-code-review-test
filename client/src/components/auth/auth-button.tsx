import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface AuthButtonProps {
  collapsed?: boolean;
}

export function AuthButton({ collapsed = false }: AuthButtonProps) {
  const { user, signInWithGoogle, logout } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Success toast is shown in the useAuth hook
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const buttonProps = collapsed ? {
    size: "icon" as const,
    className: "w-full"
  } : {
    className: ""
  };

  if (!user) {
    return (
      <Button onClick={handleSignIn} variant="outline" {...buttonProps}>
        <LogIn className="button--auth" />
        {!collapsed && "Sign in with Google"}
      </Button>
    );
  }

  return (
    <Button onClick={handleSignOut} variant="outline" {...buttonProps}>
      <LogOut className="button--auth" />
      {!collapsed && "Sign out"}
    </Button>
  );
}