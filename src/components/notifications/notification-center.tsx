import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCheck,
  CreditCard,
  MessageSquareText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time?: string;
  isRead: boolean;
  type?: string;
}

interface NotificationCenterProps {
  notifications: readonly AppNotification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAllRead: () => void;
  onNotificationClick: (id: string) => void;
}

const notificationIcons = {
  booking: CalendarClock,
  message: MessageSquareText,
  payment: CreditCard,
  work: BriefcaseBusiness,
} as const;

function NotificationCenter({
  notifications,
  open,
  onOpenChange,
  onMarkAllRead,
  onNotificationClick,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-lg border-0 bg-transparent hover:bg-accent"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-[var(--brand-orange)] px-1 text-[10px] font-bold leading-4 text-slate-950">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You’re all caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onMarkAllRead}>
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="grid min-h-44 place-items-center px-6 py-8 text-center">
            <div>
              <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <Bell aria-hidden="true" className="size-5" />
              </span>
              <p className="font-semibold">No notifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Booking and work updates will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
            {notifications.map((notification) => {
              const NotificationIcon =
                notificationIcons[notification.type as keyof typeof notificationIcons] ?? Bell;

              return (
                <button
                  key={notification.id}
                  type="button"
                  className={cn(
                    "group flex min-h-20 w-full gap-3 rounded-lg border-0 px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !notification.isRead && "bg-primary/8",
                  )}
                  onClick={() => onNotificationClick(notification.id)}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground",
                      !notification.isRead && "bg-primary text-primary-foreground",
                    )}
                  >
                    <NotificationIcon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{notification.title}</span>
                      {notification.time ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{notification.time}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {notification.message}
                    </span>
                  </span>
                  {!notification.isRead ? (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--brand-orange)]" aria-label="Unread" />
                  ) : null}
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
