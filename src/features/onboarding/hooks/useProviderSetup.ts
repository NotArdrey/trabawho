import { useState } from 'react';
import { accountRequest } from '@/shared/services/accountRegistrationService';
import { emptyServiceAddress, serviceAddressValid } from '@/shared/domain/serviceAddress';
export function useProviderSetup(onComplete?: (data: Record<string, unknown>, destination?: string) => unknown) {
  const [step, setStep] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [area, setArea] = useState(emptyServiceAddress);
  const [values, setValues] = useState({ serviceType: '', customServiceType: '', bio: '', age: '', experienceYears: '',
    pricingModel: 'fixed', fixedPrice: '', bookingMode: 'with-slots', rateBasis: 'per-project', paymentAdvance: false,
    paymentAfterService: true, afterServicePaymentType: 'both', gcashNumber: '', qrFileName: '' });
  const update = (key: keyof typeof values, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const next = () => {
    const issue = step === 1 && (!values.serviceType.trim() || !values.bio.trim() || !serviceAddressValid(area, false))
      ? 'Complete your service type, description, and service area.'
      : step === 2 && values.pricingModel === 'fixed' && Number(values.fixedPrice) <= 0 ? 'Enter a valid service price.' : '';
    setError(issue); if (!issue) setStep((current) => Math.min(3, current + 1));
  };
  const save = async (destination = 'my-work') => {
    if (busy) return; setBusy(true); setError('');
    try {
      const setup = { ...values, ...area, serviceType: values.serviceType === 'Others' ? values.customServiceType : values.serviceType };
      await accountRequest('provider-setup', setup);
      await onComplete?.(setup, destination);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Provider setup could not be saved. Retry.'); }
    finally { setBusy(false); }
  };
  return { step, setStep, busy, error, area, setArea, values, update, next, save };
}
