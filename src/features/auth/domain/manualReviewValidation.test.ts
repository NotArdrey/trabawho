import { describe, expect, it } from 'vitest';
import { manualReviewErrors } from './manualReviewValidation';

const fields = { name: 'Manual Applicant', document: 'Postal ID', number: 'POSTAL-123', expiry: '' };
const valid = new File(['image'], 'id.png', { type: 'image/png' });

describe('manual evidence validation', () => {
  it('identifies missing identity fields and each missing image before submission', () => {
    expect(manualReviewErrors({ name: '', document: '', number: '', expiry: '' }, { front: null, back: null, selfie: null }))
      .toHaveProperty('front', 'Choose an image for id front.');
    expect(manualReviewErrors({ ...fields, name: ' ' }, { front: valid, back: valid, selfie: valid })).toHaveProperty('name');
  });
  it('rejects unsupported, empty, and oversized images without rejecting valid evidence', () => {
    expect(manualReviewErrors(fields, { front: new File(['pdf'], 'id.pdf', { type: 'application/pdf' }), back: new File([], 'empty.png', { type: 'image/png' }), selfie: new File([new Uint8Array(7 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }) }))
      .toEqual({ front: 'Choose a JPEG, PNG, or WebP image up to 7 MB.', back: 'Choose a JPEG, PNG, or WebP image up to 7 MB.', selfie: 'Choose a JPEG, PNG, or WebP image up to 7 MB.' });
    expect(manualReviewErrors(fields, { front: valid, back: valid, selfie: valid })).toEqual({});
  });
});
