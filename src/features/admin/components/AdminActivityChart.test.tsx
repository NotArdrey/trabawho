import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminActivityChart } from "./AdminActivityChart";
import type { ActivityPoint } from "../types/admin-activity";

const points: ActivityPoint[] = [
  { date: "2026-10-03", accounts: 0, reviews: 0 },
  { date: "2026-10-04", accounts: 0, reviews: 0 },
  { date: "2026-10-05", accounts: 3, reviews: 0 },
  { date: "2026-10-06", accounts: 0, reviews: 0 },
];

describe("AdminActivityChart daily breakdown", () => {
  test("starts compact, highlights activity days, and lets admins inspect every date", () => {
    render(<AdminActivityChart title="Account registrations" series="accounts" points={points} unavailable={false} />);
    const toggle = screen.getByRole("button", { name: "View daily breakdown" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Account registrations daily counts" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide daily breakdown" })).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Account registrations daily counts" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /All days/ }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /All days/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("gives a useful empty state without hiding the complete date history", () => {
    render(<AdminActivityChart title="Published reviews" series="reviews" points={points} unavailable={false} />);
    fireEvent.click(screen.getByRole("button", { name: "View daily breakdown" }));
    expect(screen.getByText(/No activity days in this period/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All days/ }));
    expect(screen.getByRole("list", { name: "Published reviews daily counts" }).querySelectorAll("li")).toHaveLength(4);
  });
});
