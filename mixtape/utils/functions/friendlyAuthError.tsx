/*
 * Utility function that converts raw Supabase authentication errors into
 * clearer messages that can be shown directly to users during sign-in,
 * sign-up, and password reset flows.
 */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch")
  ) {
    return "We couldn't connect to the server. Check your internet connection and try again.";
  }

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

  if (lower.includes("user already registered")) {
    return "An account with that username already exists. Try a different one.";
  }

  return "Something went wrong. Please try again.";
}
