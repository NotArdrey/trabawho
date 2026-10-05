import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchPublicServiceSlots, type AvailableServiceSlot } from "@/features/bookings/services/bookingAvailability";

interface SlotBlock {
  id: number | string;
  startTime: string;
  endTime: string;
  slotsLeft: number;
  rawSlot?: { id?: number | string; start_ts?: string; end_ts?: string };
}

interface Schedule {
  dayBlocks?: Record<string, SlotBlock[]>;
  manualScheduling?: boolean;
  operatingDays?: string[];
}

const unavailableMessage = "That time was just reserved. Choose another available time.";
const loadErrorMessage = "We could not check live availability. Try again before choosing a time.";

function matchesSlot(block: SlotBlock, slot: AvailableServiceSlot) {
  return String(block.rawSlot?.id) === String(slot.id)
    && block.rawSlot?.start_ts === slot.start_ts
    && block.rawSlot?.end_ts === slot.end_ts;
}

export function useLiveBookingSchedule(schedule: Schedule, rawServiceId: unknown) {
  const serviceId = Number(rawServiceId);
  const live = !schedule.manualScheduling && Number.isFinite(serviceId) && serviceId > 0;
  const [availableSlots, setAvailableSlots] = useState<AvailableServiceSlot[] | null>(null);
  const [checking, setChecking] = useState(live);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!live) return;
    const currentRequest = ++requestId.current;
    setChecking(true);
    setError("");
    try {
      const slots = await fetchPublicServiceSlots(serviceId);
      if (currentRequest !== requestId.current) return;
      setAvailableSlots(slots);
    } catch {
      if (currentRequest !== requestId.current) return;
      setAvailableSlots(null);
      setError(loadErrorMessage);
    } finally {
      if (currentRequest === requestId.current) setChecking(false);
    }
  }, [live, serviceId]);

  useEffect(() => {
    let active = true;
    const reload = () => { if (active) void refresh(); };
    queueMicrotask(reload);
    window.addEventListener("focus", reload);
    return () => { active = false; requestId.current += 1; window.removeEventListener("focus", reload); };
  }, [refresh]);

  const visibleSchedule = useMemo<Schedule>(() => {
    if (!live) return schedule;
    const dayBlocks = Object.fromEntries(Object.entries(schedule.dayBlocks ?? {}).map(([day, blocks]) => [
      day, blocks.map((block) => ({ ...block, slotsLeft: availableSlots?.some((slot) => matchesSlot(block, slot)) ? 1 : 0 })),
    ]));
    return { ...schedule, dayBlocks };
  }, [availableSlots, live, schedule]);

  const verify = useCallback(async (block: SlotBlock | undefined) => {
    if (!live) return true;
    if (!block?.rawSlot?.id) { setError(unavailableMessage); return false; }
    const currentRequest = ++requestId.current;
    setChecking(true);
    setError("");
    try {
      const slots = await fetchPublicServiceSlots(serviceId);
      if (currentRequest !== requestId.current) return false;
      setAvailableSlots(slots);
      if (slots.some((slot) => matchesSlot(block, slot))) return true;
      setError(unavailableMessage);
    } catch {
      if (currentRequest === requestId.current) { setAvailableSlots(null); setError(loadErrorMessage); }
    } finally {
      if (currentRequest === requestId.current) setChecking(false);
    }
    return false;
  }, [live, serviceId]);

  return { checking, error, refresh, setError, verify, visibleSchedule };
}
