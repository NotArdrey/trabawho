import type { AppRoute, UserRole } from "@/types/application";

export type LegacyView =
  | "admin-dashboard"
  | "client-dashboard"
  | "browse-services"
  | "my-bookings"
  | "worker-bookings"
  | "chat"
  | "my-work"
  | "worker-dashboard"
  | "profile"
  | "account-settings"
  | "settings";

export const paths = {
  home: "/",
  services: "/services",
  signIn: "/sign-in",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  bookings: "/bookings",
  workerBookings: "/worker/bookings",
  messages: "/messages",
  work: "/work",
  workerDashboard: "/worker/dashboard",
  profile: "/profile",
  accountSettings: "/settings/account",
  preferences: "/settings/preferences",
  sellerOnboarding: "/seller/onboarding",
  admin: "/admin",
} as const satisfies Record<string, AppRoute | "/messages">;

const publicPaths = new Set<string>([
  paths.home,
  paths.services,
  paths.signIn,
  paths.register,
  paths.forgotPassword,
  paths.resetPassword,
  paths.authCallback,
]);

const guestOnlyPaths = new Set<string>([
  paths.signIn,
  paths.register,
  paths.forgotPassword,
]);

const exactViewPaths: Partial<Record<string, LegacyView>> = {
  [paths.services]: "browse-services",
  [paths.dashboard]: "client-dashboard",
  [paths.bookings]: "my-bookings",
  [paths.workerBookings]: "worker-bookings",
  [paths.work]: "my-work",
  [paths.workerDashboard]: "worker-dashboard",
  [paths.profile]: "profile",
  [paths.accountSettings]: "account-settings",
  [paths.preferences]: "settings",
  [paths.admin]: "admin-dashboard",
};

const viewPaths: Record<LegacyView, string> = {
  "admin-dashboard": paths.admin,
  "client-dashboard": paths.dashboard,
  "browse-services": paths.services,
  "my-bookings": paths.bookings,
  "worker-bookings": paths.workerBookings,
  chat: paths.messages,
  "my-work": paths.work,
  "worker-dashboard": paths.workerDashboard,
  profile: paths.profile,
  "account-settings": paths.accountSettings,
  settings: paths.preferences,
};

export function viewFromPathname(pathname: string): LegacyView | null {
  if (pathname === paths.messages || pathname.startsWith(`${paths.messages}/`)) return "chat";
  return exactViewPaths[pathname] ?? null;
}

export function pathForView(view: LegacyView): string {
  return viewPaths[view];
}

export function isPublicPath(pathname: string): boolean {
  return publicPaths.has(pathname);
}

export function isGuestOnlyPath(pathname: string): boolean {
  return guestOnlyPaths.has(pathname);
}

export function isKnownPath(pathname: string): boolean {
  return isPublicPath(pathname)
    || pathname === paths.sellerOnboarding
    || viewFromPathname(pathname) !== null;
}

export function canAccessPath(pathname: string, role: UserRole): boolean {
  if (pathname === paths.admin) return role === "admin";
  if (pathname === paths.workerDashboard || pathname === paths.workerBookings) return role === "worker" || role === "admin";
  return true;
}

export function homePathForRole(role: UserRole): string {
  if (role === "admin") return paths.admin;
  if (role === "worker") return paths.workerDashboard;
  return paths.dashboard;
}

export function getMessageBookingId(pathname: string): string | null {
  if (!pathname.startsWith(`${paths.messages}/`)) return null;
  const value = pathname.slice(paths.messages.length + 1).trim();
  return value ? decodeURIComponent(value) : null;
}

export function isSafeReturnPath(value: string | null): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && isKnownPath(value.split("?")[0]));
}
