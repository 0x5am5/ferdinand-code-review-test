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
import { AppLayout } from "@/components/layout/app-layout";

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
  
  // Define if a route should use the AppLayout with sidebar
  const isProtectedRoute = (path: string) => {
    const publicRoutes = ['/login', '/signup', '/reset-password'];
    return !publicRoutes.includes(path);
  };
  
  // Get current page for transition key
  const getPageKey = () => {
    return location;
  };
  
  return (
    <Switch location={location} key={location}>
      {/* Public routes without sidebar */}
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/signup">
        <SignupPage />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      
      {/* Protected routes with sidebar and page transitions */}
      <Route path="/dashboard">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={Dashboard} />
        </AppLayout>
      </Route>
      <Route path="/admin/instances">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={Instances} adminOnly />
        </AppLayout>
      </Route>
      <Route path="/clients">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={Clients} />
        </AppLayout>
      </Route>
      <Route path="/clients/new">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={NewClientPage} />
        </AppLayout>
      </Route>
      <Route path="/clients/:id">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={ClientDetails} />
        </AppLayout>
      </Route>
      <Route path="/users">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={UsersPage} adminOnly />
        </AppLayout>
      </Route>
      <Route path="/design-builder">
        <AppLayout pageKey={getPageKey()}>
          <ProtectedRoute component={DesignBuilder} adminOnly />
        </AppLayout>
      </Route>
      
      {/* 404 Not Found */}
      <Route>
        <AppLayout pageKey={getPageKey()}>
          <NotFound />
        </AppLayout>
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