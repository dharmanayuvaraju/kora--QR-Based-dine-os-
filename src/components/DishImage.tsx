"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";

interface DishImageProps {
  src: string;
  alt: string;
  variant?: "thumb" | "medium";
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

function buildResponsiveSources(url: string, variant: "thumb" | "medium") {
  if (url.startsWith("/dishes/") && url.endsWith(".jpg")) {
    const base = url.slice(0, -4);
    const thumb = `${base}-thumb.webp`;
    const med = `${base}-med.webp`;
    return {
      src: variant === "thumb" ? thumb : med,
      srcSet: `${thumb} 240w, ${med} 560w`,
      sizes: variant === "thumb" ? "(max-width: 640px) 104px, 116px" : "(max-width: 640px) 92vw, 420px",
    };
  }

  if (url.includes("images.unsplash.com")) {
    const clean = url.split("?")[0];
    const thumb = `${clean}?w=240&h=240&fit=crop&q=70&auto=format`;
    const med = `${clean}?w=560&h=560&fit=crop&q=76&auto=format`;
    return {
      src: variant === "thumb" ? thumb : med,
      srcSet: `${thumb} 240w, ${med} 560w`,
      sizes: variant === "thumb" ? "(max-width: 640px) 104px, 116px" : "(max-width: 640px) 92vw, 420px",
    };
  }

  return { src: url, srcSet: undefined, sizes: undefined };
}

export const DishImage = memo(function DishImage({
  src,
  alt,
  variant = "thumb",
  priority = false,
  className,
  imgClassName,
}: DishImageProps) {
  const [loaded, setLoaded] = useState(false);
  const sources = buildResponsiveSources(src, variant);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#EFE9E0]",
        className
      )}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          className="kora-shimmer absolute inset-0 bg-[#E7DFD3]"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources.src}
        srcSet={sources.srcSet}
        sizes={sources.sizes}
        alt={alt}
        width={variant === "thumb" ? 112 : 560}
        height={variant === "thumb" ? 112 : 560}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
      />
    </div>
  );
});
