export function signupNameError(value: string): string {
  const name = value.trim();
  if (name.length < 2 || name.length > 200 || !/\p{L}/u.test(name) || /[\p{Cc}\p{Cf}]/u.test(name)) {
    return 'Enter your complete name using 2 to 200 characters.';
  }
  return '';
}
