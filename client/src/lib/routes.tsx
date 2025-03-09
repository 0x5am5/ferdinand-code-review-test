
import { createBrowserRouter } from "react-router-dom";
import Login from "@/pages/login";
import AuthDebug from "@/pages/auth-debug";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/auth-debug",
    element: <AuthDebug />,
  },
  // Your other routes...
]);
