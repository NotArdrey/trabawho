import { CheckCircle2, Clock3 } from "lucide-react";

import { bookingRefundStage } from "@/features/bookings/utils/bookingCancellationPresentation";

interface Props {
  booking: { status: string; paymentStatus?: string | null; refundSimulated?: boolean };
}

export function BookingRefundStage({ booking }: Props) {
  const stage = bookingRefundStage(booking);
  if (!stage) return null;
  const Icon = stage === "simulated" ? CheckCircle2 : Clock3;
  return <span className={stage === "simulated"
    ? "inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"}>
    <Icon className="size-3.5" aria-hidden="true" />
    {stage === "simulated" ? "Refund review complete" : "Refund review in progress"}
  </span>;
}
