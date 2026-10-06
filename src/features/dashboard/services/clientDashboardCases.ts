import { listParticipantSupportCases } from "@/features/bookings/support";
import type { DashboardCase } from "@/features/dashboard/domain/clientNextSteps";

export async function fetchClientOverviewCases(): Promise<DashboardCase[]> {
  const cases = await listParticipantSupportCases();
  return cases
    .filter(({ viewerRole, report }) => viewerRole === "client" && report.status !== "closed")
    .map(({ report, serviceTitle, unreadCount }) => ({
      id: report.id,
      bookingId: report.booking_id,
      service: serviceTitle,
      status: report.status,
      resolution: report.resolution_status,
      unreadCount,
      updatedAt: report.latest_support_at || report.created_at,
    }));
}
