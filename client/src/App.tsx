import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./lib/auth";
import { PublicOnly, RequireAuth, RequireRole } from "./components/RouteGuards";
import FloatingProgramareCTA from "./components/FloatingProgramareCTA";
import UpdatePrompt from "./components/UpdatePrompt";
import Home from "./pages/Home";
import Cunoaste from "./pages/Cunoaste";
import Login from "./pages/Login";
import Inregistrare from "./pages/Inregistrare";
import SeteazaParola from "./pages/SeteazaParola";

// Lazy-load heavy member pages (each is 200-800 lines)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CompleteazaProfil = lazy(() => import("./pages/CompleteazaProfil"));
const InregistrareCopil = lazy(() => import("./pages/InregistrareCopil"));
const CopilProfil = lazy(() => import("./pages/CopilProfil"));
const Antrenor = lazy(() => import("./pages/Antrenor"));
const Admin = lazy(() => import("./pages/Admin"));

// Lazy-load new public marketing pages — kept out of the initial bundle
// because the landing card auto-redirects to /cunoaste; these pages are
// only ever reached via the top nav after the user lands.
const Academie = lazy(() => import("./pages/Academie"));
const Grupe = lazy(() => import("./pages/Grupe"));
const Turnee = lazy(() => import("./pages/Turnee"));
const Campionat = lazy(() => import("./pages/Campionat"));
const Stiri = lazy(() => import("./pages/Stiri"));
const Notificari = lazy(() => import("./pages/Notificari"));
const Rezultate = lazy(() => import("./pages/Rezultate"));
const Copii = lazy(() => import("./pages/Copii"));
const Program = lazy(() => import("./pages/Program"));
const Galerie = lazy(() => import("./pages/Galerie"));
const Contact = lazy(() => import("./pages/Contact"));
const Programare = lazy(() => import("./pages/Programare"));
const Apel = lazy(() => import("./pages/Apel"));

function PageLoader() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[oklch(0.08_0.02_250)]">
      <BrandSpinner size="sm" />
    </div>
  );
}

function SuspenseWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/cunoaste"} component={Cunoaste} />
      <Route path={"/academie"}>
        <SuspenseWrap>
          <Academie />
        </SuspenseWrap>
      </Route>
      <Route path={"/grupe"}>
        <SuspenseWrap>
          <Grupe />
        </SuspenseWrap>
      </Route>
      <Route path={"/turnee"}>
        <SuspenseWrap>
          <Turnee />
        </SuspenseWrap>
      </Route>
      <Route path={"/campionat"}>
        <SuspenseWrap>
          <Campionat />
        </SuspenseWrap>
      </Route>
      <Route path={"/stiri"}>
        <SuspenseWrap>
          <Stiri />
        </SuspenseWrap>
      </Route>
      <Route path={"/notificari"}>
        <SuspenseWrap>
          <Notificari />
        </SuspenseWrap>
      </Route>
      <Route path={"/rezultate"}>
        <SuspenseWrap>
          <Rezultate />
        </SuspenseWrap>
      </Route>
      <Route path={"/copii"}>
        <SuspenseWrap>
          <Copii />
        </SuspenseWrap>
      </Route>
      <Route path={"/program"}>
        <SuspenseWrap>
          <Program />
        </SuspenseWrap>
      </Route>
      <Route path={"/galerie"}>
        <SuspenseWrap>
          <Galerie />
        </SuspenseWrap>
      </Route>
      <Route path={"/contact"}>
        <SuspenseWrap>
          <Contact />
        </SuspenseWrap>
      </Route>
      <Route path={"/programare"}>
        <SuspenseWrap>
          <Programare />
        </SuspenseWrap>
      </Route>
      <Route path={"/apel/:token"}>
        <SuspenseWrap>
          <Apel />
        </SuspenseWrap>
      </Route>
      {/* Invited trainers / password recovery land here. No guard: the
          invite link itself carries the session, and the page handles the
          expired-link case. */}
      <Route path={"/seteaza-parola"} component={SeteazaParola} />
      <Route path={"/set-password"} component={SeteazaParola} />
      <Route path={"/login"}>
        <PublicOnly>
          <Login />
        </PublicOnly>
      </Route>
      <Route path={"/inregistrare"}>
        <PublicOnly>
          <Inregistrare />
        </PublicOnly>
      </Route>
      <Route path={"/dashboard"}>
        <RequireAuth>
          <SuspenseWrap>
            <Dashboard />
          </SuspenseWrap>
        </RequireAuth>
      </Route>
      <Route path={"/completeaza-profil"}>
        <RequireAuth>
          <SuspenseWrap>
            <CompleteazaProfil />
          </SuspenseWrap>
        </RequireAuth>
      </Route>
      <Route path={"/inregistrare/copil"}>
        <RequireAuth>
          <SuspenseWrap>
            <InregistrareCopil />
          </SuspenseWrap>
        </RequireAuth>
      </Route>
      <Route path={"/copil/:childId"}>
        <RequireAuth>
          <SuspenseWrap>
            <CopilProfil />
          </SuspenseWrap>
        </RequireAuth>
      </Route>
      <Route path={"/antrenor"}>
        <RequireRole roles={["trainer", "owner", "super_admin"]}>
          <SuspenseWrap>
            <Antrenor />
          </SuspenseWrap>
        </RequireRole>
      </Route>
      <Route path={"/admin"}>
        <RequireRole roles={["owner", "super_admin"]}>
          <SuspenseWrap>
            <Admin />
          </SuspenseWrap>
        </RequireRole>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Safety net for invited trainers + password-recovery links. index.html sets a
 * sessionStorage flag when the load carried an invite/recovery token in the URL
 * hash. Once the session is established, make sure the user lands on
 * /seteaza-parola to choose a password — even if Supabase redirected to the
 * site root because the redirect URL wasn't allow-listed.
 */
function PasswordSetupRedirect() {
  const { session } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (!session) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem("pw-setup-pending") === "1";
    } catch {
      // sessionStorage unavailable — nothing to do
    }
    if (
      pending &&
      location !== "/seteaza-parola" &&
      location !== "/set-password"
    ) {
      navigate("/seteaza-parola");
    }
  }, [session, location, navigate]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <PasswordSetupRedirect />
            <FloatingProgramareCTA />
            <UpdatePrompt />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
