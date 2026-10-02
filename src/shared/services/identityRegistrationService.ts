import { supabase } from '@/integrations/supabase';
import type { IdentitySignupInput, IdentitySignupSession, IdentityFunctionResponse } from './identity-registration-types';
import {
  getRegistrationFormLogSnapshot,
  logRegistrationDebug,
  sanitizeRegistrationLogValue,
} from './registrationLogger';


const getServiceLocation = (value: IdentitySignupInput | IdentitySignupSession) => ({
  province: cleanString(value.province),
  city: cleanString(value.city),
  barangay: cleanString(value.barangay),
  address: cleanString(value.address),
});

const readFunctionResponse = (value: unknown): IdentityFunctionResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = { ...value } as Record<string, unknown>;
  const stringFields = ['error', 'message', 'sessionId', 'session_id', 'verificationUrl', 'verification_url', 'url', 'sessionNonce', 'session_nonce', 'workflowId', 'workflow_id', 'identityStatus', 'businessStatus', 'diditResolvedStatus', 'status', 'rawDiditStatus'];
  for (const key of stringFields) {
    if (record[key] === null) delete record[key];
    if (record[key] !== undefined && typeof record[key] !== 'string') throw new Error('The verification service returned an unexpected response. Please try again.');
  }
  if (record.verification_data !== undefined) {
    const verification = record.verification_data;
    if (!verification || typeof verification !== 'object' || ('status' in verification && typeof verification.status !== 'string')) throw new Error('The verification service returned an unexpected status. Please try again.');
  }
  return record;
};

const STORAGE_KEY = 'trabawho.identitySignup.v1';

export const DIDIT_DOCUMENT_TYPES = [
  { key: 'id_card', label: 'National ID / ID card', mode: 'didit' },
  { key: 'passport', label: 'Passport', mode: 'didit' },
  { key: 'drivers_license', label: "Driver's license", mode: 'didit' },
];

export const MANUAL_DOCUMENT_TYPES = [
  { key: 'umid', label: 'UMID', mode: 'manual' },
  { key: 'postal_id', label: 'Postal ID', mode: 'manual' },
  { key: 'voter_id', label: "Voter's ID", mode: 'manual' },
  { key: 'prc_id', label: 'PRC ID', mode: 'manual' },
  { key: 'health_insurance', label: 'Health insurance ID', mode: 'manual' },
  { key: 'custom_document', label: 'Other government document', mode: 'manual' },
];

export const IDENTITY_DOCUMENT_TYPES = [...DIDIT_DOCUMENT_TYPES, ...MANUAL_DOCUMENT_TYPES];

export const IDENTITY_STATUS = {
  ACTIVE: ['PENDING', 'NOT_STARTED', 'IN_PROGRESS', 'PROCESSING', 'SUBMITTED', 'STARTED', 'CREATED'],
  APPROVED: 'APPROVED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  TERMINAL_FAILURE: ['DECLINED', 'REJECTED', 'DENIED', 'ABANDONED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'KYC_EXPIRED'],
};

const cleanString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeEmail = (value: unknown) => cleanString(value).toLowerCase();

export const getDocumentType = (key: string) =>
  IDENTITY_DOCUMENT_TYPES.find((item) => item.key === key) || IDENTITY_DOCUMENT_TYPES[0];

export const getIdentityRoleFromAppRole = (role: string) => (role === 'worker' ? 'musician' : 'fan');

export const getAppRoleFromIdentityRole = (role: string) => (role === 'musician' ? 'worker' : 'client');

export const normalizeIdentityStatus = (value: unknown) => {
  const normalized = cleanString(value).replace(/[\s-]+/g, '_').toUpperCase();
  if (!normalized) return 'PENDING';
  if (['APPROVED'].includes(normalized)) return 'APPROVED';
  if (['IN_REVIEW', 'PENDING_REVIEW', 'PENDING_MANUAL_REVIEW', 'MANUAL_REVIEW'].includes(normalized)) {
    return 'PENDING_REVIEW';
  }
  if (['DECLINED', 'REJECTED', 'DENIED'].includes(normalized)) return 'DECLINED';
  if (['ABANDONED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'KYC_EXPIRED'].includes(normalized)) {
    return normalized === 'CANCELED' ? 'CANCELLED' : normalized;
  }
  if (['NOT_STARTED', 'IN_PROGRESS', 'PENDING', 'PROCESSING', 'SUBMITTED', 'STARTED', 'CREATED'].includes(normalized)) {
    return 'PENDING';
  }
  return normalized;
};

export const isTerminalIdentityFailure = (status: unknown) =>
  IDENTITY_STATUS.TERMINAL_FAILURE.includes(normalizeIdentityStatus(status));

export const isActiveIdentityStatus = (status: unknown) =>
  IDENTITY_STATUS.ACTIVE.includes(normalizeIdentityStatus(status));

const getWindowOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

export const getIdentityRedirectUrl = () => `${getWindowOrigin()}/?check_verification=true#login`;

const buildTempSignupRef = () => {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `TEMP_WEB_SIGNUP_${suffix}`;
};

export const saveIdentitySignupState = (state: IdentitySignupSession) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state,
    savedAt: new Date().toISOString(),
  }));
};

export const loadIdentitySignupState = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    const required = ['tempUserRef', 'email', 'password', 'appRole', 'identityRole', 'documentTypeKey', 'documentTypeLabel', 'diditSessionId', 'sessionNonce', 'verificationUrl'];
    if (!required.every((key) => typeof data[key] === 'string')) return null;
    if (['province', 'city', 'barangay', 'address', 'fullName'].some((key) => data[key] !== undefined && typeof data[key] !== 'string')) return null;
    if (data.workflowId !== null && typeof data.workflowId !== 'string') return null;
    return data as unknown as IdentitySignupSession;
  } catch (error) {
    console.warn('Unable to read identity signup state:', error);
    return null;
  }
};

export const clearIdentitySignupState = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};

const formatEdgeFunctionDetails = (details: unknown): string => {
  if (!details) return '';

  if (typeof details === 'string') {
    try {
      return formatEdgeFunctionDetails(JSON.parse(details));
    } catch {
      return details;
    }
  }

  if (details && typeof details === 'object') {
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('; ');
  }

  return typeof details === 'number' || typeof details === 'boolean' || typeof details === 'bigint' ? String(details) : '';
};

const createEdgeFunctionError = (functionName: string, data: IdentityFunctionResponse) => {
  const baseMessage = data?.error || `Unable to complete ${functionName}.`;
  const detailMessage = formatEdgeFunctionDetails(data?.details);
  const message = detailMessage ? `${baseMessage} Details: ${detailMessage}` : baseMessage;
  const error = Object.assign(new Error(message), { functionName, details: data.details, response: data });
  error.functionName = functionName;
  error.details = data?.details;
  error.response = data;
  return error;
};

const invokeFunction = async (functionName: string, body: Record<string, unknown>): Promise<IdentityFunctionResponse> => {
  const startedAt = Date.now();
  logRegistrationDebug('edge_function:start', {
    functionName,
    request: body,
  });

  const response = await supabase.functions.invoke<unknown>(functionName, { body });
  const error: unknown = response.error;
  const data = readFunctionResponse(response.data);

  if (error) {
    const message = error instanceof Error ? error.message : `Unable to call ${functionName}.`;
    logRegistrationDebug('edge_function:error', {
      functionName,
      durationMs: Date.now() - startedAt,
      message,
      error,
    }, 'error');
    throw new Error(message);
  }

  if (data?.success === false || data?.error) {
    logRegistrationDebug('edge_function:rejected', {
      functionName,
      durationMs: Date.now() - startedAt,
      response: data,
    }, 'warn');
    throw createEdgeFunctionError(functionName, data);
  }

  logRegistrationDebug('edge_function:success', {
    functionName,
    durationMs: Date.now() - startedAt,
    response: data,
  });
  return data || {};
};

export const startDiditIdentitySession = async (formData: IdentitySignupInput) => {
  const normalizedEmail = normalizeEmail(formData.email);
  const appRole = formData.accountRole === 'worker' ? 'worker' : 'client';
  const identityRole = getIdentityRoleFromAppRole(appRole);
  const documentType = getDocumentType(formData.documentTypeKey);
  const tempUserRef = formData.tempUserRef || buildTempSignupRef();

  logRegistrationDebug('didit_session:create_requested', {
    form: getRegistrationFormLogSnapshot({ ...formData, email: normalizedEmail }) as unknown,
    appRole,
    identityRole,
    documentType,
    tempUserRef,
  });

  const data = await invokeFunction('create-didit-session', {
    userId: tempUserRef,
    email: normalizedEmail,
    role: identityRole,
    app_role: appRole,
    document_type: documentType.key,
    redirect_url: getIdentityRedirectUrl(),
    callback: getIdentityRedirectUrl(),
    existing_session_id: formData.existingSessionId || undefined,
    existing_session_nonce: loadIdentitySignupState()?.sessionNonce,
  });

  const sessionId = data.sessionId || data.session_id;
  const verificationUrl = data.verificationUrl || data.verification_url || data.url;

  if (!sessionId || !verificationUrl) {
    logRegistrationDebug('didit_session:missing_response_fields', {
      response: data,
      hasSessionId: Boolean(sessionId),
      hasVerificationUrl: Boolean(verificationUrl),
    }, 'error');
    throw new Error('Didit did not return a usable verification session.');
  }

  const nextState = {
    tempUserRef,
    email: normalizedEmail,
    password: formData.password,
    fullName: formData.fullName,
    acceptedIdentityTerms: formData.acceptedIdentityTerms === true,
    acceptedRaTerms: formData.acceptedRaTerms === true,
    ...getServiceLocation(formData),
    appRole,
    identityRole,
    documentTypeKey: documentType.key,
    documentTypeLabel: documentType.label,
    diditSessionId: sessionId,
    sessionNonce: data.sessionNonce || data.session_nonce || '',
    verificationUrl,
    workflowId: data.workflowId || data.workflow_id || null,
  };

  saveIdentitySignupState(nextState);
  logRegistrationDebug('didit_session:created', {
    session: nextState,
    responseKeys: Object.keys(data || {}),
  });
  return nextState;
};

export const fetchDiditIdentitySession = async (sessionId: string) => {
  if (!sessionId) throw new Error('Missing Didit session.');

  logRegistrationDebug('didit_session:status_check_requested', { sessionId });
  const data = await invokeFunction('create-didit-session', {
    action: 'get_session',
    session_id: sessionId,
    session_nonce: loadIdentitySignupState()?.sessionNonce,
  });

  const status = normalizeIdentityStatus(
    data.businessStatus
      || data.diditResolvedStatus
      || data.status
      || data.verification_data?.status
      || data.rawDiditStatus
  );

  logRegistrationDebug('didit_session:status_resolved', {
    sessionId,
    status,
    rawStatusFields: sanitizeRegistrationLogValue({
      businessStatus: data.businessStatus,
      diditResolvedStatus: data.diditResolvedStatus,
      status: data.status,
      rawDiditStatus: data.rawDiditStatus,
    }) as unknown,
  });
  return { ...data, status };
};

export const finishDiditIdentitySignup = async (state: IdentitySignupSession, status: unknown) => {
  if (!state?.diditSessionId) throw new Error('Missing Didit session.');

  logRegistrationDebug('didit_signup:finish_requested', {
    session: state,
    status: normalizeIdentityStatus(status),
  });

  const data = await invokeFunction('create-unverified-user', {
    email: state.email,
    password: state.password,
    role: state.identityRole,
    appRole: state.appRole || getAppRoleFromIdentityRole(state.identityRole),
    fullName: state.fullName,
    acceptedIdentityTerms: state.acceptedIdentityTerms === true,
    acceptedRaTerms: state.acceptedRaTerms === true,
    ...getServiceLocation(state),
    diditSessionId: state.diditSessionId,
    sessionNonce: state.sessionNonce,
    selectedDocumentType: state.documentTypeLabel,
    selectedDocumentTypeKey: state.documentTypeKey,
    verificationMode: 'didit',
    redirectTo: `${getWindowOrigin()}/#login`,
    diditStatus: normalizeIdentityStatus(status),
  });

  clearIdentitySignupState();
  logRegistrationDebug('didit_signup:finished', {
    diditSessionId: state.diditSessionId,
    result: data,
  });
  return data;
};

const fileToImagePayload = (file: File | null | undefined) => new Promise<{ base64: string; mimeType: string; fileName: string; extension: string } | null>((resolve, reject) => {
  if (!file) {
    resolve(null);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    const extension = cleanString(file.name).split('.').pop() || 'jpg';
    resolve({
      base64: result,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name || `identity-${Date.now()}.${extension}`,
      extension,
    });
  };
  reader.onerror = () => reject(new Error(`Unable to read ${file.name || 'selected image'}.`));
  reader.readAsDataURL(file);
});

export const submitManualIdentityReview = async (formData: IdentitySignupInput) => {
  const appRole = formData.accountRole === 'worker' ? 'worker' : 'client';
  const identityRole = getIdentityRoleFromAppRole(appRole);
  const documentType = getDocumentType(formData.documentTypeKey);
  logRegistrationDebug('manual_review:submit_requested', {
    form: getRegistrationFormLogSnapshot(formData) as unknown,
    appRole,
    identityRole,
    documentType,
  });

  const [frontImage, backImage, selfieImage] = await Promise.all([
    fileToImagePayload(formData.frontImage),
    fileToImagePayload(formData.backImage),
    fileToImagePayload(formData.selfieImage),
  ]);

  logRegistrationDebug('manual_review:files_encoded', {
    frontImage,
    backImage,
    selfieImage,
  });

  const data = await invokeFunction('manual-identity-review', {
    action: 'submit_manual_review_signup',
    email: normalizeEmail(formData.email),
    password: formData.password,
    role: identityRole,
    appRole,
    fullName: formData.manualFullName || formData.fullName,
    acceptedIdentityTerms: formData.acceptedIdentityTerms === true,
    acceptedRaTerms: formData.acceptedRaTerms === true,
    documentType: documentType.label,
    documentTypeKey: documentType.key,
    identityDocumentNumber: formData.identityDocumentNumber,
    idDocumentExpiry: formData.idDocumentExpiry,
    frontImage,
    backImage,
    selfieImage,
    source: 'MANUAL_UPLOAD',
    ...getServiceLocation(formData),
  });

  clearIdentitySignupState();
  logRegistrationDebug('manual_review:submitted', { result: data });
  return data;
};
