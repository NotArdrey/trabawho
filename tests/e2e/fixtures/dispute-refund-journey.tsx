import { createRoot } from "react-dom/client";
import { BookingTransactionActions } from "@/features/bookings/components/BookingTransactionActions";
import { AdminRefundDecision } from "@/features/admin/components/AdminRefundDecision";
import "@/styles/globals.css";

const bookingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function Journey() {
  const role = new URLSearchParams(location.search).get("role") || "client";
  return <main className="mx-auto max-w-4xl p-4">
    <h1 className="mb-4 text-2xl font-bold">Booking payment and dispute</h1>
    {role === "admin" ? <AdminRefundDecision bookingId={bookingId} caseId={caseId} paidAmount={464} closed={false} incomplete={false} onSaved={() => {}} />
      : <BookingTransactionActions booking={{ id: bookingId, paymentStatus: "paid", amountPaid: role === "provider" ? 464 : 864,
        totalChargedAmount: 864, balanceDueAmount: role === "provider" ? 400 : 0,
        scheduleStatus: "confirmed", deliveryStatus: "not_delivered", disputeStatus: role === "provider" ? "none" : "open",
        appointmentStartAt: "2026-01-01T09:00:00Z", raw: { booking: { status: "confirmed" } } }}
        viewerRole={role === "provider" ? "provider" : "client"} onUpdated={() => {}} />}
  </main>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
