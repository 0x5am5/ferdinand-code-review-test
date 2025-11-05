import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle } from "@/lib/auth";

interface InvitationData {
  id: number;
  email: string;
  role: string;
  clientIds: number[] | null;
  expiresAt: string;
  clientData?: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

export default function SignupPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  // Extract token from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("token");
    setToken(inviteToken);
  }, []);

  // Fetch invitation data using the token
  const {
    data: invitation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => {
      if (!token) return null;
      try {
        const response = await fetch(`/api/invitations/${token}`);
        if (!response.ok) {
          if (response.status === 401) return null;
          throw new Error(`Failed to fetch invitation: ${response.statusText}`);
        }
        return (await response.json()) as InvitationData;
      } catch (error: unknown) {
        console.error(
          "Error fetching invitation:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return null;
      }
    },
    enabled: !!token,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch client branding data for the invitation
  const { data: clientDataResponse, isLoading: clientLoading } = useQuery({
    queryKey: ["client", token],
    queryFn: async () => {
      if (!token) return null;
      try {
        const response = await fetch(`/api/invitations/${token}/client`);
        if (!response.ok) {
          if (response.status === 401) return null;
          throw new Error(
            `Failed to fetch client data: ${response.statusText}`
          );
        }
        return await response.json();
      } catch (error: unknown) {
        console.error(
          "Error fetching client data:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return null;
      }
    },
    enabled: !!token && !!invitation,
    retry: 1,
  });

  // Combine invitation with client data
  const invitationWithClient =
    invitation && clientDataResponse?.clientData
      ? {
          ...invitation,
          clientData: clientDataResponse.clientData,
        }
      : invitation;

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      if (!invitation) {
        toast({
          title: "Error",
          description: "Invalid invitation data",
          variant: "destructive",
        });
        return;
      }

      // Sign in with Google with the invitation token
      // The backend now handles creating the user with the role and client associations
      await signInWithGoogle(token || undefined);

      // Mark invitation as used
      try {
        await fetch(`/api/invitations/${invitation.id}/use`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error: unknown) {
        console.error(
          "Error marking invitation as used:",
          error instanceof Error ? error.message : "Unknown error"
        );
        // Don't fail the signup if marking as used fails - user is already created
      }

      // Redirect to dashboard
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });

      setLocation("/dashboard");
    } catch (error: unknown) {
      console.error(
        "Error signing in with Google:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Sign-in failed",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during sign-in",
        variant: "destructive",
      });
    }
  };

  if (isLoading || clientLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: invitationWithClient?.clientData?.primaryColor
          ? `${invitationWithClient.clientData.primaryColor}10`
          : // 10% opacity version of the primary color
            "bg-background",
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {invitationWithClient?.clientData?.logoUrl && (
            <div className="mx-auto mb-4 flex justify-center">
              <img
                src={invitationWithClient.clientData.logoUrl}
                alt={`${invitationWithClient.clientData.name} logo`}
                className="h-20 w-auto object-contain"
              />
            </div>
          )}
          <CardTitle className="text-2xl">
            Join {invitationWithClient?.clientData?.name || "Our Platform"}
          </CardTitle>
          <CardDescription>
            You've been invited to join as a {invitation.role.replace("_", " ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            This invitation was sent to {invitation.email}. Please sign in with
            this email to accept the invitation.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleGoogleSignIn}
            style={{
              backgroundColor:
                invitationWithClient?.clientData?.primaryColor || undefined,
            }}
          >
            Join with Google
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
