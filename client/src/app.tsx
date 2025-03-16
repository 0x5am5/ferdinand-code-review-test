import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Instances from "@/pages/admin/instances";
import ClientDetails from "@/pages/client/[id]";
import NewClientPage from "@/pages/clients/new";
import Guidelines from "@/pages/guidelines";
import Users from "@/pages/users";
import DesignEditor from "@/pages/design-editor";
import DesignBuilder from "@/pages/design-builder";

function ProtectedRoute({ 
  component: Component,
  adminOnly = false,
}: { 
  component: React.ComponentType;
  adminOnly?: boolean;
}) {
  // Temporarily return the component directly for development
  return <Component />;
}

function Router() {
  const [location] = useLocation();

  if (location === "/") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/guidelines" component={() => <ProtectedRoute component={Guidelines} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/design" component={() => <ProtectedRoute component={DesignEditor} />} />
      <Route path="/design-builder">
        <ProtectedRoute component={DesignBuilder} />
      </Route>
      <Route path="/admin/instances" component={() => <ProtectedRoute component={Instances} adminOnly />} />
      <Route path="/clients/new" component={() => <ProtectedRoute component={NewClientPage} />} />
      <Route path="/clients/:id" component={() => <ProtectedRoute component={ClientDetails} />} />
      <Route component={NotFound} />
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