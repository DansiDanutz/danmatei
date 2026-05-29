/**
 * NotificationBell — popover bell in the MemberShell header.
 *
 * Reads from `fotbal.notifications` for the current user, subscribes to
 * realtime INSERT events so new notifications appear instantly, and
 * supports mark-as-read (single + all).
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { usePushSubscription } from "@/lib/use-push-subscription";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notification[]);
  }, [profile]);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!profile) return;
    fetchItems();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "fotbal",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 30));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchItems]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  };

  const markAllRead = async () => {
    if (!profile) return;
    const unread = items.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((n) => n.id),
      );
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Acum";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}z`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificări${unreadCount > 0 ? ` (${unreadCount} noi)` : ""}`}
          className="touch-target relative grid size-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition-colors hover:border-brand-cyan/40 hover:text-white"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-cyan font-heading text-[9px] font-bold tabular-nums text-[oklch(0.08_0.02_250)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 rounded-2xl border border-white/10 bg-[oklch(0.12_0.025_250)] p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/75">
            Notificări
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="font-heading text-[10px] uppercase tracking-[0.16em] text-brand-cyan/80 hover:text-brand-cyan"
            >
              Marchează toate
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center font-body text-sm text-white/45">
              Nu ai notificări.
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.read_at) markRead(n.id);
                if (n.link) window.location.href = n.link;
              }}
              className={`group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                n.read_at ? "opacity-60" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 block size-2 shrink-0 rounded-full ${
                  n.read_at ? "bg-white/15" : "bg-brand-cyan"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-xs font-semibold uppercase tracking-[0.06em] text-white/90">
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 font-body text-xs leading-relaxed text-white/60">
                    {n.body}
                  </p>
                )}
                <span className="mt-1 block font-heading text-[9px] uppercase tracking-[0.18em] text-white/35">
                  {timeAgo(n.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <PushToggle />
      </PopoverContent>
    </Popover>
  );
}

// ─── Push opt-in footer ─────────────────────────────────────────────────────
// Lives at the bottom of the bell popover. Hidden when the browser doesn't
// support push or the server hasn't configured VAPID — no point teasing a
// feature that won't work. When supported, lets the user enable/disable
// background push delivery on this device.

function PushToggle() {
  const { status, loading, error, subscribe, unsubscribe } =
    usePushSubscription();

  // Don't pollute the popover when push isn't an option here.
  if (status === "checking" || status === "unsupported" || status === "not-configured") {
    return null;
  }

  if (status === "denied") {
    return (
      <div className="border-t border-white/8 px-4 py-3 font-body text-[11px] text-white/45">
        Notificările push sunt blocate în browser. Activează-le din setările
        site-ului ca să primești alerte când aplicația e închisă.
      </div>
    );
  }

  const isOn = status === "subscribed";

  return (
    <div className="border-t border-white/8 px-4 py-2.5">
      <button
        type="button"
        onClick={() => (isOn ? void unsubscribe() : void subscribe())}
        disabled={loading}
        className={
          isOn
            ? "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-brand-cyan/30 bg-brand-cyan/[0.08] px-3 py-2 font-heading text-[10.5px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/15 disabled:opacity-60"
            : "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 font-heading text-[10.5px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-brand-cyan/40 hover:text-white disabled:opacity-60"
        }
      >
        <span className="inline-flex items-center gap-2">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isOn ? (
            <Bell className="size-3.5" />
          ) : (
            <BellOff className="size-3.5" />
          )}
          {isOn ? "Notificări push active" : "Activează notificări push"}
        </span>
        <span className="font-body text-[10px] normal-case text-white/40">
          {isOn ? "Apasă pentru oprire" : "Pe acest dispozitiv"}
        </span>
      </button>
      {error && (
        <p className="mt-1.5 font-body text-[10.5px] text-rose-300/85">
          {error}
        </p>
      )}
    </div>
  );
}
