import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import SuccessNotification from '../../../shared/components/SuccessNotification';
import ErrorNotification from '../../../shared/components/ErrorNotification';
import { fetchMarketplaceServices } from "../services/marketplaceServices";
import { useMarketplaceFilters } from "../hooks/useMarketplaceFilters";
import { supabase } from '../../../shared/services/supabaseClient';
import BookingCalendarModal from '../../bookings/components/BookingCalendarModal';
import PaymentModal from '../../bookings/components/PaymentModal';
import ServiceCard from '../components/ServiceCard';
import WorkerDetailModal from '../components/WorkerDetailModal';
import ReviewsModal from '../components/ReviewsModal';
import { MarketplaceFilterPanel } from '../components/MarketplaceFilterPanel';
import { MarketplaceSearchToolbar } from '../components/MarketplaceSearchToolbar';
import { useMarketplaceSchedules } from '../hooks/useMarketplaceSchedules';
import { useMarketplaceBookingFlow } from '../hooks/useMarketplaceBookingFlow';
import {
  createScheduleForProvider,
  normalizeServiceRecord,
} from '../utils/serviceNormalizer';
import { useMarketplaceSearch } from '../hooks/useMarketplaceSearch';

const SERVICES_PER_PAGE = 6;

const getPaginationPages = (currentPage, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-end', totalPages];
  if (currentPage >= totalPages - 2) return [1, 'ellipsis-start', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', totalPages];
};

const getProviderSellerId = (provider) => {
  if (!provider) return null;
  return provider.rawService?.seller_id
    || provider.rawService?.sellers?.user_id
    || provider.rawService?.seller?.user_id
    || provider.sellerId
    || null;
};

function BrowseServicesPage({
  mode = 'authenticated',
  appTheme = 'light',
  themeMode = 'system',
  onThemeChange,
  currentView = 'browse-services',
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
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const { searchQuery, locationQuery, handleSearchChange, handleLocationChange, activeCategory, setActiveCategory,
    selectedDistrict, setSelectedDistrict, sortMode, setSortMode, hasActiveFilters, clearFilters: handleClearFilters } = useMarketplaceSearch(onSearchChange);
  const [currentPage, setCurrentPage] = useState(() => {
    const requestedPage = Number(urlSearchParams.get('page'));
    return Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [services, setServices] = useState([]);
  const [boostClock, setBoostClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setBoostClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviewsTarget, setReviewsTarget] = useState(null);
  const [reviewsBySeller, setReviewsBySeller] = useState({});
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const { refreshSchedules, schedulesByProvider } = useMarketplaceSchedules(services);
  const {
    selectedWorker, setSelectedWorker, isWorkerModalOpen, setIsWorkerModalOpen,
    isBookingCalendarOpen, setIsBookingCalendarOpen, isPaymentModalOpen, setIsPaymentModalOpen,
    pendingBooking, setPendingBooking, bookingMessage, setBookingMessage, bookingError, setBookingError, isBookingSubmitting,
    handleViewProfile, handleBookNow, handleStartChat, handleConfirmBooking, handleSelectPayment,
  } = useMarketplaceBookingFlow({ isPublic, services, schedulesByProvider, refreshSchedules, onRequireLogin, onOpenChatPage });

  const reviewsSellerId = getProviderSellerId(reviewsTarget);
  const reviewsForTarget = reviewsSellerId ? (reviewsBySeller[reviewsSellerId] || []) : [];

  useEffect(() => {
    const requestedPage = Number(urlSearchParams.get('page'));
    setCurrentPage(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  }, [urlSearchParams]);

  useEffect(() => {
    let mounted = true;

    const loadServices = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const rows = await fetchMarketplaceServices();
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

  const { categoryFilters, districts, filteredServices } = useMarketplaceFilters(services, {
    search: searchQuery, location: locationQuery, category: activeCategory, district: selectedDistrict, sort: sortMode,
  }, boostClock);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedServices = filteredServices.slice(
    (activePage - 1) * SERVICES_PER_PAGE,
    activePage * SERVICES_PER_PAGE
  );
  const paginationPages = getPaginationPages(activePage, totalPages);

  const getPageHref = (page) => {
    const next = new URLSearchParams(urlSearchParams);
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    const query = next.toString();
    return query ? `?${query}` : '?';
  };

  const updatePage = (page, replace = false) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(nextPage);
    setUrlSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage === 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    }, { replace });
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
        <section className="browse-hero gl-card !grid-cols-1" aria-labelledby="browse-page-title">
          <div>
            <h1 className="gl-title !mt-0" id="browse-page-title">Find trusted local help</h1>
            <p className="gl-subtitle">
              Compare providers by service, location, schedule readiness, and reviews before opening a booking flow.
            </p>
          </div>

        </section>

        <section className="browse-marketplace" aria-label="Service marketplace">
          <MarketplaceFilterPanel
            activeCategory={activeCategory}
            categories={categoryFilters}
            districts={districts}
            hasActiveFilters={hasActiveFilters}
            isOpen={showMobileFilters}
            isPublic={isPublic}
            locationQuery={locationQuery}
            onCategoryChange={setActiveCategory}
            onClear={handleClearFilters}
            onClose={() => setShowMobileFilters(false)}
            onDistrictChange={setSelectedDistrict}
            onLocationChange={(value) => handleLocationChange({ target: { value } })}
            selectedDistrict={selectedDistrict}
          />

          <section className="browse-results-panel">
            <MarketplaceSearchToolbar
              searchQuery={searchQuery}
              sortMode={sortMode}
              filtersOpen={showMobileFilters}
              onSearchChange={(value) => handleSearchChange({ target: { value } })}
              onSortChange={setSortMode}
              onToggleFilters={() => setShowMobileFilters((open) => !open)}
            />

            <div className="browse-results-head">
              <p>{isLoading
                ? 'Loading services...'
                : `Showing ${filteredServices.length ? ((activePage - 1) * SERVICES_PER_PAGE) + 1 : 0}-${Math.min(activePage * SERVICES_PER_PAGE, filteredServices.length)} of ${filteredServices.length} services`}</p>
              {hasActiveFilters && <button type="button" onClick={handleClearFilters}>Clear active filters</button>}
            </div>

            {loadError && (
              <div className="gl-empty" role="alert">{loadError}</div>
            )}

            {isLoading ? (
              <section className="marketplace-service-grid">
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
              <section className="marketplace-service-grid">
                {paginatedServices.map((provider) => (
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
                <p>Try a broader search, another location, or the All category.</p>
              </div>
            )}

            {!isLoading && filteredServices.length > 0 && totalPages > 1 && (
              <Pagination className="browse-pagination">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={activePage > 1 ? getPageHref(activePage - 1) : undefined}
                      aria-disabled={activePage === 1}
                      className={activePage === 1 ? 'pointer-events-none opacity-50' : ''}
                      onClick={(event) => {
                        event.preventDefault();
                        if (activePage > 1) updatePage(activePage - 1);
                      }}
                    />
                  </PaginationItem>
                  {paginationPages.map((page) => (
                    typeof page === 'number' ? (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href={getPageHref(page)}
                          isActive={page === activePage}
                          aria-label={`Go to page ${page}`}
                          onClick={(event) => {
                            event.preventDefault();
                            updatePage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href={activePage < totalPages ? getPageHref(activePage + 1) : undefined}
                      aria-disabled={activePage === totalPages}
                      className={activePage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      onClick={(event) => {
                        event.preventDefault();
                        if (activePage < totalPages) updatePage(activePage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
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
          requireBookingTerms
          onSelectPayment={handleSelectPayment}
          onCancel={() => {
            if (isBookingSubmitting) return;
            setIsPaymentModalOpen(false);
            setPendingBooking(null);
          }}
        />
      )}

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
