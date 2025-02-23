import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Instances from "@/pages/admin/instances";
import ClientDetails from "@/pages/client/[id]";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

function ProtectedRoute({ 
  component: Component,
  adminOnly = false,
}: { 
  component: React.ComponentType;
  adminOnly?: boolean;
}) {
  // Temporarily bypass auth
  return <Component />;
}

function Router() {
  const [location] = useLocation();
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Always redirect to dashboard
  if (location === "/") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/admin/instances">
        <ProtectedRoute component={Instances} adminOnly />
      </Route>
      <Route path="/clients/:id">
        <ProtectedRoute component={ClientDetails} />
      </Route>
      <Route>
        <NotFound />
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