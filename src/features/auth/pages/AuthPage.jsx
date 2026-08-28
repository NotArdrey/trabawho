import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Home,
  Lock,
  LogIn,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Upload,
  User,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  clearIdentitySignupState,
  DIDIT_DOCUMENT_TYPES,
  fetchDiditIdentitySession,
  finishDiditIdentitySignup,
  getDocumentType,
  isTerminalIdentityFailure,
  loadIdentitySignupState,
  MANUAL_DOCUMENT_TYPES,
  submitManualIdentityReview,
  startDiditIdentitySession,
} from '../../../shared/services/identityRegistrationService';
import {
  getRegistrationFormLogSnapshot,
  logRegistrationDebug,
} from '../../../shared/services/registrationLogger';
import BrandWordmark from '../../../shared/components/BrandWordmark';

const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';

const EMPTY_AUTH_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
  province: '',
  city: '',
  barangay: '',
  address: '',
  accountRole: 'client',
  documentTypeKey: 'id_card',
  manualFullName: '',
  identityDocumentNumber: '',
  idDocumentExpiry: '',
  frontImage: null,
  backImage: null,
  selfieImage: null,
  acceptedIdentityTerms: false,
  acceptedRaTerms: false,
};

const getAuthErrorMessage = (error) => {
  const errorMessage = error?.message || 'Authentication failed. Please try again.';
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  if (lowerMessage.includes('already registered') || lowerMessage.includes('user already exists')) {
    return 'This email is already registered. Please log in or use a different email.';
  }

  if (lowerMessage.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (lowerMessage.includes('weak password')) {
    return 'Password must be at least 8 characters with uppercase letters and numbers.';
  }

  return errorMessage;
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

function AuthPage({
  mode = 'login',
  onModeChange,
  onBack,
  onSubmit,
  onForgotPasswordSubmit,
  onResendVerification,
}) {
  const isRegisterMode = mode === 'register';
  const isForgotMode = mode === 'forgot';
  const isLoginMode = mode === 'login';

  const [formData, setFormData] = useState(EMPTY_AUTH_FORM);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] = useState('');
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [apiError, setApiError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [isForgotSubmitted, setIsForgotSubmitted] = useState(false);
  const [identityStep, setIdentityStep] = useState('details');
  const [identitySession, setIdentitySession] = useState(null);
  const [identityStatusMessage, setIdentityStatusMessage] = useState('');
  const [identityOutcome, setIdentityOutcome] = useState(null);
  const [loginStatusMessage, setLoginStatusMessage] = useState('');
  const latestEmailRef = useRef('');
  const diditReturnHandledRef = useRef(false);
  const pendingLoginStatusRef = useRef('');

  const selectedDocument = useMemo(
    () => getDocumentType(formData.documentTypeKey),
    [formData.documentTypeKey]
  );
  const usesDidit = selectedDocument.mode === 'didit';

  const pageCopy = useMemo(() => {
    if (isForgotMode) {
      return {
        title: 'Reset Password',
        subtitle: 'Send a secure reset link to your email and get back to your bookings.',
      };
    }

    if (isRegisterMode) {
      return {
        title: 'Create Account',
        subtitle: 'Create your client profile, set your location, and start booking trusted local services.',
      };
    }

    return {
      title: 'Login',
      subtitle: 'Access your dashboard, bookings, saved providers, and service workspace.',
    };
  }, [isForgotMode, isRegisterMode]);

  const fetchProvinces = useCallback(async () => {
    setIsLoadingProvinces(true);
    setApiError('');

    try {
      const response = await fetch(`${PSGC_BASE_URL}/provinces/`);
      if (!response.ok) throw new Error('Failed to fetch provinces');
      const data = await response.json();
      setProvinces(data);
    } catch (error) {
      console.error('Error fetching provinces:', error);
      setApiError('Could not load provinces. You can still try again in a moment.');
      setProvinces([
        { code: 'PHR030000000', name: 'Bulacan' },
        { code: 'PHR010000000', name: 'Abra' },
        { code: 'PHR020000000', name: 'Agusan del Norte' },
      ]);
    } finally {
      setIsLoadingProvinces(false);
    }
  }, []);

  useEffect(() => {
    if (isRegisterMode && provinces.length === 0) {
      fetchProvinces();
    }
  }, [fetchProvinces, isRegisterMode, provinces.length]);

  useEffect(() => {
    latestEmailRef.current = formData.email;
  }, [formData.email]);

  useEffect(() => {
    if (!isRegisterMode) return;

    const storedState = loadIdentitySignupState();
    if (!storedState?.diditSessionId) return;

    setIdentitySession(storedState);
    setIdentityStep('didit');
    setIdentityStatusMessage('Verification session restored. You can continue checking the result.');
    setFormData((current) => {
      return {
        ...current,
        email: storedState.email || current.email,
        password: storedState.password || current.password,
        confirmPassword: storedState.password || current.confirmPassword,
        accountRole: storedState.appRole || current.accountRole,
        documentTypeKey: storedState.documentTypeKey || current.documentTypeKey,
        acceptedIdentityTerms: true,
        acceptedRaTerms: true,
      };
    });
  }, [isRegisterMode]);

  useEffect(() => {
    if (!isLoginMode || diditReturnHandledRef.current || typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('check_verification') !== 'true') return;

    diditReturnHandledRef.current = true;

    const replaceReturnUrl = () => {
      window.history.replaceState('', document.title, `${window.location.pathname}#login`);
    };

    const completeDiditReturn = async () => {
      const storedState = loadIdentitySignupState();
      if (!storedState?.diditSessionId) {
        setLoginStatusMessage('Verification finished. Enter your email and password to log in.');
        replaceReturnUrl();
        return;
      }

      try {
        setIsSubmitting(true);
        setSubmitError('');
        setLoginStatusMessage('Finishing your Didit verification...');
        logRegistrationDebug('auth_page:didit_return_started', {
          identitySession: storedState,
        });

        const diditSession = await fetchDiditIdentitySession(storedState.diditSessionId);
        logRegistrationDebug('auth_page:didit_return_status_result', {
          diditSession,
        });

        if (diditSession.status === 'APPROVED' || diditSession.status === 'PENDING_REVIEW') {
          const result = await finishDiditIdentitySignup(storedState, diditSession.status);
          const isPending = result.identityStatus === 'PENDING_REVIEW' || diditSession.status === 'PENDING_REVIEW';
          setFormData((current) => ({
            ...current,
            email: storedState.email || current.email,
            password: '',
            confirmPassword: '',
          }));
          setLoginStatusMessage(isPending
            ? 'Your account was created, but access is held until identity review is approved.'
            : 'Your identity was approved. Confirm your email, then log in.');
          logRegistrationDebug('auth_page:didit_return_finished', {
            result,
            diditStatus: diditSession.status,
            pendingReview: isPending,
          });
          return;
        }

        if (isTerminalIdentityFailure(diditSession.status)) {
          clearIdentitySignupState();
          setLoginStatusMessage('Didit did not approve this attempt. Please start registration again with a valid document.');
          logRegistrationDebug('auth_page:didit_return_terminal_failure', {
            diditStatus: diditSession.status,
          }, 'warn');
          return;
        }

        setLoginStatusMessage('Didit is still processing your verification. Please wait a moment, then try logging in.');
        logRegistrationDebug('auth_page:didit_return_still_processing', {
          diditStatus: diditSession.status,
        });
      } catch (error) {
        logRegistrationDebug('auth_page:didit_return_error', {
          message: error?.message,
          error,
        }, 'error');
        setSubmitError(getAuthErrorMessage(error));
      } finally {
        replaceReturnUrl();
        setIsSubmitting(false);
      }
    };

    completeDiditReturn();
  }, [isLoginMode]);

  useEffect(() => {
    const pendingLoginStatus = pendingLoginStatusRef.current;
    pendingLoginStatusRef.current = '';
    setSubmitError('');
    setForgotError('');
    setApiError('');
    setLoginStatusMessage(mode === 'login' && pendingLoginStatus ? pendingLoginStatus : '');
    setIsSignupSuccess(false);
    setIsForgotSubmitted(false);

    if (mode !== 'register') {
      setIdentityStep('details');
      setIdentityStatusMessage('');
      setIdentityOutcome(null);
    }

    if (mode === 'forgot') {
      setForgotEmail((currentEmail) => currentEmail || latestEmailRef.current);
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [mode]);

  const fetchCities = async (provinceCode) => {
    if (!provinceCode) {
      setCities([]);
      setSelectedCityMunicipalityCode('');
      return;
    }

    setIsLoadingCities(true);
    setApiError('');

    try {
      const response = await fetch(`${PSGC_BASE_URL}/provinces/${provinceCode}/cities-municipalities/`);
      if (!response.ok) throw new Error('Failed to fetch cities');
      const data = await response.json();
      setCities(data);
      setFormData((current) => ({ ...current, city: '', barangay: '' }));
      setSelectedCityMunicipalityCode('');
      setBarangays([]);
    } catch (error) {
      console.error('Error fetching cities:', error);
      setApiError('Could not load cities. Using fallback options for now.');
      setCities([
        { code: 'PHM030000000', name: 'Meycauayan' },
        { code: 'PHM031000000', name: 'Bulacan' },
      ]);
    } finally {
      setIsLoadingCities(false);
    }
  };

  const fetchBarangays = async (cityCode) => {
    if (!cityCode) {
      setBarangays([]);
      return;
    }

    setIsLoadingBarangays(true);
    setApiError('');

    try {
      const response = await fetch(`${PSGC_BASE_URL}/cities-municipalities/${cityCode}/barangays/`);
      if (!response.ok) throw new Error('Failed to fetch barangays');
      const data = await response.json();
      setBarangays(data);
      setFormData((current) => ({ ...current, barangay: '' }));
    } catch (error) {
      console.error('Error fetching barangays:', error);
      setApiError('Could not load barangays. Using fallback options for now.');
      setBarangays([
        { code: 'PHB030000000', name: 'Binakayan' },
        { code: 'PHB030100000', name: 'Canumay' },
      ]);
    } finally {
      setIsLoadingBarangays(false);
    }
  };

  const handleModeChange = (nextMode) => {
    onModeChange?.(nextMode);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    const nextValue = type === 'checkbox' ? checked : type === 'file' ? files?.[0] || null : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    setIdentityStatusMessage('');
  };

  const handleProvinceChange = (event) => {
    const provinceCode = event.target.value;
    const selectedProvince = provinces.find((province) => province.code === provinceCode);

    setSelectedProvinceCode(provinceCode);
    setFormData((current) => ({
      ...current,
      province: selectedProvince ? selectedProvince.name : '',
      city: '',
      barangay: '',
    }));
    fetchCities(provinceCode);
  };

  const handleCityChange = (event) => {
    const cityCode = event.target.value;
    const selectedCity = cities.find((city) => city.code === cityCode);

    setSelectedCityMunicipalityCode(cityCode);
    setFormData((current) => ({
      ...current,
      city: selectedCity ? selectedCity.name : '',
      barangay: '',
    }));
    fetchBarangays(cityCode);
  };

  const handleBarangayChange = (event) => {
    const barangayCode = event.target.value;
    const selectedBarangay = barangays.find((barangay) => barangay.code === barangayCode);

    setFormData((current) => ({
      ...current,
      barangay: selectedBarangay ? selectedBarangay.name : '',
    }));
  };

  const validateAuthForm = () => {
    if (!isRegisterMode) return '';

    if (formData.password !== formData.confirmPassword) {
      return 'Password and confirm password do not match.';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!formData.province || !formData.city || !formData.barangay || !formData.address.trim()) {
      return 'Please complete all service location fields.';
    }

    if (!formData.acceptedIdentityTerms) {
      return 'Confirm that you consent to identity verification before continuing.';
    }

    if (!formData.acceptedRaTerms) {
      return 'Confirm that you agree to the RA 10173 Terms and Conditions before continuing.';
    }

    if (!usesDidit) {
      if (!formData.manualFullName.trim()) return 'Enter the full name exactly as shown on the ID.';
      if (!formData.identityDocumentNumber.trim()) return 'Enter the ID number.';
      if (!formData.idDocumentExpiry) return 'Enter the ID expiry date.';
      if (formData.idDocumentExpiry < getTodayInputValue()) return 'ID expiry date cannot be in the past.';
      if (!formData.frontImage || !formData.backImage || !formData.selfieImage) {
        return 'Upload the front ID image, back ID image, and selfie image.';
      }
    }

    return '';
  };

  const handleIdentityRegistrationSubmit = async () => {
    const identityPayload = {
      ...formData,
      fullName: formData.manualFullName || '',
    };

    logRegistrationDebug('auth_page:identity_submit_started', {
      usesDidit,
      selectedDocument,
      step: identityStep,
      form: getRegistrationFormLogSnapshot(formData),
    });

    if (usesDidit) {
      const session = await startDiditIdentitySession(identityPayload);
      setIdentitySession(session);
      setIdentityStep('didit');
      setIdentityStatusMessage('Didit verification session created. Open Didit to scan your ID and complete face match.');
      logRegistrationDebug('auth_page:didit_step_ready', {
        session,
        nextStep: 'didit',
      });
      return;
    }

    const result = await submitManualIdentityReview({
      ...identityPayload,
      manualFullName: formData.manualFullName,
    });

    setIdentityOutcome({
      kind: 'pending',
      title: 'Manual review submitted',
      message: result.message || 'Your account is queued for manual identity review. Login access stays locked until approval.',
    });
    setIdentityStep('outcome');
    logRegistrationDebug('auth_page:manual_review_outcome_ready', {
      result,
      nextStep: 'outcome',
    });
  };

  const handleCheckDiditStatus = async () => {
    if (!identitySession?.diditSessionId) {
      logRegistrationDebug('auth_page:didit_status_check_blocked', {
        reason: 'missing_identity_session',
        identityStep,
      }, 'warn');
      setSubmitError('Open a Didit verification session first.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');
      setIdentityStatusMessage('Checking Didit result...');
      logRegistrationDebug('auth_page:didit_status_check_started', {
        identitySession,
        identityStep,
      });

      const diditSession = await fetchDiditIdentitySession(identitySession.diditSessionId);
      logRegistrationDebug('auth_page:didit_status_check_result', {
        diditSession,
      });
      if (diditSession.status === 'APPROVED' || diditSession.status === 'PENDING_REVIEW') {
        const result = await finishDiditIdentitySignup(identitySession, diditSession.status);
        const isPending = result.identityStatus === 'PENDING_REVIEW' || diditSession.status === 'PENDING_REVIEW';
        pendingLoginStatusRef.current = isPending
          ? 'Your account was created, but access is held until identity review is approved.'
          : 'Your identity was approved. Confirm your email, then log in.';
        setFormData((current) => ({
          ...current,
          email: identitySession.email || current.email,
          password: '',
          confirmPassword: '',
        }));
        setIdentitySession(null);
        setIdentityOutcome(null);
        setIdentityStatusMessage('');
        setIdentityStep('details');
        handleModeChange('login');
        logRegistrationDebug('auth_page:didit_signup_outcome_ready', {
          result,
          diditStatus: diditSession.status,
          pendingReview: isPending,
          nextStep: 'login',
        });
        return;
      }

      if (isTerminalIdentityFailure(diditSession.status)) {
        clearIdentitySignupState();
        setIdentitySession(null);
        setIdentityOutcome({
          kind: 'failed',
          title: 'Verification was not completed',
          message: 'Didit did not approve this attempt. You can retry with a valid document.',
        });
        setIdentityStep('outcome');
        logRegistrationDebug('auth_page:didit_terminal_failure', {
          diditStatus: diditSession.status,
          nextStep: 'outcome',
        }, 'warn');
        return;
      }

      setIdentityStatusMessage('Didit is still processing your verification. Try checking again in a moment.');
      logRegistrationDebug('auth_page:didit_still_processing', {
        diditStatus: diditSession.status,
      });
    } catch (error) {
      logRegistrationDebug('auth_page:didit_status_check_error', {
        message: error?.message,
        error,
      }, 'error');
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestartIdentityRegistration = () => {
    logRegistrationDebug('auth_page:identity_restart', {
      previousStep: identityStep,
      hadSession: Boolean(identitySession?.diditSessionId),
      hadOutcome: Boolean(identityOutcome),
    });
    clearIdentitySignupState();
    setIdentitySession(null);
    setIdentityOutcome(null);
    setIdentityStatusMessage('');
    setSubmitError('');
    setIdentityStep('details');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    logRegistrationDebug('auth_page:submit_started', {
      mode,
      isRegisterMode,
      identityStep,
      form: isRegisterMode ? getRegistrationFormLogSnapshot(formData) : undefined,
    });

    const validationError = validateAuthForm();
    if (validationError) {
      logRegistrationDebug('auth_page:validation_failed', {
        mode,
        validationError,
        form: isRegisterMode ? getRegistrationFormLogSnapshot(formData) : undefined,
      }, 'warn');
      setSubmitError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      if (isRegisterMode) {
        await handleIdentityRegistrationSubmit();
        logRegistrationDebug('auth_page:submit_finished', {
          mode,
          nextStep: usesDidit ? 'didit' : 'outcome',
        });
        return;
      }

      await onSubmit?.(formData, isLoginMode);

      if (isRegisterMode) {
        setIsSignupSuccess(true);
      }
    } catch (error) {
      logRegistrationDebug('auth_page:submit_error', {
        mode,
        message: error?.message,
        error,
      }, 'error');
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setForgotError('');

    const submittedEmail = event.currentTarget.querySelector('input[name="email"]')?.value ?? '';
    const cleanEmail = submittedEmail.trim();
    if (!cleanEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    try {
      setIsForgotSubmitting(true);
      setForgotEmail(cleanEmail);
      await onForgotPasswordSubmit?.(cleanEmail);
      setIsForgotSubmitted(true);
    } catch (error) {
      setForgotError(error?.message || 'Unable to send password reset email. Please try again.');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const email = formData.email.trim();
    if (!email) {
      setSubmitError('Enter your email first, then resend verification.');
      return;
    }

    try {
      setIsResendingVerification(true);
      await onResendVerification?.(email);
    } catch (error) {
      setSubmitError(error?.message || 'Unable to resend verification email.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const resetRegisterSuccess = () => {
    setFormData(EMPTY_AUTH_FORM);
    setSelectedProvinceCode('');
    setSelectedCityMunicipalityCode('');
    setCities([]);
    setBarangays([]);
    setIsSignupSuccess(false);
    handleRestartIdentityRegistration();
    handleModeChange('login');
  };

  const shouldShowResend = isLoginMode && /verify your email|email not verified|email not confirmed/i.test(submitError || '');

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <button type="button" className="auth-brand" onClick={onBack} aria-label="Back to TrabaWho home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <strong><BrandWordmark /></strong>
        </button>

        <button type="button" className="auth-back-button" onClick={onBack} aria-label="Back to TrabaWho home">
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
      </header>

      <section className="auth-shell" aria-label="TrabaWho authentication">
        <aside className="auth-visual" aria-label="TrabaWho marketplace preview">
          <img
            src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&h=1600&fit=crop"
            alt="Local professionals collaborating with clients"
            className="auth-visual-image"
          />
          <div className="auth-visual-overlay" />
          <div className="auth-visual-content">
            <h2>Find help, book work, and manage every job in one place.</h2>
            <p>
              TrabaWho connects clients with service providers for real schedules,
              transparent rates, and clean booking handoffs.
            </p>

            <div className="auth-proof-grid" aria-label="TrabaWho trust highlights">
              <div>
                <strong>80+</strong>
                <span>Service categories</span>
              </div>
              <div>
                <strong>15m</strong>
                <span>Average response</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>Booking access</span>
              </div>
            </div>
          </div>
        </aside>

        <section className={`auth-panel ${isRegisterMode ? 'register' : isForgotMode ? 'forgot' : 'login'}`}>
          <div className="auth-panel-head">
            <h1>{pageCopy.title}</h1>
            <p>{pageCopy.subtitle}</p>
          </div>

          {!isForgotMode && (
            <div className="auth-mode-toggle" role="tablist" aria-label="Choose login or register">
              <button
                type="button"
                className={isLoginMode ? 'active' : ''}
                onClick={() => handleModeChange('login')}
                role="tab"
                aria-selected={isLoginMode}
              >
                <LogIn size={16} aria-hidden="true" />
                Login
              </button>
              <button
                type="button"
                className={isRegisterMode ? 'active' : ''}
                onClick={() => handleModeChange('register')}
                role="tab"
                aria-selected={isRegisterMode}
              >
                <UserPlus size={16} aria-hidden="true" />
                Register
              </button>
            </div>
          )}

          {isForgotMode ? (
            <form className="auth-form" onSubmit={handleForgotSubmit}>
              {isForgotSubmitted ? (
                <div className="auth-success-panel">
                  <CheckCircle2 size={36} aria-hidden="true" />
                  <h2>Reset link sent</h2>
                  <p>
                    We sent a password reset link to <strong>{forgotEmail}</strong>.
                    Open it from your inbox to create a new password.
                  </p>
                  <button type="button" className="auth-submit secondary" onClick={() => handleModeChange('login')}>
                    <LogIn size={18} aria-hidden="true" />
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <label className="auth-field" htmlFor="forgot-email">
                    <span>Email</span>
                    <div className="auth-input-wrap">
                      <Mail size={18} aria-hidden="true" />
                      <input
                        id="forgot-email"
                        name="email"
                        type="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </label>

                  {forgotError && <div className="auth-alert error">{forgotError}</div>}

                  <button type="submit" className="auth-submit" disabled={isForgotSubmitting}>
                    {isForgotSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
                    {isForgotSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <button type="button" className="auth-link-button center" onClick={() => handleModeChange('login')}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back to Login
                  </button>
                </>
              )}
            </form>
          ) : isSignupSuccess ? (
            <div className="auth-success-panel">
              <CheckCircle2 size={40} aria-hidden="true" />
              <h2>Account created</h2>
              <p>
                We sent a confirmation email to <strong>{formData.email}</strong>.
                Verify your email, then log in to continue.
              </p>
              <button type="button" className="auth-submit" onClick={resetRegisterSuccess}>
                <LogIn size={18} aria-hidden="true" />
                Continue to Login
              </button>
            </div>
          ) : isRegisterMode && identityStep === 'didit' ? (
            <div className="auth-success-panel" data-testid="didit-session-panel">
              <ShieldCheck size={40} aria-hidden="true" />
              <h2>Continue in Didit</h2>
              <p>
                Open Didit to scan your ID, complete liveness, and finish face match.
                You will return to the login page when verification is done.
              </p>
              <a className="auth-submit" href={identitySession?.verificationUrl || '#'}>
                <ExternalLink size={18} aria-hidden="true" />
                Open Didit Verification
              </a>
              <button type="button" className="auth-submit secondary" onClick={handleCheckDiditStatus} disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
                Check Verification Status
              </button>
              <button type="button" className="auth-link-button center" onClick={handleRestartIdentityRegistration}>
                Restart registration
              </button>
              {identityStatusMessage && <div className="auth-alert warning">{identityStatusMessage}</div>}
              {submitError && <div className="auth-alert error">{submitError}</div>}
            </div>
          ) : isRegisterMode && identityStep === 'outcome' && identityOutcome ? (
            <div className="auth-success-panel" data-testid="identity-outcome">
              {identityOutcome.kind === 'failed'
                ? <XCircle size={40} aria-hidden="true" />
                : <CheckCircle2 size={40} aria-hidden="true" />}
              <h2>{identityOutcome.title}</h2>
              <p>{identityOutcome.message}</p>
              {identityOutcome.kind === 'failed' ? (
                <button type="button" className="auth-submit" onClick={handleRestartIdentityRegistration}>
                  <RefreshCw size={18} aria-hidden="true" />
                  Try Again
                </button>
              ) : (
                <button type="button" className="auth-submit" onClick={() => handleModeChange('login')}>
                  <LogIn size={18} aria-hidden="true" />
                  Continue to Login
                </button>
              )}
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div className="auth-register-grid">
                    <label className="auth-field" htmlFor="accountRole">
                      <span>Account Type</span>
                      <div className="auth-input-wrap">
                        <UserPlus size={18} aria-hidden="true" />
                        <select
                          id="accountRole"
                          name="accountRole"
                          value={formData.accountRole}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="client">Client</option>
                          <option value="worker">Worker</option>
                        </select>
                      </div>
                    </label>

                    <label className="auth-field" htmlFor="documentTypeKey">
                      <span>Identity document</span>
                      <div className="auth-input-wrap">
                        <FileText size={18} aria-hidden="true" />
                        <select
                          id="documentTypeKey"
                          name="documentTypeKey"
                          value={formData.documentTypeKey}
                          onChange={handleInputChange}
                          required
                        >
                          <optgroup label="Automatic Didit verification">
                            {DIDIT_DOCUMENT_TYPES.map((document) => (
                              <option key={document.key} value={document.key}>{document.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Manual review">
                            {MANUAL_DOCUMENT_TYPES.map((document) => (
                              <option key={document.key} value={document.key}>{document.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </label>
                  </div>

                  {usesDidit ? (
                    <div className="auth-alert warning">
                      <ShieldCheck size={16} aria-hidden="true" />
                      {selectedDocument.label} uses Didit for ID scan, liveness, and face match before account creation.
                    </div>
                  ) : (
                    <div className="auth-form" data-testid="manual-review-fields">
                      <div className="auth-alert warning">
                        <Upload size={16} aria-hidden="true" />
                        {selectedDocument.label} requires manual review. Upload clear ID images and a selfie.
                      </div>

                      <label className="auth-field" htmlFor="manualFullName">
                        <span>Name on ID</span>
                        <div className="auth-input-wrap">
                          <User size={18} aria-hidden="true" />
                          <input
                            id="manualFullName"
                            name="manualFullName"
                            type="text"
                            value={formData.manualFullName}
                            onChange={handleInputChange}
                            placeholder="Juan Santos Dela Cruz"
                          />
                        </div>
                      </label>

                      <label className="auth-field" htmlFor="identityDocumentNumber">
                        <span>ID number</span>
                        <div className="auth-input-wrap">
                          <FileText size={18} aria-hidden="true" />
                          <input
                            id="identityDocumentNumber"
                            name="identityDocumentNumber"
                            type="text"
                            value={formData.identityDocumentNumber}
                            onChange={handleInputChange}
                            placeholder="ID number"
                          />
                        </div>
                      </label>

                      <label className="auth-field" htmlFor="idDocumentExpiry">
                        <span>ID expiry date</span>
                        <div className="auth-input-wrap">
                          <FileText size={18} aria-hidden="true" />
                          <input
                            id="idDocumentExpiry"
                            name="idDocumentExpiry"
                            type="date"
                            min={getTodayInputValue()}
                            value={formData.idDocumentExpiry}
                            onChange={handleInputChange}
                          />
                        </div>
                      </label>

                      <div className="auth-register-grid">
                        <label className="auth-field" htmlFor="manual-front-image">
                          <span>Front image</span>
                          <div className="auth-input-wrap">
                            <Upload size={18} aria-hidden="true" />
                            <input
                              id="manual-front-image"
                              name="frontImage"
                              type="file"
                              accept="image/*"
                              onChange={handleInputChange}
                            />
                          </div>
                        </label>

                        <label className="auth-field" htmlFor="manual-back-image">
                          <span>Back image</span>
                          <div className="auth-input-wrap">
                            <Upload size={18} aria-hidden="true" />
                            <input
                              id="manual-back-image"
                              name="backImage"
                              type="file"
                              accept="image/*"
                              onChange={handleInputChange}
                            />
                          </div>
                        </label>
                      </div>

                      <label className="auth-field" htmlFor="manual-selfie-image">
                        <span>Selfie image</span>
                        <div className="auth-input-wrap">
                          <Upload size={18} aria-hidden="true" />
                          <input
                            id="manual-selfie-image"
                            name="selfieImage"
                            type="file"
                            accept="image/*"
                            onChange={handleInputChange}
                          />
                        </div>
                      </label>
                    </div>
                  )}
                </>
              )}

              <label className="auth-field" htmlFor="email">
                <span>Email</span>
                <div className="auth-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="auth-field" htmlFor="password">
                <span>Password</span>
                <div className="auth-input-wrap">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                    required
                  />
                </div>
              </label>

              {isRegisterMode && (
                <>
                  <label className="auth-field" htmlFor="confirmPassword">
                    <span>Confirm Password</span>
                    <div className="auth-input-wrap">
                      <Lock size={18} aria-hidden="true" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </label>

                  <div className="auth-location-block">
                    <div>
                      <span className="auth-location-kicker">
                        <MapPin size={15} aria-hidden="true" />
                        Service Location
                      </span>
                      <p>Used to match you with nearby providers in the Philippines.</p>
                    </div>
                  </div>

                  <label className="auth-field" htmlFor="province">
                    <span>Province {isLoadingProvinces && <small>(Loading...)</small>}</span>
                    <div className="auth-input-wrap">
                      <MapPin size={18} aria-hidden="true" />
                      <select
                        id="province"
                        value={selectedProvinceCode}
                        onChange={handleProvinceChange}
                        required
                        disabled={isLoadingProvinces}
                      >
                        <option value="">Select a Province</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code}>{province.name}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="auth-field" htmlFor="city">
                    <span>City/Municipality {isLoadingCities && <small>(Loading...)</small>}</span>
                    <div className="auth-input-wrap">
                      <MapPin size={18} aria-hidden="true" />
                      <select
                        id="city"
                        value={selectedCityMunicipalityCode}
                        onChange={handleCityChange}
                        required
                        disabled={!selectedProvinceCode || isLoadingCities}
                      >
                        <option value="">{!selectedProvinceCode ? 'Select Province First' : 'Select City/Municipality'}</option>
                        {cities.map((city) => (
                          <option key={city.code} value={city.code}>{city.name}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="auth-field" htmlFor="barangay">
                    <span>Barangay {isLoadingBarangays && <small>(Loading...)</small>}</span>
                    <div className="auth-input-wrap">
                      <MapPin size={18} aria-hidden="true" />
                      <select
                        id="barangay"
                        value={formData.barangay ? (barangays.find((barangay) => barangay.name === formData.barangay)?.code || '') : ''}
                        onChange={handleBarangayChange}
                        required
                        disabled={!selectedCityMunicipalityCode || isLoadingBarangays}
                      >
                        <option value="">{!selectedCityMunicipalityCode ? 'Select City First' : 'Select Barangay'}</option>
                        {barangays.map((barangay) => (
                          <option key={barangay.code} value={barangay.code}>{barangay.name}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="auth-field" htmlFor="address">
                    <span>Specific Address</span>
                    <div className="auth-input-wrap">
                      <Home size={18} aria-hidden="true" />
                      <input
                        id="address"
                        name="address"
                        type="text"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Block, street, house number"
                        autoComplete="street-address"
                        required
                      />
                    </div>
                  </label>

                  {apiError && <div className="auth-alert warning">{apiError}</div>}

                  <label className="auth-field" htmlFor="acceptedIdentityTerms">
                    <span>Identity consent</span>
                    <div className="auth-consent-control">
                      <ShieldCheck size={18} aria-hidden="true" />
                      <input
                        id="acceptedIdentityTerms"
                        name="acceptedIdentityTerms"
                        type="checkbox"
                        checked={formData.acceptedIdentityTerms}
                        onChange={handleInputChange}
                        required
                      />
                      <span>I consent to identity verification before account access.</span>
                    </div>
                  </label>

                  <label className="auth-field" htmlFor="acceptedRaTerms">
                    <span>RA 10173 Terms and Conditions</span>
                    <div className="auth-consent-control">
                      <ShieldCheck size={18} aria-hidden="true" />
                      <input
                        id="acceptedRaTerms"
                        name="acceptedRaTerms"
                        type="checkbox"
                        checked={formData.acceptedRaTerms}
                        onChange={handleInputChange}
                        required
                      />
                      <span>I agree to TrabaWho collecting and processing my registration, identity, location, booking, and contact information under Republic Act No. 10173, the Data Privacy Act of 2012.</span>
                    </div>
                  </label>
                </>
              )}

              {submitError && <div className="auth-alert error">{submitError}</div>}
              {isLoginMode && loginStatusMessage && <div className="auth-alert warning">{loginStatusMessage}</div>}

              <button type="submit" className="auth-submit" disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : isRegisterMode ? (usesDidit ? <ShieldCheck size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />) : <LogIn size={18} aria-hidden="true" />}
                {isSubmitting ? (isRegisterMode ? 'Submitting...' : 'Logging in...') : (isRegisterMode ? (usesDidit ? 'Start Didit Verification' : 'Submit Manual Review') : 'Login')}
              </button>

              {isLoginMode && (
                <div className="auth-form-footer">
                  <button type="button" className="auth-link-button" onClick={() => handleModeChange('forgot')}>
                    Forgot Password?
                  </button>
                  {shouldShowResend && (
                    <button
                      type="button"
                      className="auth-link-button"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification}
                    >
                      {isResendingVerification ? 'Resending verification...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

export default AuthPage;
