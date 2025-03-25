
import { Route, Switch } from "wouter";
import Dashboard from "./pages/dashboard";
import Clients from "./pages/clients";
import { Sidebar } from "@/components/layout/sidebar";
import "./index.css";

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1">
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/clients" component={Clients} />
        </Switch>
      </div>
    </div>
  );
}
