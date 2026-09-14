import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminDashboard from "@/features/admin/pages/AdminDashboard";

const hookMocks = vi.hoisted(() => ({
  setSearchQuery: vi.fn(),
  setSelectedRole: vi.fn(),
  handleUpdateRole: vi.fn(),
  openAccessAction: vi.fn(),
  closeAccessAction: vi.fn(),
  handleConfirmAccessAction: vi.fn(),
  handleRestoreAccount: vi.fn(),
  handleDeleteComment: vi.fn(),
  setCommentDeleteTarget: vi.fn(),
}));

const mockAccounts = [
  {
    id: "u1",
    name: "Alice Admin",
    email: "alice@example.com",
    role: "admin",
    displayStatus: "active",
    lastSeen: "Just now",
    updatedAt: "2026-08-28T10:00:00Z",
  },
  {
    id: "u2",
    name: "Bob Client",
    email: "bob@example.com",
    role: "client",
    displayStatus: "active",
    lastSeen: "Yesterday",
    updatedAt: "2026-08-27T10:00:00Z",
  },
];

const mockComments = [
  {
    id: "c1",
    worker: "Juan Worker",
    client: "Bob Client",
    comment: "Great job!",
    rating: 5,
    status: "flagged",
  },
];

const mockLogs = [
  {
    id: "l1",
    action: "Account enabled",
    actor: "Admin",
    target: "Bob Client",
    timestamp: "2026-08-28 10:00:00",
    severity: "low",
  },
];

vi.mock("@/features/admin/hooks/useAdminAccounts", () => ({
  useAdminAccounts: () => ({
    accounts: mockAccounts,
    normalizedAccounts: mockAccounts,
    filteredAccounts: mockAccounts,
    isAccountsLoading: false,
    accountsError: "",
    commentsError: "",
    stats: {
      activeAccounts: 2,
      disabledAccounts: 0,
      suspendedAccounts: 0,
      flaggedComments: 1,
    },
    searchQuery: "",
    setSearchQuery: hookMocks.setSearchQuery,
    selectedRole: "all",
    setSelectedRole: hookMocks.setSelectedRole,
    handleUpdateRole: hookMocks.handleUpdateRole,
    roleSavingId: null,
    openAccessAction: hookMocks.openAccessAction,
    closeAccessAction: hookMocks.closeAccessAction,
    handleConfirmAccessAction: hookMocks.handleConfirmAccessAction,
    handleRestoreAccount: hookMocks.handleRestoreAccount,
    accessActionTarget: null,
    accessActionMode: "disable",
    accessReason: "",
    setAccessReason: vi.fn(),
    accessDurationValue: "2",
    setAccessDurationValue: vi.fn(),
    accessDurationUnit: "minutes",
    setAccessDurationUnit: vi.fn(),
    comments: mockComments,
    handleDeleteComment: hookMocks.handleDeleteComment,
    commentDeleteTarget: null,
    setCommentDeleteTarget: hookMocks.setCommentDeleteTarget,
    logs: mockLogs,
  }),
}));

vi.mock("@/features/admin/hooks/useIdentityReviews", () => ({
  useIdentityReviews: () => ({
    reviews: [],
    selectedReview: null,
    setSelectedReview: vi.fn(),
    isLoading: false,
    savingReviewId: null,
    error: "",
    statusMessage: "",
    refresh: vi.fn(),
    decide: vi.fn(),
  }),
}));

const renderAdmin = (initialPath = "/admin", props = {}) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <AdminDashboard {...props} />
  </MemoryRouter>,
);

describe("AdminDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the operations dashboard and complete admin navigation", () => {
    renderAdmin();

    const sidebar = screen.getByRole("complementary", { name: /admin navigation sidebar/i });
    expect(within(sidebar).getByRole("button", { name: /^Dashboard$/i })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar).getByRole("button", { name: /^Users/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Jobs$/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Employers$/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Applications$/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Moderation/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Audit logs$/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Settings$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "TrabaWho Admin Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Pending reviews")).toBeInTheDocument();
    expect(screen.getByText("System health")).toBeInTheDocument();
  });

  it("uses protected child URLs to switch between working admin sections", () => {
    renderAdmin();
    const sidebar = screen.getByRole("complementary", { name: /admin navigation sidebar/i });

    fireEvent.click(within(sidebar).getByRole("button", { name: /^Users/i }));
    expect(screen.getByRole("heading", { name: "Identity review queue", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "User management", level: 2 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search name, email, role/i)).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: /^Audit logs$/i }));
    expect(screen.getByText("Account enabled")).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: /^Moderation/i }));
    expect(screen.getByText("Great job!")).toBeInTheDocument();
  });

  it("renders honest unavailable states for unconnected management areas", () => {
    renderAdmin("/admin/jobs");

    expect(screen.getByRole("heading", { name: "Job management", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Data connection pending")).toBeInTheDocument();
  });

  it("preserves account action handlers and selected account IDs", () => {
    renderAdmin("/admin/users");

    const aliceRow = screen.getByText("Alice Admin").closest("tr");
    expect(aliceRow).not.toBeNull();
    fireEvent.click(within(aliceRow!).getByRole("button", { name: "Set client" }));
    expect(hookMocks.handleUpdateRole).toHaveBeenCalledWith(mockAccounts[0], "client");

    fireEvent.click(within(aliceRow!).getByRole("button", { name: "Disable" }));
    expect(hookMocks.openAccessAction).toHaveBeenCalledWith(mockAccounts[0], "disable");
  });

  it("returns to the app and opens the logout confirmation", () => {
    const onOpenDashboard = vi.fn();
    renderAdmin("/admin", { onOpenDashboard });

    fireEvent.click(screen.getAllByRole("button", { name: /back to trabawho/i })[0]);
    expect(onOpenDashboard).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByRole("button", { name: /log out/i })[0]);
    expect(screen.getByText(/are you sure you want to log out/i)).toBeInTheDocument();
  });
});
