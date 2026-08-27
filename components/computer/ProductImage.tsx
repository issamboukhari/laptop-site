"use client";

import { useState } from "react";

interface ProductImageProps {
  src: string | null;
  brand: string;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProductImage({
  src,
  brand,
  name,
  className = "",
  size = "md",
}: ProductImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = src && !imgFailed;

  const dims =
    size === "lg"
      ? "h-64"
      : size === "sm"
        ? "h-20 w-20 min-w-20"
        : "h-40";

  const fallbackTextSize =
    size === "lg"
      ? "text-8xl"
      : size === "sm"
        ? "text-xl"
        : "text-5xl";

  if (size === "sm") {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden shrink-0 rounded-xl bg-gradient-to-br from-gen-card-hover to-gen-card ${dims} ${className}`}
      >
        {showImg ? (
          <img
            src={src}
            alt={`${brand} ${name}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain p-1"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className={`${fallbackTextSize} font-bold text-gen-accent/20 select-none`}>
            {brand.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative ${dims} bg-gradient-to-br from-gen-card-hover to-gen-card rounded-2xl border border-gen-border flex items-center justify-center overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gen-accent/5 to-blue-500/5" />
      {showImg ? (
        <img
          src={src}
          alt={`${brand} ${name}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-4"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="relative flex flex-col items-center gap-1 select-none">
          <span className={`${fallbackTextSize} font-bold text-gen-accent/15`}>
            {brand.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
