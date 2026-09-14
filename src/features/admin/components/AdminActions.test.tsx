import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AccessActionModal from "@/features/admin/components/AccessActionModal";
import AdminAccountsTable from "@/features/admin/components/AdminAccountsTable";
import AdminCommentsSection from "@/features/admin/components/AdminCommentsSection";
import type { AdminAccount, AdminComment } from "@/features/admin/types";

const account: AdminAccount = {
  id: "account-42",
  name: "Sofia Reyes",
  email: "sofia@example.com",
  role: "client",
  displayStatus: "suspended",
  suspendedReason: "Repeated policy violation",
  suspendedUntil: "2026-09-20T08:00:00Z",
  lastSeen: "Yesterday",
};

const comment: AdminComment = {
  id: "comment-17",
  worker: "Paolo Santos",
  client: "Sofia Reyes",
  comment: "The work was completed on schedule.",
  rating: 5,
  status: "flagged",
};

describe("admin sensitive actions", () => {
  it("restores the selected account record", () => {
    const onRestoreAccount = vi.fn();
    render(
      <AdminAccountsTable
        normalizedAccounts={[account]}
        isAccountsLoading={false}
        accountsError=""
        searchQuery=""
        onSearchChange={vi.fn()}
        selectedRole="all"
        onRoleFilterChange={vi.fn()}
        roleSavingId={null}
        onUpdateRole={vi.fn()}
        onOpenAccessAction={vi.fn()}
        onRestoreAccount={onRestoreAccount}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore access" }));
    expect(onRestoreAccount).toHaveBeenCalledWith(account);
  });

  it("passes the selected comment into the delete confirmation flow", () => {
    const onOpenDeleteComment = vi.fn();
    render(
      <AdminCommentsSection
        comments={[comment]}
        commentsError=""
        onOpenDeleteComment={onOpenDeleteComment}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(onOpenDeleteComment).toHaveBeenCalledWith(comment);
  });

  it("requires a reason and submits the access action once", async () => {
    const onConfirm = vi.fn();
    const onReasonChange = vi.fn();
    const { rerender } = render(
      <AccessActionModal
        isOpen
        target={{ ...account, displayStatus: "active" }}
        mode="disable"
        reason=""
        onReasonChange={onReasonChange}
        durationValue="2"
        onDurationValueChange={vi.fn()}
        durationUnit="minutes"
        onDurationUnitChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Disable account" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Repeated policy violation" } });
    expect(onReasonChange).toHaveBeenCalledWith("Repeated policy violation");

    rerender(
      <AccessActionModal
        isOpen
        target={{ ...account, displayStatus: "active" }}
        mode="disable"
        reason="Repeated policy violation"
        onReasonChange={onReasonChange}
        durationValue="2"
        onDurationValueChange={vi.fn()}
        durationUnit="minutes"
        onDurationUnitChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disable account" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });
});
