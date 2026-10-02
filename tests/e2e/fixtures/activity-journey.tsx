import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { supabase } from "@/integrations/supabase";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import MyBookings from "@/features/bookings/pages/MyBookings";
import RatingModal from "@/features/bookings/components/RatingModal";
import { submitBookingReview } from "@/features/bookings/services/bookingService";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

function ReviewJourney() {
  const [open, setOpen] = useState(true);
  const booking = { id: "11111111-1111-4111-8111-111111111111", workerId: "stale-worker-identity", workerName: "Arnold Castillo", serviceType: "Plumbing Leak Repair" };
  return open ? <RatingModal booking={booking} onClose={() => setOpen(false)} onSubmit={async (input: { rating: number; comment: string; imageFile: File | null }) => { await submitBookingReview(booking, input.rating, input.comment, input.imageFile); }} /> : <p role="status">Review saved</p>;
}

function BookingsJourney({ profile }: { profile: { userId: string; role: string; firstName: string } }) {
  const [search, setSearch] = useState("");
  return <MyBookings sellerProfile={profile} currentView="my-bookings" searchQuery={search} onSearchChange={(event: { target: { value: string } }) => setSearch(event.target.value)} />;
}

declare global { interface Window { activityJourneyRoot?: Root } }

async function boot() {
  const root = document.getElementById("root");
  if (!root) return;
  const auth = await supabase.auth.signInWithPassword({ email: "fixture@example.test", password: "fixture-password" });
  if (auth.error) { createRoot(root).render(<p>Fixture sign-in failed</p>); return; }
  const mode = new URLSearchParams(window.location.search).get("mode");
  const profile = { userId: auth.data.user.id, role: mode === "admin" ? "admin" : mode === "bookings" ? "worker" : "client", firstName: "Kuh" };
  window.activityJourneyRoot ??= createRoot(root);
  window.activityJourneyRoot.render(<BrowserRouter>{mode === "admin" ? <AdminDashboard /> : mode === "dashboard" ? <Dashboard sellerProfile={profile} /> : mode === "bookings" ? <BookingsJourney profile={profile} /> : <ReviewJourney />}</BrowserRouter>);
}
void boot();
