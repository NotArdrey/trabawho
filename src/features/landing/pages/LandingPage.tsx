import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Navigation from "@/shared/components/Navigation";
import { AuthPage, IdentityRegistrationPage } from "@/features/auth";
import { BrowseServicesPage } from "@/features/marketplace";

import FeaturedServices from "../components/FeaturedServices";
import LandingCategories from "../components/LandingCategories";
import LandingFooter from "../components/LandingFooter";
import LandingHero from "../components/LandingHero";
import LandingSections from "../components/LandingSections";
import type { LandingSearchParams } from "../types";
import { buildServicesUrl } from "@/lib/service-search";

type AuthMode = "login" | "register" | "forgot";

interface LandingPageProps {
  appTheme?: string;
  onLogin?: (...args: unknown[]) => unknown;
  onResendVerification?: (...args: unknown[]) => unknown;
  onForgotPasswordSubmit?: (...args: unknown[]) => unknown;
}

const modeForPath = (pathname: string): AuthMode | null => {
  if (pathname === "/sign-in") return "login";
  if (pathname === "/register") return "register";
  if (pathname === "/forgot-password" || pathname === "/reset-password") return "forgot";
  return null;
};

const legacyModeForHash = (hash: string): AuthMode | null => {
  if (hash === "#login") return "login";
  if (hash === "#register") return "register";
  if (hash === "#forgot-password") return "forgot";
  return null;
};

export default function LandingPage({
  appTheme = "light",
  onLogin,
  onResendVerification,
  onForgotPasswordSubmit,
}: LandingPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const authMode = modeForPath(location.pathname) ?? legacyModeForHash(location.hash);
  const isIdentityRegisterOpen = location.hash === "#identity-register";
  const isPublicBrowseOpen = location.pathname === "/services" || location.hash === "#browse-services";

  useEffect(() => {
    if (location.hash !== "#how-it-works") return;
    window.requestAnimationFrame(() => {
      document.getElementById("how-it-works")?.scrollIntoView();
    });
  }, [location.hash]);

  const goTo = (to: string) => {
    void navigate(to);
  };

  const openAuthMode = (mode: AuthMode) => {
    goTo(
      mode === "register"
        ? "/register"
        : mode === "forgot"
          ? "/forgot-password"
          : "/sign-in",
    );
  };

  const handleSearch = (search: LandingSearchParams) => {
    goTo(buildServicesUrl(search));
  };

  if (authMode) {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={openAuthMode}
        onBack={() => goTo("/")}
        onSubmit={(...args: unknown[]) => onLogin?.(...args)}
        onForgotPasswordSubmit={onForgotPasswordSubmit}
        onResendVerification={onResendVerification}
      />
    );
  }

  if (isIdentityRegisterOpen) {
    return <IdentityRegistrationPage onBack={() => goTo("/")} onLogin={() => openAuthMode("login")} />;
  }

  if (isPublicBrowseOpen) {
    return (
      <div className="min-h-screen bg-background pt-16 sm:pt-18">
        <Navigation
          onLoginClick={() => openAuthMode("login")}
          onBrowseServices={() => goTo("/services")}
          onJoinClick={() => openAuthMode("register")}
          onProviderClick={() => openAuthMode("register")}
        />
        <BrowseServicesPage
          mode="public"
          appTheme={appTheme}
          onThemeChange={undefined}
          onSearchChange={undefined}
          onRequireLogin={() => openAuthMode("login")}
          onLogout={undefined}
          onOpenSellerSetup={undefined}
          onOpenMyBookings={undefined}
          sellerProfile={undefined}
          onOpenMyWork={undefined}
          onOpenProfile={undefined}
          onOpenAccountSettings={undefined}
          onOpenSettings={undefined}
          onOpenDashboard={undefined}
          onOpenBrowseServices={undefined}
          onOpenChatPage={undefined}
          onOpenAdminDashboard={undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation
        onLoginClick={() => openAuthMode("login")}
        onBrowseServices={() => goTo("/services")}
        onJoinClick={() => openAuthMode("register")}
        onProviderClick={() => openAuthMode("register")}
      />
      <main>
        <LandingHero onSearch={handleSearch} />
        <LandingCategories onSelect={handleSearch} />
        <FeaturedServices onBrowseAll={() => goTo("/services")} onSelect={handleSearch} />
        <LandingSections onBecomeProvider={() => openAuthMode("register")} />
      </main>
      <LandingFooter />
    </div>
  );
}
