import { useCallback, useState } from "react";

import { signOutUser } from "@/shared/services/authService";

type LogoutSuccessHandler = () => void | Promise<void>;

export function useLogoutController(onLogoutSuccess?: LogoutSuccessHandler) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirmLogout = useCallback(async () => {
    setError("");
    try {
      setIsLoading(true);
      await signOutUser();
      await onLogoutSuccess?.();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to logout. Please try again.";
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [onLogoutSuccess]);

  return { isLoading, error, handleConfirmLogout };
}

export default useLogoutController;
