import { EventEmitter } from "events";
import { getSupabaseAdminClient } from "./supabase";
import type { RealtimeEvent } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __koraRealtimeEmitter: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __koraPendingEvents: RealtimeEvent[] | undefined;
}

const emitter =
  globalThis.__koraRealtimeEmitter ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(200);
    globalThis.__koraRealtimeEmitter = e;
    return e;
  })();

function getPendingQueue(): RealtimeEvent[] {
  if (!globalThis.__koraPendingEvents) {
    globalThis.__koraPendingEvents = [];
  }
  return globalThis.__koraPendingEvents;
}

export function publishRealtimeEvent(
  event: Omit<RealtimeEvent, "id" | "timestamp">
): RealtimeEvent {
  const fullEvent: RealtimeEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  emitter.emit("event", fullEvent);
  if (getSupabaseAdminClient()) {
    getPendingQueue().push(fullEvent);
  }
  return fullEvent;
}

export async function flushRealtimeEventsToSupabase(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const queue = getPendingQueue();
  if (!supabase || queue.length === 0) return;

  const batch = queue.splice(0, queue.length);
  try {
    await supabase.from("kora_realtime_events").insert(
      batch.map((ev) => ({
        id: ev.id,
        type: ev.type,
        channel: ev.channel,
        session_id: ev.session_id ?? null,
        table_number: ev.table_number ?? null,
        order_number: ev.order_number ?? null,
        message: ev.message,
        created_at: ev.timestamp,
      }))
    );
  } catch (err) {
    console.warn("[KORA Realtime] Failed inserting Supabase realtime event:", err);
  }
}

export function subscribeRealtimeEvents(
  listener: (event: RealtimeEvent) => void
): () => void {
  emitter.on("event", listener);
  return () => {
    emitter.off("event", listener);
  };
}
