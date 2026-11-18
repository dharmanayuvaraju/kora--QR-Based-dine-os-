"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kora_low_power_mode";

export function useMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      setManualOverride(true);
      setReducedMotion(true);
      document.documentElement.dataset.reducedMotion = "true";
      return;
    }
    if (stored === "0") {
      setManualOverride(false);
      setReducedMotion(false);
      delete document.documentElement.dataset.reducedMotion;
      return;
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { deviceMemory?: number };
    const isLowPowerHardware =
      (typeof navigator.hardwareConcurrency === "number" &&
        navigator.hardwareConcurrency <= 4) ||
      (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4);

    const apply = () => {
      const shouldReduce = mq.matches || isLowPowerHardware;
      setReducedMotion(shouldReduce);
      if (shouldReduce) {
        document.documentElement.dataset.reducedMotion = "true";
      } else {
        delete document.documentElement.dataset.reducedMotion;
      }
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => {
      const next = !prev;
      setManualOverride(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        if (next) document.documentElement.dataset.reducedMotion = "true";
        else delete document.documentElement.dataset.reducedMotion;
      }
      return next;
    });
  }, []);

  return { reducedMotion, manualOverride, toggleReducedMotion };
}
