import { BadgeCheck, Clock, FileCheck, Mail, ScanFace, UserRound } from 'lucide-react';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { RegistrationStepHeader } from './RegistrationStepHeader';

export function RegistrationHeader({ registration, step }: { registration: AccountRegistration | null; step?: number }) {
  const state = registration?.state;
  if (step === 1 && state) return <RegistrationStepHeader page icon={UserRound} title="Account created" description="Your account has been created. Continue with your name, email confirmation, and identity verification." />;
  if (step === 2) return <RegistrationStepHeader page icon={UserRound} title="Your name" description={state === 'email_pending' ? 'Your account has been created. Enter your complete name as it appears on your government ID.' : 'Your name is checked against your government ID during identity verification.'} />;
  if (step === 3 && state !== 'email_pending') return <RegistrationStepHeader page icon={Mail} title="Email confirmed" description="Your email is confirmed. Continue to identity verification." />;
  if (!state) return <RegistrationStepHeader page icon={UserRound} title="Create account" description="Use an email you can access. You’ll confirm it before verifying your identity." />;
  if (state === 'email_pending') return <RegistrationStepHeader page icon={Mail} title="Confirm your email"
    description={registration.emailDelivery?.sent === false ? 'Your account was created, but the confirmation email could not be sent. Request another email below.'
      : 'Open the confirmation link sent to ' + (registration?.email || '') + '. Check spam too. Identity verification starts after your email is confirmed.'} />;
  if (state === 'ready') return <RegistrationStepHeader page icon={BadgeCheck} title="Your account is ready" description={registration.signupRole === 'worker' ? 'Your Worker account email and identity are verified. Continue to your service setup.' : 'Your Client account email and identity are verified. You can start booking services.'} />;
  if (state === 'name_pending') return <RegistrationStepHeader page icon={FileCheck} title="Name on your verified ID" description="Didit approved your checks. Confirm the complete legal name from your ID to finish registration." />;
  if (state === 'identity_review') return <RegistrationStepHeader page icon={Clock} title="Identity review pending" description="An administrator must review your identity before you can access the marketplace. Allow up to seven days." />;
  return <RegistrationStepHeader page icon={ScanFace}
    title={state === 'identity_in_progress' ? 'Identity verification in progress' : state === 'declined' ? 'Verification needs another attempt' : 'Verify your identity'}
    description={state === 'identity_in_progress' ? 'Continue your existing Didit session. Return here when you’re finished to check your result.'
      : state === 'declined' ? 'Your previous attempt was declined, abandoned, or expired. You can retry with valid evidence.'
        : 'Your email is confirmed. Didit will guide you through submitting a supported government ID and completing a selfie check.'} />;
}
