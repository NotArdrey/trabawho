import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LandingPage, PasswordRecoveryPage, SellerOnboarding } from './features';
import { LoadingScreen, SuccessNotification, ErrorNotification, FloatingChatbot } from './shared/components';
import { useAppNavigation, renderView } from './features/navigation';
import {
  canAccessPath,
  homePathForRole,
  isGuestOnlyPath,
  isKnownPath,
  isPublicPath,
  paths,
} from './app/router/routes';
import type { AppProfile, ResolvedTheme } from './types/application';

interface LegacyNavigationContext {
  [key: string]: unknown;
  isLoadingTransition: boolean;
  isLoggedIn: boolean;
  appTheme: ResolvedTheme;
  currentView: string;
  isSellerOnboardingOpen: boolean;
  sellerProfile: (Omit<Partial<AppProfile>, "role"> & { role?: string }) | null;
  userLocation: unknown;
  currentSearchQuery: string;
  successNotification: { isVisible: boolean; message: string };
  errorNotification: { isVisible: boolean; message: string };
  handleLogin: (...args: unknown[]) => unknown;
  handleResendVerification: (...args: unknown[]) => unknown;
  handleForgotPasswordSubmit: (...args: unknown[]) => unknown;
  handleCloseSellerOnboarding: () => void;
  handleOnboardingComplete: (...args: unknown[]) => unknown;
  handleOpenBrowseServices: () => void;
  handleOpenChatPage: (...args: unknown[]) => void;
  handleSearchChange: (...args: unknown[]) => void;
  hideSuccessNotification: () => void;
  hideErrorNotification: () => void;
}

function App() {
  const location = useLocation();
  const styles: { sellerOnboardingOverlay: CSSProperties } = {
    sellerOnboardingOverlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      zIndex: 150,
      overflowY: 'auto',
      padding: '1rem 0',
    },
  };

  // Use the navigation hook to get all state and handlers
  const navigationContext = useAppNavigation() as unknown as LegacyNavigationContext;


  // DOM setup effect - keeps full-bleed layout
  useEffect(() => {
    const previousBodyMargin = document.body.style.margin;
    const previousBodyPadding = document.body.style.padding;
    const previousBodyMinWidth = document.body.style.minWidth;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousHtmlMargin = document.documentElement.style.margin;
    const previousHtmlPadding = document.documentElement.style.padding;

    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.minWidth = '320px';
    document.body.style.overflowX = 'hidden';

    return () => {
      document.documentElement.style.margin = previousHtmlMargin;
      document.documentElement.style.padding = previousHtmlPadding;
      document.body.style.margin = previousBodyMargin;
      document.body.style.padding = previousBodyPadding;
      document.body.style.minWidth = previousBodyMinWidth;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  // Show loading screen if transition is active
  if (navigationContext.isLoadingTransition) {
    return <LoadingScreen />;
  }

  const rawRole = navigationContext.sellerProfile?.role;
  const role = navigationContext.sellerProfile?.isAdmin || rawRole === 'admin'
    ? 'admin'
    : rawRole === 'worker' || rawRole === 'seller' || rawRole === 'workers'
      ? 'worker'
      : 'client';

  if (!isKnownPath(location.pathname)) {
    return <Navigate to={navigationContext.isLoggedIn ? homePathForRole(role) : paths.home} replace />;
  }

  if (location.pathname === paths.resetPassword) {
    return <PasswordRecoveryPage />;
  }

  // Show landing page if not logged in
  if (!navigationContext.isLoggedIn) {
    if (!isPublicPath(location.pathname)) {
      const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
      return <Navigate to={`${paths.signIn}?returnTo=${returnTo}`} replace />;
    }

    return (
      <>
        <LandingPage
          appTheme={navigationContext.appTheme}
          onLogin={navigationContext.handleLogin}
          onResendVerification={navigationContext.handleResendVerification}
          onForgotPasswordSubmit={navigationContext.handleForgotPasswordSubmit}
        />
        <SuccessNotification
          message={navigationContext.successNotification.message}
          isVisible={navigationContext.successNotification.isVisible}
          onClose={navigationContext.hideSuccessNotification}
        />
        <ErrorNotification
          message={navigationContext.errorNotification.message}
          isVisible={navigationContext.errorNotification.isVisible}
          onClose={navigationContext.hideErrorNotification}
        />
      </>
    );
  }

  if (location.pathname === paths.home || isGuestOnlyPath(location.pathname) || location.pathname === paths.authCallback) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  if (!canAccessPath(location.pathname, role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  // Onboarding overlay
  const sellerOnboardingOverlay = navigationContext.isSellerOnboardingOpen ? (
    <div
      style={{
        ...styles.sellerOnboardingOverlay,
        backgroundColor: navigationContext.appTheme === 'dark' ? 'rgba(15, 23, 42, 0.65)' : styles.sellerOnboardingOverlay.backgroundColor,
      }}
      role="dialog"
      aria-modal="true"
    >
      <SellerOnboarding
        onBack={navigationContext.handleCloseSellerOnboarding}
        onComplete={navigationContext.handleOnboardingComplete}
        userLocation={navigationContext.userLocation}
        appTheme={navigationContext.appTheme}
        isFloating
      />
    </div>
  ) : null;

  const renderWithOnboardingOverlay = (content: ReactNode) => (
    <>
      {content}
      {sellerOnboardingOverlay}
      <FloatingChatbot
        appTheme={navigationContext.appTheme}
        currentView={navigationContext.currentView}
        isLoggedIn={navigationContext.isLoggedIn}
        role={navigationContext.sellerProfile?.role || 'client'}
        isHidden={navigationContext.isSellerOnboardingOpen || navigationContext.currentView === 'chat'}
        onOpenBrowseServices={navigationContext.handleOpenBrowseServices}
        onOpenChatPage={navigationContext.handleOpenChatPage}
        onSearchChange={navigationContext.handleSearchChange}
      />
      <SuccessNotification
        message={navigationContext.successNotification.message}
        isVisible={navigationContext.successNotification.isVisible}
        onClose={navigationContext.hideSuccessNotification}
      />
      <ErrorNotification
        message={navigationContext.errorNotification.message}
        isVisible={navigationContext.errorNotification.isVisible}
        onClose={navigationContext.hideErrorNotification}
      />
    </>
  );

  // Render current view with onboarding overlay
  const currentViewContent = renderView(navigationContext.currentView, navigationContext) as ReactNode;
  return renderWithOnboardingOverlay(currentViewContent);
}

export default App;
