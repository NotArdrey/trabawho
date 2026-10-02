export interface ServiceLocation {
  province?: string;
  city?: string;
  barangay?: string;
  address?: string;
}

export interface IdentitySignupInput extends ServiceLocation {
  acceptedIdentityTerms?: boolean;
  acceptedRaTerms?: boolean;
  email: string;
  password: string;
  accountRole: string;
  documentTypeKey: string;
  fullName?: string;
  manualFullName?: string;
  identityDocumentNumber?: string;
  idDocumentExpiry?: string;
  frontImage?: File | null;
  backImage?: File | null;
  selfieImage?: File | null;
  tempUserRef?: string;
  existingSessionId?: string;
}

export interface IdentitySignupSession extends ServiceLocation {
  acceptedIdentityTerms?: boolean;
  acceptedRaTerms?: boolean;
  tempUserRef: string;
  email: string;
  password: string;
  fullName?: string;
  appRole: string;
  identityRole: string;
  documentTypeKey: string;
  documentTypeLabel: string;
  diditSessionId: string;
  sessionNonce: string;
  verificationUrl: string;
  workflowId: string | null;
}

export interface IdentityFunctionResponse {
  [key: string]: unknown;
  success?: boolean;
  error?: string;
  details?: unknown;
  message?: string;
  sessionId?: string;
  session_id?: string;
  verificationUrl?: string;
  verification_url?: string;
  url?: string;
  sessionNonce?: string;
  session_nonce?: string;
  workflowId?: string;
  workflow_id?: string;
  identityStatus?: string;
  businessStatus?: string;
  diditResolvedStatus?: string;
  status?: string;
  rawDiditStatus?: string;
  verification_data?: { status?: string };
}
