export type AdminSection = "overview" | "accounts" | "logs" | "comments" | "cases" | "settings";
export type AccountRole = "client" | "worker" | "admin";
export type AccountStatus = "active" | "disabled" | "suspended";

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  status?: AccountStatus;
  accountStatus?: AccountStatus;
  displayStatus?: AccountStatus;
  lastSeen?: string;
  updatedAt?: string;
  suspendedUntil?: string | null;
  suspendedReason?: string;
  disabledReason?: string;
  suspendedAt?: string | null;
  disabledAt?: string | null;
}

export interface AdminComment {
  id: number | string;
  worker: string;
  client: string;
  rating: number;
  comment: string;
  status: "review" | "published";
  createdAt?: string;
}

export type ReviewStatusFilter = "all" | "published" | "unpublished";
export type ReviewRatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

export interface ReviewQuery {
  page: number;
  pageSize: number;
  search: string;
  status: ReviewStatusFilter;
  rating: ReviewRatingFilter;
}

export interface ReviewPage {
  items: AdminComment[];
  total: number;
}

export interface AdminStats {
  activeAccounts: number;
  disabledAccounts: number;
  suspendedAccounts: number;
}
