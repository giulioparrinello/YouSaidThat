import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import i18n from "@/i18n";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Create = lazy(() => import("@/pages/Create"));
const SealDocument = lazy(() => import("@/pages/SealDocument"));
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
  // The first path segment drives the language: "/it/..." renders Italian,
  // everything else English. wouter's `base` strips the "/it" prefix so every
  // <Route> and <Link href="/foo"> keeps working unchanged and stays within
  // the active language.
  const [path] = useLocation();
  const isItalian = path === "/it" || path.startsWith("/it/");

  useEffect(() => {
    const lng = isItalian ? "it" : "en";
    if (i18n.language !== lng) i18n.changeLanguage(lng);
  }, [isItalian]);

  return (
    <WouterRouter base={isItalian ? "/it" : ""}>
      <Suspense fallback={null}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/create" component={Create} />
          <Route path="/seal" component={SealDocument} />
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
    </WouterRouter>
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
