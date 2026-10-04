export type EvidenceSlot = 'front' | 'back' | 'selfie';
export interface ManualReviewFields { name: string; document: string; number: string; expiry: string }
export type ManualReviewErrors = Partial<Record<keyof ManualReviewFields | EvidenceSlot, string>>;
export const evidenceLabels: Record<EvidenceSlot, string> = { front: 'ID front', back: 'ID back', selfie: 'Selfie' };

export function manualReviewErrors(fields: ManualReviewFields, files: Record<EvidenceSlot, File | null>): ManualReviewErrors {
  const errors: ManualReviewErrors = {};
  if (fields.name.trim().length < 2) errors.name = 'Enter the complete name shown on your ID.';
  if (!fields.document.trim()) errors.document = 'Enter the government document type, such as Passport or Postal ID.';
  if (!fields.number.trim()) errors.number = 'Enter the number shown on your ID.';
  for (const slot of ['front', 'back', 'selfie'] as const) {
    const file = files[slot];
    if (!file) errors[slot] = 'Choose an image for ' + evidenceLabels[slot].toLowerCase() + '.';
    else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 7 * 1024 * 1024)
      errors[slot] = 'Choose a JPEG, PNG, or WebP image up to 7 MB.';
  }
  return errors;
}
