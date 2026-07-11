import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "./services/api";
import AdminPage from "./pages/AdminPage";
import DashboardSidebar from "./components/DashboardSidebar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MarketInsightPage from "./pages/MarketInsightPage";
import OwnerPage from "./pages/OwnerPage";
import ProfilePage from "./pages/ProfilePage";
import ResultPage from "./pages/ResultPage";
import SignupPage from "./pages/SignupPage";

const routeFromLocation = () => window.location.pathname || "/";

export default function App() {
  const [route, setRoute] = useState(routeFromLocation);
  const [session, setSession] = useState({
    username: null,
    role: null,
    email: null,
    contact_number: null,
    profile_image: "",
    isAuthenticated: false
  });
  const [prediction, setPredictionState] = useState(() => {
    const saved = sessionStorage.getItem("lastPrediction");
    return saved ? JSON.parse(saved) : null;
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("rentpredict-theme") === "dark");
  const [loadingSession, setLoadingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    apiGet("/api/session")
      .then(setSession)
      .catch(() => {
        setSession({ username: null, role: null, email: null, contact_number: null, profile_image: "", isAuthenticated: false });
      })
      .finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("rentpredict-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = sidebarOpen ? "hidden" : "";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  };

  const setPrediction = (value) => {
    setPredictionState(value);
    if (value) {
      sessionStorage.setItem("lastPrediction", JSON.stringify(value));
    } else {
      sessionStorage.removeItem("lastPrediction");
    }
  };

  const logout = async () => {
    await apiPost("/api/logout", {});
    setSession({ username: null, role: null, email: null, contact_number: null, profile_image: "", isAuthenticated: false });
    setSidebarOpen(false);
    navigate("/");
  };

  const scrollToSection = (id) => {
    setSidebarOpen(false);
    if (route !== "/") navigate("/");
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, route === "/" ? 0 : 70);
  };

  const pageProps = useMemo(
    () => ({
      session,
      setSession,
      navigate,
      logout,
      darkMode,
      onToggleTheme: () => setDarkMode((value) => !value),
      prediction,
      setPrediction,
      onOpenSidebar: () => setSidebarOpen(true)
    }),
    [session, darkMode, prediction]
  );

  if (loadingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-sky">
        <div className="rounded-lg bg-white px-6 py-4 text-sm font-semibold shadow-soft">
          Loading RentPredict...
        </div>
      </div>
    );
  }

  let page = <HomePage {...pageProps} />;
  if (route === "/login") page = <LoginPage {...pageProps} />;
  if (route === "/signup") page = <SignupPage {...pageProps} />;
  if (route === "/result") page = <ResultPage {...pageProps} />;
  if (route === "/owner") page = <OwnerPage {...pageProps} />;
  if (route === "/admin") page = <AdminPage {...pageProps} />;
  if (route === "/profile") page = <ProfilePage {...pageProps} />;
  if (route.startsWith("/market/")) page = <MarketInsightPage {...pageProps} city={route.replace("/market/", "")} />;

  return (
    <>
      {session.isAuthenticated && (
        <DashboardSidebar
          darkMode={darkMode}
          logout={logout}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onToggleTheme={() => setDarkMode((value) => !value)}
          open={sidebarOpen}
          scrollToSection={scrollToSection}
          session={session}
        />
      )}
      {page}
    </>
  );
}
