import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface ErrorNotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const notificationId = "trabawho-error-notification";

export default function ErrorNotification({ message, isVisible, onClose }: ErrorNotificationProps) {
  const wasVisible = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isVisible && !wasVisible.current && message.trim()) {
      toast.error(message, {
        id: notificationId,
        duration: 4000,
        onAutoClose: () => onCloseRef.current(),
        onDismiss: () => onCloseRef.current(),
      });
    }

    if (!isVisible && wasVisible.current) toast.dismiss(notificationId);
    wasVisible.current = isVisible;
  }, [isVisible, message]);

  return null;
}
