"use client";

export function KoraMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[#C2410C] text-[#FAF7F2] shadow-xs ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-[68%] w-[68%]" fill="none">
        <path
          d="M9 7V25M9 16L20 7M12.8 13L22 25"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23.5" cy="9" r="2.2" fill="#FDE68A" />
      </svg>
    </span>
  );
}
