"use client";

import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gen-accent text-white hover:bg-gen-accent-light active:scale-[0.98] shadow-sm":
              variant === "primary",
            "bg-gen-card text-gen-fg border border-gen-border hover:bg-gen-card-hover active:scale-[0.98]":
              variant === "secondary",
            "text-gen-fg hover:bg-gen-card-hover active:scale-[0.98]":
              variant === "ghost",
            "border border-gen-border text-gen-fg hover:bg-gen-card-hover active:scale-[0.98]":
              variant === "outline",
          },
          {
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
