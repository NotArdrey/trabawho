import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import PaymentModal from "@/features/bookings/components/PaymentModal";
import { BookingMessageComposer } from "@/features/bookings/components/BookingMessageComposer";
import { createPayMongoCheckout, redirectToPayMongo } from "@/features/bookings/services/paymongoCheckout";
import { ensureLocalSandboxReady } from "@/shared/services/paymongoSandboxCheckout";
import "@/styles/globals.css";

function Journey() {
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const params = new URLSearchParams(window.location.search);
  const booking = { serviceId: 1, quoteAmount: 1200, selectedSlot: { slotId: 1, date: "2026-10-02" }, serviceType: "Test service",
    ...(params.has('quote') ? { id: 'quote-booking', bookingMode: 'calendar-only' } : {}),
    ...(params.has('balance') ? { id: 'balance-booking', paymentStatus: 'partially_paid', balanceDueAmount: 475 } : {}) };
  if (new URLSearchParams(window.location.search).get("mode") === "chat") {
    return <main>
      <div aria-label="Messages">{messages.map((message, index) => <p key={index}>{message}</p>)}</div>
      <BookingMessageComposer conversationId="test" hasQuote={false} isSending={sending} onSend={async (body) => {
        setSending(true);
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        setMessages((current) => [...current, body]);
        setSending(false);
        return true;
      }} />
    </main>;
  }
  return <PaymentModal booking={booking} confirmLabel={params.has('balance') ? 'Pay remaining balance' : undefined}
    collectServiceAddress={params.has('address')} requireBookingTerms={params.has("terms")} onCancel={() => {}} onSelectPayment={async (_method, details) => {
    if (details.testCheckout) await ensureLocalSandboxReady();
    await redirectToPayMongo(await createPayMongoCheckout({ ...booking, paymentPlan: details.paymentPlan, serviceAddress: details.serviceAddress }),
      { oneClickTest: details.testCheckout });
  }} />;
}

const root = document.getElementById("root");
declare global { interface Window { bookingJourneyRoot?: Root } }
if (root) {
  window.bookingJourneyRoot ??= createRoot(root);
  window.bookingJourneyRoot.render(<Journey />);
}
