/**
 * /notificari — User notifications inbox. Public route, but the content
 * itself is gated to the signed-in user (RLS on fotbal.notifications).
 * For unauthenticated visitors we render a friendly sign-in prompt.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bell, Check, ArrowRight } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Bucharest",
});

export default function Notificari() {
  const { profile, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      setItems(((data as NotificationRow[] | null) ?? []));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, authLoading]);

  const markRead = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return;
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  };

  if (!authLoading && !profile) {
    return (
      <PublicShell
        pageKicker="Notificări"
        pageTitle="Intră în cont pentru a vedea notificările"
        pageDescription="Notificările despre meciuri, antrenamente, mesaje de la antrenor și anunțuri de grup ajung în acest panou după ce te autentifici."
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-5 py-3 font-heading text-sm font-semibold uppercase tracking-[0.16em] text-[oklch(0.08_0.02_250)] transition-transform hover:scale-[1.02]"
        >
          Mergi la autentificare
          <ArrowRight className="size-4" />
        </Link>
      </PublicShell>
    );
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <PublicShell
      pageKicker={unread > 0 ? `${unread} necitite` : "Notificări"}
      pageTitle="Inbox"
      pageDescription="Tot ce ai ratat — pe scurt."
    >
      {loading && (
        <div className="grid place-items-center py-16">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="grid place-items-center rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 py-16 text-center">
          <Bell className="size-9 text-brand-cyan" />
          <p className="mt-3 font-heading text-lg uppercase tracking-wider text-white">
            Inbox gol
          </p>
          <p className="mt-1 font-body text-sm text-white/55">
            Te anunțăm aici când apare ceva nou.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n, i) => {
          const isUnread = !n.read_at;
          return (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.03, ease: expoOut }}
              className={`relative flex items-start gap-4 rounded-2xl border p-4 sm:p-5 ${
                isUnread
                  ? "border-brand-cyan/30 bg-brand-cyan/[0.05]"
                  : "border-white/8 bg-[oklch(0.13_0.03_250)]/40"
              }`}
            >
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  isUnread ? "bg-brand-cyan" : "bg-white/15"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate font-heading text-sm font-semibold text-white">
                    {n.title}
                  </p>
                  <span className="ml-auto shrink-0 font-body text-[11px] text-white/45">
                    {dateFormatter.format(new Date(n.created_at))}
                  </span>
                </div>
                {n.body && (
                  <p className="mt-1 font-body text-sm leading-relaxed text-white/65">
                    {n.body}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {n.link && (
                    <Link
                      href={n.link}
                      className="inline-flex items-center gap-1 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan hover:text-white"
                    >
                      Deschide
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="inline-flex items-center gap-1 font-heading text-[11px] uppercase tracking-[0.16em] text-white/50 hover:text-white"
                    >
                      <Check className="size-3.5" />
                      Marchează ca citită
                    </button>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </PublicShell>
  );
}
