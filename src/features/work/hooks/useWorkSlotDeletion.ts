import { useRef, useState } from "react";
import { deleteWorkSlot } from "../services/workDeletion";

interface Slot { id: number; date?: string; startTime?: string; endTime?: string }
interface Target { slotId: number; label: string }
interface Options {
  sellerId?: string | null;
  scheduleMode: string;
  calendarAvailability: Slot[];
  weeklySchedule: Record<string, Slot[]>;
  loadSlots: (options: { silent: boolean }) => Promise<unknown>;
  setScheduleError: (message: string) => void;
}

export function useWorkSlotDeletion({ sellerId, scheduleMode, calendarAvailability, weeklySchedule, loadSlots, setScheduleError }: Options) {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Target | null>(null);
  const [isDeletingSlot, setIsDeletingSlot] = useState(false);
  const saving = useRef(false);
  const handleDeleteSlot = (dayKey: string | null, slotId: number) => {
    if (saving.current) return;
    const entry = scheduleMode === "calendar-only" ? calendarAvailability.find((slot) => slot.id === slotId) : (weeklySchedule[dayKey || ""] || []).find((slot) => slot.id === slotId);
    if (!entry) return;
    setDeleteConfirmTarget({ slotId, label: scheduleMode === "calendar-only" ? `available date ${entry.date || ""}` : `time slot ${dayKey || ""} ${entry.startTime || ""}-${entry.endTime || ""}` });
  };
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget || !sellerId || saving.current) return;
    saving.current = true;
    setIsDeletingSlot(true);
    setScheduleError("");
    try {
      await deleteWorkSlot(deleteConfirmTarget.slotId, sellerId);
      setDeleteConfirmTarget(null);
      await loadSlots({ silent: true });
    } catch (caught) {
      setScheduleError(caught instanceof Error ? caught.message : "Unable to delete this availability. Try again.");
    } finally { saving.current = false; setIsDeletingSlot(false); }
  };
  const cancelDeletion = (target: Target | null) => { if (!saving.current) setDeleteConfirmTarget(target); };
  return { deleteConfirmTarget, setDeleteConfirmTarget: cancelDeletion, handleDeleteSlot, handleConfirmDelete, isDeletingSlot };
}
