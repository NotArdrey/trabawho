import { Bell, BriefcaseBusiness, CalendarClock, CheckCheck, CreditCard, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkflowEmptyState } from "@/components/ui/workflow-panel";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time?: string;
  createdAt?: string;
  isRead: boolean;
  type?: string;
}

interface NotificationCenterProps {
  notifications: readonly AppNotification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAllRead: () => void;
  onNotificationClick: (id: string) => void;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

const notificationIcons = { booking: CalendarClock, message: MessageSquareText, payment: CreditCard, work: BriefcaseBusiness } as const;

function NotificationCenter({ notifications, open, onOpenChange, onMarkAllRead, onNotificationClick, isLoading = false, error = "", onRetry }: NotificationCenterProps) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative rounded-lg border-0 bg-transparent hover:bg-accent" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}>
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-highlight px-1 text-[10px] font-bold leading-4 text-slate-950">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Notifications</h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You're all caught up"}</p>
          </div>
          {unreadCount > 0 ? <Button type="button" variant="ghost" size="sm" onClick={onMarkAllRead}><CheckCheck aria-hidden="true" />Mark all read</Button> : null}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-3" aria-label="Loading notifications" aria-live="polite">
            {[0, 1, 2].map((item) => <div key={item} className="flex min-h-20 animate-pulse gap-3 rounded-lg bg-muted/60 p-3"><span className="size-9 shrink-0 rounded-lg bg-muted" /><span className="flex-1 space-y-2"><span className="block h-4 w-2/5 rounded bg-muted" /><span className="block h-3 w-4/5 rounded bg-muted" /></span></div>)}
          </div>
        ) : error ? (
          <div className="grid min-h-44 place-items-center px-6 py-8 text-center"><div><p className="font-semibold">Could not load notifications</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>{onRetry ? <Button className="mt-4" type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button> : null}</div></div>
        ) : notifications.length === 0 ? (
          <WorkflowEmptyState className="min-h-44" icon={Bell} title="No notifications yet" description="Booking and message updates will appear here." tone="primary" />
        ) : (
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
            {notifications.map((notification) => {
              const NotificationIcon = notificationIcons[notification.type as keyof typeof notificationIcons] ?? Bell;
              return (
                <button key={notification.id} type="button" className={cn("group flex min-h-20 w-full gap-3 rounded-lg border-0 px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !notification.isRead && "bg-primary/8")} onClick={() => onNotificationClick(notification.id)}>
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground", !notification.isRead && "bg-primary text-primary-foreground")}><NotificationIcon aria-hidden="true" className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-semibold text-foreground">{notification.title}</span>{notification.time ? <span className="shrink-0 text-xs text-muted-foreground">{notification.time}</span> : null}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{notification.message}</span></span>
                  {!notification.isRead ? <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-highlight" aria-label="Unread" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { NotificationCenter };
