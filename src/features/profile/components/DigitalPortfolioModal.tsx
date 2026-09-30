import { useState } from "react";
import { CheckCircle2, Download, FileText, MapPin, QrCode, ShieldCheck, Star, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateProviderPortfolio, getPaymentLabel } from "@/features/profile/services/generateProviderPortfolio";

export interface DigitalPortfolioModalProps {
  bio?: string;
  gcashNumber?: string;
  isOpen: boolean;
  isVerified?: boolean;
  location?: string;
  onClose: () => void;
  profilePhoto?: string | null;
  rating?: number | string | null;
  serviceType?: string;
  workerName?: string;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
}

const DigitalPortfolioModal = ({
  bio = "Professional service available through TrabaWho.",
  gcashNumber,
  isOpen,
  isVerified = false,
  location = "Location not set",
  onClose,
  profilePhoto,
  rating,
  serviceType = "General service",
  workerName = "Service provider",
}: DigitalPortfolioModalProps) => {
  const [generationError, setGenerationError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const numericRating = Number(rating);
  const ratingLabel = Number.isFinite(numericRating) && numericRating > 0 ? `${numericRating.toFixed(1)} / 5` : "No reviews yet";
  const paymentLabel = getPaymentLabel(gcashNumber);
  const referenceData = `TrabaWho provider\nName: ${workerName}\nService: ${serviceType}\nLocation: ${location}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referenceData)}`;

  const handleDownload = async () => {
    try {
      setGenerationError("");
      setIsGenerating(true);
      await generateProviderPortfolio({ bio, gcashNumber, isVerified, location, profilePhoto, ratingLabel, serviceType, workerName });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Could not generate the PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isGenerating) onClose(); }}>
      <DialogContent className="max-h-[calc(100svh-1rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-2 flex items-center gap-2 text-primary"><FileText className="size-5" aria-hidden="true" /><Badge variant="secondary">Shareable PDF</Badge></div>
          <DialogTitle className="text-2xl">Professional portfolio preview</DialogTitle>
          <DialogDescription className="leading-6">Check how clients will see your professional information before downloading.</DialogDescription>
        </DialogHeader>

        <div
          className="grid min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.75fr)]"
          role="region"
          aria-label="Portfolio preview content"
        >
          <div className="bg-muted/40 p-4 sm:p-6">
            <article className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-sm" aria-label="Portfolio preview">
              <header className="flex items-center justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white"><img className="h-8 w-7 object-contain" src="/trabawho-logo.svg" alt="" aria-hidden="true" /></span>
                  <span><span className="block text-lg font-bold tracking-tight">Traba<span className="text-brand-highlight">Who</span></span><span className="block text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/75">Local services marketplace</span></span>
                </div>
                <span className="hidden text-xs font-semibold uppercase tracking-widest text-primary-foreground/80 sm:block">Provider portfolio</span>
              </header>

              <div className="p-5 sm:p-6">
                <section className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                  {profilePhoto ? <img className="size-20 shrink-0 rounded-full object-cover ring-2 ring-border" src={profilePhoto} alt={`${workerName} profile`} /> : <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary ring-2 ring-border" aria-label={`${workerName} initials`}>{getInitials(workerName)}</span>}
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-2xl font-bold tracking-tight text-foreground">{workerName}</h2>
                    <p className="mt-1 font-semibold text-primary">{serviceType}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={isVerified ? "success" : "secondary"}><ShieldCheck aria-hidden="true" />{isVerified ? "Verified provider" : "Provider profile"}</Badge>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"><Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />{ratingLabel}</span>
                    </div>
                  </div>
                </section>

                <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/55 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client rating</dt><dd className="mt-1 font-semibold text-foreground">{ratingLabel}</dd></div>
                  <div className="rounded-lg bg-muted/55 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MapPin className="size-3.5 text-primary" aria-hidden="true" />Service area</dt><dd className="mt-1 break-words text-sm font-semibold text-foreground">{location}</dd></div>
                  <div className="rounded-lg bg-muted/55 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><WalletCards className="size-3.5 text-primary" aria-hidden="true" />Payment contact</dt><dd className="mt-1 break-words text-sm font-semibold text-foreground">{paymentLabel}</dd></div>
                </dl>

                <section className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Professional summary</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{bio}</p></section>
                <section className="mt-6 flex flex-col gap-4 rounded-xl bg-primary/5 p-4 sm:flex-row sm:items-center">
                  <img src={qrCodeUrl} alt="Provider reference QR code" className="size-24 shrink-0 rounded-lg bg-white p-1" />
                  <div><QrCode className="mb-2 size-5 text-primary" aria-hidden="true" /><h3 className="font-semibold text-foreground">Provider reference</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">Scan to confirm the provider name, service, and location included in this portfolio.</p></div>
                </section>
              </div>
            </article>
          </div>

          <aside className="border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0">
            <h3 className="text-lg font-semibold">What clients receive</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">A concise, print-ready introduction focused on the details needed to evaluate your service.</p>
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /><span><strong className="block">Professional identity</strong><span className="text-muted-foreground">Your photo, name, service, and verification status.</span></span></li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /><span><strong className="block">Decision-ready details</strong><span className="text-muted-foreground">Rating, service area, payment contact, and summary.</span></span></li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /><span><strong className="block">TrabaWho reference</strong><span className="text-muted-foreground">A QR reference and clearly dated export.</span></span></li>
            </ul>
            {generationError ? <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{generationError}</p> : null}
          </aside>
        </div>

        <DialogFooter className="px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
          <Button type="button" onClick={() => { void handleDownload(); }} isLoading={isGenerating}><Download aria-hidden="true" />{isGenerating ? "Preparing PDF…" : "Download portfolio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DigitalPortfolioModal;
