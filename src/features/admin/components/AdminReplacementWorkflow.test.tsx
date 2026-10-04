import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { getLatestReplacement } from "@/features/bookings/services/caseWorkflow";
import { AdminReplacementWorkflow } from "./AdminReplacementWorkflow";

vi.mock("@/features/bookings/services/caseWorkflow", () => ({ getLatestReplacement: vi.fn() }));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({ useBookingActivity: vi.fn() }));
vi.mock("./AdminReplacementProposal", () => ({ AdminReplacementProposal: () => <p>Proposal form</p> }));

const props = { caseId: "case-1", serviceId: 1, providerId: "provider-1", onSaved: vi.fn() };
type Detail = Awaited<ReturnType<typeof getLatestReplacement>>;
const detail = (status: string) => ({
  visit: { id: "visit-1", status, client_accepted_at: "2026-10-04T08:00:00Z",
    provider_accepted_at: status === "accepted" ? "2026-10-04T08:10:00Z" : null },
  slot: { id: 12, start_ts: "2026-10-10T08:00:00+08:00", end_ts: "2026-10-10T09:00:00+08:00" },
}) as unknown as Detail;

beforeEach(() => { vi.clearAllMocks(); });

it("shows the accepted time and does not offer a duplicate proposal", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(detail("accepted"));
  render(<AdminReplacementWorkflow {...props} />);
  expect(await screen.findByText(/Both participants accepted/)).toBeVisible();
  expect(screen.getByText(/October 10, 2026/)).toBeVisible();
  expect(screen.queryByText("Proposal form")).not.toBeInTheDocument();
});

it("allows a new proposal only after the previous time became unavailable", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(detail("unavailable"));
  render(<AdminReplacementWorkflow {...props} />);
  expect(await screen.findByText(/became unavailable/)).toBeVisible();
  expect(screen.getByText("Proposal form")).toBeVisible();
});
