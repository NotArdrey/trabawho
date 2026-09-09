import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarCheck } from "lucide-react";

import { Button } from "./button";
import { WorkflowEmptyState, WorkflowPanel, WorkflowStatGrid } from "./workflow-panel";

describe("workflow panel primitives", () => {
  it("connects the panel heading and exposes responsive keyboard actions", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<WorkflowPanel icon={CalendarCheck} title="Today's schedule" description="One job scheduled" action={<Button onClick={onAction}>Manage schedule</Button>}><p>Schedule content</p></WorkflowPanel>);
    const panel = screen.getByRole("region", { name: "Today's schedule" });
    expect(panel).toHaveClass("border");
    const actions = screen.getAllByRole("button", { name: "Manage schedule" });
    expect(actions[0].parentElement).toHaveClass("sm:block");
    expect(actions[1].parentElement).toHaveClass("sm:hidden");
    actions[0].focus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("renders an optional contextual empty-state action", () => {
    render(<WorkflowEmptyState icon={CalendarCheck} title="No jobs today" description="Your schedule is clear." action={<Button>Manage availability</Button>} tone="primary" />);
    expect(screen.getByRole("heading", { name: "No jobs today" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Manage availability" })).toBeVisible();
  });

  it("uses semantic terms and descriptions for statistics", () => {
    render(<WorkflowStatGrid aria-label="Service health" items={[{ id: "services", label: "Active listings", value: "2 of 3" }, { id: "slots", label: "Available slots", value: 4 }]} />);
    expect(screen.getAllByRole("term")[0]).toHaveTextContent("Active listings");
    expect(screen.getAllByRole("definition")[0]).toHaveTextContent("2 of 3");
  });
});
