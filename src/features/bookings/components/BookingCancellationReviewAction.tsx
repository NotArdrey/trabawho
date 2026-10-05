import { CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canReviewBookingCancellation, type CancellationBooking } from "@/features/bookings/utils/bookingCancellationPresentation";

interface Props {
  booking: CancellationBooking;
  isProvider: boolean;
  onReview: () => void;
}

export function BookingCancellationReviewAction({ booking, isProvider, onReview }: Props) {
  if (!canReviewBookingCancellation(booking, isProvider)) return null;
  return <Button type="button" onClick={onReview}>
    <CalendarX2 className="size-4" aria-hidden="true" />Review cancellation
  </Button>;
}
