/*
 * Utility function that converts raw Supabase authentication errors into
 * clearer messages that can be shown directly to users during sign-in,
 * sign-up, and password reset flows.
 */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Wrong username or password. Please try again.";
  }

  if (lower.includes("email not confirmed")) {
    return "Your account has not been confirmed yet.";
  }

  if (lower.includes("user not found")) {
    return "Account not found. Check your username or create a new account.";
  }

  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return message;
}
