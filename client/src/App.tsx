import { UserRole } from "@shared/schema";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { ClientProtectedRoute } from "@/components/auth/client-protected-route";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/toaster";
import { RoleSwitchingProvider } from "@/contexts/RoleSwitchingContext";
import { AuthProvider } from "@/hooks/use-auth";
import { SpotlightProvider } from "@/hooks/use-spotlight";
import { queryClient } from "@/lib/queryClient";
import Instances from "@/pages/admin/instances";
import BrandAssets from "@/pages/brand-assets";
import ClientDetails from "@/pages/clients/[id]";
import NewClientPage from "@/pages/clients/new";
import ClientUsers from "@/pages/clients/users";
import Dashboard from "@/pages/dashboard";
import DesignBuilder from "@/pages/design-builder";
import DesignEditor from "@/pages/design-editor";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import SignupPage from "@/pages/signup";
import Users from "@/pages/users";
import Clients from "./pages/clients";

function Router() {
  return (
    <Switch>
      {/* Public routes that don't require authentication */}
      <Route path="/" component={Login} />
      <Route path="/signup" component={SignupPage} />

      {/* Protected routes that require authentication */}
      <Route path="/dashboard">
        <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
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

      <Route path="/clients/:id/users">
        <ProtectedRoute roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout pageKey="client-users">
            <ClientUsers />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients/:id">
        <ClientProtectedRoute>
          <AppLayout pageKey="client-details">
            <ClientDetails />
          </AppLayout>
        </ClientProtectedRoute>
      </Route>

      <Route path="/clients">
        <ProtectedRoute roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout pageKey="client-details">
            <Clients />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/brand-assets">
        <ProtectedRoute roles={[]}>
          <AppLayout pageKey="brand-assets">
            <BrandAssets />
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleSwitchingProvider>
          <SpotlightProvider>
            <Router />
            <Toaster />
          </SpotlightProvider>
        </RoleSwitchingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
