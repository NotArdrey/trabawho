export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemeMode, "system">;
export type AppLanguage = "en" | "fil";
export type UserRole = "client" | "worker" | "admin";

export type AppRoute =
  | "/"
  | "/services"
  | "/sign-in"
  | "/register"
  | "/forgot-password"
  | "/reset-password"
  | "/auth/callback"
  | "/dashboard"
  | "/bookings"
  | "/messages/:bookingId?"
  | "/work"
  | "/worker/dashboard"
  | "/profile"
  | "/settings/account"
  | "/settings/preferences"
  | "/seller/onboarding"
  | "/admin";

export interface UserLocation {
  province: string;
  city: string;
  barangay: string;
  address: string;
}

export interface AppProfile {
  userId: string;
  email: string;
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber?: string;
  profilePhoto?: string;
  bio?: string;
  role: UserRole;
  isAdmin: boolean;
  isClient: boolean;
  isWorker: boolean;
  location: UserLocation;
}

export interface ServiceSummary {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category?: string;
  price?: number;
  currency: "PHP";
  active: boolean;
}

export type BookingStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled" | "refunded";

export interface BookingSummary {
  id: string;
  clientId: string;
  sellerId: string;
  serviceId: string;
  status: BookingStatus;
  scheduledAt?: string;
  totalAmount?: number;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ReviewSummary {
  id: string;
  bookingId: string;
  rating: number;
  comment?: string;
}
