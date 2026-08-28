import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquareText,
  Sparkles,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { getDisplayServiceType, getProviderQuoteAmount } from '../utils/serviceNormalizer';
import { getProfilePhotoUrl, hasUploadedProfilePhoto } from '../../../shared/utils/profilePhoto';

const formatRate = (worker = {}) => {
  if (worker.pricingType === 'inquiry' || worker.actionType === 'inquire') {
    return 'Rate upon inquiry';
  }

  const amount = getProviderQuoteAmount(worker);
  if (!amount) return 'Custom pricing';

  const suffixMap = {
    'per-hour': 'hour',
    'per-day': 'day',
    'per-week': 'week',
    'per-month': 'month',
    'per-project': 'project',
  };

  return `PHP ${amount}/${suffixMap[worker.rateBasis] || 'service'}`;
};

const getRateBadge = (worker = {}) => {
  const labelMap = {
    'per-hour': 'Hourly Rate',
    'per-day': 'Daily Rate',
    'per-week': 'Weekly Rate',
    'per-month': 'Monthly Rate',
    'per-project': 'Project Rate',
  };

  if (worker.pricingType === 'inquiry' || worker.actionType === 'inquire') return 'Inquiry Based';
  return labelMap[worker.rateBasis] || 'Service Rate';
};

function WorkerDetailModal({ isOpen, worker, onClose, onBookNow }) {
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!isOpen || !worker) return undefined;

    setIsLoadingDetails(true);
    setGalleryIndex(0);
    const timer = setTimeout(() => {
      setIsLoadingDetails(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [isOpen, worker]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !worker) return null;

  const gallery = (worker.gallery && worker.gallery.length > 0)
    ? worker.gallery
    : (worker.uploadedPhotos && worker.uploadedPhotos.length > 0)
      ? worker.uploadedPhotos
      : (worker.photos && worker.photos.length > 0)
        ? worker.photos
        : (hasUploadedProfilePhoto(worker.photo) ? [worker.photo] : []);

  const serviceType = getDisplayServiceType(worker);
  const isInquiry = worker.actionType === 'inquire';
  const rating = worker.rating || 'New';
  const reviews = worker.reviews || 0;
  const providerName = worker.name || 'Service Provider';
  const providerPhoto = getProfilePhotoUrl(worker.photo);
  const selectedImage = gallery[galleryIndex];

  const showPrev = () => setGalleryIndex((index) => (index - 1 + gallery.length) % gallery.length);
  const showNext = () => setGalleryIndex((index) => (index + 1) % gallery.length);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  return (
    <div
      className="worker-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${providerName} details`}
      onClick={handleBackdropClick}
    >
      <div className="worker-modal gl-card">
        <button
          type="button"
          className="worker-modal-close gl-icon-button"
          onClick={onClose}
          aria-label="Close service details"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* LEFT: Gallery */}
        <div className="worker-modal-gallery">
          {isLoadingDetails ? (
            <div className="worker-modal-skeleton">
              <UserRound size={46} aria-hidden="true" />
            </div>
          ) : selectedImage ? (
            <>
              <img src={selectedImage} alt={`${providerName} work sample`} loading="lazy" />
              {gallery.length > 1 && (
                <>
                  <button type="button" className="worker-gallery-nav prev" onClick={showPrev} aria-label="Previous image">
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                  <button type="button" className="worker-gallery-nav next" onClick={showNext} aria-label="Next image">
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                  <div className="worker-gallery-counter" aria-hidden="true">
                    {galleryIndex + 1} / {gallery.length}
                  </div>
                  <div className="worker-gallery-thumbs" aria-label="Gallery thumbnails">
                    {gallery.map((image, index) => (
                      <button
                        // eslint-disable-next-line react/no-array-index-key
                        key={`${image}-${index}`}
                        type="button"
                        className={index === galleryIndex ? 'active' : ''}
                        onClick={() => setGalleryIndex(index)}
                        aria-label={`Show image ${index + 1}`}
                      >
                        <img src={image} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="worker-modal-empty-gallery">
              <Sparkles size={36} aria-hidden="true" />
              <p>No portfolio photos shared yet.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Details */}
        <div className="worker-modal-details">
          {isLoadingDetails ? (
            <div className="worker-detail-loading">
              <span />
              <strong />
              <p />
              <p />
              <button />
            </div>
          ) : (
            <>
              {/* Provider header card */}
              <div className="worker-provider-header">
                <div className="worker-provider-avatar">
                  <img src={providerPhoto} alt={providerName} />
                </div>
                <div className="worker-provider-info">
                  <div className="worker-provider-name-row">
                    <strong>{providerName}</strong>
                    <span className="worker-verified-badge" title="Verified provider">
                      <BadgeCheck size={14} aria-hidden="true" />
                      Verified
                    </span>
                  </div>
                  <div className="worker-provider-rating">
                    <Star size={14} fill="currentColor" aria-hidden="true" />
                    <strong>{rating}</strong>
                    <span>({reviews} {reviews === 1 ? 'review' : 'reviews'})</span>
                  </div>
                </div>
              </div>

              {/* Title + service eyebrow */}
              <div className="worker-modal-title-block">
                <span className="gl-eyebrow">{serviceType}</span>
                <h2>{worker.title || serviceType}</h2>
              </div>

              {/* Trust / quick-facts pills */}
              <div className="worker-modal-meta">
                <span><CalendarCheck size={14} aria-hidden="true" /> {isInquiry ? 'Request booking' : 'Time-slot booking'}</span>
                <span><Clock size={14} aria-hidden="true" /> Responds in &lt; 15 min</span>
                {worker.location && <span><MapPin size={14} aria-hidden="true" /> {worker.location}</span>}
                {worker.experience ? <span>{worker.experience}+ years experience</span> : null}
              </div>

              {/* Description */}
              <p className="worker-modal-description">
                {worker.description || 'Professional service available through TrabaWho. Message this provider for full project details.'}
              </p>

              {/* Rate card */}
              <div className="worker-modal-rate gl-card">
                <div>
                  <span className="worker-modal-rate-label">{getRateBadge(worker)}</span>
                  <strong className="worker-modal-rate-value">{formatRate(worker)}</strong>
                </div>
                <p className="worker-modal-rate-note">
                  {isInquiry
                    ? 'Final pricing and schedule are coordinated through chat.'
                    : 'Price shown is the standard rate. Booking unlocks the schedule.'}
                </p>
              </div>
            </>
          )}

          {/* Sticky action bar */}
          {!isLoadingDetails && (
            <div className="worker-modal-action-bar">
              <button
                type="button"
                className="gl-button secondary worker-modal-secondary"
                onClick={() => onBookNow?.({ ...worker, actionType: 'inquire' })}
                aria-label={`Message ${providerName}`}
              >
                <MessageSquareText size={16} aria-hidden="true" />
                Message
              </button>
              <button
                type="button"
                className="gl-button primary worker-modal-primary"
                onClick={() => onBookNow?.(worker)}
              >
                {isInquiry ? 'Inquire Now' : 'Book Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkerDetailModal;
