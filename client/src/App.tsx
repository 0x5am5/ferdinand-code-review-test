
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
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
        <AppLayout pageKey="dashboard">
          <Dashboard />
        </AppLayout>
      </Route>
      <Route path="/design-builder">
        <AppLayout pageKey="design-builder">
          <DesignBuilder />
        </AppLayout>
      </Route>
      <Route path="/design-editor">
        <AppLayout pageKey="design-editor">
          <DesignEditor />
        </AppLayout>
      </Route>
      <Route path="/users">
        <AppLayout pageKey="users">
          <Users />
        </AppLayout>
      </Route>
      <Route path="/admin/instances">
        <AppLayout pageKey="instances">
          <Instances />
        </AppLayout>
      </Route>
      <Route path="/clients/new">
        <AppLayout pageKey="new-client">
          <NewClientPage />
        </AppLayout>
      </Route>
      <Route path="/clients/:id">
        <AppLayout pageKey="client-details">
          <ClientDetails />
        </AppLayout>
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
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
