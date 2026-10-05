import { AccountError, text } from './accountRegistration.ts';
import { asRecord } from './identityDomain.ts';
import type { DraftClient } from './registrationDrafts.ts';

export function manualDocument(body: Record<string,unknown>) {
  const fullName=text(body.fullName),documentType=text(body.documentType),documentNumber=text(body.documentNumber),expiry=text(body.expiry);
  if (fullName.length<2 || fullName.length>200 || !/\p{L}/u.test(fullName) || /[\p{Cc}\p{Cf}]/u.test(fullName) || !documentType || documentType.length>100 || !documentNumber || body.acceptedIdentityTerms!==true)
    throw new AccountError('Provide the name on ID, document type, number, evidence, and identity consent.');
  const noExpiration=body.noExpiration===true || (body.noExpiration===undefined && !expiry);
  if (!noExpiration && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0,10)!==expiry || expiry<new Date().toISOString().slice(0,10)))
    throw new AccountError('Enter an unexpired document date or select no expiration.');
  return {fullName,documentType,expiry:noExpiration?'':expiry,backNotApplicable:body.backNotApplicable===true};
}
export async function uploadManualEvidence(client:DraftClient,id:string,body:Record<string,unknown>,paths:string[]) {
  const evidence:Record<string,string>={};
  // Validate every image before any upload or Auth creation.
  const images = ['front',...(body.backNotApplicable===true?[]:['back']),'selfie'].map(slot=>{
    const image=asRecord(body[`${slot}Image`]);const mimeType=text(image.mimeType);
    if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) throw new AccountError('Choose JPEG, PNG, or WebP evidence.');
    const base64=text(image.base64).split(',').pop() || '';
    if (!base64 || base64.length>Math.ceil(7*1024*1024*4/3)+4) throw new AccountError('Each image must be at most 7 MB.');
    let bytes:Uint8Array;
    try {bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));} catch {throw new AccountError('Choose a readable identity image.');}
    if (!bytes.length || bytes.length>7*1024*1024) throw new AccountError('Each image must be at most 7 MB.');
    return {slot,mimeType,bytes};
  });
  for (const {slot,mimeType,bytes} of images) {
    const extension=mimeType==='image/jpeg'?'jpg':mimeType.split('/')[1];const path=`${id}/${crypto.randomUUID()}-${slot}.${extension}`;
    const upload=await client.storage.from('identity-manual').upload(path,bytes,{contentType:mimeType,upsert:false});
    if (upload.error) throw new AccountError('Identity evidence could not be uploaded. Retry.',503);
    paths.push(path);evidence[slot]=path;
  }
  return evidence;
}
