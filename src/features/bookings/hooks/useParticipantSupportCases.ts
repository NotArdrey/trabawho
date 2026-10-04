import { useCallback, useEffect, useRef, useState } from "react";
import { listParticipantSupportCases, type ParticipantSupportCase } from "../services/participantSupportCases";
import { useBookingActivity } from "./useBookingActivity";

export function useParticipantSupportCases(userId?: string) {
  const [result, setResult] = useState<{ userId?: string; items: ParticipantSupportCase[] }>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const loadedUserId = useRef<string | undefined>(undefined);
  const invalidate = useCallback(() => { request.current++; }, []);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    if (loadedUserId.current !== userId) setLoading(true);
    try {
      const items = await listParticipantSupportCases();
      if (id === request.current) { setResult({ userId, items }); loadedUserId.current = userId; setError(""); }
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : "Your support cases could not be loaded. Try refreshing.");
    } finally { if (id === request.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; invalidate(); };
  }, [refresh, invalidate]);
  useBookingActivity(refresh, true, 60_000, "support");
  return { items: result.userId === userId ? result.items : [], loading, error, refresh };
}
