import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';

// Mock the hook
const mockAccounts = [
  { id: 'u1', name: 'Alice Admin', email: 'alice@example.com', role: 'admin', displayStatus: 'active', lastSeen: 'Just now' },
  { id: 'u2', name: 'Bob Client', email: 'bob@example.com', role: 'client', displayStatus: 'active', lastSeen: 'Yesterday' },
];

const mockStats = {
  activeAccounts: 2,
  disabledAccounts: 0,
  suspendedAccounts: 0,
  flaggedComments: 1,
};

const mockComments = [
  { id: 'c1', worker: 'Juan Worker', client: 'Bob Client', comment: 'Great job!', rating: 5, status: 'flagged' },
];

const mockLogs = [
  { id: 'l1', action: 'Account Enabled', actor: 'Admin', target: 'Bob Client', timestamp: '2026-08-28 10:00:00', severity: 'low' },
];

jest.mock('../hooks/useAdminAccounts', () => ({
  useAdminAccounts: () => ({
    accounts: mockAccounts,
    normalizedAccounts: mockAccounts,
    filteredAccounts: mockAccounts,
    isAccountsLoading: false,
    accountsError: '',
    commentsError: '',
    stats: mockStats,
    searchQuery: '',
    setSearchQuery: jest.fn(),
    selectedRole: 'all',
    setSelectedRole: jest.fn(),
    handleUpdateRole: jest.fn(),
    roleSavingId: null,
    openAccessAction: jest.fn(),
    closeAccessAction: jest.fn(),
    handleConfirmAccessAction: jest.fn(),
    handleRestoreAccount: jest.fn(),
    accessActionTarget: null,
    accessActionMode: 'disable',
    accessReason: '',
    setAccessReason: jest.fn(),
    accessDurationValue: '2',
    setAccessDurationValue: jest.fn(),
    accessDurationUnit: 'minutes',
    setAccessDurationUnit: jest.fn(),
    comments: mockComments,
    setComments: jest.fn(),
    handleDeleteComment: jest.fn(),
    commentDeleteTarget: null,
    setCommentDeleteTarget: jest.fn(),
    logs: mockLogs,
  }),
}));

describe('AdminDashboard with Sidebar UI', () => {
  const mockOnLogout = jest.fn();
  const mockOnOpenDashboard = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sidebar navigation with brand and all sections', () => {
    render(
      <AdminDashboard
        appTheme="light"
        onLogout={mockOnLogout}
        onOpenDashboard={mockOnOpenDashboard}
      />
    );

    // Sidebar navigation
    const sidebar = screen.getByRole('complementary', { name: /admin navigation sidebar/i });
    expect(sidebar).toBeInTheDocument();

    // Verify all sidebar navigation section items within sidebar
    expect(within(sidebar).getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: /Account Management/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: /Audit Logs/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: /Summary \/ Comments/i })).toBeInTheDocument();

    // Main header on landing overview
    expect(screen.getByRole('heading', { name: 'TrabaWho Admin Dashboard' })).toBeInTheDocument();
  });

  test('switches sections when sidebar items are clicked', () => {
    render(
      <AdminDashboard
        appTheme="light"
        onLogout={mockOnLogout}
        onOpenDashboard={mockOnOpenDashboard}
      />
    );

    const sidebar = screen.getByRole('complementary', { name: /admin navigation sidebar/i });

    // Click Account Management in sidebar
    fireEvent.click(within(sidebar).getByRole('button', { name: /Account Management/i }));
    expect(screen.getByPlaceholderText(/search name, email, role/i)).toBeInTheDocument();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();

    // Click Audit Logs in sidebar
    fireEvent.click(within(sidebar).getByRole('button', { name: /Audit Logs/i }));
    expect(screen.getByText('Account Enabled')).toBeInTheDocument();

    // Click Summary / Comments in sidebar
    fireEvent.click(within(sidebar).getByRole('button', { name: /Summary \/ Comments/i }));
    expect(screen.getByText('Great job!')).toBeInTheDocument();
  });

  test('calls onOpenDashboard when Back to App button is clicked', () => {
    render(
      <AdminDashboard
        appTheme="light"
        onLogout={mockOnLogout}
        onOpenDashboard={mockOnOpenDashboard}
      />
    );

    const backButtons = screen.getAllByRole('button', { name: /back to app/i });
    expect(backButtons.length).toBeGreaterThan(0);
    fireEvent.click(backButtons[0]);
    expect(mockOnOpenDashboard).toHaveBeenCalled();
  });

  test('opens logout modal when Logout button is clicked', () => {
    render(
      <AdminDashboard
        appTheme="light"
        onLogout={mockOnLogout}
        onOpenDashboard={mockOnOpenDashboard}
      />
    );

    const logoutButtons = screen.getAllByRole('button', { name: /logout/i });
    expect(logoutButtons.length).toBeGreaterThan(0);
    fireEvent.click(logoutButtons[0]);

    // Logout confirmation modal should appear
    expect(screen.getByText(/are you sure you want to log out/i)).toBeInTheDocument();
  });
});
