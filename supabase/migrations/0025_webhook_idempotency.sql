-- 0025 — Webhook idempotency guards
--
-- Voice webhooks can be retried by the agent or by infrastructure after a
-- transient timeout. The application now always writes a vendor_call_id
-- (LiveKit room id, or a payload hash fallback for older agents); this index
-- makes duplicate delivery harmless even under concurrent retries.

create unique index if not exists lead_calls_vendor_call_id_unique
  on fotbal.lead_calls (vendor, vendor_call_id)
  where vendor_call_id is not null;
