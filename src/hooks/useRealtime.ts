"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/lib/types";

export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
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
