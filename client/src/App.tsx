import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Instances from "@/pages/admin/instances";
import ClientDetails from "@/pages/clients/[id]";
import Clients from "@/pages/clients";
import NewClientPage from "@/pages/clients/new";
import UsersPage from "@/pages/users";
import SignupPage from "@/pages/signup";
import ResetPassword from "@/pages/reset-password";
import DesignBuilder from "@/pages/design-builder";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { ThemeProvider } from "./contexts/ThemeContext";

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

  // Always redirect to dashboard from root
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
      <Route path="/clients">
        <ProtectedRoute component={Clients} />
      </Route>
      <Route path="/clients/new">
        <ProtectedRoute component={NewClientPage} />
      </Route>
      <Route path="/clients/:id">
        <ProtectedRoute component={ClientDetails} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} adminOnly />
      </Route>
      <Route path="/signup">
        <SignupPage />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/design-builder">
        <ProtectedRoute component={DesignBuilder} adminOnly />
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
      <ThemeProvider>
        <Router />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;