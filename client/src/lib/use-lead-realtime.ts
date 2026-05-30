/**
 * useLeadRealtime — subscribes the calling component to live
 * `lead_notifications` inserts for the given trainer. Fires `onNew` on
 * each insert so the inbox can refetch and show a toast.
 *
 * Returns a small status object so the UI can render a "Live" indicator.
 *
 * The Realtime channel is keyed by `trainerSlug` so multiple tabs from
 * the same trainer share one channel via Supabase's Realtime broadcast.
 *
 * NOTE — realtime delivery requires migration 0029 (lead_realtime_rls) to be
 * applied AND trainer slugs to be seeded in fotbal.trainers.slug (migration
 * 0026 ACTION REQUIRED). Until then the Supabase RLS policy on
 * lead_notifications evaluates to false for every authenticated trainer (the
 * old policy keyed on auth.jwt()->>'trainer_id', a claim Supabase doesn't
 * inject), so the channel subscribes but delivers no rows. The inbox still
 * works via the service-role API (api/lead/list.ts) — realtime is additive.
 * The component renders "inbox-only" rather than "error" until the DB is ready.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

type LeadNotificationRow = {
  id: string;
  recipient_trainer_id: string;
  channel: "push" | "whatsapp" | "email" | "inapp";
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/**
 * "live"         — channel subscribed and RLS allows delivery.
 * "inbox-only"   — channel connected but RLS blocked row delivery (migration
 *                  0029 or trainer slugs not yet applied); inbox still works
 *                  via the service-role API, realtime is just unavailable.
 * "connecting"   — subscription in progress.
 * "idle"         — no slug / Supabase not configured.
 */
type RealtimeStatus = "idle" | "connecting" | "live" | "inbox-only";

export function useLeadRealtime(
  trainerSlug: string | null,
  onNew: (row: LeadNotificationRow) => void,
): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  // Track whether we've received at least one row since subscribing. If the
  // channel reports SUBSCRIBED but never delivers a row (which happens when
  // the RLS policy silently blocks all rows), we keep the status as
  // "inbox-only" rather than prematurely claiming "live".
  const receivedAny = useRef(false);

  useEffect(() => {
    if (!trainerSlug || !isSupabaseConfigured) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    receivedAny.current = false;

    const channel: RealtimeChannel = supabase
      .channel(`lead-inbox:${trainerSlug}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "fotbal",
          table: "lead_notifications",
          // Only the channel='inapp' row to avoid 4× per lead.
          filter: `recipient_trainer_id=eq.${trainerSlug}`,
        },
        (payload) => {
          const row = payload.new as LeadNotificationRow;
          if (row?.channel !== "inapp") return;
          // First confirmed delivery — upgrade from "inbox-only" to "live".
          if (!receivedAny.current) {
            receivedAny.current = true;
            setStatus("live");
          }
          onNewRef.current(row);
        },
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          // Channel subscribed — show inbox-only until a row actually arrives.
          // If migration 0029 + slugs are in place the first insert will flip
          // this to "live"; otherwise it stays as inbox-only indefinitely.
          setStatus(prev => prev === "connecting" ? "inbox-only" : prev);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("inbox-only");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trainerSlug]);

  return { status };
}
