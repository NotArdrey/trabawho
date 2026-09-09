import { fireEvent, render, screen } from "@testing-library/react";

import { ActiveInquiriesSection } from "./ActiveInquiriesSection";
import type { WorkInquiry } from "@/features/work/types/inquiry";

const inquiry: WorkInquiry = {
  clientName: "Joshua Santos",
  clientRating: 4.8,
  description: "Repair a small kitchen appliance.",
  id: "inquiry-1",
  messages: 2,
  proposedBudget: "PHP 900",
  requestDate: "Sep 9",
  service: "Appliance repair",
  status: "Waiting for response",
};

describe("ActiveInquiriesSection", () => {
  it("presents the queue identity and preserves its response action", () => {
    const onRespond = vi.fn();
    render(<ActiveInquiriesSection inquiries={[inquiry]} onRespond={onRespond} />);
    expect(screen.getByRole("region", { name: "Active inquiries" })).toBeVisible();
    expect(screen.getByText("4.8 rating")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Respond to Joshua Santos" }));
    expect(onRespond).toHaveBeenCalledWith("inquiry-1");
  });

  it("shows a recognizable empty queue", () => {
    render(<ActiveInquiriesSection inquiries={[]} onRespond={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No active inquiries" })).toBeVisible();
    expect(screen.getByText("New client requests will appear here when they need your response.")).toBeVisible();
  });
});
