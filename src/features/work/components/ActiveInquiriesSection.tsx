import { CalendarDays, Inbox, MessageSquareText, Star, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import type { WorkInquiry } from "@/features/work/types/inquiry";

interface ActiveInquiriesSectionProps {
  inquiries: WorkInquiry[];
  onRespond: (inquiryId: string) => void;
}

const statusTone = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("waiting") || normalized.includes("scheduled")) return "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
  if (normalized.includes("negotiating")) return "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
  if (normalized.includes("pending")) return "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  return "bg-muted text-muted-foreground";
};

export function ActiveInquiriesSection({ inquiries, onRespond }: ActiveInquiriesSectionProps) {
  return (
    <section className="mb-4 rounded-xl border bg-card p-5 shadow-none max-md:mb-3 max-md:p-4" data-testid="work-inquiries-section">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 pb-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-brand-highlight-soft text-brand-highlight-foreground">
          <Inbox className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight text-foreground max-md:text-[17px]">Active inquiries</h2>
          <p className="mt-1 text-sm text-muted-foreground">Clients waiting for your response.</p>
        </div>
        <Badge variant={inquiries.length ? "brand" : "secondary"}>{inquiries.length}</Badge>
      </div>

      <div className="divide-y">
        {inquiries.map((inquiry) => (
          <article key={inquiry.id} className="py-5 first:pt-4 last:pb-1">
            <div className="flex items-start justify-between gap-4 max-sm:flex-wrap">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <img className="size-12 shrink-0 rounded-full object-cover" src={getProfilePhotoUrl(inquiry.clientPhoto)} alt={inquiry.clientName} />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">{inquiry.clientName}</h3>
                  {inquiry.clientRating ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-brand-highlight-foreground"><Star className="size-3 fill-brand-highlight text-brand-highlight" aria-hidden="true" />{inquiry.clientRating} rating</p>
                  ) : <p className="mt-1 text-xs text-muted-foreground">New client</p>}
                </div>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide", statusTone(inquiry.status))}>{inquiry.status}</span>
            </div>

            <div className="mt-4">
              <p className="font-semibold text-primary">{inquiry.service}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{inquiry.description}</p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4 max-sm:flex-col max-sm:items-stretch">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><WalletCards className="size-3.5" aria-hidden="true" />{inquiry.proposedBudget}</span>
                {inquiry.requestDate ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />{inquiry.requestDate}</span> : null}
              </div>
              <Button type="button" className="shadow-none max-sm:w-full" onClick={() => onRespond(inquiry.id)} aria-label={`Respond to ${inquiry.clientName}`}>
                <MessageSquareText aria-hidden="true" />Respond{inquiry.messages > 0 ? ` (${inquiry.messages})` : ""}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
