import { useState, useEffect } from 'react';
import { supabase } from '../../shared/services/supabaseClient';
import {
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  syncAuthenticatedUserProfile,
  fetchUserProfileBundle,
  syncWorkerSetup,
  uploadProfilePhoto,
  updateUserProfileFields,
  updateUserPassword,
  resendSignupVerificationEmail,
  sendPasswordResetEmail,
  isAccountBlockedForLogin,
} from '../../shared/services/authService';
import { getThemeTokens } from '../../shared/styles/themeTokens';
import { getProfilePhotoUrl } from '../../shared/utils/profilePhoto';

const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredThemeMode = () => {
  const savedThemeMode = localStorage.getItem('trabawho-theme-mode');
  return savedThemeMode === 'light' || savedThemeMode === 'dark' || savedThemeMode === 'system'
    ? savedThemeMode
    : 'system';
};

const toErrorMessage = (error, fallbackMessage) => {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

const normalizeRole = (value) => {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (role === 'workers' || role === 'seller' || role === 'sellers') return 'worker';
  return role === 'admin' || role === 'worker' || role === 'client' ? role : 'client';
};

const resolveHomeView = (profile) => {
  const normalizedRole = normalizeRole(profile?.role);
  const isAdmin = Boolean(profile?.isAdmin) || normalizedRole === 'admin';
  return isAdmin ? 'admin-dashboard' : 'client-dashboard';
};

const buildAuthOnlyProfile = (user, source = {}) => {
  const metadata = user?.user_metadata || {};
  const email = user?.email || source?.email || '';
  const province = source?.province || metadata?.province || '';
  const city = source?.city || metadata?.city || '';
  const barangay = source?.barangay || metadata?.barangay || '';
  const address = source?.address || metadata?.address || '';
  const firstName = source?.firstName || metadata?.first_name || '';
  const middleName = source?.middleName || metadata?.middle_name || '';
  const lastName = source?.lastName || metadata?.last_name || '';
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
    || source?.name
    || metadata?.full_name
    || metadata?.name
    || (email ? email.split('@')[0] : 'TrabaWho User');

  const role = normalizeRole(
    typeof source?.role === 'string'
      ? source.role
      : (typeof metadata?.role === 'string' ? metadata.role : 'client')
  );

  return {
    userId: user?.id || null,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    phoneNumber: source?.phoneNumber || metadata?.phone_number || '',
    profilePhoto: getProfilePhotoUrl(source?.profilePhoto || metadata?.profile_photo),
    bio: source?.bio || metadata?.bio || '',
    province,
    city,
    barangay,
    address,
    location: { province, city, barangay, address },
    isClient: true,
    isWorker: false,
    role,
    isAdmin: role === 'admin',
  };
};

export const useAppNavigation = () => {
  // State management
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingTransition, setIsLoadingTransition] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [currentView, setCurrentView] = useState('client-dashboard');
  const [previousView, setPreviousView] = useState('client-dashboard');
  const [selectedChatBookingId, setSelectedChatBookingId] = useState(null);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState(() => getStoredThemeMode());
  const [appTheme, setAppTheme] = useState(() => {
    const initialMode = getStoredThemeMode();
    return initialMode === 'system' ? getSystemTheme() : initialMode;
  });
  const [appLanguage, setAppLanguage] = useState(
    () => localStorage.getItem('trabawho-language') || 'en'
  );
  const [isSellerOnboardingOpen, setIsSellerOnboardingOpen] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [resetEmail, setResetEmail] = useState(null);
  const [successNotification, setSuccessNotification] = useState({ isVisible: false, message: '' });
  const [errorNotification, setErrorNotification] = useState({ isVisible: false, message: '' });

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let isMounted = true;

    const refreshCurrentUserProfile = async () => {
      try {
        const nextProfile = await fetchUserProfileBundle(authUser.id);
        if (!isMounted || !nextProfile) return;

        const accessError = isAccountBlockedForLogin(nextProfile);
        if (accessError) {
          await signOutUser().catch((signOutError) => {
            console.error('Unable to sign out blocked user after realtime update:', signOutError);
          });
          setAuthUser(null);
          setSellerProfile(null);
          setUserLocation(null);
          setIsLoggedIn(false);
          showErrorNotification(accessError);
          return;
        }

        setSellerProfile(nextProfile);
        setUserLocation(nextProfile?.location || null);
      } catch (error) {
        console.error('Unable to refresh current user profile from realtime update:', error);
      }
    };

    // Clean up any existing profile-watch channels (prevents "add callbacks after subscribe" errors)
    try {
      const existing = (supabase.getChannels && supabase.getChannels()) || [];
      existing.forEach((ch) => {
        try {
          if (ch.topic && String(ch.topic).includes(`profile-watch-${authUser.id}`)) {
            supabase.removeChannel(ch);
          }
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      // ignore if getChannels not available
    }

    const channel = supabase
      .channel(`profile-watch-${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${authUser.id}`,
        },
        refreshCurrentUserProfile
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_profiles',
          filter: `user_id=eq.${authUser.id}`,
        },
        refreshCurrentUserProfile
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  const hydrateAuthenticatedUser = async (user, source = {}) => {
    if (!user) return null;

    let profile = source && source.userId ? source : null;
    if (!profile) {
      try {
        profile = await syncAuthenticatedUserProfile(user, source);
      } catch (error) {
        // Keep login usable even if profile sync fails for this account.
        console.error('Profile sync failed during login, falling back to auth-only profile:', error);
        profile = buildAuthOnlyProfile(user, source);
        showErrorNotification('Logged in with limited profile mode. Some profile data could not be synced right now.');
      }
    }

    const accessError = isAccountBlockedForLogin(profile);
    if (accessError) {
      try {
        await signOutUser();
      } catch (signOutError) {
        console.error('Unable to sign out blocked account:', signOutError);
      }
      setAuthUser(null);
      setSellerProfile(null);
      setUserLocation(null);
      setIsLoggedIn(false);
      throw new Error(accessError);
    }

    setAuthUser(user);
    setSellerProfile(profile);
    setUserLocation(profile?.location || null);
    setIsLoggedIn(true);
    setCurrentView(resolveHomeView(profile));
    return profile;
  };

  // Theme effect
  useEffect(() => {
    const nextTheme = themeMode === 'system' ? getSystemTheme() : themeMode;

    setAppTheme(nextTheme);
    localStorage.setItem('trabawho-theme-mode', themeMode);

    if (themeMode !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setAppTheme(getSystemTheme());
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleSystemThemeChange);
      return () => mediaQueryList.removeEventListener('change', handleSystemThemeChange);
    }

    mediaQueryList.addListener(handleSystemThemeChange);
    return () => mediaQueryList.removeListener(handleSystemThemeChange);
  }, [themeMode]);

  // Dark theme class effect
  useEffect(() => {
    const isDarkTheme = appTheme === 'dark';
    const tokens = getThemeTokens(appTheme);

    document.body.classList.toggle('app-theme-dark', isDarkTheme);
    document.body.classList.toggle('app-theme-light', !isDarkTheme);
    document.documentElement.setAttribute('data-theme', appTheme);
    document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';

    const cssVars = {
      '--trabawho-page-bg': tokens.pageBg,
      '--trabawho-page-bg-alt': tokens.pageBgAlt,
      '--trabawho-surface': tokens.surface,
      '--trabawho-surface-alt': tokens.surfaceAlt,
      '--trabawho-surface-soft': tokens.surfaceSoft,
      '--trabawho-border': tokens.border,
      '--trabawho-text-primary': tokens.textPrimary,
      '--trabawho-text-secondary': tokens.textSecondary,
      '--trabawho-text-muted': tokens.textMuted,
      '--trabawho-input-bg': tokens.inputBg,
      '--trabawho-input-border': tokens.inputBorder,
      '--trabawho-input-text': tokens.inputText,
      '--trabawho-accent': tokens.accent,
      '--trabawho-accent-hover': tokens.accentHover || tokens.accent,
      '--trabawho-accent-deep': tokens.accentDeep || tokens.accent,
      '--trabawho-accent-soft': tokens.accentSoft,
      '--trabawho-accent-border': tokens.accentBorder,
      '--trabawho-accent-ring': tokens.accentRing,
      '--trabawho-accent-shadow': tokens.accentShadow,
      '--trabawho-shadow': tokens.shadow,
      '--trabawho-shadow-soft': tokens.shadowSoft,
      '--trabawho-nav-bg': tokens.navBg,
      '--trabawho-nav-border': tokens.navBorder,
      '--trabawho-badge-bg': tokens.badgeBg,
      '--trabawho-badge-text': tokens.badgeText,
      '--trabawho-success-bg': tokens.successBg,
      '--trabawho-success': tokens.success,
      '--trabawho-success-text': tokens.successText,
      '--trabawho-success-border': tokens.successBorder,
      '--trabawho-danger': tokens.danger,
      '--trabawho-danger-bg': tokens.dangerBg,
      '--trabawho-danger-border': tokens.dangerBorder,
      '--trabawho-warning': tokens.warning,
      '--trabawho-warning-bg': tokens.warningBg,
      '--trabawho-warning-border': tokens.warningBorder,
      '--gl-page': tokens.pageBg,
      '--gl-page-soft': tokens.surfaceSoft,
      '--gl-surface': tokens.surface,
      '--gl-surface-2': tokens.surfaceAlt,
      '--gl-surface-3': tokens.surfaceSoft,
      '--gl-border': tokens.border,
      '--gl-border-strong': tokens.inputBorder,
      '--gl-text': tokens.textPrimary,
      '--gl-text-2': tokens.textSecondary,
      '--gl-text-3': tokens.textMuted,
      '--gl-blue': tokens.accent,
      '--gl-blue-2': tokens.accentHover || tokens.accentDeep || tokens.accent,
      '--gl-cyan': '#ff7a00',
      '--gl-green': tokens.success,
      '--gl-amber': tokens.warning,
      '--gl-red': tokens.danger,
      '--gl-accent-soft': tokens.accentSoft,
      '--gl-accent-border': tokens.accentBorder,
      '--gl-accent-ring': tokens.accentRing,
      '--gl-accent-shadow': tokens.accentShadow,
      '--gl-success-soft': tokens.successBg,
      '--gl-success-border': tokens.successBorder,
      '--gl-danger-soft': tokens.dangerBg,
      '--gl-danger-border': tokens.dangerBorder,
      '--gl-warning-soft': tokens.warningBg,
      '--gl-warning-border': tokens.warningBorder,
      '--gl-shadow': tokens.shadow,
      '--gl-shadow-soft': tokens.shadowSoft,
      '--bg-page': tokens.pageBg,
      '--bg-surface': tokens.surface,
      '--border-default': tokens.border,
      '--text-primary': tokens.textPrimary,
      '--text-secondary': tokens.textSecondary,
    };

    Object.entries(cssVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    document.body.style.backgroundColor = tokens.pageBg;
    document.body.style.color = tokens.textPrimary;
  }, [appTheme]);

  // Language effect
  useEffect(() => {
    localStorage.setItem('trabawho-language', appLanguage);
    document.documentElement.lang = appLanguage === 'fil' ? 'fil' : 'en';
  }, [appLanguage]);

  // Authentication bootstrap effect
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessionUser = data.session?.user || null;
        if (!isMounted) return;

        if (sessionUser) {
          let profile;
          try {
            profile = await syncAuthenticatedUserProfile(sessionUser);
          } catch (profileError) {
            console.error('Unable to sync profile from session restore, using auth-only profile:', profileError);
            profile = buildAuthOnlyProfile(sessionUser);
            showErrorNotification('Session restored in limited profile mode. Some profile data could not be loaded.');
          }

          const accessError = isAccountBlockedForLogin(profile);
          if (accessError) {
            try {
              await signOutUser();
            } catch (signOutError) {
              console.error('Unable to sign out blocked session:', signOutError);
            }
            if (isMounted) {
              setIsLoggedIn(false);
              setAuthUser(null);
              setSellerProfile(null);
              setUserLocation(null);
              showErrorNotification(accessError);
              setIsLoadingTransition(false);
            }
            return;
          }

          setAuthUser(sessionUser);
          setSellerProfile(profile);
          setUserLocation(profile?.location || null);
          setIsLoggedIn(true);
          setCurrentView(resolveHomeView(profile));
          if (!isMounted) return;
        }
      } catch (error) {
        console.error('Unable to restore Supabase session:', error);
        if (isMounted) {
          setIsLoggedIn(false);
          setAuthUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTransition(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler functions
  const showSuccessNotification = (message) => {
    setSuccessNotification({ isVisible: true, message });
  };

  const hideSuccessNotification = () => {
    setSuccessNotification({ isVisible: false, message: '' });
  };

  const showErrorNotification = (message) => {
    setErrorNotification({
      isVisible: true,
      message: toErrorMessage(message, 'Something went wrong. Please try again.'),
    });
  };

  const hideErrorNotification = () => {
    setErrorNotification({ isVisible: false, message: '' });
  };

  const handleLogin = async (formData, isLoginMode = true) => {
    try {
      if (isLoginMode) {
        const user = await signInWithEmail({
          email: formData.email,
          password: formData.password,
        });
        // Only show the loading screen AFTER we know auth succeeded
        setIsLoadingTransition(true);
        const result = await hydrateAuthenticatedUser(user);
        showSuccessNotification('Welcome back! You have successfully logged in.');
        setIsLoadingTransition(false);
        return result;
      }

      const result = await signUpWithEmail(formData);

      if (result.requiresEmailVerification) {
        showSuccessNotification('Account created. Please verify your email first, then log in.');
        return result.user;
      }

      // Only show the loading screen AFTER we know signup succeeded
      setIsLoadingTransition(true);
      await hydrateAuthenticatedUser(result.user, result.profile || {
        userId: result.user.id,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        fullName: [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ').trim(),
        email: formData.email,
        location: {
          province: formData.province,
          city: formData.city,
          barangay: formData.barangay,
          address: formData.address,
        },
        isWorker: false,
      });
      showSuccessNotification('Account created successfully! Welcome to TrabaWho.');
      setIsLoadingTransition(false);
      return result.user;
    } catch (error) {
      setIsLoadingTransition(false);
      setIsLoggedIn(false);
      setAuthUser(null);
      throw error;
    }
  };

  const handleLogout = async () => {
    setIsLoadingTransition(true);

    try {
      await signOutUser();
    } catch (error) {
      console.error('Supabase sign out failed:', error);
    } finally {
      setIsLoggedIn(false);
      setAuthUser(null);
      setSellerProfile(null);
      setUserLocation(null);
      setIsSellerOnboardingOpen(false);
      setSelectedChatBookingId(null);
      setCurrentView('client-dashboard');
      setIsLoadingTransition(false);
    }
  };

  const handleOpenSellerOnboarding = () => {
    setIsSellerOnboardingOpen(true);
  };

  const handleOnboardingComplete = async (profileData, destination = 'my-work') => {
    const userId = authUser?.id || sellerProfile?.userId;
    if (!userId) return;

    const resolvedLocation = profileData?.location || userLocation || sellerProfile?.location || {};
    const profilePayload = {
      ...profileData,
      firstName: profileData?.firstName || sellerProfile?.firstName || authUser?.user_metadata?.first_name || '',
      middleName: profileData?.middleName || sellerProfile?.middleName || authUser?.user_metadata?.middle_name || '',
      lastName: profileData?.lastName || sellerProfile?.lastName || authUser?.user_metadata?.last_name || '',
      serviceType: profileData?.serviceType || sellerProfile?.serviceType || '',
      customServiceType: profileData?.customServiceType || sellerProfile?.customServiceType || '',
      bio: profileData?.bio || sellerProfile?.bio || '',
      pricingModel: profileData?.pricingModel || sellerProfile?.pricingModel || 'fixed',
      fixedPrice: profileData?.fixedPrice || sellerProfile?.fixedPrice || '',
      rateBasis: profileData?.rateBasis || sellerProfile?.rateBasis || 'per-project',
      bookingMode: profileData?.bookingMode || sellerProfile?.bookingMode || 'with-slots',
      paymentAdvance: profileData?.paymentAdvance ?? sellerProfile?.paymentAdvance ?? false,
      paymentAfterService: profileData?.paymentAfterService ?? sellerProfile?.paymentAfterService ?? true,
      afterServicePaymentType: profileData?.afterServicePaymentType || sellerProfile?.afterServicePaymentType || 'both',
      gcashNumber: profileData?.gcashNumber || sellerProfile?.gcashNumber || '',
      qrFileName: profileData?.qrFileName || sellerProfile?.qrFileName || '',
      fullName: profileData?.fullName
        || sellerProfile?.fullName
        || [
          profileData?.firstName || sellerProfile?.firstName || authUser?.user_metadata?.first_name || '',
          profileData?.middleName || sellerProfile?.middleName || authUser?.user_metadata?.middle_name || '',
          profileData?.lastName || sellerProfile?.lastName || authUser?.user_metadata?.last_name || '',
        ].filter(Boolean).join(' ').trim()
        || authUser?.user_metadata?.full_name
        || authUser?.user_metadata?.name
        || '',
      email: profileData?.email || authUser?.email || sellerProfile?.email || '',
      province: profileData?.province || resolvedLocation.province || '',
      city: profileData?.city || resolvedLocation.city || '',
      barangay: profileData?.barangay || resolvedLocation.barangay || '',
      address: profileData?.address || resolvedLocation.address || '',
      location: resolvedLocation,
    };

    try {
      const mergedProfile = await syncWorkerSetup(userId, profilePayload);
      setSellerProfile(mergedProfile);
      setUserLocation(mergedProfile?.location || null);
      setIsSellerOnboardingOpen(false);
      if (destination === 'home') {
        setCurrentView('client-dashboard');
        return;
      }
      setCurrentView('my-work');
    } catch (error) {
      console.error('Failed to complete seller onboarding (first attempt):', error);

      // Retry once with a minimal payload to avoid issues from optional fields.
      try {
        const retryPayload = {
          fullName: profilePayload.fullName,
          serviceType: profilePayload.serviceType,
          customServiceType: profilePayload.customServiceType,
          bio: profilePayload.bio,
          pricingModel: profilePayload.pricingModel,
          fixedPrice: profilePayload.fixedPrice,
          bookingMode: profilePayload.bookingMode,
          rateBasis: profilePayload.rateBasis,
          paymentAdvance: profilePayload.paymentAdvance,
          paymentAfterService: profilePayload.paymentAfterService,
          afterServicePaymentType: profilePayload.afterServicePaymentType,
          gcashNumber: profilePayload.gcashNumber,
          qrFileName: profilePayload.qrFileName,
          province: profilePayload.province,
          city: profilePayload.city,
          barangay: profilePayload.barangay,
          address: profilePayload.address,
          location: profilePayload.location,
        };

        const mergedProfile = await syncWorkerSetup(userId, retryPayload);
        setSellerProfile(mergedProfile);
        setUserLocation(mergedProfile?.location || null);
        setIsSellerOnboardingOpen(false);
        setCurrentView(destination === 'home' ? 'client-dashboard' : 'my-work');
        showSuccessNotification('Seller onboarding synced on retry.');
        return;
      } catch (retryError) {
        console.error('Failed to complete seller onboarding (retry):', retryError);
      }

      // Keep user in onboarding with a real backend error instead of fake local mode.
      setIsSellerOnboardingOpen(true);
      showErrorNotification(
        `${toErrorMessage(error, 'Unable to sync seller onboarding.')}`
        + ' Please ensure Supabase seller tables and RLS policies are applied (profiles, worker_profiles, sellers, services).'
      );
    }
  };

  const handleCloseSellerOnboarding = () => {
    setIsSellerOnboardingOpen(false);
  };

  const handleProfileUpdate = async (updatedProfileFields) => {
    const currentUser = authUser || {
      id: sellerProfile?.userId,
      email: sellerProfile?.email,
      user_metadata: {},
    };

    if (!currentUser?.id) return;

    const profileFields = { ...(updatedProfileFields || {}) };

    if (profileFields.profilePhotoFile) {
      const uploadedPhotoUrl = await uploadProfilePhoto({
        userId: currentUser.id,
        file: profileFields.profilePhotoFile,
      });
      profileFields.profilePhoto = uploadedPhotoUrl;
      delete profileFields.profilePhotoFile;
    }

    const mergedProfile = await updateUserProfileFields(currentUser, profileFields);

    setSellerProfile((prev) => mergedProfile || prev);
    setUserLocation((prev) => mergedProfile?.location || prev);

    return mergedProfile;
  };

  const handlePasswordUpdate = async ({ currentPassword, newPassword }) => {
    const currentUserEmail = authUser?.email || sellerProfile?.email;
    await updateUserPassword({
      email: currentUserEmail,
      currentPassword,
      newPassword,
    });
  };

  const handleBackToClientDashboard = () => {
    setSelectedChatBookingId(null);
    setCurrentView('client-dashboard');
  };

  const handleOpenAdminDashboard = () => {
    setSelectedChatBookingId(null);
    setCurrentView('admin-dashboard');
  };

  const handleOpenMyBookings = () => {
    setSelectedChatBookingId(null);
    setCurrentView('my-bookings');
  };

  const handleOpenChatPage = (bookingId = null) => {
    const nextBookingId = bookingId && typeof bookingId === 'object' ? null : bookingId;
    setSelectedChatBookingId(nextBookingId || null);
    setCurrentView('chat');
  };

  const handleOpenBrowseServices = () => {
    setSelectedChatBookingId(null);
    setCurrentView('browse-services');
  };

  const handleOpenMyWork = () => {
    setSelectedChatBookingId(null);
    setCurrentView('my-work');
  };

  const handleOpenProfile = () => {
    setSelectedChatBookingId(null);
    setCurrentView('profile');
  };

  const handleOpenAccountSettings = () => {
    setSelectedChatBookingId(null);
    setCurrentView('account-settings');
  };

  const handleOpenSettings = () => {
    setPreviousView(currentView);
    setCurrentView('settings');
  };

  const handleBackFromSettings = () => {
    setCurrentView(previousView || 'client-dashboard');
  };

  const handleThemeChange = (nextTheme) => {
    if (nextTheme === 'system') {
      setThemeMode('system');
      return;
    }

    setThemeMode(nextTheme === 'dark' ? 'dark' : 'light');
  };

  const handleLanguageChange = (nextLanguage) => {
    setAppLanguage(nextLanguage === 'fil' ? 'fil' : 'en');
  };

  const handleSearchChange = (event) => {
    if (event && event.target) {
      setCurrentSearchQuery(event.target.value);
    }
  };

  const handleOpenForgotPassword = () => {
    setCurrentView('forgot-password');
  };

  const handleResendVerification = async (email) => {
    await resendSignupVerificationEmail(email);
    showSuccessNotification('Verification email sent. Please check your inbox.');
  };

  const handleForgotPasswordSubmit = async (email) => {
    await sendPasswordResetEmail(email);
    showSuccessNotification('Password reset link sent. Please check your inbox.');
  };

  const handleOpenResetPassword = (token, email) => {
    setResetToken(token);
    setResetEmail(email);
    setCurrentView('reset-password');
  };

  const handleBackToLogin = () => {
    setCurrentView('client-dashboard');
    setResetToken(null);
    setResetEmail(null);
  };

  return {
    // State
    isLoggedIn,
    isLoadingTransition,
    authUser,
    currentView,
    previousView,
    selectedChatBookingId,
    sellerProfile,
    userLocation,
    currentSearchQuery,
    themeMode,
    appTheme,
    appLanguage,
    isSellerOnboardingOpen,
    resetToken,
    resetEmail,
    successNotification,
    errorNotification,

    // Handlers
    handleLogin,
    handleLogout,
    handleOpenSellerOnboarding,
    handleOnboardingComplete,
    handleCloseSellerOnboarding,
    handleProfileUpdate,
    handlePasswordUpdate,
    handleBackToClientDashboard,
    handleOpenAdminDashboard,
    handleOpenMyBookings,
    handleOpenChatPage,
    handleOpenBrowseServices,
    handleOpenMyWork,
    handleOpenProfile,
    handleOpenAccountSettings,
    handleOpenSettings,
    handleBackFromSettings,
    handleThemeChange,
    handleLanguageChange,
    handleSearchChange,
    handleOpenForgotPassword,
    handleResendVerification,
    handleForgotPasswordSubmit,
    handleOpenResetPassword,
    handleBackToLogin,
    showSuccessNotification,
    hideSuccessNotification,
    showErrorNotification,
    hideErrorNotification,
  };
};
