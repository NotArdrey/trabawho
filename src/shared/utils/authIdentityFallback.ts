interface AuthFallbackUser { app_metadata?: Record<string, unknown>; email_confirmed_at?: string | null }

// If profile loading fails, identity/account authorization is unknown. Never
// grant access based on user-editable metadata or a cached registration form.
export function authIdentityFallback(user: AuthFallbackUser | null | undefined) {
  const metadata = user?.app_metadata ?? {};
  return {
    identityRequired: true,
    identityVerificationStatus: typeof metadata.verification_status === "string" ? metadata.verification_status : "PENDING",
    isVerified: false,
    accountStatus: "active",
    role: "client",
    isAdmin: false,
  };
}
