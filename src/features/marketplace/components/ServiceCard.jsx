import { CalendarCheck, MapPin, MessageCircle, MessageSquareText, Star } from 'lucide-react';
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
    <article className="service-result-card gl-card">
      <div className="service-result-avatar">
        <img src={providerPhoto} alt={providerName} />
      </div>

      <div className="service-result-main">
        <div className="service-result-title-row">
          <div>
            <span className="service-result-category">{displayServiceType}</span>
            {provider.isBoosted && <span className="service-result-boosted">Boosted</span>}
            <h3>{provider.title || displayServiceType}</h3>
          </div>
          <strong className="service-result-price">{formatPrice(provider)}</strong>
        </div>

        <p>{provider.description || 'Professional service available through TrabaWho.'}</p>

        <div className="service-result-meta">
          <span><Star size={14} fill="currentColor" aria-hidden="true" /> {provider.rating || 'New'} ({provider.reviews || 0})</span>
          <span><CalendarCheck size={14} aria-hidden="true" /> {isRequestBooking ? 'Request booking' : 'Time-slot booking'}</span>
          {provider.location && <span><MapPin size={14} aria-hidden="true" /> {provider.location}</span>}
          <span>{provider.experience ? `${provider.experience}+ years` : 'Verified local provider'}</span>
        </div>
      </div>

      <div className="service-result-actions">
        <button type="button" className="gl-button primary" onClick={() => onViewProfile?.(provider)}>
          View Service
        </button>
        <button
          type="button"
          className="gl-button secondary"
          onClick={() => onChat?.(provider)}
          aria-label={`Chat with ${providerName}`}
        >
          <MessageCircle size={16} aria-hidden="true" />
          Chat
        </button>
        <button
          type="button"
          className="gl-button secondary"
          onClick={() => onViewReviews?.(provider)}
          aria-label={`View reviews for ${providerName}`}
        >
          <MessageSquareText size={16} aria-hidden="true" />
          Reviews
        </button>
      </div>
    </article>
  );
}

export default ServiceCard;
