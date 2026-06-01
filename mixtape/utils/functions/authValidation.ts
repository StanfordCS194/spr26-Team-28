/*
 * Password validation helpers used to enforce the app's minimum signup
 * requirements.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordChecks(password: string) {
  return {
    hasMinLength: password.length >= MIN_PASSWORD_LENGTH,
    hasNumber: /\d/.test(password),
  };
}

export function isPasswordStrong(password: string) {
  const checks = passwordChecks(password);
  return checks.hasMinLength && checks.hasNumber;
}

export function passwordsMatch(password: string, confirmPassword: string) {
  return password === confirmPassword;
}
