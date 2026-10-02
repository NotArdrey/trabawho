import { useState } from 'react';
import { validateRegistrationStep } from './validation';
import type { RegistrationErrors, RegistrationValues, UpdateRegistration } from './types';

export function useRegistrationFlow(values: RegistrationValues, onUpdate: UpdateRegistration, clearSubmitError: () => void) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [attempted, setAttempted] = useState(false);
  const move = (next: number) => {
    setStep(next);
    setErrors({});
    setAttempted(false);
    clearSubmitError();
    requestAnimationFrame(() => document.getElementById('registration-step-heading')?.focus());
  };
  const showErrors = (nextErrors: RegistrationErrors, invalidStep = step) => {
    setStep(invalidStep);
    setAttempted(true);
    setErrors(nextErrors);
    requestAnimationFrame(() => document.getElementById(Object.keys(nextErrors)[0])?.focus());
  };
  const next = () => {
    const nextErrors = validateRegistrationStep(values, step);
    if (Object.keys(nextErrors).length) showErrors(nextErrors);
    else move(step + 1);
  };
  const validateAll = () => {
    for (let index = 1; index <= 4; index++) {
      const nextErrors = validateRegistrationStep(values, index);
      if (Object.keys(nextErrors).length) {
        showErrors(nextErrors, index);
        return false;
      }
    }
    return true;
  };
  const update: UpdateRegistration = (name, value) => {
    onUpdate(name, value);
    clearSubmitError();
    if (attempted) setErrors(validateRegistrationStep({ ...values, [name]: value }, step));
  };
  return { step, errors, move, next, validateAll, update };
}
