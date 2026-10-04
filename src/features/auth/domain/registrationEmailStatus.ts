interface RegistrationResult {
  identityStatus?: unknown;
  emailDelivery?: { sent?: unknown; skipped?: unknown };
}

export function registrationEmailStatus(result: RegistrationResult, diditStatus: string): string {
  if (result.identityStatus === 'PENDING_REVIEW' || diditStatus === 'PENDING_REVIEW') {
    return 'Your account was created, but access is held until identity review is approved.';
  }
  if (result.emailDelivery?.sent === false && result.emailDelivery.skipped !== true) {
    return 'Your identity was approved, but the confirmation email could not be requested. Use Resend verification email below.';
  }
  return 'Your identity was approved. Confirm your email, then log in.';
}

export function canResendRegistrationEmail(mode: string, error: string, status: string): boolean {
  return mode === 'login' && /verify your email|email not verified|email not confirmed|confirm your email|confirmation email/i.test(`${error} ${status}`);
}
