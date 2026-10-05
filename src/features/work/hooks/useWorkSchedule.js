import { useWorkSlotDeletion } from './useWorkSlotDeletion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../shared/services/supabaseClient';
import {
  DAY_INDEX,
  DAY_ORDER,
  INITIAL_CALENDAR_AVAILABILITY,
  addDays,
  buildSlotTimestamps,
  createServiceSlot,
  createEmptyWeeklySchedule,
  fetchSellerSlots,
  formatDateOnly,
  formatDateForDay,
  formatDateLabel,
  formatDateLong,
  getSlotDateKey,
  getMonday,
  getSlotStatusColor,
  mapSlotsToSchedule,
  updateServiceSlot,
} from '../services/scheduleService';

export const useWorkSchedule = ({ sellerId, currentProfile } = {}) => {
  const [weeklySchedule, setWeeklySchedule] = useState(() => createEmptyWeeklySchedule());
  const [calendarAvailability, setCalendarAvailability] = useState(() => INITIAL_CALENDAR_AVAILABILITY);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editSlotModalOpen, setEditSlotModalOpen] = useState(false);
  const [editSlotData, setEditSlotData] = useState(null);
  const [editSlotDayKey, setEditSlotDayKey] = useState(null);
  const [editSlotId, setEditSlotId] = useState(null);
  const [slotModalType, setSlotModalType] = useState('edit');
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleLastSyncedAt, setScheduleLastSyncedAt] = useState(null);
  const isMountedRef = useRef(true);

  const scheduleMode =
    (currentProfile?.bookingMode || 'with-slots').toLowerCase() === 'calendar-only'
      ? 'calendar-only'
      : 'with-slots';
  const serviceId = currentProfile?.raw?.id || null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const dayKeys = DAY_ORDER;
  const currentWeekMonday = useMemo(() => addDays(getMonday(new Date()), weekOffset * 7), [weekOffset]);
  const currentWeekSunday = useMemo(() => addDays(currentWeekMonday, 6), [currentWeekMonday]);
  const currentWeekEndExclusive = useMemo(() => addDays(currentWeekMonday, 7), [currentWeekMonday]);
  const weekRangeLabel = `${formatDateLabel(currentWeekMonday)} - ${formatDateLabel(currentWeekSunday)}`;
  const weekDateByDay = useMemo(
    () => dayKeys.reduce((acc, day) => {
      acc[day] = addDays(currentWeekMonday, DAY_INDEX[day]);
      return acc;
    }, {}),
    [currentWeekMonday, dayKeys]
  );

  const getDateForDay = useCallback((dayKey) => formatDateForDay(currentWeekMonday, dayKey), [currentWeekMonday]);

  const defaultAddDayKey = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateKey = formatDateOnly(today);
    const dayKey = today.getDay() === 0 ? 'Sun' : DAY_ORDER[today.getDay() - 1];
    const isVisibleWeekday = Boolean(dayKey) && getDateForDay(dayKey) === todayDateKey;
    return isVisibleWeekday ? dayKey : 'Mon';
  }, [getDateForDay]);

  const loadSlots = useCallback(async ({ silent = false } = {}) => {
    if (!sellerId) {
      setWeeklySchedule(createEmptyWeeklySchedule());
      setCalendarAvailability([]);
      setScheduleLastSyncedAt(null);
      return [];
    }

    const weekStartTs = buildSlotTimestamps({
      date: formatDateOnly(currentWeekMonday),
      startTime: '00:00',
    }).startTs;
    const weekEndTs = buildSlotTimestamps({
      date: formatDateOnly(currentWeekEndExclusive),
      startTime: '00:00',
    }).startTs;

    try {
      if (!silent) setIsScheduleLoading(true);
      setScheduleError('');

      const slots = await fetchSellerSlots({
        sellerId,
        serviceId,
        startTs: weekStartTs,
        endTs: weekEndTs,
      });
      if (!isMountedRef.current) return slots;

      const mapped = mapSlotsToSchedule(slots, { weekMonday: currentWeekMonday });
      setCalendarAvailability(mapped.calendarAvailability);
      setWeeklySchedule(mapped.weeklySchedule);
      setScheduleLastSyncedAt(new Date());
      return slots;
    } catch (error) {
      console.warn('Failed to load seller slots', error);
      if (isMountedRef.current) {
        setScheduleError(error?.message || 'Unable to load real schedule slots.');
        setWeeklySchedule(createEmptyWeeklySchedule());
        setCalendarAvailability([]);
      }
      return [];
    } finally {
      if (isMountedRef.current && !silent) setIsScheduleLoading(false);
    }
  }, [currentWeekEndExclusive, currentWeekMonday, sellerId, serviceId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!sellerId) return undefined;

    const channel = supabase
      .channel(`work-schedule-slots-${sellerId}-${serviceId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_slots',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          loadSlots({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSlots, sellerId, serviceId]);

  const closeSlotModal = useCallback(() => {
    setEditSlotModalOpen(false);
    setEditSlotData(null);
    setEditSlotDayKey(null);
    setEditSlotId(null);
    setSlotModalType('edit');
  }, []);

  const handleEditSlot = useCallback((dayKey, slotId) => {
    setSlotModalType('edit');

    if (scheduleMode === 'calendar-only') {
      const entry = calendarAvailability.find((item) => item.id === slotId);
      if (!entry) return;
      setEditSlotData(entry);
      setEditSlotDayKey(null);
      setEditSlotId(slotId);
      setEditSlotModalOpen(true);
      return;
    }

    const block = (weeklySchedule[dayKey] || []).find((item) => item.id === slotId);
    if (!block) return;
    setEditSlotData(block);
    setEditSlotDayKey(dayKey);
    setEditSlotId(slotId);
    setEditSlotModalOpen(true);
  }, [calendarAvailability, scheduleMode, weeklySchedule]);

  const handleSaveCalendarSlot = useCallback(async (updatedData) => {
    const currentService = currentProfile?.raw || null;

    if (slotModalType === 'add') {
      if (!currentService || !sellerId) {
        setScheduleError('Create a service first before adding availability.');
        return false;
      }

      try {
        await createServiceSlot({
          serviceId: currentService.id,
          sellerId,
          date: updatedData.date,
          startTime: '00:00',
          endTime: '23:59:59',
          capacity: updatedData.maxBookings || 1,
          note: updatedData.note || '',
        });
        await loadSlots({ silent: true });
        return true;
      } catch (error) {
        console.error('Failed to create calendar service slot', error);
        setScheduleError(error?.message || 'Unable to add availability date.');
        return false;
      }
    }

    if (editSlotId != null) {
      try {
        const existingEntry = calendarAvailability.find((item) => item.id === editSlotId);
        const existingMetadata = { ...(existingEntry?.raw?.metadata || {}) };
        delete existingMetadata.note;
        const nextMetadata = updatedData.note
          ? { ...existingMetadata, note: updatedData.note }
          : existingMetadata;
        const { startTs, endTs } = buildSlotTimestamps({
          date: updatedData.date,
          startTime: '00:00',
          endTime: '23:59:59',
        });
        await updateServiceSlot({
          slotId: editSlotId,
          updates: {
            start_ts: startTs,
            end_ts: endTs,
            capacity: updatedData.maxBookings,
            note: updatedData.note || null,
            metadata: nextMetadata,
          },
        });
        await loadSlots({ silent: true });
        return true;
      } catch (error) {
        console.error('Failed to update calendar service slot', error);
        setScheduleError(error?.message || 'Unable to update availability date.');
        return false;
      }
    }

    return false;
  }, [calendarAvailability, currentProfile?.raw, editSlotId, loadSlots, sellerId, slotModalType]);

  const handleSaveWeeklySlot = useCallback(async (updatedData) => {
    const currentService = currentProfile?.raw || null;

    if (slotModalType === 'add') {
      if (!currentService || !sellerId || !editSlotDayKey) {
        setScheduleError('Create a service first before adding a schedule slot.');
        return false;
      }

      try {
        await createServiceSlot({
          serviceId: currentService.id,
          sellerId,
          date: getDateForDay(editSlotDayKey),
          startTime: updatedData.startTime,
          endTime: updatedData.endTime,
          capacity: updatedData.capacity,
        });
        await loadSlots({ silent: true });
        return true;
      } catch (error) {
        console.error('Failed to add weekly service slot', error);
        setScheduleError(error?.message || 'Unable to add schedule slot.');
        return false;
      }
    }

    if (editSlotId != null) {
      try {
        const sourceBlock = (weeklySchedule[editSlotDayKey] || []).find((item) => item.id === editSlotId);
        const sourceDate = sourceBlock?.raw?.start_ts ? getSlotDateKey(sourceBlock.raw.start_ts) : null;
        const slotDate = sourceDate || getDateForDay(editSlotDayKey);
        const { startTs, endTs } = buildSlotTimestamps({
          date: slotDate,
          startTime: updatedData.startTime,
          endTime: updatedData.endTime,
        });
        await updateServiceSlot({
          slotId: editSlotId,
          updates: {
            start_ts: startTs,
            end_ts: endTs,
            capacity: updatedData.capacity,
          },
        });

        await loadSlots({ silent: true });
        return true;
      } catch (error) {
        console.error('Failed to update weekly service slot', error);
        setScheduleError(error?.message || 'Unable to update schedule slot.');
        return false;
      }
    }

    return false;
  }, [currentProfile?.raw, editSlotDayKey, editSlotId, getDateForDay, loadSlots, sellerId, slotModalType, weeklySchedule]);

  const handleSaveSlotEdit = useCallback(async (updatedData) => {
    const saved = scheduleMode === 'calendar-only'
      ? await handleSaveCalendarSlot(updatedData)
      : await handleSaveWeeklySlot(updatedData);

    if (saved !== false) closeSlotModal();
    return saved;
  }, [closeSlotModal, handleSaveCalendarSlot, handleSaveWeeklySlot, scheduleMode]);

  const { deleteConfirmTarget, setDeleteConfirmTarget, handleDeleteSlot, handleConfirmDelete, isDeletingSlot } = useWorkSlotDeletion({
    sellerId, scheduleMode, calendarAvailability, weeklySchedule, loadSlots, setScheduleError,
  });

  const handleAddSlot = useCallback((dayKey) => {
    if (scheduleMode === 'calendar-only') {
      setSlotModalType('add');
      setEditSlotDayKey(null);
      setEditSlotId(null);
      setEditSlotData({
        date: formatDateOnly(currentWeekMonday),
        maxBookings: 3,
        note: '',
      });
      setEditSlotModalOpen(true);
      return;
    }

    const nextDayKey = DAY_ORDER.includes(dayKey) ? dayKey : defaultAddDayKey;
    setSlotModalType('add');
    setEditSlotDayKey(nextDayKey);
    setEditSlotId(null);
    setEditSlotData({
      startTime: '09:00',
      endTime: '11:00',
      capacity: 3,
    });
    setEditSlotModalOpen(true);
  }, [currentWeekMonday, defaultAddDayKey, scheduleMode]);

  const weeklyScheduledMinutes = useMemo(() => {
    const toMinutes = (timeValue) => {
      const [hours, minutes] = String(timeValue || '0:0').split(':').map(Number);
      return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
    };

    return DAY_ORDER.reduce((total, dayKey) => {
      return total + (weeklySchedule[dayKey] || []).reduce((dayTotal, block) => {
        const duration = Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime));
        return dayTotal + duration;
      }, 0);
    }, 0);
  }, [weeklySchedule]);

  const scheduleSlotCount = useMemo(
    () => DAY_ORDER.reduce((total, dayKey) => total + (weeklySchedule[dayKey] || []).length, 0),
    [weeklySchedule]
  );

  return {
    calendarAvailability,
    closeSlotModal,
    currentWeekMonday,
    currentWeekSunday,
    dayKeys,
    deleteConfirmTarget,
    isDeletingSlot,
    defaultAddDayKey,
    editSlotData,
    editSlotDayKey,
    editSlotId,
    editSlotModalOpen,
    formatDateForDay: getDateForDay,
    formatDateLong,
    getSlotStatusColor,
    handleAddSlot,
    handleConfirmDelete,
    handleDeleteSlot,
    handleEditSlot,
    handleSaveSlotEdit,
    isScheduleLoading,
    scheduleMode,
    scheduleError,
    scheduleLastSyncedAt,
    scheduleSlotCount,
    setDeleteConfirmTarget,
    setWeekOffset,
    slotModalType,
    weekDateByDay,
    weekOffset,
    weekRangeLabel,
    weeklyScheduledMinutes,
    weeklySchedule,
  };
};

export default useWorkSchedule;
