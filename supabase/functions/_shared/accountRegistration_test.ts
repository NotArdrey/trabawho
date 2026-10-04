import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifiedDocument } from './accountRegistration.ts';
Deno.test('complete legal names remain unsplit and conflicting documents require review', () => {
  const report = { status: 'Approved', id_verifications: [{ full_name: 'Maria Isabel de la Cruz Santos', document_type: 'Passport' }] };
  assertEquals(verifiedDocument(report).fullName, 'Maria Isabel de la Cruz Santos');
  assertEquals(verifiedDocument(report).nameAmbiguous, false);
  assertEquals(verifiedDocument({ ...report, id_verifications: [...report.id_verifications, { full_name: 'A Different Name', document_type: 'Passport' }] }).nameAmbiguous, true);
});
Deno.test('missing extracted names are not fabricated from an email or account metadata', () => {
  assertEquals(verifiedDocument({ status: 'Approved', email: 'prefix@example.com', id_verifications: [{ document_type: 'id_card' }] }).fullName, '');
});
