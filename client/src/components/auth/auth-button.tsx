import { Button } from "@/components/ui/button";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
  });
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <Button onClick={handleSignIn} variant="outline">
        <LogIn className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    );
  }

  return (
    <Button onClick={handleSignOut} variant="outline">
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
}