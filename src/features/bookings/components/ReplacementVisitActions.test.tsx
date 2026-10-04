import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { getLatestReplacement } from "@/features/bookings/services/caseWorkflow";
import { ReplacementVisitActions } from "./ReplacementVisitActions";

const activity = vi.hoisted(() => ({ refresh: null as null | (() => Promise<unknown>) }));
vi.mock("@/features/bookings/services/caseWorkflow", () => ({
  getLatestReplacement: vi.fn(), respondReplacement: vi.fn(), startReplacement: vi.fn(),
  deliverReplacement: vi.fn(), confirmReplacement: vi.fn(), openCaseImage: vi.fn(),
}));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({
  useBookingActivity: (refresh: () => Promise<unknown>) => { activity.refresh = refresh; },
}));

type Detail = Awaited<ReturnType<typeof getLatestReplacement>>;
const slot = { id: 1, start_ts: "2026-10-10T08:00:00+08:00", end_ts: "2026-10-10T09:00:00+08:00" };
const proposal = (status: string, clientAccepted: boolean, providerAccepted: boolean) => ({
  visit: { id: "visit-1", status, reason: "The provider missed the original appointment.",
    client_accepted_at: clientAccepted ? "2026-10-04T08:00:00Z" : null,
    provider_accepted_at: providerAccepted ? "2026-10-04T08:10:00Z" : null, started_at: null },
  slot,
}) as unknown as Detail;

beforeEach(() => { vi.clearAllMocks(); activity.refresh = null; });

it("shows each participant's decision and updates when the second acceptance arrives", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(proposal("proposed", true, false));
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="client" onChanged={vi.fn()} />);
  expect(await screen.findByText("Client: Accepted")).toBeVisible();
  expect(screen.getByText("Provider: Awaiting response")).toBeVisible();
  vi.mocked(getLatestReplacement).mockResolvedValue(proposal("accepted", true, true));
  await act(async () => { await activity.refresh?.(); });
  expect(screen.getByText(/Both participants accepted/)).toBeVisible();
  expect(screen.getByText(/Replacement time confirmed/)).toBeVisible();
});
