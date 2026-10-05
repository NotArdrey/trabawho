import { render, screen, within } from "@testing-library/react";
import { AdminAuditEventCard } from "./AdminAuditEventCard";
import type { AuditEntry } from "../types/admin-activity";

const entry: AuditEntry = { id: "one", source: "bookings", actorId: null, actor: "Support agent",
  action: "booking cancellation approved", target: "booking-123", reason: "The client requested cancellation.",
  outcome: "confirmed → cancelled", createdAt: "2026-10-05T09:30:00Z", operationId: null };

describe("audit event card", () => {
  it("distinguishes source, outcome, technical reference and reason", () => {
    render(<AdminAuditEventCard entry={entry} />);
    expect(screen.getByText("Booking")).toBeVisible();
    expect(screen.getByText("booking-123")).toHaveClass("font-mono");
    expect(screen.getByText("confirmed → cancelled")).toHaveClass("bg-amber-100");
    expect(screen.getByText("The client requested cancellation.")).toBeVisible();
    expect(screen.getByText(/PHT$/)).toBeVisible();
  });

  it("uses success for an approved identity decision and neutral for a support follow-up", () => {
    const { rerender } = render(<AdminAuditEventCard entry={{ ...entry, source: "identity", outcome: "Approved" }} />);
    expect(screen.getByText("Identity review")).toBeVisible();
    expect(screen.getByText("Approved")).toHaveClass("bg-emerald-100");
    rerender(<AdminAuditEventCard entry={{ ...entry, source: "support", outcome: "Follow-up recorded" }} />);
    expect(screen.getByText("Support follow-up")).toBeVisible();
    expect(within(screen.getByText("Recorded outcome").parentElement as HTMLElement).getByText("Follow-up recorded")).toHaveClass("bg-secondary");
  });
});
