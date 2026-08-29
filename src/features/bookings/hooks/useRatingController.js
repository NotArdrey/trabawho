// ============================================================================
// useRatingController.js - Rating Workflow Controller Hook
// ============================================================================
// Purpose: Manages rating submission workflow
// Responsibilities:
//   - Manage rating modal UI state (which booking, rating value, comment)
//   - Handle star hover effects for rating preview
//   - Handle rating submission
//   - Notify parent when rating is submitted
// 
// Returns: Object with state and handlers for rating workflow
// ============================================================================

import { useState, useCallback } from 'react';

export function useRatingController(updateBooking, pushNotification) {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  // Rating modal state
  const [ratingTargetId, setRatingTargetId] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  // ========================================================================
  // HANDLER FUNCTIONS - Rating Workflow
  // ========================================================================

  /**
   * Open rating modal for a specific booking
   * Resets rating state to default values
   */
  const handleOpenRating = useCallback((bookingId) => {
    setRatingTargetId(bookingId);
    setRatingValue(5);
    setRatingHover(0);
    setRatingComment('');
  }, []);

  /**
   * Submit a rating and review
   * Updates booking with rating and review, marks as rated
   */
  const handleSubmitRating = useCallback(async (booking) => {
    if (!ratingTargetId) return;

    // Update booking with rating and review
    await updateBooking(booking.id, {
      rating: ratingValue,
      review: ratingComment.trim(),
      canRate: false,
    });

    // Push notification
    pushNotification?.(
      'Rating Submitted',
      `Thanks — your rating for booking #${booking.id} was recorded.`
    );

    // Reset modal state
    setRatingTargetId(null);
    setRatingValue(5);
    setRatingHover(0);
    setRatingComment('');
  }, [ratingTargetId, ratingValue, ratingComment, updateBooking, pushNotification]);

  /**
   * Handle rating submitted via alternate flow (from ChatWindow, etc)
   * Updates booking directly with rating payload
   */
  const handleLeaveRating = useCallback(async (payload) => {
    if (!payload || !payload.bookingId) return;

    await updateBooking(payload.bookingId, {
      rating: payload.rating,
      review: payload.comment || '',
      reviewImage: payload.imageFile || null,
      canRate: false,
    });

    pushNotification?.(
      'Rating Submitted',
      `Thanks — your rating for booking #${payload.bookingId} was recorded.`
    );
  }, [updateBooking, pushNotification]);

  // ========================================================================
  // RETURN OBJECT - Exposed state and handlers
  // ========================================================================
  
  return {
    // Rating modal state
    ratingTargetId,
    setRatingTargetId,
    ratingValue,
    setRatingValue,
    ratingHover,
    setRatingHover,
    ratingComment,
    setRatingComment,

    // Handlers
    handleOpenRating,
    handleSubmitRating,
    handleLeaveRating,
  };
}
