export interface BaseAccountValues { email: string; password: string; confirmPassword: string; acceptedTerms: boolean }
export type BaseAccountErrors = Partial<Record<keyof BaseAccountValues, string>>;
export function baseAccountErrors(values: BaseAccountValues): BaseAccountErrors {
  const errors: BaseAccountErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.password.length < 8 || values.password.length > 128) errors.password = 'Use a password of 8 to 128 characters.';
  else if (values.password !== values.password.trim()) errors.password = 'Remove spaces at the beginning or end of your password.';
  if (!values.confirmPassword) errors.confirmPassword = 'Re-enter your password to confirm it.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match. Re-enter the same password.';
  if (!values.acceptedTerms) errors.acceptedTerms = 'Accept the Terms and Conditions to create your account.';
  return errors;
}
