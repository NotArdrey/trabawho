import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquareText,
  Star,
  X,
} from 'lucide-react';
import { getDisplayServiceType, getProviderQuoteAmount } from '../utils/serviceNormalizer';
import { getProfilePhotoUrl, hasUploadedProfilePhoto } from '../../../shared/utils/profilePhoto';

interface WorkerDetails {
  actionType?: string;
  description?: string;
  experience?: number;
  gallery?: string[];
  location?: string;
  name?: string;
  photo?: string;
  photos?: string[];
  pricingType?: string;
  rateBasis?: string;
  rating?: number | string | null;
  reviews?: number;
  title?: string;
  uploadedPhotos?: string[];
  [key: string]: unknown;
}

interface WorkerDetailModalProps {
  isOpen: boolean;
  worker: WorkerDetails | null;
  onClose?: () => void;
  onBookNow?: (worker: WorkerDetails) => void;
}

const formatRate = (worker: WorkerDetails = {}) => {
  if (worker.pricingType === 'inquiry' || worker.actionType === 'inquire') {
    return 'Rate upon inquiry';
  }

  const amount = Number(getProviderQuoteAmount(worker));
  if (!amount) return 'Custom pricing';

  const suffixMap: Record<string, string> = {
    'per-hour': 'hour',
    'per-day': 'day',
    'per-week': 'week',
    'per-month': 'month',
    'per-project': 'project',
  };

  return `PHP ${amount}/${(worker.rateBasis && suffixMap[worker.rateBasis]) || 'service'}`;
};

const getRateBadge = (worker: WorkerDetails = {}) => {
  const labelMap: Record<string, string> = {
    'per-hour': 'Hourly Rate',
    'per-day': 'Daily Rate',
    'per-week': 'Weekly Rate',
    'per-month': 'Monthly Rate',
    'per-project': 'Project Rate',
  };

  if (worker.pricingType === 'inquiry' || worker.actionType === 'inquire') return 'Inquiry Based';
  return (worker.rateBasis && labelMap[worker.rateBasis]) || 'Service Rate';
};

function WorkerDetailModal({ isOpen, worker, onClose, onBookNow }: WorkerDetailModalProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isProfilePhotoOpen, setIsProfilePhotoOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isProfilePhotoOpen) setIsProfilePhotoOpen(false);
      else onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isProfilePhotoOpen, onClose]);

  if (!isOpen || !worker) return null;

  const gallery: string[] = (worker.gallery && worker.gallery.length > 0)
    ? worker.gallery
    : (worker.uploadedPhotos && worker.uploadedPhotos.length > 0)
      ? worker.uploadedPhotos
      : (worker.photos && worker.photos.length > 0)
        ? worker.photos
        : [];

  const serviceType = getDisplayServiceType(worker);
  const isInquiry = worker.actionType === 'inquire';
  const rating = worker.rating || 'New';
  const reviews = worker.reviews || 0;
  const providerName = worker.name || 'Service Provider';
  const providerPhoto = getProfilePhotoUrl(worker.photo);
  const selectedImage = gallery[galleryIndex] || gallery[0];

  const showPrev = () => setGalleryIndex((index) => (index - 1 + gallery.length) % gallery.length);
  const showNext = () => setGalleryIndex((index) => (index + 1) % gallery.length);

  const closeModal = () => {
    setGalleryIndex(0);
    setIsProfilePhotoOpen(false);
    onClose?.();
  };

  return (
    <div
      className="worker-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${providerName} details`}
    >
      <button type="button" className="absolute inset-0 cursor-default" onClick={closeModal} aria-label="Close service details" />
      <div className={`worker-modal gl-card z-[1] ${gallery.length === 0 ? '!w-[min(580px,calc(100vw-28px))] !grid-cols-1' : ''}`}>
        <button
          type="button"
          className="worker-modal-close gl-icon-button"
          onClick={closeModal}
          aria-label="Close service details"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Portfolio images remain optional; profile photos open from the avatar. */}
        {gallery.length > 0 && <div className="worker-modal-gallery">
          {selectedImage ? (
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
          ) : null}
        </div>}

        {/* RIGHT: Details */}
        <div className="worker-modal-details">
          <>
              {/* Provider header card */}
              <div className="worker-provider-header">
                <button
                  type="button"
                  className="worker-provider-avatar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setIsProfilePhotoOpen(true)}
                  aria-label={`View ${providerName} profile photo`}
                  disabled={!hasUploadedProfilePhoto(worker.photo)}
                >
                  <img src={providerPhoto} alt={providerName} />
                </button>
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

          {/* Sticky action bar */}
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
        </div>
      </div>
      {isProfilePhotoOpen && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${providerName} profile photo`}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsProfilePhotoOpen(false)}
            aria-label="Dismiss profile photo"
          />
          <div className="relative z-[1] max-h-full max-w-xl overflow-hidden rounded-xl bg-background p-2 shadow-xl">
            <img className="max-h-[80svh] w-auto rounded-lg object-contain" src={providerPhoto} alt={providerName} />
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-lg bg-background text-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsProfilePhotoOpen(false)}
              aria-label="Close profile photo"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerDetailModal;
