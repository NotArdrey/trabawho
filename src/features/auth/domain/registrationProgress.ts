import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function registrationProgress(registration: AccountRegistration | null) {
  switch (registration?.state) {
    case 'email_pending': return 2;
    case 'identity_pending':
    case 'identity_in_progress':
    case 'declined': return 3;
    case 'identity_review':
      return registration.legalName || registration.requestedName || registration.providerStatus === 'APPROVED' ? 4 : 3;
    case 'name_pending':
    case 'ready': return 4;
    default: return 1;
  }
}
