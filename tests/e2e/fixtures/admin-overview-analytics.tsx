import { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminOverview from "@/features/admin/components/AdminOverview";
import AdminAnalytics from "@/features/admin/components/AdminAnalytics";
import type { AdminSection } from "@/features/admin/types";
import type { AdminAnalyticsData } from "@/features/admin/types/admin-activity";
import "@/styles/globals.css";

function loadAnalytics(days: number): Promise<AdminAnalyticsData> {
  const trend = Array.from({ length: days }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 6 - days + 1 + index)).toISOString().slice(0, 10), accounts: index === 2 ? 3 : 0, reviews: index === 3 ? 1 : 0 }));
  return Promise.resolve({ days, newAccounts: 3, activeServices: 13, publishedReviews: 1, averageRating: 5, openCases: 5, trend, unavailable: [], updatedAt: "2026-10-06T00:00:00Z" });
}

function TestPage() {
  const [section, setSection] = useState<AdminSection>("overview");
  return <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-background px-4 py-6 sm:px-6 lg:px-8">
    {section === "overview" ? <AdminOverview stats={{ activeAccounts: 19, disabledAccounts: 2, suspendedAccounts: 1 }} totalAccounts={22} isLoading={false} error="" onSectionChange={setSection} /> : <>
      <button type="button" className="min-h-11 text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSection("overview")}>Back to overview</button>
      {section === "analytics" ? <AdminAnalytics loadAnalytics={loadAnalytics} /> : <p>Opened {section}</p>}
    </>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<TestPage />);
