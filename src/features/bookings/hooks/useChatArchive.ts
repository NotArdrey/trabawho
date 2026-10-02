import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArchivedChats, unarchiveChat, type ArchivedChat, type ChatViewerRole } from "../services/chatArchive";

export function useChatArchive(open: boolean, role: ChatViewerRole, onRestored: () => Promise<unknown>) {
  const [chats, setChats] = useState<ArchivedChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const restoringRef = useRef(false);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchArchivedChats(role);
      if (request === generation.current) setChats(rows);
    } catch {
      if (request === generation.current) setError("Unable to load archived chats. Check your connection and try again.");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(() => { if (open && !disposed) void refresh(); });
    return () => { disposed = true; generation.current += 1; };
  }, [open, refresh]);

  const restore = async (chat: ArchivedChat): Promise<boolean> => {
    if (restoringRef.current) return false;
    restoringRef.current = true;
    setRestoring(true);
    setError("");
    setNotice("");
    try {
      await unarchiveChat(chat.conversationId);
      setChats((current) => current.filter((row) => row.conversationId !== chat.conversationId));
      setNotice("Chat unarchived. It is back in your active inbox.");
      try {
        await onRestored();
      } catch {
        setNotice("Chat unarchived. Refresh Messages to update your active inbox.");
      }
      return true;
    } catch {
      setError("Unable to unarchive this chat. Check your connection and try again.");
      return false;
    } finally {
      restoringRef.current = false;
      setRestoring(false);
    }
  };

  return { chats, loading, error, restoring, notice, refresh, restore };
}
