import { useState } from 'react';
import { getThemeTokens } from '../../../shared/styles/themeTokens';

const TERMS = [
  'You agree to share accurate booking, schedule, payment, and contact details needed to complete this service.',
  'TrabaWho will process booking records, chat messages, proof of payment, and uploaded files only for service coordination, verification, safety, and support.',
  'Mock payment steps in this test flow do not move real money. Final payment responsibility remains between the client and worker until production payment is enabled.',
  'Both client and worker must act honestly, avoid fraudulent proof, and keep agreed service details inside the booking conversation for traceability.',
];

function BookingTermsModal({
  isOpen,
  appTheme = 'light',
  title = 'Confirm Booking Terms',
  subtitle = 'Please review these TrabaWho booking terms before continuing.',
  confirmLabel = 'Agree and Continue',
  terms = TERMS,
  agreementLabel = 'I agree to the TrabaWho booking Terms and Conditions for this booking.',
  onCancel,
  onConfirm,
}) {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  const themeTokens = getThemeTokens(appTheme);
  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 3200,
      background: 'rgba(15, 23, 42, 0.62)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
    },
    card: {
      width: 'min(100%, 620px)',
      maxHeight: 'calc(100vh - 28px)',
      overflowY: 'auto',
      background: themeTokens.surface,
      color: themeTokens.textPrimary,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: 8,
      boxShadow: '0 22px 60px rgba(15, 23, 42, 0.3)',
      padding: 18,
      boxSizing: 'border-box',
    },
    title: { margin: '0 0 6px', fontSize: 22, fontWeight: 800 },
    subtitle: { margin: 0, color: themeTokens.textSecondary, lineHeight: 1.45 },
    list: { margin: '14px 0', paddingLeft: 20, color: themeTokens.textSecondary, lineHeight: 1.5 },
    checkboxRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 8,
      background: themeTokens.surfaceAlt,
      border: `1px solid ${themeTokens.border}`,
      fontWeight: 700,
    },
    checkbox: { width: 18, height: 18, marginTop: 1, flexShrink: 0 },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    cancel: {
      minHeight: 40,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: 8,
      background: themeTokens.surfaceSoft,
      color: themeTokens.textPrimary,
      padding: '9px 13px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    confirm: {
      minHeight: 40,
      border: 'none',
      borderRadius: 8,
      background: accepted ? themeTokens.accent : '#94a3b8',
      color: '#ffffff',
      padding: '9px 13px',
      fontWeight: 800,
      cursor: accepted ? 'pointer' : 'not-allowed',
    },
  };

  const handleCancel = () => {
    setAccepted(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    if (!accepted) return;
    setAccepted(false);
    onConfirm?.();
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="booking-terms-title">
      <div style={styles.card}>
        <h2 id="booking-terms-title" style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>
          {subtitle}
        </p>
        <ol style={styles.list}>
          {terms.map((term) => <li key={term}>{term}</li>)}
        </ol>
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            style={styles.checkbox}
          />
          <span>{agreementLabel}</span>
        </label>
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" style={styles.confirm} onClick={handleConfirm} disabled={!accepted}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookingTermsModal;
