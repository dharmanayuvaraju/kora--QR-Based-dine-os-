"use client";

import type { DietaryType } from "@/lib/types";

export function DietaryMark({
  dietary,
  showLabel = false,
}: {
  dietary: DietaryType;
  showLabel?: boolean;
}) {
  if (dietary === "non_veg") {
    return (
      <span className="inline-flex items-center gap-1.5" title="Non-Vegetarian">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[#9B2C2C] bg-white">
          <span
            className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-[#9B2C2C]"
            aria-hidden
          />
        </span>
        {showLabel && <span className="text-[11px] font-medium text-[#9B2C2C]">Non-Veg</span>}
      </span>
    );
  }

  if (dietary === "vegan") {
    return (
      <span className="inline-flex items-center gap-1.5" title="Plant-Based / Vegan">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[#1E6B4B] bg-[#ECFDF5]">
          <span className="h-2 w-2 rounded-full bg-[#1E6B4B]" aria-hidden />
        </span>
        {showLabel && <span className="text-[11px] font-medium text-[#1E6B4B]">Vegan</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" title="Vegetarian">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[#1E6B4B] bg-white">
        <span className="h-2 w-2 rounded-full bg-[#1E6B4B]" aria-hidden />
      </span>
      {showLabel && <span className="text-[11px] font-medium text-[#1E6B4B]">Veg</span>}
    </span>
  );
}
