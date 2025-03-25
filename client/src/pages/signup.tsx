import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { signInWithGoogle } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => {
      if (!token) return null;
      try {
        const response = await fetch(`/api/invitations/${token}`);
        if (!response.ok) {
          if (response.status === 401) return null;
          throw new Error(`Failed to fetch invitation: ${response.statusText}`);
        }
        return await response.json() as InvitationData;
      } catch (error) {
        console.error("Error fetching invitation:", error);
        return null;
      }
    },
    enabled: !!token,
    retry: 1,
    refetchOnWindowFocus: false
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
          throw new Error(`Failed to fetch client data: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching client data:", error);
        return null;
      }
    },
    enabled: !!token && !!invitation,
    retry: 1
  });

  // Combine invitation with client data
  const invitationWithClient = invitation && clientDataResponse?.clientData ? {
    ...invitation,
    clientData: clientDataResponse.clientData
  } : invitation;

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      if (!invitation) {
        toast({
          title: "Error",
          description: "Invalid invitation data",
          variant: "destructive"
        });
        return;
      }

      // Sign in with Google
      await signInWithGoogle();
      
      // Update user role based on invitation
      try {
        // Update the user role
        const response = await fetch('/api/users/role', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: invitation.role
          })
        });
        
        if (!response.ok) {
          console.error("Failed to update user role");
        } else {
          console.log(`User role updated to ${invitation.role}`);
        }
      } catch (error) {
        console.error("Error updating user role:", error);
      }
      
      // Associate user with the clients in the invitation
      if (invitation.clientIds && invitation.clientIds.length > 0) {
        try {
          // Create user-client associations for each client ID
          await Promise.all(invitation.clientIds.map(async (clientId) => {
            const response = await fetch('/api/user-clients', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                clientId
              })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to associate user with client ID ${clientId}`);
            }
          }));
          
          console.log(`User associated with ${invitation.clientIds.length} clients`);
        } catch (error) {
          console.error("Error associating user with clients:", error);
        }
      }
      
      // Mark invitation as used
      await fetch(`/api/invitations/${invitation.id}/use`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      // Redirect to dashboard
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully."
      });
      
      setLocation("/dashboard");
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "An error occurred during sign-in",
        variant: "destructive"
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
            <Button 
              className="w-full" 
              onClick={() => setLocation("/login")}
            >
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
            <Button 
              className="w-full" 
              onClick={() => setLocation("/login")}
            >
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
        backgroundColor: invitationWithClient?.clientData?.primaryColor ? 
          `${invitationWithClient.clientData.primaryColor}10` : // 10% opacity version of the primary color
          "bg-background" 
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
            This invitation was sent to {invitation.email}. 
            Please sign in with this email to accept the invitation.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleGoogleSignIn}
            style={{
              backgroundColor: invitationWithClient?.clientData?.primaryColor || undefined,
            }}
          >
            Join with Google
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}