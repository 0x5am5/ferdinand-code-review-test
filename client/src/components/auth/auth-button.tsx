import { Button } from "@/components/ui/button";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { LogIn, LogOut } from "lucide-react";

export function AuthButton() {
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
  });

  if (!user) {
    return (
      <Button onClick={() => signInWithGoogle()} variant="outline">
        <LogIn className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    );
  }

  return (
    <Button onClick={() => signOut()} variant="outline">
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
}
