import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { supabase } from "@/integrations/supabase";
import AdminSupportCases from "@/features/admin/components/AdminSupportCases";
import { BookingTransactionActions } from "@/features/bookings/components/BookingTransactionActions";
import { ParticipantSupportCases } from "@/features/bookings";
import "@/styles/globals.css";

function Journey() {
  const [disputeStatus, setDisputeStatus] = useState("none");
  const [role] = useState(() => new URLSearchParams(location.search).get("role"));
  if (role === "participant-client" || role === "participant-provider") return <ParticipantSupportCases sellerProfile={{
    userId: "22222222-2222-4222-8222-222222222222", role: role === "participant-provider" ? "worker" : "client", fullName: "Case participant",
  }} />;
  return <main className="mx-auto max-w-4xl p-4">
    {role === "admin" ? <AdminSupportCases /> : <>
      <h1 className="mb-4 text-2xl font-bold">Booked repair</h1>
      <BookingTransactionActions booking={{
        id: "11111111-1111-4111-8111-111111111111", disputeStatus,
        paymentStatus: "paid", amountPaid: 540, totalChargedAmount: 540, balanceDueAmount: 0,
        scheduleStatus: "confirmed", deliveryStatus: "not_delivered", scheduleVersion: 1,
        appointmentStartAt: "2026-01-01T09:00:00Z", raw: { booking: { status: "confirmed" } },
      }} viewerRole="client" onUpdated={() => setDisputeStatus("open")} />
    </>}
  </main>;
}

async function boot() {
  const root = document.getElementById("root");
  if (!root) return;
  const { error } = await supabase.auth.signInWithPassword({ email: "fixture@example.test", password: "fixture-password" });
  createRoot(root).render(error ? <p>Fixture sign-in failed</p> : <BrowserRouter><Journey /></BrowserRouter>);
}
void boot();
