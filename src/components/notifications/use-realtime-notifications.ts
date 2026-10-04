import { useCallback, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured, supabase, type Database } from "@/integrations/supabase";
import type { AppNotification } from "./notification-center";
import { bookingNotification, caseNotification, messageNotification } from "./notification-items";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type CaseMessageRow = Database["public"]["Tables"]["booking_case_messages"]["Row"];

const MAX_NOTIFICATIONS = 30;

function useRealtimeNotifications(providedUserId?: string) {
  const [resolvedUserId, setResolvedUserId] = useState("");
  const userId = providedUserId || resolvedUserId;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadedForUserId, setLoadedForUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const conversationIds = useRef(new Set<string>());
  const readIds = useRef(new Set<string>());

  useEffect(() => {
    if (providedUserId) return;
    void supabase.auth.getUser().then(({ data }) => setResolvedUserId(data.user?.id || ""));
  }, [providedUserId]);

  const persistReadIds = useCallback((ids: Set<string>) => {
    if (userId) localStorage.setItem(`trabawho-notifications-read:${userId}`, JSON.stringify([...ids].slice(-200)));
  }, [userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      return undefined;
    }

    let active = true;
    let loadSequence = 0;
    let hasLoaded = false;
    try {
      const stored = JSON.parse(localStorage.getItem(`trabawho-notifications-read:${userId}`) || "[]") as unknown;
      readIds.current = new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      readIds.current = new Set();
    }

    const loadNotifications = async (foreground = false) => {
      const sequence = ++loadSequence;
      if (foreground) setIsLoading(true);
      const [bookingResult, conversationResult, caseNoticeResult] = await Promise.all([
        supabase.from("bookings").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("updated_at", { ascending: false }).limit(20),
        supabase.from("conversations").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("created_at", { ascending: false }).limit(50),
        supabase.from("booking_case_notifications").select("*").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (bookingResult.error) throw bookingResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (caseNoticeResult.error && caseNoticeResult.error.code !== "PGRST205") throw caseNoticeResult.error;

      const conversations = (conversationResult.data || []) as ConversationRow[];
      conversationIds.current = new Set(conversations.map((row) => row.id));
      const ids = [...conversationIds.current];
      const caseNotices = caseNoticeResult.error ? [] : caseNoticeResult.data || [];
      const [messageResult, caseMessageResult] = await Promise.all([
        ids.length
          ? supabase.from("messages").select("*").in("conversation_id", ids).neq("sender_id", userId).order("created_at", { ascending: false }).limit(30)
          : Promise.resolve({ data: [] as MessageRow[], error: null }),
        caseNotices.length
          ? supabase.from("booking_case_messages").select("*").in("id", [...new Set(caseNotices.map((notice) => notice.message_id))])
          : Promise.resolve({ data: [] as CaseMessageRow[], error: null }),
      ]);
      if (messageResult.error) throw messageResult.error;
      if (!active || sequence !== loadSequence) return;
      const byConversation = new Map(conversations.map((row) => [row.id, row]));
      const byCaseMessage = new Map((caseMessageResult.error ? [] : caseMessageResult.data || []).map((row) => [row.id, row]));

      setNotifications([
        ...((bookingResult.data || []) as BookingRow[]).map((row) => bookingNotification(row, userId, readIds.current)),
        ...((messageResult.data || []) as MessageRow[]).flatMap((row) => {
          const conversation = byConversation.get(row.conversation_id);
          return conversation ? [messageNotification(row, conversation, userId, readIds.current)] : [];
        }),
        ...caseNotices.map((notice) => caseNotification(notice, byCaseMessage.get(notice.message_id))),
      ].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, MAX_NOTIFICATIONS));
      setLoadedForUserId(userId);
      hasLoaded = true;
      setError("");
      if (caseNoticeResult.error || caseMessageResult.error) setActionError("Some support alerts could not be loaded. Try again shortly.");
      setIsLoading(false);
    };

    const reload = (foreground = false) => { void loadNotifications(foreground).catch(() => {
      if (active) {
        if (hasLoaded) setActionError("Notifications could not be refreshed. Try again shortly.");
        else setError("Notifications could not be loaded.");
        setIsLoading(false);
      }
    }); };
    reload(true);

    const channel = supabase
      .channel(`app-notifications-${userId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `buyer_id=eq.${userId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `seller_id=eq.${userId}` }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as ConversationRow;
        if (row.buyer_id === userId || row.seller_id === userId) conversationIds.current.add(row.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id !== userId && conversationIds.current.has(row.conversation_id)) {
          reload();
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_case_notifications", filter: `recipient_id=eq.${userId}` }, () => reload())
      .subscribe();
    const reconciliation = window.setInterval(() => { if (document.visibilityState !== "hidden" && navigator.onLine) reload(); }, 30_000);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(reconciliation);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [reloadKey, userId]);

  const markRead = useCallback((id: string) => {
    setActionError("");
    const caseId = notifications.find((item) => item.id === id)?.caseId;
    if (caseId) {
      setNotifications((current) => current.map((item) => item.caseId === caseId ? { ...item, isRead: true } : item));
      void Promise.resolve(supabase.rpc("mark_booking_case_notifications_read", { p_case_id: caseId })).then(({ error: readError }) => {
        if (readError) { setActionError("Case updates could not be marked read. Open the case and try again."); setReloadKey((value) => value + 1); }
      }).catch(() => { setActionError("Case updates could not be marked read. Open the case and try again."); setReloadKey((value) => value + 1); });
      return;
    }
    readIds.current.add(id);
    persistReadIds(readIds.current);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }, [notifications, persistReadIds]);

  const markAllRead = useCallback(() => {
    setActionError("");
    notifications.filter((item) => !item.caseId).forEach((item) => readIds.current.add(item.id));
    persistReadIds(readIds.current);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    const caseIds = [...new Set(notifications.flatMap((item) => item.caseId && !item.isRead ? [item.caseId] : []))];
    if (caseIds.length) void Promise.all(caseIds.map((caseId) => supabase.rpc("mark_booking_case_notifications_read", { p_case_id: caseId })))
      .then((results) => { if (results.some((result) => result.error)) { setActionError("Some case updates could not be marked read. Open a case and try again."); setReloadKey((value) => value + 1); } })
      .catch(() => { setActionError("Some case updates could not be marked read. Open a case and try again."); setReloadKey((value) => value + 1); });
  }, [notifications, persistReadIds]);

  const canLoad = Boolean(userId && isSupabaseConfigured);
  return { notifications: canLoad && loadedForUserId === userId ? notifications : [], isLoading: canLoad ? !error && (isLoading || loadedForUserId !== userId) : false, error: canLoad ? error : "", actionError, markRead, markAllRead, retry: () => setReloadKey((value) => value + 1) };
}

export { useRealtimeNotifications };
