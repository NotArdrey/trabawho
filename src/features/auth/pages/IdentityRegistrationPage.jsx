import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  clearIdentitySignupState,
  DIDIT_DOCUMENT_TYPES,
  fetchDiditIdentitySession,
  finishDiditIdentitySignup,
  getDocumentType,
  isActiveIdentityStatus,
  isTerminalIdentityFailure,
  loadIdentitySignupState,
  MANUAL_DOCUMENT_TYPES,
  normalizeIdentityStatus,
  startDiditIdentitySession,
  submitManualIdentityReview,
} from '../../../shared/services/identityRegistrationService';
import {
  getRegistrationFormLogSnapshot,
  logRegistrationDebug,
} from '../../../shared/services/registrationLogger';
import BrandWordmark from '../../../shared/components/BrandWordmark';

const EMPTY_FORM = {
  accountRole: 'client',
  email: '',
  password: '',
  confirmPassword: '',
  documentTypeKey: 'id_card',
  acceptedTerms: false,
  acceptedRaTerms: false,
  manualFullName: '',
  identityDocumentNumber: '',
  idDocumentExpiry: '',
  frontImage: null,
  backImage: null,
  selfieImage: null,
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const getErrorMessage = (error) => {
  const message = error?.message || 'Unable to complete identity registration. Please try again.';
  if (/rate limit|too many/i.test(message)) return 'Too many registration attempts. Please wait a while before trying again.';
  if (/already registered|already exists/i.test(message)) return 'This email is already registered. Please log in or use a different email.';
  if (/session nonce|validated|restart identity/i.test(message)) return 'Your verification session expired. Please restart identity verification.';
  return message;
};

function IdentityRegistrationPage({ onBack, onLogin }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [step, setStep] = useState('details');
  const [savedSession, setSavedSession] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const selectedDocument = useMemo(
    () => getDocumentType(formData.documentTypeKey),
    [formData.documentTypeKey]
  );
  const usesDidit = selectedDocument.mode === 'didit';

  useEffect(() => {
    const storedState = loadIdentitySignupState();
    if (!storedState?.diditSessionId) {
      logRegistrationDebug('identity_page:restore_skipped', {
        reason: 'no_saved_didit_session',
      });
      return;
    }

    logRegistrationDebug('identity_page:session_restored', {
      storedState,
    });
    setSavedSession(storedState);
    setFormData((current) => ({
      ...current,
      accountRole: storedState.appRole || current.accountRole,
      email: storedState.email || current.email,
      password: storedState.password || current.password,
      confirmPassword: storedState.password || current.confirmPassword,
      documentTypeKey: storedState.documentTypeKey || current.documentTypeKey,
      acceptedTerms: true,
      acceptedRaTerms: true,
    }));
    setStep('didit');
    setStatusMessage('Verification session restored. You can continue checking the result.');
  }, []);

  const updateField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setErrorMessage('');
  };

  const validateDetails = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return 'Enter a valid email address.';
    if (formData.password.length < 8) return 'Password must be at least 8 characters.';
    if (formData.password !== formData.confirmPassword) return 'Password and confirm password do not match.';
    if (!formData.acceptedTerms) return 'Confirm that you consent to identity verification before continuing.';
    if (!formData.acceptedRaTerms) return 'Confirm that you agree to the RA 10173 Terms and Conditions before continuing.';

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

  const handleStartDidit = async () => {
    logRegistrationDebug('identity_page:didit_start_clicked', {
      usesDidit,
      selectedDocument,
      form: getRegistrationFormLogSnapshot(formData),
    });
    const validationError = validateDetails();
    if (validationError) {
      logRegistrationDebug('identity_page:validation_failed', {
        action: 'start_didit',
        validationError,
        form: getRegistrationFormLogSnapshot(formData),
      }, 'warn');
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('');
      const session = await startDiditIdentitySession(formData);
      setSavedSession(session);
      setStep('didit');
      setStatusMessage('Didit verification session created. Open the secure verification page to continue.');
      logRegistrationDebug('identity_page:didit_session_ready', {
        session,
        nextStep: 'didit',
      });
    } catch (error) {
      logRegistrationDebug('identity_page:didit_start_error', {
        message: error?.message,
        error,
      }, 'error');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    logRegistrationDebug('identity_page:manual_submit_clicked', {
      selectedDocument,
      form: getRegistrationFormLogSnapshot(formData),
    });
    const validationError = validateDetails();
    if (validationError) {
      logRegistrationDebug('identity_page:validation_failed', {
        action: 'submit_manual_review',
        validationError,
        form: getRegistrationFormLogSnapshot(formData),
      }, 'warn');
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('');
      const data = await submitManualIdentityReview(formData);
      setOutcome({
        kind: 'pending',
        title: 'Manual review submitted',
        message: data.message || 'Your account was created for manual identity review. We will email you after the review decision.',
      });
      setStep('outcome');
      logRegistrationDebug('identity_page:manual_review_outcome_ready', {
        result: data,
        nextStep: 'outcome',
      });
    } catch (error) {
      logRegistrationDebug('identity_page:manual_submit_error', {
        message: error?.message,
        error,
      }, 'error');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckDidit = async () => {
    const session = savedSession || loadIdentitySignupState();
    if (!session?.diditSessionId) {
      logRegistrationDebug('identity_page:didit_check_blocked', {
        reason: 'missing_saved_session',
        step,
      }, 'warn');
      setErrorMessage('No verification session was found. Please restart identity registration.');
      setStep('details');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('Checking Didit verification status...');
      logRegistrationDebug('identity_page:didit_check_started', {
        session,
        step,
      });
      const diditSession = await fetchDiditIdentitySession(session.diditSessionId);
      const normalizedStatus = normalizeIdentityStatus(diditSession.status);
      logRegistrationDebug('identity_page:didit_check_result', {
        diditSession,
        normalizedStatus,
      });

      if (normalizedStatus === 'APPROVED' || normalizedStatus === 'PENDING_REVIEW') {
        const result = await finishDiditIdentitySignup(session, normalizedStatus);
        const pendingReview = normalizedStatus === 'PENDING_REVIEW' || result.identityStatus === 'PENDING_REVIEW';
        setOutcome({
          kind: pendingReview ? 'pending' : 'approved',
          title: pendingReview ? 'Identity review pending' : 'Email confirmation sent',
          message: pendingReview
            ? 'Your account has been created, but access is held until identity review is approved.'
            : 'Your identity was approved. Check your inbox and confirm your email before logging in.',
        });
        onLogin?.();
        logRegistrationDebug('identity_page:didit_signup_outcome_ready', {
          result,
          normalizedStatus,
          pendingReview,
          nextStep: 'login',
        });
        return;
      }

      if (isTerminalIdentityFailure(normalizedStatus)) {
        clearIdentitySignupState();
        setSavedSession(null);
        setOutcome({
          kind: 'failed',
          title: 'Verification was not completed',
          message: 'Didit returned a terminal verification result. You can restart registration and try again.',
        });
        setStep('outcome');
        logRegistrationDebug('identity_page:didit_terminal_failure', {
          normalizedStatus,
          nextStep: 'outcome',
        }, 'warn');
        return;
      }

      if (isActiveIdentityStatus(normalizedStatus)) {
        setStatusMessage('Didit is still processing this verification. Try again in a moment.');
        logRegistrationDebug('identity_page:didit_active_status', {
          normalizedStatus,
        });
        return;
      }

      setStatusMessage(`Current verification status: ${normalizedStatus}.`);
      logRegistrationDebug('identity_page:didit_unhandled_status', {
        normalizedStatus,
      });
    } catch (error) {
      logRegistrationDebug('identity_page:didit_check_error', {
        message: error?.message,
        error,
      }, 'error');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    logRegistrationDebug('identity_page:restart', {
      previousStep: step,
      hadSession: Boolean(savedSession?.diditSessionId),
      hadOutcome: Boolean(outcome),
    });
    clearIdentitySignupState();
    setSavedSession(null);
    setOutcome(null);
    setErrorMessage('');
    setStatusMessage('');
    setStep('details');
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'var(--gl-page)',
      color: 'var(--gl-text)',
    },
    topbar: {
      minHeight: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px clamp(18px, 4vw, 56px)',
      borderBottom: '1px solid var(--gl-border)',
      background: 'var(--gl-surface)',
    },
    brand: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--gl-brand-gap)',
      border: 0,
      background: 'transparent',
      color: 'var(--gl-blue)',
      fontWeight: 900,
      fontSize: 'var(--gl-brand-font-size)',
      lineHeight: 1,
      cursor: 'pointer',
    },
    brandImg: {
      width: 'var(--gl-brand-logo-size)',
      height: 'var(--gl-brand-logo-size)',
      objectFit: 'contain',
      flex: '0 0 auto',
    },
    backButton: {
      minHeight: 42,
      border: '1px solid var(--gl-border)',
      borderRadius: 8,
      background: 'var(--gl-surface)',
      color: 'var(--gl-text)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '0 14px',
      cursor: 'pointer',
      fontWeight: 850,
    },
    shell: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
      gap: 0,
      minHeight: 'calc(100vh - 72px)',
    },
    aside: {
      padding: 'clamp(32px, 5vw, 72px)',
      background: '#0f172a',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 28,
    },
    asideTitle: {
      maxWidth: 520,
      margin: '0 0 14px',
      fontSize: 'clamp(2rem, 4vw, 4rem)',
      lineHeight: 1.08,
      letterSpacing: 0,
      fontWeight: 900,
    },
    asideText: {
      maxWidth: 540,
      margin: 0,
      color: 'rgba(255,255,255,0.82)',
      lineHeight: 1.7,
      fontSize: 16,
    },
    trustGrid: {
      display: 'grid',
      gap: 10,
    },
    trustItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.08)',
      fontWeight: 750,
    },
    main: {
      padding: 'clamp(24px, 5vw, 64px)',
      background: 'var(--gl-surface)',
    },
    panel: {
      maxWidth: 760,
      margin: '0 auto',
      display: 'grid',
      gap: 18,
    },
    header: {
      display: 'grid',
      gap: 8,
    },
    eyebrow: {
      display: 'inline-flex',
      width: 'fit-content',
      alignItems: 'center',
      gap: 7,
      minHeight: 30,
      padding: '0 10px',
      borderRadius: 8,
      border: '1px solid var(--gl-accent-border)',
      color: 'var(--gl-blue)',
      background: 'var(--gl-accent-soft)',
      fontWeight: 850,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    title: {
      margin: 0,
      color: 'var(--gl-text)',
      fontSize: 'clamp(2rem, 4vw, 3rem)',
      lineHeight: 1.1,
      fontWeight: 900,
      letterSpacing: 0,
    },
    subtitle: {
      margin: 0,
      color: 'var(--gl-text-2)',
      lineHeight: 1.65,
      fontSize: 15,
    },
    form: {
      display: 'grid',
      gap: 14,
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
      gap: 14,
    },
    field: {
      display: 'grid',
      gap: 7,
      minWidth: 0,
    },
    label: {
      color: 'var(--gl-text)',
      fontSize: 13,
      fontWeight: 850,
    },
    input: {
      width: '100%',
      minHeight: 46,
      border: '1px solid var(--gl-border-strong)',
      borderRadius: 8,
      background: 'var(--gl-surface)',
      color: 'var(--gl-text)',
      padding: '0 12px',
      outline: 'none',
      boxSizing: 'border-box',
    },
    select: {
      width: '100%',
      minHeight: 46,
      border: '1px solid var(--gl-border-strong)',
      borderRadius: 8,
      background: 'var(--gl-surface)',
      color: 'var(--gl-text)',
      padding: '0 12px',
      outline: 'none',
      boxSizing: 'border-box',
    },
    note: {
      margin: 0,
      padding: 12,
      borderRadius: 8,
      border: '1px solid var(--gl-border)',
      background: 'var(--gl-surface-2)',
      color: 'var(--gl-text-2)',
      lineHeight: 1.55,
      fontSize: 13,
    },
    consent: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      border: '1px solid var(--gl-border)',
      borderRadius: 8,
      background: 'var(--gl-surface-2)',
      color: 'var(--gl-text-2)',
      lineHeight: 1.5,
      fontSize: 13,
    },
    alert: (kind) => ({
      display: 'flex',
      alignItems: 'flex-start',
      gap: 9,
      padding: 12,
      borderRadius: 8,
      border: kind === 'error' ? '1px solid var(--gl-danger-border)' : '1px solid var(--gl-accent-border)',
      background: kind === 'error' ? 'var(--gl-danger-soft)' : 'var(--gl-accent-soft)',
      color: kind === 'error' ? 'var(--gl-red)' : 'var(--gl-blue)',
      fontSize: 13,
      lineHeight: 1.45,
      fontWeight: 750,
    }),
    buttonRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
    },
    primaryButton: {
      minHeight: 46,
      border: '1px solid var(--gl-blue)',
      borderRadius: 8,
      background: 'var(--gl-blue)',
      color: '#ffffff',
      padding: '0 16px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer',
      fontWeight: 900,
      textDecoration: 'none',
    },
    secondaryButton: {
      minHeight: 46,
      border: '1px solid var(--gl-border)',
      borderRadius: 8,
      background: 'var(--gl-surface)',
      color: 'var(--gl-text)',
      padding: '0 16px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer',
      fontWeight: 850,
      textDecoration: 'none',
    },
    statusPanel: {
      display: 'grid',
      gap: 14,
      padding: 18,
      border: '1px solid var(--gl-border)',
      borderRadius: 8,
      background: 'var(--gl-surface-2)',
    },
    outcome: (kind) => ({
      display: 'grid',
      justifyItems: 'center',
      gap: 12,
      padding: 28,
      borderRadius: 8,
      border: kind === 'failed' ? '1px solid var(--gl-danger-border)' : '1px solid var(--gl-success-border)',
      background: kind === 'failed' ? 'var(--gl-danger-soft)' : 'var(--gl-success-soft)',
      textAlign: 'center',
    }),
  };

  return (
    <main style={styles.page} data-testid="identity-registration-page">
      <header style={styles.topbar}>
        <button type="button" style={styles.brand} onClick={onBack} aria-label="Back to TrabaWho home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" style={styles.brandImg} />
          <BrandWordmark />
        </button>
        <button type="button" style={styles.backButton} onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
      </header>

      <section style={styles.shell}>
        <aside style={styles.aside}>
          <div>
            <h1 style={styles.asideTitle}>Identity first. Account second.</h1>
            <p style={styles.asideText}>
              TrabaWho verifies your identity before creating a usable account. Approved users still confirm email before login; pending cases go to manual review.
            </p>
          </div>
          <div style={styles.trustGrid} aria-label="Identity registration safeguards">
            <div style={styles.trustItem}><ShieldCheck size={18} aria-hidden="true" /> Didit hosted verification</div>
            <div style={styles.trustItem}><UserCheck size={18} aria-hidden="true" /> Human review for edge cases</div>
            <div style={styles.trustItem}><FileText size={18} aria-hidden="true" /> Duplicate document protection</div>
          </div>
        </aside>

        <section style={styles.main}>
          <div style={styles.panel}>
            <div style={styles.header}>
              <span style={styles.eyebrow}>
                <ShieldCheck size={15} aria-hidden="true" />
                Verified Registration
              </span>
              <h2 style={styles.title}>Create a verified account</h2>
              <p style={styles.subtitle}>
                Enter account details, choose the ID you will use, and finish verification before the account is created.
              </p>
            </div>

            {step === 'details' && (
              <form
                style={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (usesDidit) handleStartDidit();
                  else handleManualSubmit();
                }}
              >
                <div style={styles.grid2}>
                  <label style={styles.field} htmlFor="identity-account-role">
                    <span style={styles.label}>Account type</span>
                    <select
                      id="identity-account-role"
                      value={formData.accountRole}
                      onChange={(event) => updateField('accountRole', event.target.value)}
                      style={styles.select}
                    >
                      <option value="client">Client</option>
                      <option value="worker">Worker</option>
                    </select>
                  </label>

                  <label style={styles.field} htmlFor="identity-document-type">
                    <span style={styles.label}>Identity document</span>
                    <select
                      id="identity-document-type"
                      value={formData.documentTypeKey}
                      onChange={(event) => updateField('documentTypeKey', event.target.value)}
                      style={styles.select}
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
                  </label>
                </div>

                <div style={styles.grid2}>
                  <label style={styles.field} htmlFor="identity-email">
                    <span style={styles.label}>Email</span>
                    <input
                      id="identity-email"
                      type="email"
                      value={formData.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      style={styles.input}
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label style={styles.field} htmlFor="identity-password">
                    <span style={styles.label}>Password</span>
                    <input
                      id="identity-password"
                      type="password"
                      value={formData.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      style={styles.input}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </div>

                <label style={styles.field} htmlFor="identity-confirm-password">
                  <span style={styles.label}>Confirm password</span>
                  <input
                    id="identity-confirm-password"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    style={styles.input}
                    autoComplete="new-password"
                    required
                  />
                </label>

                {usesDidit ? (
                  <p style={styles.note}>
                    {selectedDocument.label} is supported by Didit. You will be sent to Didit for ID capture, selfie/liveness, and face match.
                  </p>
                ) : (
                  <div style={styles.form} data-testid="manual-review-fields">
                    <p style={styles.note}>
                      {selectedDocument.label} requires manual review. Upload clear images and make sure the ID number and expiry are readable.
                    </p>
                    <div style={styles.grid2}>
                      <label style={styles.field} htmlFor="manual-full-name">
                        <span style={styles.label}>Name on ID</span>
                        <input
                          id="manual-full-name"
                          value={formData.manualFullName}
                          onChange={(event) => updateField('manualFullName', event.target.value)}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field} htmlFor="manual-id-number">
                        <span style={styles.label}>ID number</span>
                        <input
                          id="manual-id-number"
                          value={formData.identityDocumentNumber}
                          onChange={(event) => updateField('identityDocumentNumber', event.target.value)}
                          style={styles.input}
                        />
                      </label>
                    </div>
                    <label style={styles.field} htmlFor="manual-id-expiry">
                      <span style={styles.label}>ID expiry date</span>
                      <input
                        id="manual-id-expiry"
                        type="date"
                        min={getTodayInputValue()}
                        value={formData.idDocumentExpiry}
                        onChange={(event) => updateField('idDocumentExpiry', event.target.value)}
                        style={styles.input}
                      />
                    </label>
                    <div style={styles.grid2}>
                      <label style={styles.field} htmlFor="manual-front-image">
                        <span style={styles.label}>Front image</span>
                        <input
                          id="manual-front-image"
                          type="file"
                          accept="image/*"
                          onChange={(event) => updateField('frontImage', event.target.files?.[0] || null)}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field} htmlFor="manual-back-image">
                        <span style={styles.label}>Back image</span>
                        <input
                          id="manual-back-image"
                          type="file"
                          accept="image/*"
                          onChange={(event) => updateField('backImage', event.target.files?.[0] || null)}
                          style={styles.input}
                        />
                      </label>
                    </div>
                    <label style={styles.field} htmlFor="manual-selfie-image">
                      <span style={styles.label}>Selfie image</span>
                      <input
                        id="manual-selfie-image"
                        type="file"
                        accept="image/*"
                        onChange={(event) => updateField('selfieImage', event.target.files?.[0] || null)}
                        style={styles.input}
                      />
                    </label>
                  </div>
                )}

                <label style={styles.consent}>
                  <input
                    type="checkbox"
                    checked={formData.acceptedTerms}
                    onChange={(event) => updateField('acceptedTerms', event.target.checked)}
                  />
                  <span>
                    I consent to TrabaWho collecting registration details and sending me through Didit or manual identity review before creating account access.
                  </span>
                </label>

                <label style={styles.consent}>
                  <input
                    type="checkbox"
                    checked={formData.acceptedRaTerms}
                    onChange={(event) => updateField('acceptedRaTerms', event.target.checked)}
                    required
                  />
                  <span>
                    I agree to TrabaWho collecting and processing my registration, identity, location, booking, and contact information under Republic Act No. 10173, the Data Privacy Act of 2012.
                  </span>
                </label>

                {errorMessage && (
                  <div style={styles.alert('error')} role="alert">
                    <AlertTriangle size={17} aria-hidden="true" />
                    {errorMessage}
                  </div>
                )}

                {statusMessage && (
                  <div style={styles.alert('info')} role="status">
                    <ShieldCheck size={17} aria-hidden="true" />
                    {statusMessage}
                  </div>
                )}

                <div style={styles.buttonRow}>
                  <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
                    {isSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : usesDidit ? <ShieldCheck size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
                    {isSubmitting ? 'Submitting...' : usesDidit ? 'Start Didit Verification' : 'Submit Manual Review'}
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={onLogin}>
                    Already verified? Login
                  </button>
                </div>
              </form>
            )}

            {step === 'didit' && (
              <div style={styles.statusPanel} data-testid="didit-session-panel">
                <h3 style={{ margin: 0 }}>Continue in Didit</h3>
                <p style={styles.subtitle}>
                  Open the secure Didit verification page. You will return to the login page when verification is done.
                </p>
                <div style={styles.buttonRow}>
                  <a
                    href={savedSession?.verificationUrl || '#'}
                    style={styles.primaryButton}
                  >
                    <ExternalLink size={18} aria-hidden="true" />
                    Open Didit Verification
                  </a>
                  <button type="button" style={styles.secondaryButton} onClick={handleCheckDidit} disabled={isSubmitting}>
                    {isSubmitting ? <RefreshCw className="gl-spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
                    Check Verification Status
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={handleRestart}>
                    Restart
                  </button>
                </div>
                {statusMessage && (
                  <div style={styles.alert('info')} role="status">
                    <ShieldCheck size={17} aria-hidden="true" />
                    {statusMessage}
                  </div>
                )}
                {errorMessage && (
                  <div style={styles.alert('error')} role="alert">
                    <AlertTriangle size={17} aria-hidden="true" />
                    {errorMessage}
                  </div>
                )}
              </div>
            )}

            {step === 'outcome' && outcome && (
              <div style={styles.outcome(outcome.kind)} data-testid="identity-outcome">
                {outcome.kind === 'failed'
                  ? <XCircle size={42} aria-hidden="true" color="var(--gl-red)" />
                  : <CheckCircle2 size={42} aria-hidden="true" color="var(--gl-green)" />}
                <h3 style={{ margin: 0, fontSize: 24 }}>{outcome.title}</h3>
                <p style={styles.subtitle}>{outcome.message}</p>
                <div style={styles.buttonRow}>
                  {outcome.kind === 'failed' ? (
                    <button type="button" style={styles.primaryButton} onClick={handleRestart}>
                      Try Again
                    </button>
                  ) : (
                    <button type="button" style={styles.primaryButton} onClick={onLogin}>
                      Go to Login
                    </button>
                  )}
                  <button type="button" style={styles.secondaryButton} onClick={onBack}>
                    Back Home
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

export default IdentityRegistrationPage;
