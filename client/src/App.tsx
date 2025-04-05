import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
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
    <div>
      <AnimatePresence mode="wait">
        <Switch location={location} key={location}>
        <Route path="/login">
          <PageTransition>
            <Login />
          </PageTransition>
        </Route>
        <Route path="/dashboard">
          <PageTransition>
            <ProtectedRoute component={Dashboard} />
          </PageTransition>
        </Route>
        <Route path="/admin/instances">
          <PageTransition>
            <ProtectedRoute component={Instances} adminOnly />
          </PageTransition>
        </Route>
        <Route path="/clients">
          <PageTransition>
            <ProtectedRoute component={Clients} />
          </PageTransition>
        </Route>
        <Route path="/clients/new">
          <PageTransition>
            <ProtectedRoute component={NewClientPage} />
          </PageTransition>
        </Route>
        <Route path="/clients/:id">
          <PageTransition>
            <ProtectedRoute component={ClientDetails} />
          </PageTransition>
        </Route>
        <Route path="/users">
          <PageTransition>
            <ProtectedRoute component={UsersPage} adminOnly />
          </PageTransition>
        </Route>
        <Route path="/signup">
          <PageTransition>
            <SignupPage />
          </PageTransition>
        </Route>
        <Route path="/reset-password">
          <PageTransition>
            <ResetPassword />
          </PageTransition>
        </Route>
        <Route path="/design-builder">
          <PageTransition>
            <ProtectedRoute component={DesignBuilder} adminOnly />
          </PageTransition>
        </Route>
        <Route>
          <PageTransition>
            <NotFound />
          </PageTransition>
        </Route>
      </Switch>
      </AnimatePresence>
    </div>
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