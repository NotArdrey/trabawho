import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { BookingTransactionActions } from "@/features/bookings/components/BookingTransactionActions";
import { BookingDetailsDialog } from "@/features/bookings/components/BookingDetailsDialog";
import { BookingRefundStage } from "@/features/bookings/components/BookingRefundStage";
import { BookingRefundProgress } from "@/features/bookings/components/BookingRefundProgress";
import { Button } from "@/components/ui/button";
import { AdminRefundDecision } from "@/features/admin/components/AdminRefundDecision";
import "@/styles/globals.css";

const bookingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function Journey() {
  const role = new URLSearchParams(location.search).get("role") || "client";
  const [detailsOpen, setDetailsOpen] = useState(false);
  return <main className="mx-auto max-w-4xl p-4">
    <h1 className="mb-4 text-2xl font-bold">Booking payment and dispute</h1>
    {role === "completed-test-refund" ? <section className="grid gap-4 rounded-xl border bg-card p-4">
      <BookingRefundStage booking={{ status: "Cancelled", paymentStatus: "refunded", refundSimulated: true }} />
      <BookingRefundProgress bookingId={bookingId} caseId={caseId} canRequest={false} onChanged={() => {}} />
    </section> : role.startsWith("cancelled-") ? <section className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2"><strong>Cancelled</strong><BookingRefundStage booking={{ status: "Cancelled", paymentStatus: "refund_pending" }} /></div>
      <Button type="button" variant="outline" className="w-fit" onClick={() => setDetailsOpen(true)}>View details</Button>
      <BookingTransactionActions booking={{ id: bookingId, paymentStatus: "refund_pending", amountPaid: 464,
        totalChargedAmount: 864, balanceDueAmount: 400, scheduleStatus: "released", deliveryStatus: "not_delivered",
        disputeStatus: "open", raw: { booking: { status: "cancelled" } } }}
        viewerRole={role === "cancelled-provider" ? "provider" : "client"} onUpdated={() => {}} />
      {detailsOpen && <BookingDetailsDialog booking={{ id: bookingId, status: "Cancelled", paymentStatus: "refund_pending",
        paymentPlan: "downpayment", amountPaid: 464, balanceDueAmount: 400, totalChargedAmount: 864,
        paymentMethod: "paymongo-card", selectedSlot: { date: "2026-10-14", timeBlock: { startTime: "13:00", endTime: "14:00" } } }}
        isProviderView={role === "cancelled-provider"} statusLabel="Cancelled" onClose={() => setDetailsOpen(false)} onMessage={() => {}} />}
    </section> : role === "admin" ? <AdminRefundDecision bookingId={bookingId} caseId={caseId} paidAmount={464} closed={false} incomplete={false} onSaved={() => {}} />
      : <BookingTransactionActions booking={{ id: bookingId, paymentStatus: "paid", amountPaid: role === "provider" ? 464 : 864,
        totalChargedAmount: 864, balanceDueAmount: role === "provider" ? 400 : 0,
        scheduleStatus: "confirmed", deliveryStatus: "not_delivered", disputeStatus: role === "provider" ? "none" : "open",
        appointmentStartAt: "2026-01-01T09:00:00Z", raw: { booking: { status: "confirmed" } } }}
        viewerRole={role === "provider" ? "provider" : "client"} onUpdated={() => {}} />}
  </main>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<MemoryRouter><Journey /></MemoryRouter>);
