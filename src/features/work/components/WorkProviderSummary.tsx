import { CalendarClock, MapPin, Megaphone, Pencil, QrCode, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";

export interface WorkProviderSummaryProps {
  name: string;
  profilePhoto?: string | null;
  service: string;
  price: string;
  location: string;
  bookingMode: "Time-slot booking" | "Request booking";
  isBoosted?: boolean;
  activeInquiries: number;
  averageRating: string;
  completed: number;
  description: string;
  duration: string;
  payment: string;
  booster: string;
  onEditProfile: () => void;
  onOpenGcashQr: () => void;
  onOpenCashQr: () => void;
}

interface DetailProps { label: string; value: string; wide?: boolean }

function Detail({ label, value, wide = false }: DetailProps) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-1" : undefined}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-foreground">{value}</dd>
    </div>
  );
}

export default function WorkProviderSummary({
  name,
  profilePhoto,
  service,
  price,
  location,
  bookingMode,
  isBoosted = false,
  activeInquiries,
  averageRating,
  completed,
  description,
  duration,
  payment,
  booster,
  onEditProfile,
  onOpenGcashQr,
  onOpenCashQr,
}: WorkProviderSummaryProps) {
  return (
    <section className="mb-5 rounded-xl border bg-card p-5 shadow-none max-sm:p-4" aria-label="Current service summary">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <img className="size-16 shrink-0 rounded-full object-cover ring-1 ring-border sm:size-[72px]" src={getProfilePhotoUrl(profilePhoto)} alt={`${name} profile`} />
          <div className="min-w-0 flex-1">
            <button type="button" className="group flex max-w-full items-center gap-2 rounded-md text-left text-xl font-bold leading-tight text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onEditProfile} title="Edit profile details">
              <span className="truncate">{name}</span><Pencil className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </button>
            <p className="mt-2 text-sm font-semibold text-primary">{service}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{price}</p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{location}</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary"><CalendarClock aria-hidden="true" />{bookingMode}</Badge>
              {isBoosted ? <Badge variant="warning"><Megaphone aria-hidden="true" />Boosted</Badge> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="button" size="sm" variant="outline" className="shadow-none" onClick={onOpenGcashQr}><QrCode aria-hidden="true" />GCash QR</Button>
          <Button type="button" size="sm" variant="outline" className="shadow-none" onClick={onOpenCashQr}><QrCode aria-hidden="true" />Cash confirmation</Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x rounded-xl bg-muted/45 py-4 text-center">
        <div className="px-2"><strong className="block text-xl font-bold text-foreground">{activeInquiries}</strong><span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Active inquiries</span></div>
        <div className="px-2"><strong className="flex items-center justify-center gap-1 text-xl font-bold text-foreground"><Star className="size-[18px] fill-brand-highlight text-brand-highlight" aria-hidden="true" />{averageRating}</strong><span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Average rating</span></div>
        <div className="px-2"><strong className="block text-xl font-bold text-foreground">{completed}</strong><span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Completed</span></div>
      </div>

      <div className="mt-5 border-t pt-5">
        <h2 className="text-sm font-bold text-foreground">Work description</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          <Detail label="Service" value={service} wide />
          <Detail label="Rate" value={price} />
          <Detail label="Duration" value={duration} />
          <Detail label="Payment" value={payment} />
          <Detail label="Ad booster" value={booster} />
        </dl>
      </div>
    </section>
  );
}
