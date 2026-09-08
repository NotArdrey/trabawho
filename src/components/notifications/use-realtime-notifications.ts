import { useCallback, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured, supabase, type Database, type Json } from "@/integrations/supabase";
import type { AppNotification } from "./notification-center";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

const MAX_NOTIFICATIONS = 30;

function formatRelativeTime(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(difference / 60_000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(difference / 3_600_000);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(difference / 86_400_000), "day");
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasReadBy(readBy: Json | null, userId: string) {
  const matchesUser = (value: Json | undefined) => (typeof value === "string" || typeof value === "number") && String(value) === userId;
  if (Array.isArray(readBy)) return readBy.some(matchesUser);
  if (typeof readBy === "string") {
    try {
      return hasReadBy(JSON.parse(readBy) as Json, userId);
    } catch {
      return readBy === userId;
    }
  }
  if (readBy && typeof readBy === "object") {
    return Object.values(readBy).some(matchesUser);
  }
  return false;
}

function bookingNotification(row: BookingRow, readIds: Set<string>): AppNotification {
  const id = `booking:${row.id}:${row.updated_at}`;
  const status = readableStatus(row.status || "updated");
  return {
    id,
    title: `Booking ${status}`,
    message: `Booking ${row.id.slice(0, 8)} is now ${status.toLowerCase()}.`,
    time: formatRelativeTime(row.updated_at),
    createdAt: row.updated_at,
    isRead: readIds.has(id),
    type: "booking",
  };
}

function messageNotification(row: MessageRow, userId: string, readIds: Set<string>): AppNotification {
  const id = `message:${row.id}`;
  const body = row.body?.trim();
  return {
    id,
    title: "New message",
    message: body ? (body.length > 90 ? `${body.slice(0, 87)}...` : body) : "You received a new attachment.",
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    isRead: readIds.has(id) || hasReadBy(row.read_by, userId),
    type: "message",
  };
}

function useRealtimeNotifications(providedUserId?: string) {
  const [resolvedUserId, setResolvedUserId] = useState("");
  const userId = providedUserId || resolvedUserId;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
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

  const pushNotification = useCallback((notification: AppNotification) => {
    setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, MAX_NOTIFICATIONS));
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      return undefined;
    }

    let active = true;
    try {
      const stored = JSON.parse(localStorage.getItem(`trabawho-notifications-read:${userId}`) || "[]") as unknown;
      readIds.current = new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      readIds.current = new Set();
    }

    const loadNotifications = async () => {
      setIsLoading(true);
      setError("");
      const [bookingResult, conversationResult] = await Promise.all([
        supabase.from("bookings").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("updated_at", { ascending: false }).limit(20),
        supabase.from("conversations").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("created_at", { ascending: false }).limit(50),
      ]);
      if (bookingResult.error) throw bookingResult.error;
      if (conversationResult.error) throw conversationResult.error;

      const conversations = (conversationResult.data || []) as ConversationRow[];
      conversationIds.current = new Set(conversations.map((row) => row.id));
      const ids = [...conversationIds.current];
      const messageResult = ids.length
        ? await supabase.from("messages").select("*").in("conversation_id", ids).neq("sender_id", userId).order("created_at", { ascending: false }).limit(30)
        : { data: [], error: null };
      if (messageResult.error) throw messageResult.error;
      if (!active) return;

      setNotifications([
        ...((bookingResult.data || []) as BookingRow[]).map((row) => bookingNotification(row, readIds.current)),
        ...((messageResult.data || []) as MessageRow[]).map((row) => messageNotification(row, userId, readIds.current)),
      ].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, MAX_NOTIFICATIONS));
      setIsLoading(false);
    };

    void loadNotifications().catch(() => {
      if (active) {
        setError("Notifications could not be loaded.");
        setIsLoading(false);
      }
    });

    const channel = supabase
      .channel(`app-notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `buyer_id=eq.${userId}` }, (payload) => {
        if (payload.eventType !== "DELETE") pushNotification(bookingNotification(payload.new as BookingRow, readIds.current));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `seller_id=eq.${userId}` }, (payload) => {
        if (payload.eventType !== "DELETE") pushNotification(bookingNotification(payload.new as BookingRow, readIds.current));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as ConversationRow;
        if (row.buyer_id === userId || row.seller_id === userId) conversationIds.current.add(row.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id !== userId && conversationIds.current.has(row.conversation_id)) {
          pushNotification(messageNotification(row, userId, readIds.current));
        }
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [pushNotification, reloadKey, userId]);

  const markRead = useCallback((id: string) => {
    readIds.current.add(id);
    persistReadIds(readIds.current);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }, [persistReadIds]);

  const markAllRead = useCallback(() => {
    notifications.forEach((item) => readIds.current.add(item.id));
    persistReadIds(readIds.current);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
  }, [notifications, persistReadIds]);

  const canLoad = Boolean(userId && isSupabaseConfigured);
  return { notifications: canLoad ? notifications : [], isLoading: canLoad ? isLoading : false, error: canLoad ? error : "", markRead, markAllRead, retry: () => setReloadKey((value) => value + 1) };
}

export { useRealtimeNotifications };
