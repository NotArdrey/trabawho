import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface SuccessNotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const notificationId = "trabawho-success-notification";

export default function SuccessNotification({ message, isVisible, onClose }: SuccessNotificationProps) {
  const wasVisible = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isVisible && !wasVisible.current && message.trim()) {
      toast.success(message, {
        id: notificationId,
        duration: 3000,
        onAutoClose: () => onCloseRef.current(),
        onDismiss: () => onCloseRef.current(),
      });
    }

    if (!isVisible && wasVisible.current) toast.dismiss(notificationId);
    wasVisible.current = isVisible;
  }, [isVisible, message]);

  return null;
}
