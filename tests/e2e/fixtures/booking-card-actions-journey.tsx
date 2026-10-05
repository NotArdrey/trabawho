import { createRoot } from "react-dom/client";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingCardFooter } from "@/features/bookings/components/BookingCardFooter";
import { BookingTransactionActions } from "@/features/bookings/components/BookingTransactionActions";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<main className="mx-auto max-w-7xl p-4">
  <article className="rounded-xl border bg-background p-4">
    <BookingCardFooter amountLabel="Service price" amount="PHP 650" platformFee="PHP 52"
      totalPayment="PHP 702" paymentProgress={{ paid: "PHP 377", balance: "PHP 325" }}
      messageLabel="Message provider" messageIsPrimary={false}
      onViewDetails={() => {}} onMessage={() => {}} onReschedule={() => {}} onCancel={() => {}}>
      <Button type="button" className="col-span-2 w-full sm:w-auto"><CreditCard aria-hidden="true" />Pay Balance</Button>
      <BookingTransactionActions booking={{ id: "fixture-booking", disputeStatus: "none", paymentStatus: "partially_paid",
        amountPaid: 377, balanceDueAmount: 325, totalChargedAmount: 702, scheduleStatus: "confirmed",
        deliveryStatus: "not_delivered", appointmentStartAt: "2026-01-01T09:00:00Z",
        raw: { booking: { status: "confirmed" } } }} viewerRole="client" onUpdated={() => {}} />
    </BookingCardFooter>
  </article>
</main>);
