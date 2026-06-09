import { useState, useRef, useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";

interface Notification {
  id: number;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ notifications, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const markReadFetcher = useFetcher();
  const markAllFetcher = useFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markReadFetcher.submit(
        { notificationId: notification.id },
        { method: "POST", action: "/api/notifications/mark-read", encType: "application/json" }
      );
    }
    setOpen(false);
    navigate(notification.linkUrl);
  }

  function handleMarkAll() {
    markAllFetcher.submit(
      {},
      { method: "POST", action: "/api/notifications/mark-all-read", encType: "application/json" }
    );
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-2 w-80 rounded-md border border-sidebar-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full px-3 py-3 text-left transition-colors hover:bg-accent",
                    !n.isRead && "bg-accent/40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.isRead && "pl-4")}>
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.message}</div>
                      <div className="mt-1 text-xs text-muted-foreground/70">{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
