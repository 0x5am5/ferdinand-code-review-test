
import { Route, Switch } from "wouter";
import Dashboard from "./pages/dashboard";
import Clients from "./pages/clients";
import "./index.css";

export default function App() {
  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clients" component={Clients} />
    </Switch>
  );
}
