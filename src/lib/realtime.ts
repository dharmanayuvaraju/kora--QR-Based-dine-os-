import { EventEmitter } from "events";
import type { RealtimeEvent } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __koraRealtimeEmitter: EventEmitter | undefined;
}

const emitter =
  globalThis.__koraRealtimeEmitter ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(200);
    globalThis.__koraRealtimeEmitter = e;
    return e;
  })();

export function publishRealtimeEvent(
  event: Omit<RealtimeEvent, "id" | "timestamp">
): RealtimeEvent {
  const fullEvent: RealtimeEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  emitter.emit("event", fullEvent);
  return fullEvent;
}

export function subscribeRealtimeEvents(
  listener: (event: RealtimeEvent) => void
): () => void {
  emitter.on("event", listener);
  return () => {
    emitter.off("event", listener);
  };
}
