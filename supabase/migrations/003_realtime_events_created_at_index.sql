-- Speed up latest-event cursor lookups for resilient cross-device Realtime delta sync
CREATE INDEX IF NOT EXISTS idx_kora_realtime_events_created_at
  ON public.kora_realtime_events (created_at DESC);
