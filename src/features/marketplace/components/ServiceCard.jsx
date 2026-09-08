import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  MapPin,
  MessageCircle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayServiceType, getProviderQuoteAmount } from '../utils/serviceNormalizer';
import { getProfilePhotoUrl } from '../../../shared/utils/profilePhoto';

const formatPrice = (provider = {}) => {
  if (provider.pricingType === 'inquiry') return 'Price on inquiry';

  const amount = getProviderQuoteAmount(provider);
  if (!amount) return 'Custom pricing';

  const suffixMap = {
    'per-hour': 'hr',
    'per-day': 'day',
    'per-week': 'wk',
    'per-month': 'mo',
    'per-project': 'project',
  };

  return `PHP ${amount}/${suffixMap[provider.rateBasis] || 'service'}`;
};

function ServiceCard({ provider, onViewProfile, onViewReviews, onChat }) {
  const displayServiceType = getDisplayServiceType(provider);
  const providerName = provider.name || 'Service Provider';
  const providerPhoto = getProfilePhotoUrl(provider.photo);
  const isRequestBooking = provider.actionType === 'inquire' || provider.bookingMode === 'calendar-only';

  return (
    <article className="marketplace-service-card">
        <div className="marketplace-service-visual">
          <BriefcaseBusiness className="marketplace-service-watermark" aria-hidden="true" />
          <div className="marketplace-service-avatar">
            <img src={providerPhoto} alt="" />
          </div>
          <div className="min-w-0">
            <p className="marketplace-service-provider">{providerName}</p>
            <div className="marketplace-service-trust">
              <BadgeCheck size={14} aria-hidden="true" />
              Verified provider
            </div>
          </div>
        </div>

        <div className="marketplace-service-content">
          <div className="marketplace-service-labels">
            <span className="marketplace-service-category">Available service</span>
            {provider.isBoosted && <span className="marketplace-service-boosted">Featured</span>}
          </div>
          <h3>{displayServiceType}</h3>
          <p className="marketplace-service-description">
            {provider.description || 'Professional service available through TrabaWho.'}
          </p>

          <div className="marketplace-service-meta">
            <button
              type="button"
              className="marketplace-service-rating"
              onClick={() => onViewReviews?.(provider)}
              aria-label={`View ${provider.reviews || 0} reviews for ${providerName}`}
            >
              <Star size={15} fill="currentColor" aria-hidden="true" />
              <strong>{provider.rating || 'New'}</strong>
              <span>{provider.reviews ? `${provider.reviews} reviews` : 'No reviews yet'}</span>
            </button>
            {provider.location && (
              <span><MapPin size={15} aria-hidden="true" /> {provider.location}</span>
            )}
            <span><CalendarCheck size={15} aria-hidden="true" /> {isRequestBooking ? 'Request booking' : 'Choose a time'}</span>
          </div>
        </div>

        <div className="marketplace-service-footer">
          <div>
            <span>Starting at</span>
            <strong>{formatPrice(provider)}</strong>
          </div>
          <div className="marketplace-service-actions">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChat?.(provider)}
              aria-label={`Message ${providerName}`}
            >
              <MessageCircle aria-hidden="true" />
            </Button>
            <Button type="button" onClick={() => onViewProfile?.(provider)}>
              View service
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
    </article>
  );
}

export default ServiceCard;
