import { BadgeCheck, Clock, FileCheck, Mail, ScanFace, UserRound } from 'lucide-react';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { RegistrationStepHeader } from './RegistrationStepHeader';

export function RegistrationHeader({ registration }: { registration: AccountRegistration | null }) {
  const state = registration?.state;
  if (!state) return <RegistrationStepHeader page icon={UserRound} title="Create account" description="Use an email you can access. You’ll confirm it before verifying your identity." />;
  if (state === 'email_pending') return <RegistrationStepHeader page icon={Mail} title="Confirm your email"
    description={'Open the confirmation link sent to ' + (registration?.email || '') + '. Check spam too. Identity verification starts after your email is confirmed.'} />;
  if (state === 'ready') return <RegistrationStepHeader page icon={BadgeCheck} title="Your account is ready" description="Your email and identity are verified. You can start booking, or set up offering your own services." />;
  if (state === 'name_pending') return <RegistrationStepHeader page icon={FileCheck} title="Name on your verified ID" description="Didit approved your checks. Confirm the complete legal name from your ID to finish registration." />;
  if (state === 'identity_review') return <RegistrationStepHeader page icon={Clock} title="Identity review pending" description="An administrator must review your identity before you can access the marketplace. Allow up to seven days." />;
  return <RegistrationStepHeader page icon={ScanFace}
    title={state === 'identity_in_progress' ? 'Identity verification in progress' : state === 'declined' ? 'Verification needs another attempt' : 'Verify your identity'}
    description={state === 'identity_in_progress' ? 'Continue your existing Didit session. Return here when you’re finished to check your result.'
      : state === 'declined' ? 'Your previous attempt was declined, abandoned, or expired. You can retry with valid evidence.'
        : 'Your email is confirmed. Didit will guide you through submitting a supported government ID and completing a selfie check.'} />;
}
