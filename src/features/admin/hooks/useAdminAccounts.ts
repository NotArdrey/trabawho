import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase";
import AdminAccountService from "../services/AdminAccountService";
import type { AdminAccount, AdminComment, AdminStats, ReviewRatingFilter, ReviewStatusFilter } from "../types";

const REVIEW_PAGE_SIZE = 10;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useAdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewQuery, setReviewQuery] = useState("");
  const [debouncedReviewQuery, setDebouncedReviewQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("all");
  const [reviewRating, setReviewRating] = useState<ReviewRatingFilter>("all");
  const [reviewPage, setReviewPage] = useState(1);
  const reviewRequestId = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentActionError, setCommentActionError] = useState("");
  const [accessActionTarget, setAccessActionTarget] = useState<AdminAccount | null>(null);
  const [accessActionMode, setAccessActionMode] = useState<"disable" | "ban">("disable");
  const [accessReason, setAccessReason] = useState("");
  const [accessDurationValue, setAccessDurationValue] = useState("2");
  const [accessDurationUnit, setAccessDurationUnit] = useState<"minutes" | "hours" | "days">("minutes");
  const [commentDeleteTarget, setCommentDeleteTarget] = useState<AdminComment | null>(null);

  const refreshAccounts = useCallback(async () => {
    try {
      setAccounts(await AdminAccountService.fetchAccounts());
      setAccountsError("");
    } catch (error) {
      setAccountsError(errorMessage(error, "Unable to load accounts right now."));
    } finally {
      setIsAccountsLoading(false);
    }
  }, []);

  const refreshComments = useCallback(async () => {
    const requestId = ++reviewRequestId.current;
    setIsCommentsLoading(true);
    try {
      const result = await AdminAccountService.fetchComments({ page: reviewPage, pageSize: REVIEW_PAGE_SIZE, search: debouncedReviewQuery, status: reviewStatus, rating: reviewRating });
      if (requestId !== reviewRequestId.current) return;
      setComments(result.items);
      setReviewTotal(result.total);
      setCommentsError("");
      if (reviewPage > 1 && result.total <= (reviewPage - 1) * REVIEW_PAGE_SIZE) setReviewPage(reviewPage - 1);
    } catch (error) {
      if (requestId !== reviewRequestId.current) return;
      setCommentsError(errorMessage(error, "Unable to load reviews right now."));
    } finally {
      if (requestId === reviewRequestId.current) setIsCommentsLoading(false);
    }
  }, [reviewPage, debouncedReviewQuery, reviewStatus, reviewRating]);

  const changeReviewQuery = useCallback((value: string) => { setReviewQuery(value); setReviewPage(1); }, []);
  const changeReviewStatus = useCallback((value: ReviewStatusFilter) => { setReviewStatus(value); setReviewPage(1); }, []);
  const changeReviewRating = useCallback((value: ReviewRatingFilter) => { setReviewRating(value); setReviewPage(1); }, []);

  useEffect(() => {
    queueMicrotask(() => { void refreshAccounts(); });
  }, [refreshAccounts]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedReviewQuery(reviewQuery), 300);
    return () => window.clearTimeout(timeout);
  }, [reviewQuery]);
  useEffect(() => {
    queueMicrotask(() => { void refreshComments(); });
    return () => { reviewRequestId.current += 1; };
  }, [refreshComments]);
  useEffect(() => {
    const channel = supabase.channel("admin-accounts-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { void refreshAccounts(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshAccounts]);

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const query = searchQuery.trim().toLowerCase();
    return (selectedRole === "all" || account.role === selectedRole)
      && (!query || [account.name, account.email, account.role].some((value) => value.toLowerCase().includes(query)));
  }), [accounts, searchQuery, selectedRole]);

  const normalizedAccounts = useMemo(() => filteredAccounts.map((account) => ({
    ...account,
    displayStatus: account.status || account.accountStatus || "active",
    lastSeen: account.lastSeen || (account.updatedAt ? new Date(account.updatedAt).toLocaleString() : "Unknown"),
  })), [filteredAccounts]);

  const stats: AdminStats = useMemo(() => ({
    activeAccounts: accounts.filter((account) => (account.status || account.accountStatus || "active") === "active").length,
    disabledAccounts: accounts.filter((account) => (account.status || account.accountStatus) === "disabled").length,
    suspendedAccounts: accounts.filter((account) => (account.status || account.accountStatus) === "suspended").length,
  }), [accounts]);

  const handleUpdateRole = useCallback(async (account: AdminAccount, nextRole: "client" | "admin") => {
    if (!account.id || roleSavingId) return;
    setRoleSavingId(account.id);
    try {
      await AdminAccountService.updateRole(account.id, nextRole);
      await refreshAccounts();
      toast.success("Account role updated.");
    } catch (error) {
      setAccountsError(errorMessage(error, "Unable to update role right now."));
    } finally { setRoleSavingId(null); }
  }, [refreshAccounts, roleSavingId]);

  const openAccessAction = useCallback((account: AdminAccount, mode: "disable" | "ban") => {
    setAccessActionTarget(account);
    setAccessError("");
    setAccessActionMode(mode);
    setAccessReason(mode === "ban" ? "Suspended for policy violation." : "Disabled by admin.");
    setAccessDurationValue("2");
    setAccessDurationUnit("minutes");
  }, []);
  const closeAccessAction = useCallback(() => { if (!accessSaving) { setAccessActionTarget(null); setAccessError(""); } }, [accessSaving]);

  const handleConfirmAccessAction = useCallback(async () => {
    if (!accessActionTarget?.id || accessSaving) return;
    const duration = AdminAccountService.calculateDurationMinutes(accessDurationValue, accessDurationUnit);
    if (!accessReason.trim() || (accessActionMode === "ban" && (!Number.isFinite(duration) || duration <= 0))) return;
    setAccessSaving(true);
    try {
      await AdminAccountService.updateStatus(accessActionTarget.id, accessActionMode === "ban" ? "suspended" : "disabled", accessReason.trim(), accessActionMode === "ban" ? duration : null);
      await refreshAccounts();
      setAccessActionTarget(null);
      setAccessError("");
      toast.success("Account access updated.");
    } catch (error) {
      setAccessError(errorMessage(error, "Unable to update account access right now."));
    } finally { setAccessSaving(false); }
  }, [accessActionTarget, accessActionMode, accessReason, accessDurationValue, accessDurationUnit, accessSaving, refreshAccounts]);

  const handleRestoreAccount = useCallback(async (account: AdminAccount) => {
    if (!account.id || accessSaving) return;
    setAccessSaving(true);
    try {
      await AdminAccountService.updateStatus(account.id, "active");
      await refreshAccounts();
      toast.success("Account restored.");
    } catch (error) {
      setAccountsError(errorMessage(error, "Unable to restore account right now."));
    } finally { setAccessSaving(false); }
  }, [accessSaving, refreshAccounts]);

  const handleDeleteComment = useCallback(async (commentId: number | string | undefined) => {
    if (commentId === undefined || commentSaving) return;
    setCommentSaving(true);
    try {
      await AdminAccountService.deleteComment(commentId);
      await refreshComments();
      setCommentDeleteTarget(null);
      setCommentActionError("");
      toast.success("Review deleted.");
    } catch (error) {
      setCommentActionError(errorMessage(error, "Unable to delete review right now."));
    } finally { setCommentSaving(false); }
  }, [commentSaving, refreshComments]);

  return { accounts, normalizedAccounts, isAccountsLoading, accountsError, comments, isCommentsLoading, commentsError,
    reviewTotal, reviewQuery, setReviewQuery: changeReviewQuery, reviewStatus, setReviewStatus: changeReviewStatus,
    reviewRating, setReviewRating: changeReviewRating, reviewPage, setReviewPage, reviewPageSize: REVIEW_PAGE_SIZE,
    stats, searchQuery, setSearchQuery, selectedRole, setSelectedRole, roleSavingId, accessSaving, accessError, commentSaving, commentActionError, setCommentActionError,
    handleUpdateRole, openAccessAction, closeAccessAction, handleConfirmAccessAction, handleRestoreAccount,
    accessActionTarget, accessActionMode, accessReason, setAccessReason, accessDurationValue, setAccessDurationValue,
    accessDurationUnit, setAccessDurationUnit, commentDeleteTarget, setCommentDeleteTarget, handleDeleteComment,
    refreshAccounts, refreshComments };
}

export default useAdminAccounts;
