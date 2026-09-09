import { useLogoutController } from "@/features/auth/hooks";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel: () => void;
}

export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }: LogoutConfirmModalProps) {
  const controller = useLogoutController(async () => {
    try {
      await onConfirm?.();
    } catch (error) {
      console.error("Logout confirmation callback error:", error);
    }
  });

  return (
    <ConfirmActionModal
      isOpen={isOpen}
      title="Log out of TrabaWho?"
      description="Are you sure you want to log out? You will need to sign in again to manage your bookings and services."
      confirmLabel="Log out"
      onCancel={onCancel}
      onConfirm={() => void controller.handleConfirmLogout()}
      isConfirming={controller.isLoading}
    />
  );
}
