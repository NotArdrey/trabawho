import { useTemporaryTargetHighlight } from "@/shared/hooks/useTemporaryTargetHighlight";

export function useBookingFocus(bookingId: string | null, visible: boolean, navigationKey?: string) {
  const highlighted = useTemporaryTargetHighlight(bookingId ? `booking-card-${bookingId}` : null, visible, navigationKey);
  return highlighted ? bookingId : null;
}
