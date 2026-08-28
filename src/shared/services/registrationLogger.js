const REGISTRATION_LOG_PREFIX = '[TrabaWho Registration]';
const REGISTRATION_TERMINAL_LOG_ENDPOINT = '/__trabawho_registration_log';

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmPassword',
  'sessionNonce',
  'session_nonce',
  'base64',
  'authorization',
  'accessToken',
  'refreshToken',
  'token',
]);

const URL_KEYS = new Set([
  'verificationUrl',
  'verification_url',
  'redirect_url',
  'redirectTo',
  'callback',
  'url',
]);

const ID_KEYS = new Set([
  'userId',
  'user_id',
  'tempUserRef',
  'diditSessionId',
  'sessionId',
  'session_id',
]);

const maskEmail = (value) => {
  if (typeof value !== 'string') return value;
  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) return value;
  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${'*'.repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
};

const maskIdentifier = (value) => {
  if (typeof value !== 'string') return value;
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const describeFile = (file) => {
  if (!file || typeof file !== 'object') return file;
  return {
    name: file.name || 'unnamed-file',
    type: file.type || 'unknown',
    size: typeof file.size === 'number' ? file.size : null,
  };
};

export const sanitizeRegistrationLogValue = (value, key = '') => {
  if (SENSITIVE_KEYS.has(key)) return '[REDACTED]';
  if (URL_KEYS.has(key)) return '[REDACTED_URL]';
  if (ID_KEYS.has(key)) return maskIdentifier(value);
  if (key === 'email') return maskEmail(value);

  if (typeof File !== 'undefined' && value instanceof File) {
    return describeFile(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRegistrationLogValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeRegistrationLogValue(childValue, childKey),
      ])
    );
  }

  return value;
};

export const getRegistrationFormLogSnapshot = (formData = {}) => {
  const documentTypeKey = formData.documentTypeKey || '';
  const acceptedTerms = Boolean(formData.acceptedTerms ?? formData.acceptedIdentityTerms);

  return sanitizeRegistrationLogValue({
    email: formData.email || '',
    accountRole: formData.accountRole || 'client',
    documentTypeKey,
    acceptedTerms,
    passwordLength: typeof formData.password === 'string' ? formData.password.length : 0,
    hasPasswordConfirmation: Boolean(formData.confirmPassword),
    location: {
      province: formData.province || '',
      city: formData.city || '',
      barangay: formData.barangay || '',
      hasAddress: Boolean(formData.address),
    },
    manualReview: {
      hasManualFullName: Boolean(formData.manualFullName),
      hasIdentityDocumentNumber: Boolean(formData.identityDocumentNumber),
      hasExpiryDate: Boolean(formData.idDocumentExpiry),
      frontImage: describeFile(formData.frontImage),
      backImage: describeFile(formData.backImage),
      selfieImage: describeFile(formData.selfieImage),
    },
  });
};

export const logRegistrationDebug = (eventName, details = {}, level = 'log') => {
  const consoleMethod = typeof console?.[level] === 'function' ? level : 'log';
  const payload = {
    timestamp: new Date().toISOString(),
    ...sanitizeRegistrationLogValue(details),
  };

  console[consoleMethod](`${REGISTRATION_LOG_PREFIX} ${eventName}`, payload);

  if (
    process.env.NODE_ENV === 'development'
    && typeof fetch === 'function'
    && typeof window !== 'undefined'
  ) {
    fetch(REGISTRATION_TERMINAL_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        level: consoleMethod,
        payload,
      }),
      keepalive: true,
    }).catch(() => {
      // Terminal forwarding is best-effort and should never affect signup.
    });
  }
};
