import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotificationCenter, type AppNotification } from "./notification-center";

const notifications: AppNotification[] = [
  {
    id: "booking-1",
    title: "Booking updated",
    message: "Your provider confirmed the requested schedule.",
    time: "2m ago",
    isRead: false,
    type: "booking",
  },
  {
    id: "message-1",
    title: "New message",
    message: "You received a reply from your provider.",
    time: "1h ago",
    isRead: true,
    type: "message",
  },
];

describe("NotificationCenter", () => {
  it("shows unread status and exposes notification actions", () => {
    const onMarkAllRead = vi.fn();
    const onNotificationClick = vi.fn();

    render(
      <NotificationCenter
        notifications={notifications}
        open
        onOpenChange={vi.fn()}
        onMarkAllRead={onMarkAllRead}
        onNotificationClick={onNotificationClick}
      />,
    );

    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
    expect(screen.getByText("1 unread update")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    fireEvent.click(screen.getByRole("button", { name: /Booking updated/ }));

    expect(onMarkAllRead).toHaveBeenCalledOnce();
    expect(onNotificationClick).toHaveBeenCalledWith("booking-1");
  });

  it("renders a useful empty state", () => {
    render(
      <NotificationCenter
        notifications={[]}
        open
        onOpenChange={vi.fn()}
        onMarkAllRead={vi.fn()}
        onNotificationClick={vi.fn()}
      />,
    );

    expect(screen.getByText("No notifications yet")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });
});
