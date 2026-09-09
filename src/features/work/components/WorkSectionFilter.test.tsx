import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import WorkSectionFilter, { type WorkSectionOption } from "./WorkSectionFilter";

const options: WorkSectionOption[] = [
  { value: "all", label: "Show All", shortLabel: "All", description: "Overview of every work section" },
  { value: "inquiries", label: "Active Inquiries", shortLabel: "Inquiries", description: "Client requests waiting for a response" },
  { value: "cash-approvals", label: "Payment Confirmations", shortLabel: "Cash", description: "Cash payment review queue" },
];

describe("WorkSectionFilter", () => {
  let scrollIntoViewMock: (arg?: boolean | ScrollIntoViewOptions) => void;

  beforeEach(() => {
    scrollIntoViewMock = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it("selects a mobile chip with one action", async () => {
    const onValueChange = vi.fn();
    render(<WorkSectionFilter value="all" options={options} onValueChange={onValueChange} />);
    await userEvent.click(within(screen.getByLabelText("Work sections")).getByRole("button", { name: "Inquiries" }));
    expect(onValueChange).toHaveBeenCalledWith("inquiries");
  });

  it("supports keyboard activation and only renders supplied sections", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<WorkSectionFilter value="all" options={options} onValueChange={onValueChange} />);
    const filter = within(screen.getByLabelText("Work sections"));
    expect(filter.queryByRole("button", { name: "Availability" })).not.toBeInTheDocument();
    filter.getByRole("button", { name: "Cash" }).focus();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("cash-approvals");
  });

  it("supports pointer dragging and keeps the selected chip in view", () => {
    const { rerender } = render(<WorkSectionFilter value="all" options={options} onValueChange={vi.fn()} />);
    const rail = screen.getByRole("group", { name: "Work sections" });
    Object.defineProperty(rail, "scrollLeft", { configurable: true, value: 80, writable: true });

    fireEvent.pointerDown(rail, { pointerId: 1, pointerType: "mouse", clientX: 120 });
    fireEvent.pointerMove(rail, { pointerId: 1, pointerType: "mouse", clientX: 80 });
    fireEvent.pointerUp(rail, { pointerId: 1, pointerType: "mouse", clientX: 80 });

    expect(rail.scrollLeft).toBe(120);
    rerender(<WorkSectionFilter value="cash-approvals" options={options} onValueChange={vi.fn()} />);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
