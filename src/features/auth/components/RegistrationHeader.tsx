import { BadgeCheck, Clock, FileCheck, ScanFace, UserRound } from 'lucide-react';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { RegistrationStepHeader } from './RegistrationStepHeader';

export function RegistrationHeader({ registration, step }: { registration: AccountRegistration | null; step?: number }) {
  const state = registration?.state;
  if (step === 1 && state) return <RegistrationStepHeader page icon={UserRound} title="Continue your registration" description="Your account details are saved. Continue to verify your identity." />;
  if (!state) return <RegistrationStepHeader page icon={UserRound} title="Create your account" description="Choose your account type and sign-in details. Next, verify your identity." />;
  if (state === 'email_pending') return <RegistrationStepHeader page icon={FileCheck} title="Registration complete" description="Your identity is approved and your account has been created. Check your inbox to confirm your email, then sign in." />;
  if (state === 'ready') return <RegistrationStepHeader page icon={BadgeCheck} title="Your account is ready" description={registration.signupRole === 'worker' ? 'Your Worker account email and identity are verified. Continue to your service setup.' : 'Your Client account email and identity are verified. You can start booking services.'} />;
  if (state === 'name_pending') return <RegistrationStepHeader page icon={FileCheck} title="Name on your verified ID" description="Didit approved your checks. Confirm the complete legal name from your ID to finish registration." />;
  if (state === 'identity_review') return <RegistrationStepHeader page icon={Clock} title="Identity review pending" description="An administrator must review your identity before you can access the marketplace. Allow up to seven days." />;
  return <RegistrationStepHeader page icon={ScanFace}
    title={state === 'identity_in_progress' ? 'Identity verification in progress' : state === 'declined' ? 'Verification needs another attempt' : 'Verify your identity'}
    description={state === 'identity_in_progress' ? 'Continue your existing Didit session. Return here when you’re finished to check your result.'
      : state === 'declined' ? 'Your previous attempt was declined, abandoned, or expired. You can retry with valid evidence.'
        : 'We verify identities to help keep TrabaWho safe for clients and workers. Choose automatic verification or submit your ID for manual review.'} />;
}
