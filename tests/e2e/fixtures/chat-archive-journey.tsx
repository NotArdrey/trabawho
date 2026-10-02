import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ChatWindow from "@/features/bookings/components/ChatWindow";
import { ChatArchiveBrowser } from "@/features/bookings/components/ChatArchiveBrowser";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

function Journey() {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role") === "seller" ? "seller" : "buyer";
  const [empty, setEmpty] = useState(params.get("empty") === "true");
  const [restored, setRestored] = useState(false);
  const booking = { id: "conversation:chat-1", conversationId: "chat-1", workerName: "Juan Provider", clientName: "Ana Client", serviceType: "Plumbing", quoteAmount: 0, status: "Chat", isStandaloneChat: true, buyerId: "buyer-1", sellerId: "seller-1" };
  const onRestored = () => {
    setEmpty(false);
    setRestored(true);
    return Promise.resolve();
  };
  return <main>
    {restored && <p role="status">Active inbox refreshed</p>}
    {empty ? <><ChatArchiveBrowser viewerRole={role} onRestored={onRestored} /><p>No active conversations.</p></>
      : <ChatWindow booking={booking} bookings={[booking]} viewerRole={role} selectedBookingId={booking.id} onSelectBooking={() => {}}
        onApproveQuote={undefined} onRejectQuote={undefined} onProposeQuote={undefined} onStopServiceAccepted={undefined}
        onOpenSlotSelection={undefined} onOpenPaymentSelection={undefined} onRequestRefund={undefined}
        onConfirmRefundReceived={undefined} onLeaveRating={undefined} onDeleteChat={undefined}
        initialMobileListOpen onChatRestored={onRestored} onArchiveChat={() => { setEmpty(true); return Promise.resolve(); }} />}
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><Journey /></BrowserRouter>);
