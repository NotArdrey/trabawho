import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarCheck,
  Filter,
  MapPin,
  Search,
} from 'lucide-react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import SuccessNotification from '../../../shared/components/SuccessNotification';
import ErrorNotification from '../../../shared/components/ErrorNotification';
import { createClientBooking, startServiceConversation } from '../../bookings/services/bookingService';
import { fetchAllActiveServices } from '../../../shared/services/authService';
import { supabase } from '../../../shared/services/supabaseClient';
import BookingCalendarModal from '../../bookings/components/BookingCalendarModal';
import PaymentModal from '../../bookings/components/PaymentModal';
import BookingTermsModal from '../../bookings/components/BookingTermsModal';
import ServiceCard from '../components/ServiceCard';
import WorkerDetailModal from '../components/WorkerDetailModal';
import ReviewsModal from '../components/ReviewsModal';
import {
  buildWeeklyScheduleFromSlots,
  createScheduleForProvider,
  getDisplayServiceType,
  getProviderQuoteAmount,
  normalizeServiceRecord,
} from '../utils/serviceNormalizer';

const DEFAULT_CATEGORIES = ['All', 'Tutor', 'Technician', 'Cleaner', 'More Services'];

const getProviderSellerId = (provider) => {
  if (!provider) return null;
  return provider.rawService?.seller_id
    || provider.rawService?.sellers?.user_id
    || provider.rawService?.seller?.user_id
    || provider.sellerId
    || null;
};

const compareBoostPriority = (a, b) => {
  if (a.isBoosted !== b.isBoosted) return a.isBoosted ? -1 : 1;
  if (!a.isBoosted || !b.isBoosted) return 0;

  const budgetDelta = (b.boostBudget || 0) - (a.boostBudget || 0);
  if (budgetDelta !== 0) return budgetDelta;

  const aStartedAt = new Date(a.adBooster?.starts_at || a.adBooster?.startsAt || 0).getTime() || 0;
  const bStartedAt = new Date(b.adBooster?.starts_at || b.adBooster?.startsAt || 0).getTime() || 0;
  return bStartedAt - aStartedAt;
};

function BrowseServicesPage({
  mode = 'authenticated',
  appTheme = 'light',
  themeMode = 'system',
  onThemeChange,
  currentView = 'browse-services',
  searchQuery: externalSearchQuery = '',
  onSearchChange,
  onRequireLogin,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenChatPage,
  onOpenAdminDashboard,
}) {
  const isPublic = mode === 'public';
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [sortMode, setSortMode] = useState('recommended');
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isBookingCalendarOpen, setIsBookingCalendarOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [pendingTermsAction, setPendingTermsAction] = useState(null);
  const [reviewsTarget, setReviewsTarget] = useState(null);
  const [reviewsBySeller, setReviewsBySeller] = useState({});
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [schedulesByProvider, setSchedulesByProvider] = useState({});

  const searchQuery = isPublic ? localSearchQuery : externalSearchQuery;
  const reviewsSellerId = getProviderSellerId(reviewsTarget);
  const reviewsForTarget = reviewsSellerId ? (reviewsBySeller[reviewsSellerId] || []) : [];

  useEffect(() => {
    let mounted = true;

    const loadServices = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const rows = await fetchAllActiveServices(80);
        if (!mounted) return;
        setServices((rows || []).map((row) => normalizeServiceRecord(row, sellerProfile || {})));
      } catch (error) {
        if (!mounted) return;
        setLoadError(error?.message || 'Unable to load services right now.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadServices();
    return () => {
      mounted = false;
    };
  }, [sellerProfile]);

  useEffect(() => {
    let mounted = true;

    const loadSlots = async () => {
      const serviceIds = services.map((item) => item.rawService?.id).filter(Boolean);

      setSchedulesByProvider((prev) => {
        const next = { ...prev };
        services.forEach((provider) => {
          if (!next[provider.id]) next[provider.id] = createScheduleForProvider(provider);
        });
        return next;
      });

      if (serviceIds.length === 0) return;

      const { data, error } = await supabase
        .from('service_slots')
        .select('*')
        .in('service_id', serviceIds)
        .order('start_ts', { ascending: true });

      if (error || !mounted) return;

      const slotsByService = {};
      (data || []).forEach((slot) => {
        if (!slotsByService[slot.service_id]) slotsByService[slot.service_id] = [];
        slotsByService[slot.service_id].push(slot);
      });

      setSchedulesByProvider((prev) => {
        const next = { ...prev };
        services.forEach((provider) => {
          const slots = slotsByService[provider.rawService?.id] || [];
          next[provider.id] = buildWeeklyScheduleFromSlots(slots, provider);
        });
        return next;
      });
    };

    loadSlots();
    return () => {
      mounted = false;
    };
  }, [services]);

  useEffect(() => {
    if (!reviewsTarget || !reviewsSellerId || reviewsBySeller[reviewsSellerId]) return undefined;

    let mounted = true;

    const loadReviews = async () => {
      try {
        setIsReviewsLoading(true);
        const { data, error } = await supabase
          .from('reviews')
          .select('id, rating, title, body, created_at')
          .eq('seller_id', reviewsSellerId)
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!mounted) return;

        setReviewsBySeller((prev) => ({
          ...prev,
          [reviewsSellerId]: (data || []).map((review) => ({
            id: review.id,
            clientName: 'Client',
            rating: review.rating,
            comment: review.body || review.title || 'No comment provided.',
            date: review.created_at ? String(review.created_at).slice(0, 10) : '',
          })),
        }));
      } catch (error) {
        if (mounted) setBookingError(error?.message || 'Unable to load reviews.');
      } finally {
        if (mounted) setIsReviewsLoading(false);
      }
    };

    loadReviews();
    return () => {
      mounted = false;
    };
  }, [reviewsBySeller, reviewsSellerId, reviewsTarget]);

  const categories = useMemo(() => {
    const dynamic = services
      .map(getDisplayServiceType)
      .filter(Boolean)
      .filter((value) => !DEFAULT_CATEGORIES.includes(value));
    return [...DEFAULT_CATEGORIES, ...Array.from(new Set(dynamic)).slice(0, 5)];
  }, [services]);

  const districts = useMemo(() => {
    const items = services.map((service) => service.location).filter(Boolean);
    return ['All Districts', ...Array.from(new Set(items))];
  }, [services]);

  const filteredServices = useMemo(() => {
    const normalizedSearch = String(searchQuery || '').trim().toLowerCase();
    const core = ['Tutor', 'Technician', 'Cleaner'];

    const filtered = services.filter((provider) => {
      const serviceLabel = getDisplayServiceType(provider);
      const haystack = [
        provider.name,
        provider.title,
        serviceLabel,
        provider.description,
        provider.location,
      ].join(' ').toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const isCore = core.includes(serviceLabel);
      const matchesCategory = activeCategory === 'All'
        || (activeCategory === 'More Services' ? !isCore : serviceLabel === activeCategory);
      const matchesDistrict = selectedDistrict === 'All Districts' || provider.location === selectedDistrict;

      return matchesSearch && matchesCategory && matchesDistrict;
    });

    return filtered.sort((a, b) => {
      const boostOrder = compareBoostPriority(a, b);
      if (boostOrder !== 0) return boostOrder;
      if (sortMode === 'price-low') return getProviderQuoteAmount(a) - getProviderQuoteAmount(b);
      if (sortMode === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortMode === 'newest') return new Date(b.rawService?.created_at || 0) - new Date(a.rawService?.created_at || 0);
      return (b.reviews || 0) - (a.reviews || 0);
    });
  }, [activeCategory, searchQuery, selectedDistrict, services, sortMode]);

  const handleSearchChange = (event) => {
    if (isPublic) {
      setLocalSearchQuery(event.target.value);
      return;
    }
    onSearchChange?.(event);
  };

  const handleViewProfile = (provider) => {
    setSelectedWorker(provider);
    setIsWorkerModalOpen(true);
  };

  const executeBookNow = async (worker) => {
    if (isPublic) {
      setIsWorkerModalOpen(false);
      onRequireLogin?.();
      return;
    }

    if (worker.actionType === 'inquire') {
      try {
        setIsBookingSubmitting(true);
        setBookingError('');
        const conversation = await startServiceConversation({ provider: worker });
        setIsWorkerModalOpen(false);
        setSelectedWorker(null);
        setBookingMessage(`Chat started with ${worker.name}.`);
        onOpenChatPage?.(conversation?.id);
      } catch (error) {
        setBookingError(error?.message || 'Unable to start chat with this worker.');
      } finally {
        setIsBookingSubmitting(false);
      }
      return;
    }

    setIsWorkerModalOpen(false);
    setIsBookingCalendarOpen(true);
  };

  const handleBookNow = (worker) => {
    if (isPublic) {
      executeBookNow(worker);
      return;
    }

    setPendingTermsAction({ type: 'book', worker });
  };

  const executeStartChat = async (provider) => {
    if (isPublic) {
      onRequireLogin?.();
      return;
    }

    try {
      setIsBookingSubmitting(true);
      setBookingError('');
      const conversation = await startServiceConversation({ provider });
      setBookingMessage(`Chat started with ${provider.name}.`);
      onOpenChatPage?.(conversation?.id);
    } catch (error) {
      setBookingError(error?.message || 'Unable to start chat with this worker.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const handleStartChat = (provider) => {
    executeStartChat(provider);
  };

  const handleConfirmTermsAction = async () => {
    const action = pendingTermsAction;
    setPendingTermsAction(null);
    if (!action) return;

    if (action.type === 'chat') {
      await executeStartChat(action.provider);
      return;
    }

    await executeBookNow(action.worker);
  };

  const handleConfirmBooking = ({ workerId, date, dayKey, blockId, manualScheduling }) => {
    const worker = services.find((item) => item.id === workerId) || selectedWorker;
    if (!worker) return;

    const schedule = schedulesByProvider[workerId] || createScheduleForProvider(worker);
    const selectedBlock = manualScheduling
      ? { id: `manual-${workerId}-${date}`, startTime: 'Manual', endTime: 'Schedule', capacity: 1, slotsLeft: 1 }
      : ((schedule.dayBlocks?.[date] || schedule.dayBlocks?.[dayKey] || []).find((block) => block.id === blockId));

    setPendingBooking({
      workerId,
      serviceId: worker.rawService?.id,
      sellerId: worker.rawService?.seller_id,
      rawService: worker.rawService,
      workerName: worker.name,
      serviceType: getDisplayServiceType(worker),
      quoteAmount: getProviderQuoteAmount(worker),
      bookingMode: worker.bookingMode,
      selectedSlot: {
        date,
        dateKey: date,
        dayKey,
        blockId: selectedBlock?.id || blockId,
        slotId: selectedBlock?.rawSlot?.id || null,
        rawSlot: selectedBlock?.rawSlot || null,
        timeBlock: selectedBlock,
      },
      allowGcashAdvance: true,
      allowAfterService: false,
      afterServicePaymentType: 'gcash-only',
    });

    setIsBookingCalendarOpen(false);
    setIsPaymentModalOpen(true);
  };

  const handleSelectPayment = async (selectedPaymentMethod, mockPayment) => {
    if (!pendingBooking) return;

    const { workerId, selectedSlot } = pendingBooking;
    const { dateKey, dayKey, blockId } = selectedSlot;
    const worker = services.find((item) => item.id === workerId) || selectedWorker;

    try {
      setIsBookingSubmitting(true);
      setBookingError('');
      await createClientBooking({
        provider: worker,
        pendingBooking,
        paymentMethod: selectedPaymentMethod,
        mockPayment,
      });
    } catch (error) {
      setBookingError(error?.message || 'Unable to create booking.');
      setIsBookingSubmitting(false);
      return;
    }

    setSchedulesByProvider((prev) => {
      const providerSchedule = prev[workerId] || {};
      const applyDecrement = (blocks = []) =>
        blocks.map((block) => (
          block.id === blockId ? { ...block, slotsLeft: Math.max(0, (block.slotsLeft || 0) - 1) } : block
        ));

      return {
        ...prev,
        [workerId]: {
          ...providerSchedule,
          dayBlocks: {
            ...providerSchedule.dayBlocks,
            ...(dateKey ? { [dateKey]: applyDecrement(providerSchedule.dayBlocks?.[dateKey] || []) } : {}),
            ...(dayKey ? { [dayKey]: applyDecrement(providerSchedule.dayBlocks?.[dayKey] || []) } : {}),
          },
        },
      };
    });

    const paymentLabel =
      selectedPaymentMethod === 'gcash-advance'
        ? 'GCash advance payment'
        : selectedPaymentMethod === 'after-service-cash'
          ? 'cash after-service payment'
          : 'GCash after-service payment';

    setBookingMessage(
      selectedPaymentMethod === 'gcash-advance'
        ? `${mockPayment?.paymentPlan === 'downpayment' ? '50% downpayment' : 'Full payment'} booking created. GCash payment is pending provider verification before confirmation.`
        : `Booking scheduled with ${paymentLabel}. Payment is required before final completion.`
    );
    setIsPaymentModalOpen(false);
    setPendingBooking(null);
    setSelectedWorker(null);
    setIsBookingSubmitting(false);
  };

  return (
    <div className="gl-page" data-testid={isPublic ? 'public-browse-services' : 'app-browse-services'}>
      {!isPublic && (
        <DashboardNavigation
          appTheme={appTheme}
          themeMode={themeMode}
          onThemeChange={onThemeChange}
          currentView={currentView}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
          onOpenMyWork={onOpenMyWork}
          onOpenProfile={onOpenProfile}
          onOpenAccountSettings={onOpenAccountSettings}
          onOpenSettings={onOpenSettings}
          onOpenDashboard={onOpenDashboard}
          onOpenBrowseServices={onOpenBrowseServices}
          isAdminView={false}
          onToggleAdminView={() => { if (typeof onOpenAdminDashboard === 'function') onOpenAdminDashboard(); }}
        />
      )}

      <main className="gl-shell gl-page-pad">
        <section className="browse-hero gl-card" aria-labelledby="browse-page-title">
          <div>
            <span className="gl-eyebrow">
              <Search size={15} aria-hidden="true" />
              Service Marketplace
            </span>
            <h1 className="gl-title" id="browse-page-title">Find trusted local help</h1>
            <p className="gl-subtitle">
              Compare providers by service, location, schedule readiness, and reviews before opening a booking flow.
            </p>
          </div>

          <div className="browse-kpis gl-kpi-grid" aria-label="Marketplace summary">
            <div className="gl-kpi gl-card">
              <p className="gl-kpi-value">{services.length}</p>
              <p className="gl-kpi-label">Active services</p>
            </div>
            <div className="gl-kpi gl-card">
              <p className="gl-kpi-value">{categories.length}</p>
              <p className="gl-kpi-label">Categories</p>
            </div>
            <div className="gl-kpi gl-card">
              <p className="gl-kpi-value">{districts.length - 1}</p>
              <p className="gl-kpi-label">Locations</p>
            </div>
          </div>
        </section>

        <section className="browse-marketplace" aria-label="Service marketplace">
          <aside className="browse-filter-rail gl-card" aria-label="Browse filters">
            <div className="browse-filter-head">
              <Filter size={17} aria-hidden="true" />
              <strong>Filters</strong>
            </div>

            <div className="browse-filter-group">
              <span>Category</span>
              <div className="browse-filter-options" aria-label="Service categories">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`browse-filter-option ${activeCategory === category ? 'active' : ''}`}
                    type="button"
                    aria-label={category}
                    onClick={() => setActiveCategory(category)}
                  >
                    <span>{category}</span>
                    <small>{category === 'All' ? services.length : services.filter((item) => {
                      const serviceLabel = getDisplayServiceType(item);
                      const core = ['Tutor', 'Technician', 'Cleaner'];
                      return category === 'More Services' ? !core.includes(serviceLabel) : serviceLabel === category;
                    }).length}</small>
                  </button>
                ))}
              </div>
            </div>

            <label className="browse-filter-group">
              <span>District</span>
              <select className="gl-select" value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
                {districts.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="gl-button secondary browse-clear-button"
              onClick={() => {
                setActiveCategory('All');
                setSelectedDistrict('All Districts');
                setSortMode('recommended');
                if (isPublic) setLocalSearchQuery('');
                else onSearchChange?.({ target: { value: '' } });
              }}
            >
              Clear filters
            </button>
          </aside>

          <section className="browse-results-panel">
            <div className="browse-toolbar gl-card">
              <div className="browse-search">
                <Search size={18} aria-hidden="true" />
                <input
                  className="gl-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search services, providers, or locations"
                />
              </div>

              <label className="browse-select-label">
                <ArrowUpDown size={16} aria-hidden="true" />
                <select className="gl-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                  <option value="recommended">Recommended</option>
                  <option value="rating">Highest rated</option>
                  <option value="price-low">Lowest price</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>

            <div className="browse-results-head">
              <p>{isLoading ? 'Loading services...' : `${filteredServices.length} matching services`}</p>
              <div>
                <span><BriefcaseBusiness size={15} aria-hidden="true" /> {activeCategory}</span>
                <span><MapPin size={15} aria-hidden="true" /> {selectedDistrict}</span>
                <span><CalendarCheck size={15} aria-hidden="true" /> {sortMode}</span>
              </div>
            </div>

            {loadError && (
              <div className="gl-empty" role="alert">{loadError}</div>
            )}

            {isLoading ? (
              <section className="browse-results-list">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="browse-skeleton gl-card" key={`service-skeleton-${index}`}>
                    <span />
                    <strong />
                    <p />
                    <p />
                    <button />
                  </div>
                ))}
              </section>
            ) : filteredServices.length > 0 ? (
              <section className="browse-results-list">
                {filteredServices.map((provider) => (
                  <ServiceCard
                    key={provider.id}
                    provider={provider}
                    onViewProfile={handleViewProfile}
                    onViewReviews={setReviewsTarget}
                    onChat={handleStartChat}
                  />
                ))}
              </section>
            ) : (
              <div className="gl-empty">
                <strong>No services match these filters yet.</strong>
                <p>Try a broader search, another district, or the All category.</p>
              </div>
            )}
          </section>
        </section>
      </main>

      <WorkerDetailModal
        isOpen={isWorkerModalOpen}
        worker={selectedWorker}
        onClose={() => {
          setIsWorkerModalOpen(false);
          setSelectedWorker(null);
        }}
        onBookNow={handleBookNow}
      />

      <BookingCalendarModal
        isOpen={isBookingCalendarOpen}
        onClose={() => setIsBookingCalendarOpen(false)}
        worker={selectedWorker}
        schedule={selectedWorker ? (schedulesByProvider[selectedWorker.id] || createScheduleForProvider(selectedWorker)) : null}
        onConfirmBooking={handleConfirmBooking}
      />

      {isPaymentModalOpen && pendingBooking && (
        <PaymentModal
          booking={pendingBooking}
          onSelectPayment={handleSelectPayment}
          onCancel={() => {
            if (isBookingSubmitting) return;
            setIsPaymentModalOpen(false);
            setPendingBooking(null);
          }}
        />
      )}

      <BookingTermsModal
        isOpen={Boolean(pendingTermsAction)}
        appTheme={appTheme}
        title="Agree Before Booking"
        confirmLabel="Agree and Continue"
        onCancel={() => setPendingTermsAction(null)}
        onConfirm={handleConfirmTermsAction}
      />

      <ReviewsModal
        isOpen={Boolean(reviewsTarget)}
        provider={reviewsTarget}
        onClose={() => setReviewsTarget(null)}
        reviews={reviewsForTarget}
        isLoading={isReviewsLoading && Boolean(reviewsTarget)}
        appTheme={appTheme}
      />

      <SuccessNotification
        message={bookingMessage}
        isVisible={Boolean(bookingMessage)}
        onClose={() => setBookingMessage('')}
      />
      <ErrorNotification
        message={loadError || bookingError}
        isVisible={Boolean(loadError || bookingError)}
        onClose={() => {
          setLoadError('');
          setBookingError('');
        }}
      />
    </div>
  );
}

export default BrowseServicesPage;
