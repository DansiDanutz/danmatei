/**
 * useLeadRealtime — subscribes the calling component to live
 * `lead_notifications` inserts for the given trainer. Fires `onNew` on
 * each insert so the inbox can refetch and show a toast.
 *
 * Returns a small status object so the UI can render a "Live" indicator.
 *
 * The Realtime channel is keyed by `trainerSlug` so multiple tabs from
 * the same trainer share one channel via Supabase's Realtime broadcast.
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

type RealtimeStatus = "idle" | "connecting" | "live" | "error";

export function useLeadRealtime(
  trainerSlug: string | null,
  onNew: (row: LeadNotificationRow) => void,
): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  useEffect(() => {
    if (!trainerSlug || !isSupabaseConfigured) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");

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
          onNewRef.current(row);
        },
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trainerSlug]);

  return { status };
}
