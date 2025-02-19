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