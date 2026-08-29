import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Star, X } from 'lucide-react';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const RatingModal = ({ booking, onClose, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setError('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('The review image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (rating < 1 || isSubmitting) return;
    try {
      setError('');
      setIsSubmitting(true);
      await onSubmit?.({ rating, comment: comment.trim(), imageFile });
      onClose?.();
    } catch (submitError) {
      setError(submitError?.message || 'Unable to submit your review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rating-modal-backdrop" role="presentation">
      <form className="rating-modal gl-card" role="dialog" aria-modal="true" aria-labelledby="rating-modal-title" onSubmit={handleSubmit}>
        <header className="rating-modal-header">
          <div>
            <span className="gl-eyebrow">Completed service</span>
            <h2 id="rating-modal-title">Rate {booking?.workerName}</h2>
            <p>{booking?.serviceType}</p>
          </div>
          <button type="button" className="booking-detail-modal-close" aria-label="Close rating" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="rating-modal-stars">
          <legend>Your rating</legend>
          <div>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? 'selected' : ''}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
              >
                <Star size={28} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>

        <label className="rating-modal-comment">
          <span>Review <small>(optional)</small></span>
          <textarea value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} placeholder="How was the service?" />
          <small>{comment.length}/1000</small>
        </label>

        <div className="rating-modal-photo">
          <span>Photo <small>(optional, up to 5 MB)</small></span>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} aria-label="Add review photo" />
          {!imagePreview ? (
            <button type="button" className="rating-photo-picker" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={22} aria-hidden="true" />
              Add a photo of the completed work
            </button>
          ) : (
            <div className="rating-photo-preview">
              <img src={imagePreview} alt="Review upload preview" />
              <button type="button" onClick={removeImage} aria-label="Remove review photo"><X size={16} /></button>
            </div>
          )}
        </div>

        {error && <p className="rating-modal-error" role="alert">{error}</p>}

        <footer className="rating-modal-actions">
          <button type="button" className="gl-button secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="gl-button primary" disabled={isSubmitting}>
            <Star size={16} aria-hidden="true" />
            {isSubmitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default RatingModal;
