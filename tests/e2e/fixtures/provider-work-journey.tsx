import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import WorkerDashboard from "@/features/work/pages/WorkerDashboard";
import { useChatScope } from "@/features/bookings/hooks/useChatScope";
import { useBookingListController } from "@/features/bookings/hooks/useBookingListController";
import { useBookingConversation } from "@/features/bookings/hooks/useBookingConversation";
import { DeleteWorkService } from "@/features/work/components/DeleteWorkService";
import { useWorkSlotDeletion } from "@/features/work/hooks/useWorkSlotDeletion";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

function Inbox() {
  const location = useLocation();
  const selectedId = location.pathname.split("/")[2] || null;
  const { activeScope, isResolvingChatScope } = useChatScope({ isWorker: true, isChat: true, isProviderRoute: false, selectedId, userId: "worker-1", requestedScope: new URLSearchParams(location.search).get("scope") });
  const list = useBookingListController([], { autoLoad: !isResolvingChatScope, includeStandaloneChats: true, listRole: activeScope === "incoming" ? "seller" : "buyer", sellerId: "worker-1" });
  const { messages } = useBookingConversation({ id: selectedId || list.bookings[0]?.id });
  return <main className="p-5"><h1>{activeScope === "incoming" ? "Incoming chats" : "Purchases"}</h1>{list.bookings.map((row) => <p key={row.id}>Client conversation: {row.id}</p>)}<section aria-label="Incoming messages">{messages.map((message) => <p key={message.id}>{typeof message.content === "string" ? message.content : message.content.description}</p>)}</section></main>;
}

function Deletion() {
  const [serviceDeleted, setServiceDeleted] = useState(false);
  const [slotDeleted, setSlotDeleted] = useState(false);
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "calendar" ? "calendar-only" : "with-slots";
  const slot = useWorkSlotDeletion({ sellerId: "worker-1", scheduleMode: mode, calendarAvailability: [{ id: 8, date: "2026-10-05" }], weeklySchedule: { Mon: [{ id: 8, startTime: "09:00", endTime: "10:00" }] }, loadSlots: () => { setSlotDeleted(true); return Promise.resolve(); }, setScheduleError: setError });
  return <main className="space-y-5 p-5"><h1>My Work</h1>
    {serviceDeleted ? <p role="status">Service deleted</p> : <DeleteWorkService serviceId={7} sellerId="worker-1" title="Plumbing" onDeleted={() => setServiceDeleted(true)} />}
    {slotDeleted ? <p role="status">Availability deleted</p> : <Button onClick={() => slot.handleDeleteSlot("Mon", 8)}>Delete availability</Button>}
    <ConfirmActionModal isOpen={Boolean(slot.deleteConfirmTarget)} title="Delete this time slot?" description="Existing booking records will not be deleted." variant="destructive" confirmLabel="Delete" isConfirming={slot.isDeletingSlot} onCancel={() => slot.setDeleteConfirmTarget(null)} onConfirm={() => { void slot.handleConfirmDelete(); }}>
      <p>{slot.deleteConfirmTarget?.label}</p>{error ? <p role="alert">{error}</p> : null}
    </ConfirmActionModal>
  </main>;
}

function Journey() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname.startsWith("/messages")) return <Inbox />;
  if (new URLSearchParams(location.search).has("delete")) return <Deletion />;
  return <WorkerDashboard sellerProfile={{ userId: "worker-1", role: "worker" }} onOpenChatPage={(id, scope) => { void navigate(`/messages${id ? `/${id}` : ""}?scope=${scope || "purchases"}`); }} />;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><Journey /></BrowserRouter>);
