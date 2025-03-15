import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Dashboard from "@/pages/dashboard";
import Guidelines from "@/pages/guidelines";
import Clients from "@/pages/clients";
import NewClient from "@/pages/clients/new";
import Users from "@/pages/users";
import DesignEditor from "@/pages/design-editor";
import DesignBuilder from "@/pages/design-builder";
import Settings from "@/pages/settings"; // Assuming this component exists


function App() {
  return (
    <Router>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/guidelines" component={Guidelines} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/new" component={NewClient} />
        <Route path="/users" component={Users} />
        <Route path="/design" component={DesignEditor} />
        <Route path="/design-builder" component={DesignBuilder} />
        <Route path="/settings" component={Settings} />
        {/* Add other routes here as needed */}
      </Switch>
    </Router>
  );
}

export default App;