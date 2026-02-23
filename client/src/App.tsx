import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Create from "@/pages/Create";
import Verify from "@/pages/Verify";
import Unlock from "@/pages/Unlock";
import Attestation from "@/pages/Attestation";
import Privacy from "@/pages/Privacy";
import Community from "@/pages/Community";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={Create} />
      <Route path="/verify" component={Verify} />
      <Route path="/unlock" component={Unlock} />
      <Route path="/community" component={Community} />
      <Route path="/attestation/:id" component={Attestation} />
      <Route path="/privacy" component={Privacy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
