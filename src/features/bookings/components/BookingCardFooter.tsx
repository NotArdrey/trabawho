import type { ReactNode } from "react";
import { CalendarClock, CalendarX2, ChevronDown, Eye, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BookingCardFooterProps {
  amountLabel: string;
  amount: string;
  platformFee?: string;
  totalPayment?: string;
  paymentProgress?: { paid: string; balance: string };
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
  platformFee,
  totalPayment,
  paymentProgress,
  messageLabel,
  messageIsPrimary,
  onViewDetails,
  onMessage,
  onReschedule,
  onCancel,
  children,
}: BookingCardFooterProps) {
  const hasManagementActions = Boolean(onReschedule || onCancel);

  return (
    <footer className="grid min-w-0 gap-4 border-t border-border/70 pt-4">
      <section aria-label="Payment summary" className="min-w-0 rounded-xl bg-muted/40 px-4 py-3">
        <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-[repeat(3,minmax(7rem,auto))_minmax(12rem,1fr)]">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{amountLabel}</dt>
            <dd className="mt-1 text-sm font-bold text-foreground">{amount}</dd>
          </div>

          {platformFee && (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Platform fee</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{platformFee}</dd>
            </div>
          )}

          {totalPayment && (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Total payment</dt>
              <dd className="mt-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{totalPayment}</dd>
            </div>
          )}

          {paymentProgress && (
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:border-l sm:border-border/70 sm:pl-5">
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
