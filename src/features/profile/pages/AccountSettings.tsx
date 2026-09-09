import type { ChangeEvent } from "react";
import DashboardNavigation from "@/shared/components/DashboardNavigation";
import AccountPrivacyPanel, {
  type AccountLocationDetails,
  type AccountProfileDetails,
} from "@/features/profile/components/AccountPrivacyPanel";

type NavigationHandler = () => void;

export interface AccountSettingsProps {
  currentView?: string;
  onLogout?: () => void | Promise<void>;
  onOpenAccountSettings?: NavigationHandler;
  onOpenAdminDashboard?: NavigationHandler;
  onOpenBrowseServices?: NavigationHandler;
  onOpenChatPage?: NavigationHandler;
  onOpenDashboard?: NavigationHandler;
  onOpenMyBookings?: NavigationHandler;
  onOpenMyWork?: NavigationHandler;
  onOpenProfile?: NavigationHandler;
  onOpenSellerSetup?: NavigationHandler;
  onOpenSettings?: NavigationHandler;
  onSearchChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdatePassword?: (values: { currentPassword: string; newPassword: string }) => Promise<unknown>;
  onUpdateProfile?: (values: Record<string, unknown>) => Promise<unknown>;
  searchQuery?: string;
  sellerProfile?: AccountProfileDetails | null;
  userLocation?: AccountLocationDetails | null;
}

function AccountSettings({
  currentView,
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  onOpenChatPage,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenDashboard,
  onOpenBrowseServices,
  userLocation,
  onUpdateProfile,
  onUpdatePassword,
  onOpenAdminDashboard,
}: AccountSettingsProps) {
  return (
    <div className="min-h-screen bg-background" data-testid="account-settings-page">
      <DashboardNavigation
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
        onOpenMyWork={onOpenMyWork}
        onOpenProfile={onOpenProfile}
        onOpenAccountSettings={onOpenAccountSettings}
        onOpenSettings={onOpenSettings}
        onOpenDashboard={onOpenDashboard}
        onOpenBrowseServices={onOpenBrowseServices}
        isAdminView={false}
        onToggleAdminView={() => onOpenAdminDashboard?.()}
      />

      <main className="mx-auto w-full max-w-[920px] px-6 pb-32 pt-8 max-[880px]:px-3 max-[880px]:pb-[calc(6.5rem+env(safe-area-inset-bottom))] max-[880px]:pt-4">
        <div className="rounded-2xl bg-card p-7 max-sm:rounded-xl max-sm:px-4 max-sm:py-5">
          <AccountPrivacyPanel
            collapsible={false}
            defaultExpanded
            sellerProfile={sellerProfile}
            userLocation={userLocation}
            onUpdateProfile={onUpdateProfile}
            onUpdatePassword={onUpdatePassword}
          />
        </div>
      </main>
    </div>
  );
}

export default AccountSettings;
