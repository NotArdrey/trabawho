import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  LogIn,
  Mail,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Search,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  clearIdentitySignupState,
  fetchDiditIdentitySession,
  finishDiditIdentitySignup,
  getDocumentType,
  isTerminalIdentityFailure,
  loadIdentitySignupState,
  submitManualIdentityReview,
  startDiditIdentitySession,
} from '@/shared/services/identityRegistrationService';
import {
  getRegistrationFormLogSnapshot,
  logRegistrationDebug,
} from '@/shared/services/registrationLogger';
import BrandWordmark from '@/shared/components/BrandWordmark';
import PasswordField from '../components/PasswordField';
import { RegistrationForm } from '../registration/RegistrationForm';
import { canResendRegistrationEmail, registrationEmailStatus } from '../domain/registrationEmailStatus';

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
      title: 'Sign in',
      subtitle: 'Access your dashboard, bookings, saved providers, and service workspace.',
    };
  }, [isForgotMode, isRegisterMode]);

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
        province: storedState.province || current.province,
        city: storedState.city || current.city,
        barangay: storedState.barangay || current.barangay,
        address: storedState.address || current.address,
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
          setLoginStatusMessage(registrationEmailStatus(result, diditSession.status));
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

  const handleModeChange = (nextMode) => {
    onModeChange?.(nextMode);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    const nextValue = type === 'checkbox' ? checked : type === 'file' ? files?.[0] || null : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    setIdentityStatusMessage('');
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
        pendingLoginStatusRef.current = registrationEmailStatus(result, diditSession.status);
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
      setSubmitError('');
      setLoginStatusMessage('Confirmation email requested. Check your inbox and spam folder.');
    } catch (error) {
      setSubmitError(error?.message || 'Unable to resend verification email.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const resetRegisterSuccess = () => {
    setFormData(EMPTY_AUTH_FORM);
    setIsSignupSuccess(false);
    handleRestartIdentityRegistration();
    handleModeChange('login');
  };

  const shouldShowResend = canResendRegistrationEmail(mode, submitError, loginStatusMessage);

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <button type="button" className="auth-brand" onClick={onBack} aria-label="Back to TrabaWho home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <strong><BrandWordmark /></strong>
        </button>

        <button type="button" className="auth-back-button" onClick={onBack} aria-label="Back to TrabaWho home">
          <span className="auth-back-icon" aria-hidden="true">
            <ArrowLeft size={17} />
          </span>
          <span className="auth-back-label">Back to home</span>
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
            <span className="auth-visual-eyebrow">Built for local work</span>
            <h2>Find help, book work, and manage every job in one place.</h2>
            <p>
              From the first search to the finished service, TrabaWho keeps the experience clear and connected.
            </p>

            <div className="auth-journey-panel">
              <strong>Everything you need to get work moving</strong>
              <ol aria-label="TrabaWho service journey">
                <li><span><Search size={17} aria-hidden="true" /></span><b>Discover</b><small>Find local help</small></li>
                <li><span><CalendarCheck size={17} aria-hidden="true" /></span><b>Schedule</b><small>Choose what works</small></li>
                <li><span><MessageSquareText size={17} aria-hidden="true" /></span><b>Manage</b><small>Stay up to date</small></li>
              </ol>
            </div>
          </div>
        </aside>

        <section className={`auth-panel ${isRegisterMode ? 'register' : isForgotMode ? 'forgot' : 'login'}`}>
          <div className="auth-panel-head">
            <div className="auth-panel-brand" aria-hidden="true">
              <img src="/trabawho-logo.svg" alt="" />
              <span><BrandWordmark /><small>Local services marketplace</small></span>
            </div>
            <span className="auth-panel-accent" aria-hidden="true" />
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
                Sign in
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
                    Back to sign in
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
                    Back to sign in
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
                Continue to sign in
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
                  Continue to sign in
                </button>
              )}
            </div>
          ) : isRegisterMode ? (
            <RegistrationForm
              values={formData}
              onUpdate={(name, value) => setFormData((current) => ({ ...current, [name]: value }))}
              onSubmit={handleAuthSubmit}
              submitError={submitError}
              clearSubmitError={() => setSubmitError('')}
              isSubmitting={isSubmitting}
            />
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label className="auth-field" htmlFor="email">
                <span>Email</span>
                <div className="auth-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange}
                    placeholder="you@example.com" autoComplete="email" required />
                </div>
              </label>
              <PasswordField id="password" label="Password" name="password" value={formData.password}
                onChange={handleInputChange} placeholder="Enter your password" autoComplete="current-password" required />
              {submitError && <div className="auth-alert error">{submitError}</div>}
              {loginStatusMessage && <div className="auth-alert warning">{loginStatusMessage}</div>}
              <button type="submit" className="auth-submit" disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
              <div className="auth-form-footer">
                <button type="button" className="auth-link-button" onClick={() => handleModeChange('forgot')}>Forgot Password?</button>
                {shouldShowResend && <button type="button" className="auth-link-button" onClick={handleResendVerification} disabled={isResendingVerification}>
                  {isResendingVerification ? 'Resending verification...' : 'Resend verification email'}
                </button>}
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

export default AuthPage;
