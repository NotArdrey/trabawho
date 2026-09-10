import { useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquareText,
  Star,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getProfilePhotoUrl, hasUploadedProfilePhoto } from "@/shared/utils/profilePhoto";

import { getDisplayServiceType, getProviderQuoteAmount } from "../utils/serviceNormalizer";

interface WorkerDetails {
  actionType?: string;
  description?: string;
  experience?: number;
  gallery?: string[];
  location?: string;
  name?: string;
  photo?: string;
  photos?: string[];
  pricingType?: string;
  rateBasis?: string;
  rating?: number | string | null;
  reviews?: number;
  title?: string;
  uploadedPhotos?: string[];
  [key: string]: unknown;
}

interface WorkerDetailModalProps {
  isOpen: boolean;
  worker: WorkerDetails | null;
  onClose?: () => void;
  onBookNow?: (worker: WorkerDetails) => void;
}

const formatRate = (worker: WorkerDetails = {}) => {
  if (worker.pricingType === "inquiry" || worker.actionType === "inquire") return "Rate upon inquiry";

  const amount = Number(getProviderQuoteAmount(worker));
  if (!amount) return "Custom pricing";

  const suffixMap: Record<string, string> = {
    "per-hour": "hour",
    "per-day": "day",
    "per-week": "week",
    "per-month": "month",
    "per-project": "project",
  };

  return `PHP ${amount.toLocaleString("en-PH")}/${(worker.rateBasis && suffixMap[worker.rateBasis]) || "service"}`;
};

const getRateBadge = (worker: WorkerDetails = {}) => {
  const labelMap: Record<string, string> = {
    "per-hour": "Hourly rate",
    "per-day": "Daily rate",
    "per-week": "Weekly rate",
    "per-month": "Monthly rate",
    "per-project": "Project rate",
  };

  if (worker.pricingType === "inquiry" || worker.actionType === "inquire") return "Inquiry based";
  return (worker.rateBasis && labelMap[worker.rateBasis]) || "Service rate";
};

export default function WorkerDetailModal({ isOpen, worker, onClose, onBookNow }: WorkerDetailModalProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isProfilePhotoOpen, setIsProfilePhotoOpen] = useState(false);

  if (!worker) return null;

  const gallery = worker.gallery?.length
    ? worker.gallery
    : worker.uploadedPhotos?.length
      ? worker.uploadedPhotos
      : worker.photos?.length
        ? worker.photos
        : [];
  const serviceType = getDisplayServiceType(worker);
  const isInquiry = worker.actionType === "inquire";
  const rating = worker.rating || "New";
  const reviews = worker.reviews || 0;
  const providerName = worker.name || "Service Provider";
  const providerPhoto = getProfilePhotoUrl(worker.photo);
  const selectedImage = gallery[galleryIndex] || gallery[0];
  const serviceTitle = worker.title && worker.title !== providerName ? worker.title : serviceType;

  const closeModal = () => {
    setGalleryIndex(0);
    setIsProfilePhotoOpen(false);
    onClose?.();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent
          className={cn(
            "max-h-[calc(100svh-1rem)] gap-0 overflow-y-auto p-0 sm:max-h-[calc(100svh-2rem)]",
            gallery.length ? "max-w-5xl lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:overflow-hidden" : "max-w-xl",
          )}
        >
          {gallery.length > 0 ? (
            <section className="relative min-h-64 overflow-hidden bg-muted lg:min-h-[600px]" aria-label="Service portfolio">
              <img className="absolute inset-0 size-full object-cover" src={selectedImage} alt={`${providerName} work sample`} loading="lazy" />
              {gallery.length > 1 ? (
                <>
                  <span className="absolute left-4 top-4 rounded-full bg-slate-950/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm" aria-live="polite">
                    {galleryIndex + 1} of {gallery.length}
                  </span>
                  <Button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/95 shadow-md" variant="ghost" size="icon" onClick={() => setGalleryIndex((index) => (index - 1 + gallery.length) % gallery.length)} aria-label="Previous image">
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/95 shadow-md" variant="ghost" size="icon" onClick={() => setGalleryIndex((index) => (index + 1) % gallery.length)} aria-label="Next image">
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2" aria-label="Gallery thumbnails">
                    {gallery.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        className={cn("size-12 overflow-hidden rounded-lg bg-background shadow-md ring-2 ring-white/70 focus-visible:outline-none focus-visible:ring-ring", index === galleryIndex && "ring-primary")}
                        onClick={() => setGalleryIndex(index)}
                        aria-label={`Show image ${index + 1}`}
                        aria-current={index === galleryIndex}
                      >
                        <img className="size-full object-cover" src={image} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <div className="flex min-w-0 flex-col lg:max-h-[calc(100svh-2rem)]">
            <header className="bg-muted/45 px-5 py-5 pr-16 sm:px-6 sm:py-6 sm:pr-16">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default"
                  onClick={() => setIsProfilePhotoOpen(true)}
                  aria-label={`View ${providerName} profile photo`}
                  disabled={!hasUploadedProfilePhoto(worker.photo)}
                >
                  <img className="size-14 rounded-full object-cover shadow-sm ring-2 ring-background" src={providerPhoto} alt="" />
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-foreground">{providerName}</p>
                    <Badge variant="secondary" className="text-primary"><BadgeCheck aria-hidden="true" />Verified</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />
                    <strong className="text-foreground">{rating}</strong>
                    <span>({reviews} {reviews === 1 ? "review" : "reviews"})</span>
                  </p>
                </div>
              </div>
            </header>

            <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:overflow-y-auto">
              <DialogHeader className="gap-2 pr-8">
                <Badge variant="secondary" className="w-fit text-primary">{serviceType}</Badge>
                <DialogTitle className="text-2xl sm:text-3xl">{serviceTitle}</DialogTitle>
                <DialogDescription className="text-base leading-7">
                  {worker.description || "Professional service available through TrabaWho. Message this provider for full project details."}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
                <div className="flex gap-3">
                  <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div><dt className="font-semibold text-foreground">Booking</dt><dd className="mt-0.5 text-muted-foreground">{isInquiry ? "Request booking" : "Time-slot booking"}</dd></div>
                </div>
                <div className="flex gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div><dt className="font-semibold text-foreground">Response time</dt><dd className="mt-0.5 text-muted-foreground">Usually within 15 minutes</dd></div>
                </div>
                {worker.location ? (
                  <div className="flex gap-3 sm:col-span-2">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div><dt className="font-semibold text-foreground">Service location</dt><dd className="mt-0.5 text-muted-foreground">{worker.location}</dd></div>
                  </div>
                ) : null}
                {worker.experience ? (
                  <div className="sm:col-span-2"><dt className="font-semibold text-foreground">Experience</dt><dd className="mt-0.5 text-muted-foreground">{worker.experience}+ years</dd></div>
                ) : null}
              </dl>

              <section className="rounded-xl bg-primary/5 p-4" aria-labelledby="service-rate-label">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><WalletCards className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p id="service-rate-label" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{getRateBadge(worker)}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{formatRate(worker)}</p>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      {isInquiry ? "Final pricing and schedule are coordinated through chat." : "Standard listed rate. Choose Book now to view available schedules."}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <DialogFooter className="sticky bottom-0 mt-auto grid grid-cols-[auto_minmax(0,1fr)] bg-background px-5 pb-5 pt-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:px-6 sm:pb-6">
              <Button variant="outline" onClick={() => onBookNow?.({ ...worker, actionType: "inquire" })} aria-label={`Message ${providerName}`}>
                <MessageSquareText aria-hidden="true" />Message
              </Button>
              <Button onClick={() => onBookNow?.(worker)}>{isInquiry ? "Inquire now" : "Book now"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfilePhotoOpen} onOpenChange={setIsProfilePhotoOpen}>
        <DialogContent className="max-w-xl p-3">
          <DialogTitle className="sr-only">{providerName} profile photo</DialogTitle>
          <img className="max-h-[80svh] w-full rounded-lg object-contain" src={providerPhoto} alt={providerName} />
        </DialogContent>
      </Dialog>
    </>
  );
}
