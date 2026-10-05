import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function registrationProgress(registration: AccountRegistration | null) {
  switch (registration?.state) {
    case 'email_pending': return registration.signupName ? 3 : 2;
    case 'identity_pending':
    case 'identity_in_progress':
    case 'declined': return 4;
    case 'identity_review':
      return 4;
    case 'name_pending':
    case 'ready': return 4;
    default: return 1;
  }
}
