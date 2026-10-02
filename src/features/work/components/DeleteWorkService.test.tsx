import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteWorkService } from "./DeleteWorkService";
const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("../services/workDeletion", () => ({ deleteWorkService: remove }));
describe("service deletion", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("does not delete on opening or cancelling confirmation", () => {
    render(<DeleteWorkService serviceId={7} sellerId="worker" title="Plumbing" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete service" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Plumbing");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
  });
  it("keeps failure visible and refreshes only after a successful retry", async () => {
    remove.mockRejectedValueOnce(new Error("Unable to delete this service."));
    const refresh = vi.fn();
    render(<DeleteWorkService serviceId={7} sellerId="worker" title="Plumbing" onDeleted={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete service" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete service" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to delete"));
    expect(refresh).not.toHaveBeenCalled();
    remove.mockResolvedValue(undefined);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete service" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenLastCalledWith(7, "worker");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
