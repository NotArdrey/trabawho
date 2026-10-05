import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function registrationProgress(registration: AccountRegistration | null) {
  switch (registration?.state) {
    case 'email_pending':
    case 'identity_pending':
    case 'identity_in_progress':
    case 'declined': return 2;
    case 'identity_review':
      return 2;
    case 'name_pending':
    case 'ready': return 2;
    default: return 1;
  }
}
