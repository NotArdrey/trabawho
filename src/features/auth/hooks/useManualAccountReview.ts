import { useRef, useState } from 'react';
import { encodeIdentityImage } from '@/shared/services/accountRegistrationService';
import { manualReviewErrors, type EvidenceSlot, type ManualReviewErrors, type ManualReviewFields } from '../domain/manualReviewValidation';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useManualAccountReview(submit: (body: Record<string, unknown>) => Promise<void>, onDraftChange?: DraftListener) {
  const [fields, setFields] = useState<ManualReviewFields>({ name: '', document: '', number: '', expiry: '' });
  const [files, setFiles] = useState<Record<EvidenceSlot, File | null>>({ front: null, back: null, selfie: null });
  const [errors, setErrors] = useState<ManualReviewErrors>({});
  const [error, setError] = useState('');
  const [encoding, setEncoding] = useState(false);
  const working = useRef(false);
  useRegistrationDraft(Object.values(fields).some(Boolean) || Object.values(files).some(Boolean), onDraftChange);
  const send = async () => {
    if (working.current) return null;
    const issues = manualReviewErrors(fields, files);
    setErrors(issues);
    const first = Object.keys(issues)[0] as keyof ManualReviewErrors | undefined;
    if (first) return 'manual-' + (first === 'front' || first === 'back' || first === 'selfie' ? first + '-image' : first);
    working.current = true; setEncoding(true); setError('');
    try {
      const [frontImage, backImage, selfieImage] = await Promise.all([encodeIdentityImage(files.front), fields.backNotApplicable ? Promise.resolve(null) : encodeIdentityImage(files.back), encodeIdentityImage(files.selfie)]);
      await submit({ action: 'manual', fullName: fields.name, documentNumber: fields.number, documentType: fields.document,
        expiry: fields.noExpiration ? '' : fields.expiry, noExpiration: Boolean(fields.noExpiration), backNotApplicable: Boolean(fields.backNotApplicable), frontImage, backImage, selfieImage, acceptedIdentityTerms: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Evidence could not be read. Choose the images again.'); }
    finally { working.current = false; setEncoding(false); }
    return null;
  };
  const update = (key: 'name' | 'document' | 'number' | 'expiry', value: string) => setFields((current) => ({ ...current, [key]: value }));
  const setOption = (key: 'noExpiration' | 'backNotApplicable', value: boolean) => setFields((current) => ({ ...current, [key]: value }));
  const setFile = (slot: EvidenceSlot, file: File | null) => setFiles((current) => ({ ...current, [slot]: file }));
  return { fields, update, setOption, files, setFile, errors, error, encoding, send };
}
