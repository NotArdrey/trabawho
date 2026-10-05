import { fireEvent, render, screen, within } from "@testing-library/react";
import AdminAccountsTable from "./AdminAccountsTable";
import type { AdminAccount } from "../types";

const accounts: AdminAccount[] = Array.from({ length: 18 }, (_, index) => ({
  id: `user-${index + 1}`,
  name: `Demo Person ${index + 1}`,
  email: `person${index + 1}@example.com`,
  role: "client",
  displayStatus: "active",
}));
const onSearchChange = vi.fn();
const onRoleFilterChange = vi.fn();
const onUpdateRole = vi.fn();

function renderTable() {
  render(<AdminAccountsTable accounts={accounts} isLoading={false} error="" onRetry={vi.fn()} searchQuery="" onSearchChange={onSearchChange} selectedRole="all" onRoleFilterChange={onRoleFilterChange} roleSavingId={null} accessSaving={false} onUpdateRole={onUpdateRole} onOpenAccessAction={vi.fn()} onRestoreAccount={vi.fn()} />);
}

describe("AdminAccountsTable", () => {
  beforeEach(() => vi.clearAllMocks());

  test("pages accounts and reports the visible range", () => {
    renderTable();
    expect(screen.getByText("Showing 1–8 of 18 accounts")).toBeInTheDocument();
    expect(screen.getByText("Demo Person 1")).toBeInTheDocument();
    expect(screen.queryByText("Demo Person 9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 9–16 of 18 accounts")).toBeInTheDocument();
    expect(screen.getByText("Demo Person 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Search accounts"), { target: { value: "person 1" } });
    expect(onSearchChange).toHaveBeenCalledWith("person 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  test("requires confirmation before changing account privileges", () => {
    renderTable();
    fireEvent.click(screen.getAllByRole("button", { name: "Set admin" })[0]);
    expect(screen.getByRole("heading", { name: "Grant admin access?" })).toBeInTheDocument();
    expect(onUpdateRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUpdateRole).not.toHaveBeenCalled();
  });

  test("uses the shared search and role filter controls", () => {
    renderTable();
    expect(screen.getByRole("searchbox", { name: "Search accounts" })).toBeVisible();
    const roles = screen.getByRole("toolbar", { name: "Role" });
    expect(within(roles).getByRole("button", { name: "All roles" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(roles).getByRole("button", { name: "Worker" }));
    expect(onRoleFilterChange).toHaveBeenCalledWith("worker");
  });

  test("separates role changes from access restrictions", () => {
    renderTable();
    const roleActions = screen.getByRole("group", { name: "Role changes for Demo Person 1" });
    const accessActions = screen.getByRole("group", { name: "Access actions for Demo Person 1" });
    expect(within(roleActions).getByRole("button", { name: "Set admin" })).toHaveClass("text-primary");
    expect(within(accessActions).getByRole("button", { name: "Disable" })).toHaveClass("text-amber-900");
    expect(within(accessActions).getByRole("button", { name: "Suspend" })).toHaveClass("bg-destructive");
  });
});
