import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | "outline";
  className?: string;
}

function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-gen-card-hover text-gen-fg": variant === "default",
          "bg-gen-accent/15 text-gen-accent": variant === "accent",
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400":
            variant === "success",
          "bg-amber-500/15 text-amber-600 dark:text-amber-400":
            variant === "warning",
          "bg-red-500/15 text-red-600 dark:text-red-400": variant === "danger",
          "border border-gen-border text-gen-muted": variant === "outline",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export { Badge };
