import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingTransactionActions } from "./BookingTransactionActions";
import { getParticipantReportImage, getParticipantSupportBooking, type ParticipantSupportCase } from "../services/participantSupportCases";
import type { BookingActionRecord } from "../types/booking-action-record";

export function ParticipantCaseDetail({ item, onUpdated }: { item: ParticipantSupportCase; onUpdated: () => void }) {
  const [booking, setBooking] = useState<BookingActionRecord | null>(null);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [revision, setRevision] = useState(0);
  const bookingId = item.report.booking_id;
  useEffect(() => {
    let active = true;
    void getParticipantSupportBooking(bookingId).then((value) => {
      if (active) { setBooking(value); setError(""); }
    }).catch(() => { if (active) setError("This booking could not be loaded. Try again."); });
    return () => { active = false; };
  }, [bookingId, revision]);
  const viewImage = async () => {
    if (!item.report.storage_path) return;
    setImageError("");
    try { window.open(await getParticipantReportImage(item.report.storage_path), "_blank", "noopener,noreferrer"); }
    catch { setImageError("The report image could not be opened. Try again."); }
  };
  return <section aria-label="Support case progress" className="grid gap-4 border-t pt-4">
    <h3 className="font-semibold">Case progress and next steps</h3>
    <p className="break-all text-xs text-muted-foreground">Case reference: {item.report.id}</p>
    {item.report.storage_path && <Button variant="outline" className="w-fit" onClick={() => { void viewImage(); }}><ExternalLink aria-hidden="true" />View report image</Button>}
    {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
    {error ? <div role="alert" className="grid gap-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="w-fit" onClick={() => setRevision((value) => value + 1)}><RefreshCw aria-hidden="true" />Retry loading case</Button></div>
      : !booking && <p role="status" className="text-sm text-muted-foreground">Loading case progress…</p>}
    {booking && <BookingTransactionActions booking={{ ...booking, disputeStatus: item.report.status === "closed" ? "closed" : "open" }}
      supportCaseId={item.report.id} viewerRole={item.viewerRole} onUpdated={() => { setRevision((value) => value + 1); onUpdated(); }} />}
  </section>;
}
