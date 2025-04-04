import { Button } from "@/components/ui/button";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthButtonProps {
  collapsed?: boolean;
}

export function AuthButton({ collapsed = false }: AuthButtonProps) {
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
  });
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast({
        title: "Welcome!",
        description: "You have successfully signed in.",
      });
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
      await signOut();
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
    className: "w-full justify-start gap-2"
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