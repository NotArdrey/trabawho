export type AuditSource = "bookings" | "support" | "identity";
export interface AuditEntry {
  id: string;
  source: AuditSource;
  actorId: string | null;
  actor: string;
  action: string;
  target: string;
  reason: string;
  outcome: string;
  createdAt: string;
  operationId: string | null;
}
export interface AuditFeed { entries: AuditEntry[]; unavailable: string[]; cappedSources: string[] }
export interface ActivityPoint { date: string; accounts: number; reviews: number }
export interface AdminAnalyticsData {
  days: number;
  newAccounts: number | null;
  activeServices: number | null;
  publishedReviews: number | null;
  averageRating: number | null;
  openCases: number | null;
  trend: ActivityPoint[];
  unavailable: string[];
  updatedAt: string;
}
