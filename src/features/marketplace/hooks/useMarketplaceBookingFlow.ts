import { useRef, useState } from "react";
import { createPayMongoCheckout, redirectToPayMongo, startServiceConversation, type PaymentSelectionDetails } from "@/features/bookings";
import { ensureLocalSandboxReady } from "@/shared/services/paymongoSandboxCheckout";
import { createScheduleForProvider, getDisplayServiceType, getProviderQuoteAmount } from "../utils/serviceNormalizer";

interface Provider extends Record<string, unknown> {
  id: number | string;
  name?: string;
  actionType?: string;
  bookingMode?: string;
  rawService?: { id?: number | string; seller_id?: string; [key: string]: unknown };
}
interface Block {
  id: number | string;
  startTime: string;
  endTime: string;
  capacity?: number;
  slotsLeft?: number;
  rawSlot?: { id?: number | string };
}
interface Schedule { dayBlocks?: Record<string, Block[]> }
interface SlotSelection {
  workerId: number | string;
  date: string;
  dayKey: string | null;
  blockId: number | string;
  manualScheduling?: boolean;
}
interface PendingBooking {
  serviceId?: number | string;
  workerId: number | string;
  sellerId?: string;
  rawService?: Provider["rawService"];
  workerName?: string;
  serviceType: string;
  quoteAmount: number;
  bookingMode?: string;
  selectedSlot: { date: string; dateKey: string; dayKey: string | null; blockId: number | string; slotId: number | string | null; rawSlot: Block["rawSlot"] | null; timeBlock?: Block };
}
interface Options {
  isPublic: boolean;
  services: Provider[];
  schedulesByProvider: Record<string, Schedule>;
  refreshSchedules: () => void;
  onRequireLogin?: () => void;
  onOpenChatPage?: (id?: string) => void;
}

const startConversation = startServiceConversation as unknown as (options: { provider: Provider }) => Promise<{ id: string }>;

export function useMarketplaceBookingFlow({ isPublic, services, schedulesByProvider, refreshSchedules, onRequireLogin, onOpenChatPage }: Options) {
  const [selectedWorker, setSelectedWorker] = useState<Provider | null>(null);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isBookingCalendarOpen, setIsBookingCalendarOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleViewProfile = (provider: Provider) => {
    setSelectedWorker(provider);
    setIsWorkerModalOpen(true);
  };

  const handleStartChat = async (provider: Provider) => {
    if (isPublic) { onRequireLogin?.(); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsBookingSubmitting(true);
    setBookingError("");
    try {
      const conversation = await startConversation({ provider });
      setIsWorkerModalOpen(false);
      setSelectedWorker(null);
      setBookingMessage(`Chat started with ${provider.name || "this provider"}.`);
      onOpenChatPage?.(conversation.id);
    } catch {
      setBookingError("Unable to start chat with this provider. Please try again.");
    } finally {
      submittingRef.current = false;
      setIsBookingSubmitting(false);
    }
  };

  const handleBookNow = (worker: Provider) => {
    if (isPublic) { setIsWorkerModalOpen(false); onRequireLogin?.(); return; }
    if (worker.actionType === "inquire" || worker.bookingMode === "calendar-only") {
      void handleStartChat(worker);
      return;
    }
    setSelectedWorker(worker);
    setIsWorkerModalOpen(false);
    setIsBookingCalendarOpen(true);
  };

  const handleConfirmBooking = ({ workerId, date, dayKey, blockId, manualScheduling }: SlotSelection) => {
    const worker = services.find((item) => String(item.id) === String(workerId)) || selectedWorker;
    if (!worker) return;
    const schedule = schedulesByProvider[String(workerId)] || createScheduleForProvider(worker) as unknown as Schedule;
    const selectedBlock: Block | undefined = manualScheduling
      ? { id: `manual-${workerId}-${date}`, startTime: "Manual", endTime: "Schedule", capacity: 1, slotsLeft: 1 }
      : (schedule.dayBlocks?.[date] || schedule.dayBlocks?.[dayKey || ""] || []).find((block) => String(block.id) === String(blockId));
    setPendingBooking({
      workerId, serviceId: worker.rawService?.id, sellerId: worker.rawService?.seller_id,
      rawService: worker.rawService, workerName: worker.name, serviceType: getDisplayServiceType(worker),
      quoteAmount: Number(getProviderQuoteAmount(worker)), bookingMode: worker.bookingMode,
      selectedSlot: { date, dateKey: date, dayKey, blockId: selectedBlock?.id || blockId,
        slotId: selectedBlock?.rawSlot?.id || null, rawSlot: selectedBlock?.rawSlot || null, timeBlock: selectedBlock },
    });
    setIsBookingCalendarOpen(false);
    setIsPaymentModalOpen(true);
  };

  const handleSelectPayment = async (method: string, details: PaymentSelectionDetails) => {
    if (!pendingBooking || submittingRef.current) return;
    if (method !== "paymongo-card") throw new Error("Choose PayMongo card checkout to continue.");
    submittingRef.current = true;
    setIsBookingSubmitting(true);
    setBookingError("");
    try {
      if (details.testCheckout) await ensureLocalSandboxReady();
      await redirectToPayMongo(await createPayMongoCheckout({ ...pendingBooking, paymentPlan: details.paymentPlan, serviceAddress: details.serviceAddress }),
        { oneClickTest: details.testCheckout });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reserve this booking.";
      if (/time (?:is|was).*(?:unavailable|booked)|slot.*(?:unavailable|full)/i.test(message)) {
        setIsPaymentModalOpen(false);
        setPendingBooking(null);
        refreshSchedules();
        setIsBookingCalendarOpen(true);
        setBookingError("That time is no longer available. Choose another time from the refreshed availability.");
        return;
      }
      setBookingError(message);
      throw error;
    } finally {
      submittingRef.current = false;
      setIsBookingSubmitting(false);
    }
  };

  return { selectedWorker, setSelectedWorker, isWorkerModalOpen, setIsWorkerModalOpen,
    isBookingCalendarOpen, setIsBookingCalendarOpen, isPaymentModalOpen, setIsPaymentModalOpen,
    pendingBooking, setPendingBooking, bookingMessage, setBookingMessage, bookingError, setBookingError, isBookingSubmitting,
    handleViewProfile, handleBookNow, handleStartChat, handleConfirmBooking, handleSelectPayment };
}
