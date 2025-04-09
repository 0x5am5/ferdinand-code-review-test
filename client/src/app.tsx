import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Instances from "@/pages/admin/instances";
import ClientDetails from "@/pages/client/[id]";
import NewClientPage from "@/pages/clients/new";
// Guidelines page has been removed or not implemented yet
import Users from "@/pages/users";
import DesignEditor from "@/pages/design-editor";
import DesignBuilder from "@/pages/design-builder";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  const [location] = useLocation();

  if (location === "/") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
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
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;