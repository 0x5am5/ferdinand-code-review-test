import { createBrowserRouter } from "react-router-dom";
import Login from "@/pages/login";
import AuthDebug from "@/pages/auth-debug";
import DesignEditor from '@/pages/design-editor';
import DesignBuilder from '@/pages/design-builder';
import { ProtectedRoute } from '@/components/ProtectedRoute'; // Assumed location
import Users from '@/pages/users'; // Assumed location


export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/auth-debug",
    element: <AuthDebug />,
  },
  { path: '/design-editor', element: <DesignEditor /> },
  { path: '/design-builder', element: <DesignBuilder /> },
  { path: '/users', element: <ProtectedRoute component={Users} adminOnly /> }, // Added route with adminOnly protection
  // Your other routes...
]);