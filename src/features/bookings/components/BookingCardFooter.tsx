import type { ReactNode } from "react";
import { CalendarClock, CalendarDays, CalendarX2, ChevronDown, Eye, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface BookingCardFooterProps {
  amountLabel: string;
  amount: string;
  emphasizeAmount?: boolean;
  platformFee?: string;
  totalPayment?: string;
  paymentProgress?: { paid: string; balance: string };
  requestDate?: string;
  messageLabel: string;
  messageIsPrimary: boolean;
  onViewDetails: () => void;
  onMessage: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}

export function BookingCardFooter({
  amountLabel,
  amount,
  emphasizeAmount = false,
  platformFee,
  totalPayment,
  paymentProgress,
  requestDate,
  messageLabel,
  messageIsPrimary,
  onViewDetails,
  onMessage,
  onReschedule,
  onCancel,
  children,
}: BookingCardFooterProps) {
  const hasManagementActions = Boolean(onReschedule || onCancel);
  const parsedRequestDate = requestDate && /^\d{4}-\d{2}-\d{2}$/.test(requestDate) ? new Date(`${requestDate}T00:00:00`) : null;
  const requestedOn = parsedRequestDate && !Number.isNaN(parsedRequestDate.getTime())
    ? parsedRequestDate.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })
    : requestDate;

  return (
    <footer className="grid min-w-0 gap-4 border-t border-border/70 pt-4">
      <section aria-label="Payment summary" className="min-w-0">
        <dl className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className={cn("min-w-0 rounded-lg px-3 py-2 sm:min-w-28", emphasizeAmount ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 sm:min-w-40" : "bg-muted/60")}>
            <dt className={cn("text-xs font-medium", emphasizeAmount ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground")}>{amountLabel}</dt>
            <dd className={cn("mt-1 font-bold tabular-nums", emphasizeAmount ? "text-lg text-emerald-700 dark:text-emerald-300" : "text-sm text-foreground")}>{amount}</dd>
          </div>

          {requestedOn && (
            <div className="min-w-0 rounded-lg bg-primary/10 px-3 py-2 text-primary sm:min-w-40">
              <dt className="flex items-center gap-1 text-xs font-medium"><CalendarDays className="size-3.5" aria-hidden="true" />Requested on</dt>
              <dd className="mt-1 text-sm font-bold">{requestedOn}</dd>
            </div>
          )}

          {platformFee && (
            <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2 sm:min-w-28">
              <dt className="text-xs font-medium text-muted-foreground">Platform fee</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{platformFee}</dd>
            </div>
          )}

          {totalPayment && (
            <div className="min-w-0 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40 sm:min-w-28">
              <dt className="text-xs font-medium text-muted-foreground">Total payment</dt>
              <dd className="mt-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{totalPayment}</dd>
            </div>
          )}

          {paymentProgress && (
            <div className="col-span-2 min-w-0 rounded-lg bg-muted/60 px-3 py-2 sm:min-w-48">
              <dt className="text-xs font-medium text-muted-foreground">Payment progress</dt>
              <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
                <span>Paid: {paymentProgress.paid}</span>
                <span className="text-muted-foreground">Balance: {paymentProgress.balance}</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <nav aria-label="Booking actions" className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onViewDetails}>
          <Eye aria-hidden="true" />
          View details
        </Button>

        <Button type="button" variant={messageIsPrimary ? "primary" : "outline"} className="w-full sm:w-auto" onClick={onMessage}>
          <MessageCircle aria-hidden="true" />
          {messageLabel}
        </Button>

        {hasManagementActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                <CalendarClock aria-hidden="true" />
                Manage booking
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onReschedule && (
                <DropdownMenuItem onSelect={onReschedule}>
                  <CalendarClock aria-hidden="true" />
                  Reschedule
                </DropdownMenuItem>
              )}
              {onReschedule && onCancel && <DropdownMenuSeparator />}
              {onCancel && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onCancel}>
                  <CalendarX2 aria-hidden="true" />
                  Cancel booking
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {children}
      </nav>
    </footer>
  );
}
