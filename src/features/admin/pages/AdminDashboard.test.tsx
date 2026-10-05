import { fireEvent, render as testingRender, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

const render = (element: Parameters<typeof testingRender>[0]) => testingRender(<MemoryRouter>{element}</MemoryRouter>);

vi.mock("../components/AdminAnalytics", () => ({ default: () => <section aria-label="Analytics">Live analytics</section> }));
vi.mock("../services/adminAuditService", () => ({ fetchAdminAuditFeed: vi.fn().mockResolvedValue({ entries: [], unavailable: [], cappedSources: [] }) }));

const openAccessAction = vi.fn();
const updateRole = vi.fn();
const restoreAccount = vi.fn();
const changeTheme = vi.fn();
const openAccountSettings = vi.fn();
const accounts = [
  { id: "u1", name: "Alice Admin", email: "alice@example.com", role: "admin", displayStatus: "active", lastSeen: "Today" },
  { id: "u2", name: "Bob Client", email: "bob@example.com", role: "client", displayStatus: "disabled", lastSeen: "Yesterday" },
];

vi.mock("../hooks/useAdminAccounts", () => ({
  useAdminAccounts: () => ({
    accounts, normalizedAccounts: accounts, isAccountsLoading: false, accountsError: "",
    comments: [{ id: 1, worker: "Juan Worker", client: "Bob Client", comment: "Great job!", rating: 5, status: "published" }],
    isCommentsLoading: false, commentsError: "", reviewTotal: 1, reviewQuery: "", setReviewQuery: vi.fn(), reviewStatus: "all", setReviewStatus: vi.fn(), reviewRating: "all", setReviewRating: vi.fn(), reviewPage: 1, setReviewPage: vi.fn(), reviewPageSize: 10, stats: { activeAccounts: 1, disabledAccounts: 1, suspendedAccounts: 0 },
    searchQuery: "", setSearchQuery: vi.fn(), selectedRole: "all", setSelectedRole: vi.fn(), roleSavingId: null,
    accessSaving: false, accessError: "", commentSaving: false, commentActionError: "", setCommentActionError: vi.fn(), handleUpdateRole: updateRole, openAccessAction, closeAccessAction: vi.fn(),
    handleConfirmAccessAction: vi.fn(), handleRestoreAccount: restoreAccount, accessActionTarget: null,
    accessActionMode: "disable", accessReason: "", setAccessReason: vi.fn(), accessDurationValue: "2",
    setAccessDurationValue: vi.fn(), accessDurationUnit: "minutes", setAccessDurationUnit: vi.fn(),
    commentDeleteTarget: null, setCommentDeleteTarget: vi.fn(), handleDeleteComment: vi.fn(),
    refreshAccounts: vi.fn(), refreshComments: vi.fn(),
  }),
}));

describe("AdminDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  test("shows real account metrics and no invented activity", () => {
    render(<AdminDashboard />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Disabled accounts")).toBeInTheDocument();
    expect(screen.queryByText("Admin Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Flagged Comments")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Analytics" })).toBeInTheDocument();
    const workspace = within(within(screen.getByRole("main")).getByRole("region", { name: "Workspace" }));
    for (const label of ["Review accounts", "View reviews", "View logs"]) {
      expect(workspace.getByRole("button", { name: new RegExp(label) })).toHaveClass("bg-primary");
    }
  });

  test("navigates existing screens and loads audit history", () => {
    render(<AdminDashboard />);
    const navigation = within(screen.getByRole("complementary", { name: /admin navigation sidebar/i }));
    fireEvent.click(navigation.getByRole("button", { name: /account management/i }));
    expect(screen.getByLabelText("Search accounts")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    fireEvent.click(navigation.getByRole("button", { name: /audit logs/i }));
    expect(screen.getByRole("heading", { name: "Audit logs" })).toBeInTheDocument();
    fireEvent.click(navigation.getByRole("button", { name: /^reviews$/i }));
    expect(screen.getByText("Great job!")).toBeInTheDocument();
  });

  test("confirms restore and role changes before sending them", () => {
    render(<AdminDashboard />);
    fireEvent.click(within(screen.getByRole("complementary", { name: /admin navigation sidebar/i })).getByRole("button", { name: /account management/i }));
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    expect(openAccessAction).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), "disable");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByRole("heading", { name: "Restore account?" })).toBeInTheDocument();
    expect(restoreAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
    expect(restoreAccount).toHaveBeenCalledWith(expect.objectContaining({ id: "u2" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Set admin" })[1]);
    expect(screen.getByRole("heading", { name: "Grant admin access?" })).toBeInTheDocument();
    expect(updateRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm role change" }));
    expect(updateRole).toHaveBeenCalledWith(expect.objectContaining({ id: "u2" }), "admin");
  });

  test("opens the logout confirmation", () => {
    render(<AdminDashboard />);
    fireEvent.click(within(screen.getByRole("complementary", { name: /admin navigation sidebar/i })).getByRole("button", { name: "Logout" }));
    expect(screen.getByText(/are you sure you want to log out/i)).toBeInTheDocument();
  });

  test("opens dedicated settings with account and appearance controls", () => {
    render(<AdminDashboard appTheme="dark" themeMode="system" onThemeChange={changeTheme} onOpenAccountSettings={openAccountSettings} adminIdentity={{ fullName: "Alice Admin", email: "alice@example.com" }} />);
    const sidebar = within(screen.getByRole("complementary", { name: /admin navigation sidebar/i }));
    expect(sidebar.queryByRole("radiogroup", { name: "Appearance" })).not.toBeInTheDocument();
    fireEvent.click(sidebar.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /device/i })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /^light/i }));
    expect(changeTheme).toHaveBeenCalledWith("light");
    fireEvent.click(screen.getByRole("button", { name: /manage account & privacy/i }));
    expect(openAccountSettings).toHaveBeenCalledOnce();
  });
});
