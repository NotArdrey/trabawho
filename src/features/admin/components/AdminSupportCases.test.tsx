import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { useAdminSupportCases } from "@/features/admin/hooks/useAdminSupportCases";
import type { SupportCase } from "@/features/admin/services/adminSupportService";
import AdminSupportCases from "./AdminSupportCases";

vi.mock("@/features/admin/hooks/useAdminSupportCases", () => ({ useAdminSupportCases: vi.fn() }));

const cases = Array.from({ length: 10 }, (_, index) => ({
  id: `case-${index + 1}`, booking_id: `booking-${index + 1}`, case_type: "provider_no_show",
  reason: `Reported issue ${index + 1}`, status: "under_review", created_at: "2026-10-04T08:00:00Z",
  resolution_status: "reviewing", assigned_admin_id: null,
})) as SupportCase[];

describe("AdminSupportCases pagination", () => {
  it("shows eight cases per page and resets to page one when searching", () => {
    vi.mocked(useAdminSupportCases).mockReturnValue({ cases, loading: false, error: "", refresh: vi.fn() });
    render(<MemoryRouter initialEntries={["/admin/support-cases"]}><AdminSupportCases /></MemoryRouter>);
    expect(screen.getByText("Reported issue 1")).toBeVisible();
    expect(screen.queryByText("Reported issue 9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getByText("Reported issue 9")).toBeVisible();
    expect(screen.getByText("Showing 9–10 of 10 matching cases")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search loaded support cases" }), { target: { value: "issue 1" } });
    expect(screen.getByText("Reported issue 1")).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Support case pages" })).not.toBeInTheDocument();
  });
});
