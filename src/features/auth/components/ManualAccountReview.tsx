import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { encodeIdentityImage } from '@/shared/services/accountRegistrationService';

export function ManualAccountReview({ busy, submit, canSubmit = true }: { busy: boolean; canSubmit?: boolean; submit: (body: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(''); const [number, setNumber] = useState(''); const [document, setDocument] = useState('');
  const [expiry, setExpiry] = useState(''); const [error, setError] = useState(''); const [encoding, setEncoding] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({ front: null, back: null, selfie: null });
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault(); if (busy || encoding || !canSubmit) return;
    setEncoding(true); setError('');
    void (async () => {
      try {
        const [frontImage, backImage, selfieImage] = await Promise.all([encodeIdentityImage(files.front), encodeIdentityImage(files.back), encodeIdentityImage(files.selfie)]);
        await submit({ action: 'manual', fullName: name, documentNumber: number, documentType: document, expiry, frontImage, backImage, selfieImage, acceptedIdentityTerms: true });
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Evidence could not be read.'); }
      finally { setEncoding(false); }
    })();
  }}>
    <h2 className="text-lg font-semibold">Manual identity review</h2>
    <p className="text-sm text-muted-foreground">Use this if the hosted workflow cannot verify your document. An administrator reviews this evidence before access opens. Allow up to seven days.</p>
    {[['manual-name', 'Name on ID', name, setName], ['manual-document', 'Government document type', document, setDocument], ['manual-number', 'ID number', number, setNumber]]
      .map(([id, label, value, setter]) => <div key={String(id)} className="space-y-2"><Label htmlFor={String(id)}>{String(label)}</Label><Input id={String(id)} value={String(value)} maxLength={200} required disabled={busy || encoding} onChange={(event) => (setter as (value: string) => void)(event.target.value)} /></div>)}
    <div className="space-y-2"><Label htmlFor="manual-expiry">ID expiry date (if shown)</Label><Input id="manual-expiry" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></div>
    {(['front', 'back', 'selfie'] as const).map((slot) => <div key={slot} className="space-y-2"><Label htmlFor={`manual-${slot}-image`}>{slot === 'selfie' ? 'Selfie' : `ID ${slot}`}</Label><Input id={`manual-${slot}-image`} type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy || encoding} onChange={(event) => setFiles((current) => ({ ...current, [slot]: event.target.files?.[0] || null }))} /></div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={!canSubmit} isLoading={busy || encoding}>Submit for human review</Button>
  </form>;
}
