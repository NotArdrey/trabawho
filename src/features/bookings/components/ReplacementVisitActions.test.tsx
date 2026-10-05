import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { confirmReplacement, deliverReplacement, getLatestReplacement, respondReplacement, startReplacement } from "@/features/bookings/services/caseWorkflow";
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
const replacement = (status: string, startedAt: string | null) => ({
  visit: { id: "visit-1", status, reason: "The provider missed the original appointment.",
    client_accepted_at: "2026-10-04T08:00:00Z", provider_accepted_at: "2026-10-04T08:10:00Z",
    started_at: startedAt, delivery_note: "The replacement service was completed and checked." },
  slot: { ...slot, start_ts: "2020-10-05T09:00:00+08:00", end_ts: "2020-10-05T10:00:00+08:00" },
}) as unknown as Detail;

beforeEach(() => { vi.clearAllMocks(); activity.refresh = null; });

it("shows each participant's decision and updates when the second acceptance arrives", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(proposal("proposed", true, false));
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="client" funded onChanged={vi.fn()} />);
  expect(await screen.findByText("Client: Accepted")).toBeVisible();
  expect(screen.getByText("Provider: Awaiting response")).toBeVisible();
  vi.mocked(getLatestReplacement).mockResolvedValue(proposal("accepted", true, true));
  await act(async () => { await activity.refresh?.(); });
  expect(screen.getByText(/Both participants accepted/)).toBeVisible();
  expect(screen.getAllByText("Visit confirmed")).toHaveLength(2);
});

it("confirms a declined time before sending the response", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(proposal("proposed", false, true));
  vi.mocked(respondReplacement).mockResolvedValue({} as Awaited<ReturnType<typeof respondReplacement>>);
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="client" funded onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Decline time" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Saturday, October 10, 2026");
  expect(respondReplacement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  expect(respondReplacement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Decline time" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Decline time" }));
  await waitFor(() => expect(respondReplacement).toHaveBeenCalledWith("visit-1", false));
});

it("lets a funded provider start and submit replacement work from the booking", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValueOnce(replacement("accepted", null))
    .mockResolvedValueOnce(replacement("accepted", "2026-10-05T08:40:00Z"))
    .mockResolvedValueOnce(replacement("delivered", "2026-10-05T08:40:00Z"));
  vi.mocked(startReplacement).mockResolvedValue({} as Awaited<ReturnType<typeof startReplacement>>);
  vi.mocked(deliverReplacement).mockResolvedValue({} as Awaited<ReturnType<typeof deliverReplacement>>);
  const onChanged = vi.fn();
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="provider" funded onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole("button", { name: "Start replacement work" }));
  fireEvent.click(screen.getByRole("button", { name: "Start work" }));
  await waitFor(() => expect(startReplacement).toHaveBeenCalledWith("visit-1"));
  fireEvent.change(await screen.findByRole("textbox", { name: "Completed work notes" }), {
    target: { value: "The replacement service was completed and checked." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review and submit work" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("The replacement service was completed and checked.");
  expect(deliverReplacement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Submit work" }));
  await waitFor(() => expect(deliverReplacement).toHaveBeenCalledWith("visit-1", "booking-1",
    "The replacement service was completed and checked.", null));
  expect(await screen.findByText("Waiting for client confirmation.")).toBeVisible();
  expect(onChanged).toHaveBeenCalledTimes(2);
});

it("lets the funded client confirm delivered replacement work", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValueOnce(replacement("delivered", "2026-10-05T08:40:00Z"))
    .mockResolvedValueOnce(replacement("completed", "2026-10-05T08:40:00Z"));
  vi.mocked(confirmReplacement).mockResolvedValue({} as Awaited<ReturnType<typeof confirmReplacement>>);
  const onChanged = vi.fn();
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="client" funded onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm completed visit" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("This marks the booking Completed and closes the no-show support case.");
  expect(confirmReplacement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
  await waitFor(() => expect(confirmReplacement).toHaveBeenCalledWith("visit-1"));
  expect(await screen.findByText("The client confirmed this visit. The case is resolved.")).toBeVisible();
  expect(onChanged).toHaveBeenCalledOnce();
});

it("does not offer start or completion when full payment is not verified", async () => {
  vi.mocked(getLatestReplacement).mockResolvedValue(replacement("accepted", null));
  render(<ReplacementVisitActions caseId="case-1" bookingId="booking-1" viewerRole="provider" funded={false} onChanged={vi.fn()} />);
  expect(await screen.findByText(/completion is paused until this booking shows full verified payment/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Start replacement work" })).not.toBeInTheDocument();
});
