import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function registrationProgress(registration: AccountRegistration | null) {
  switch (registration?.state) {
    case 'email_pending': return registration.signupName ? 3 : 2;
    case 'identity_pending': return registration.signupName === '' ? 2 : 3;
    case 'identity_in_progress':
    case 'declined': return 3;
    case 'identity_review':
      return 3;
    case 'name_pending':
    case 'ready': return 3;
    default: return 1;
  }
}
