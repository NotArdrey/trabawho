import type { LucideIcon } from "lucide-react";

export type AdminSectionKey =
  | "overview"
  | "users"
  | "jobs"
  | "employers"
  | "applications"
  | "moderation"
  | "audit-logs"
  | "settings";

export type AdminAccountStatus = "active" | "disabled" | "suspended" | "unknown";

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  displayStatus: AdminAccountStatus;
  status?: AdminAccountStatus;
  accountStatus?: AdminAccountStatus;
  lastSeen: string;
  updatedAt?: string | null;
  createdAt?: string | null;
  disabledReason?: string;
  suspendedReason?: string;
  suspendedUntil?: string | null;
}

export interface AdminComment {
  id: string;
  worker: string;
  client: string;
  comment: string;
  rating: number;
  status: string;
  createdAt?: string | null;
}

export interface AdminLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
}

export type IdentityReviewDecision = "APPROVE" | "REJECT" | "RESUBMISSION";

export interface AdminIdentityReview {
  id: string;
  userId: string;
  source: "MANUAL_UPLOAD" | "DIDIT_PENDING" | "DIDIT_DUPLICATE";
  status: "PENDING_REVIEW";
  submittedAt: string;
  expectedDecisionBy: string;
  accountType: "client" | "worker";
  email: string;
  location: {
    province: string;
    city: string;
    barangay: string;
    address: string;
  };
  identity: {
    documentType: string;
    documentTypeKey: string | null;
    nameOnId: string | null;
    idNumber: string | null;
    expiryDate: string | null;
    diditSessionId: string | null;
    duplicateReason: string | null;
    duplicateMatchCount: number;
    diditResult: Record<string, unknown> | null;
    frontImageUrl: string | null;
    backImageUrl: string | null;
    selfieImageUrl: string | null;
  };
}

export interface AdminStats {
  activeAccounts: number;
  disabledAccounts: number;
  suspendedAccounts: number;
  flaggedComments: number;
}

export interface AdminNavigationItem {
  key: AdminSectionKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: "default" | "warning";
}

export interface AdminState {
  accounts: AdminAccount[];
  normalizedAccounts: AdminAccount[];
  isAccountsLoading: boolean;
  accountsError: string;
  commentsError: string;
  stats: AdminStats;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRole: string;
  setSelectedRole: (value: string) => void;
  handleUpdateRole: (account: AdminAccount, role: string) => Promise<void> | void;
  roleSavingId: string | null;
  openAccessAction: (account: AdminAccount, mode: "disable" | "ban") => void;
  closeAccessAction: () => void;
  handleConfirmAccessAction: () => Promise<void> | void;
  handleRestoreAccount: (account: AdminAccount) => Promise<void> | void;
  accessActionTarget: AdminAccount | null;
  accessActionMode: "disable" | "ban";
  accessReason: string;
  setAccessReason: (value: string) => void;
  accessDurationValue: string;
  setAccessDurationValue: (value: string) => void;
  accessDurationUnit: string;
  setAccessDurationUnit: (value: string) => void;
  comments: AdminComment[];
  handleDeleteComment: (commentId: string | undefined) => Promise<void> | void;
  commentDeleteTarget: AdminComment | null;
  setCommentDeleteTarget: (comment: AdminComment | null) => void;
  logs: AdminLog[];
}
