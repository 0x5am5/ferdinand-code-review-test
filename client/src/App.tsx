import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { SpotlightProvider } from "@/hooks/use-spotlight";
import { queryClient } from "@/lib/queryClient";
import { useLocation, Route, Switch, Redirect } from "wouter";
import Login from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import DesignBuilder from "@/pages/design-builder";
import DesignEditor from "@/pages/design-editor";
import Instances from "@/pages/admin/instances";
import NewClientPage from "@/pages/clients/new";
import ClientDetails from "@/pages/clients/[id]";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { UserRole } from "@shared/schema";
import Clients from "./pages/clients";
import { useEffect } from "react"; // Import useEffect
import FontLoader from "@/lib/font-loader"; // Import FontLoader

function Router() {
  const [location] = useLocation();

  if (location === "/") {
    return <Redirect to="/login" />;
  }

  return (
    <Switch>
      {/* Public routes that don't require authentication */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignupPage} />

      {/* Protected routes that require authentication */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout pageKey="dashboard">
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/design-builder">
        <ProtectedRoute roles={[]}>
          <AppLayout pageKey="design-builder">
            <DesignBuilder />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/design-editor/:id">
        <ProtectedRoute>
          <AppLayout pageKey="design-editor">
            <DesignEditor />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/users">
        <ProtectedRoute roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout pageKey="users">
            <Users />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/instances">
        <ProtectedRoute>
          <AppLayout pageKey="instances">
            <Instances />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients/new">
        <ProtectedRoute roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout pageKey="new-client">
            <NewClientPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients/:id">
        <ProtectedRoute>
          <AppLayout pageKey="client-details">
            <ClientDetails />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients">
        <ProtectedRoute roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout pageKey="client-details">
            <Clients />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route>
        <AppLayout pageKey="not-found">
          <NotFound />
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const loadUserFonts = async () => {
      if (!user?.client_id) return;

      try {
        console.log('Loading fonts for client:', user.client_id);
        const response = await fetch(`/api/clients/${user.client_id}/assets`);
        if (response.ok) {
          const assets = await response.json();
          const fontAssets = assets.filter((asset: any) => asset.category === 'font');

          const fonts = fontAssets.map((asset: any) => {
            try {
              const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
              return {
                name: asset.name,
                source: data.source || 'google',
                sourceData: data.sourceData || {}
              };
            } catch (error) {
              console.warn('Failed to parse font asset:', asset.name, error);
              return null;
            }
          }).filter(Boolean);

          if (fonts.length > 0) {
            await FontLoader.loadFonts(fonts);
          }
        }
      } catch (error) {
        console.error('Failed to load user fonts:', error);
      }
    };

    loadUserFonts();
  }, [user?.client_id]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SpotlightProvider>
          <Router />
          <Toaster />
        </SpotlightProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;