import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Create = lazy(() => import("@/pages/Create"));
const Verify = lazy(() => import("@/pages/Verify"));
const Unlock = lazy(() => import("@/pages/Unlock"));
const Attestation = lazy(() => import("@/pages/Attestation"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Community = lazy(() => import("@/pages/Community"));
const Admin = lazy(() => import("@/pages/Admin"));
const Docs = lazy(() => import("@/pages/Docs"));
const SecurityAudit = lazy(() => import("@/pages/SecurityAudit"));
const ConfirmEmail = lazy(() => import("@/pages/ConfirmEmail"));
const Prediction = lazy(() => import("@/pages/Prediction"));

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/create" component={Create} />
        <Route path="/verify" component={Verify} />
        <Route path="/unlock" component={Unlock} />
        <Route path="/community" component={Community} />
        <Route path="/attestation/:id" component={Attestation} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/admin" component={Admin} />
        <Route path="/docs" component={Docs} />
        <Route path="/security-audit" component={SecurityAudit} />
        <Route path="/confirm-email" component={ConfirmEmail} />
        <Route path="/p/:id" component={Prediction} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
