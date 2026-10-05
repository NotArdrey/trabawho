export type EvidenceSlot = 'front' | 'back' | 'selfie';
export interface ManualReviewFields { name: string; document: string; number: string; expiry: string; noExpiration?: boolean; backNotApplicable?: boolean }
export type ManualReviewErrors = Partial<Record<keyof ManualReviewFields | EvidenceSlot, string>>;
export const evidenceLabels: Record<EvidenceSlot, string> = { front: 'ID front', back: 'ID back', selfie: 'Selfie holding ID' };

export function manualReviewErrors(fields: ManualReviewFields, files: Record<EvidenceSlot, File | null>): ManualReviewErrors {
  const errors: ManualReviewErrors = {};
  if (fields.name.trim().length < 2) errors.name = 'Enter the complete name shown on your ID.';
  if (!fields.document.trim()) errors.document = 'Enter the government document type, such as Passport or Postal ID.';
  if (!fields.number.trim()) errors.number = 'Enter the number shown on your ID.';
  if (!fields.noExpiration && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.expiry) || Number.isNaN(Date.parse(fields.expiry)) || new Date(fields.expiry).toISOString().slice(0, 10) !== fields.expiry || fields.expiry < new Date().toISOString().slice(0, 10)))
    errors.expiry = 'Enter an unexpired date or select no expiration.';
  for (const slot of ['front', 'back', 'selfie'] as const) {
    if (slot === 'back' && fields.backNotApplicable) continue;
    const file = files[slot];
    if (!file) errors[slot] = 'Choose an image for ' + evidenceLabels[slot].toLowerCase() + '.';
    else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 7 * 1024 * 1024)
      errors[slot] = 'Choose a JPEG, PNG, or WebP image up to 7 MB.';
  }
  return errors;
}
