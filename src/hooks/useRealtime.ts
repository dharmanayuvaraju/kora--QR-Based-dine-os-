"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeEvent } from "@/lib/types";

export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Production mode: Supabase Realtime over WebSockets (works across Vercel serverless Lambdas)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const channel = supabase
        .channel("kora-live-events")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "kora_realtime_events" },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const ev: RealtimeEvent = {
              id: String(row.id ?? ""),
              type: row.type as RealtimeEvent["type"],
              channel: String(row.channel ?? "restaurant:orders"),
              session_id: row.session_id ? String(row.session_id) : undefined,
              table_number: row.table_number ? String(row.table_number) : undefined,
              order_number:
                typeof row.order_number === "number" ? row.order_number : undefined,
              message: String(row.message ?? "Live update"),
              timestamp: String(row.created_at ?? new Date().toISOString()),
            };
            callbackRef.current(ev);
          }
        )
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Local fallback: Built-in Server-Sent Events (SSE)
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/v1/realtime/stream");

      source.addEventListener("connected", () => {
        setConnected(true);
      });

      source.addEventListener("update", (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as RealtimeEvent;
          callbackRef.current(parsed);
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
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { connected };
}
