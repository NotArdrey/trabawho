import { CalendarDays, Inbox, ListChecks, MessageSquareText, Star, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
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

const formatRequestDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
};

export function ActiveInquiriesSection({ inquiries, onRespond }: ActiveInquiriesSectionProps) {
  return (
    <WorkflowPanel className="mb-4 max-md:mb-3" contentClassName="px-5 max-md:px-4" data-testid="work-inquiries-section" icon={Inbox} title="Active inquiries" description="Clients waiting for your response." tone="highlight" status={<Badge variant={inquiries.length ? "brand" : "secondary"}>{inquiries.length}</Badge>}>
      {inquiries.length ? <div className="divide-y">
        {inquiries.map((inquiry) => (
          <article key={inquiry.id} className="py-5 first:pt-4">
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
              <dl className="flex flex-wrap gap-2 text-xs">
                {inquiry.proposedBudget ? (
                  <div className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <WalletCards className="size-4" aria-hidden="true" />
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Budget</dt><dd className="font-bold">{inquiry.proposedBudget}</dd></div>
                  </div>
                ) : null}
                {inquiry.requestDate ? (
                  <div className="flex min-h-11 items-center gap-2 rounded-lg bg-primary/10 px-3 text-primary">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    <div><dt className="text-[10px] font-semibold uppercase tracking-wide opacity-75">Requested date</dt><dd className="font-bold">{formatRequestDate(inquiry.requestDate)}</dd></div>
                  </div>
                ) : null}
              </dl>
              <Button type="button" className="shadow-none max-sm:w-full" onClick={() => onRespond(inquiry.id)} aria-label={`Respond to ${inquiry.clientName}`}>
                <MessageSquareText aria-hidden="true" />Respond{inquiry.messages > 0 ? ` (${inquiry.messages})` : ""}
              </Button>
            </div>
          </article>
        ))}
      </div> : <WorkflowEmptyState icon={ListChecks} title="No active inquiries" description="New client requests will appear here when they need your response." tone="success" />}
    </WorkflowPanel>
  );
}
