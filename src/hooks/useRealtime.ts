"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeEvent } from "@/lib/types";

const BROADCAST_CHANNEL_NAME = "kora-live-sync-v1";

/**
 * Instantly notifies other open tabs in the same browser (e.g., Manager + Chef + Customer)
 * without waiting for a WebSocket round-trip. Cross-device sync is handled via Supabase Realtime.
 */
export function notifyLocalTabs(
  event: Pick<RealtimeEvent, "type" | "message"> & Partial<RealtimeEvent>
): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  try {
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    const full: RealtimeEvent = {
      id: event.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: event.type,
      channel: event.channel ?? "restaurant:orders",
      session_id: event.session_id,
      table_number: event.table_number,
      order_number: event.order_number,
      message: event.message,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    bc.postMessage(full);
    bc.close();
  } catch {
    // BroadcastChannel unavailable or blocked
  }
}

export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  const lastSeenEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let disposed = false;

    const dispatchOnce = (ev: RealtimeEvent) => {
      if (disposed) return;
      if (ev.id && ev.id === lastSeenEventIdRef.current) return;
      if (ev.id && !ev.id.startsWith("local-")) {
        lastSeenEventIdRef.current = ev.id;
      }
      callbackRef.current(ev);
    };

    // Layer 1: Same-browser cross-tab BroadcastChannel (zero-latency < 5ms sync)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (msg) => {
          const ev = msg.data as RealtimeEvent | undefined;
          if (ev && ev.type) {
            dispatchOnce(ev);
          }
        };
      } catch {
        // ignore
      }
    }

    // Production mode: Supabase Realtime over WebSockets + missed-event delta sync
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return () => {
          disposed = true;
          bc?.close();
        };
      }

      const uniqueChannelName = `kora-live-events-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      // Prime cursor with latest event id so initial poll doesn't double-fire
      const syncLatestEvent = async (emitIfChanged: boolean) => {
        if (disposed) return;
        try {
          const { data } = await supabase
            .from("kora_realtime_events")
            .select("id, type, channel, session_id, table_number, order_number, message, created_at")
            .order("created_at", { ascending: false })
            .limit(1);
          const row = data?.[0];
          if (!row) return;
          const rowId = String(row.id ?? "");
          if (!lastSeenEventIdRef.current) {
            lastSeenEventIdRef.current = rowId;
            return;
          }
          if (rowId && rowId !== lastSeenEventIdRef.current) {
            lastSeenEventIdRef.current = rowId;
            if (emitIfChanged) {
              callbackRef.current({
                id: rowId,
                type: row.type as RealtimeEvent["type"],
                channel: String(row.channel ?? "restaurant:orders"),
                session_id: row.session_id ? String(row.session_id) : undefined,
                table_number: row.table_number ? String(row.table_number) : undefined,
                order_number:
                  typeof row.order_number === "number" ? row.order_number : undefined,
                message: String(row.message ?? "Live update"),
                timestamp: String(row.created_at ?? new Date().toISOString()),
              });
            }
          }
        } catch {
          // ignore transient poll failure
        }
      };

      void syncLatestEvent(false);

      const channel = supabase
        .channel(uniqueChannelName)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "kora_realtime_events" },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            dispatchOnce({
              id: String(row.id ?? ""),
              type: row.type as RealtimeEvent["type"],
              channel: String(row.channel ?? "restaurant:orders"),
              session_id: row.session_id ? String(row.session_id) : undefined,
              table_number: row.table_number ? String(row.table_number) : undefined,
              order_number:
                typeof row.order_number === "number" ? row.order_number : undefined,
              message: String(row.message ?? "Live update"),
              timestamp: String(row.created_at ?? new Date().toISOString()),
            });
          }
        )
        .subscribe((status) => {
          if (disposed) return;
          setConnected(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") {
            void syncLatestEvent(true);
          }
        });

      // Layer 3: Lightweight delta check (3s) + instant resync when tab regains focus/visibility
      const deltaTimer = setInterval(() => {
        if (typeof document === "undefined" || document.visibilityState === "visible") {
          void syncLatestEvent(true);
        }
      }, 3000);

      const handleWake = () => {
        if (typeof document === "undefined" || document.visibilityState === "visible") {
          void syncLatestEvent(true);
        }
      };

      if (typeof window !== "undefined") {
        window.addEventListener("focus", handleWake);
        document.addEventListener("visibilitychange", handleWake);
      }

      return () => {
        disposed = true;
        clearInterval(deltaTimer);
        if (typeof window !== "undefined") {
          window.removeEventListener("focus", handleWake);
          document.removeEventListener("visibilitychange", handleWake);
        }
        bc?.close();
        supabase.removeChannel(channel);
      };
    }

    // Local fallback: Built-in Server-Sent Events (SSE)
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/v1/realtime/stream");

      source.addEventListener("connected", () => {
        setConnected(true);
      });

      source.addEventListener("update", (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as RealtimeEvent;
          dispatchOnce(parsed);
        } catch {
          // Ignore malformed event
        }
      });

      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      bc?.close();
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { connected };
}
