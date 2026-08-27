import { cn } from "@/lib/utils/cn";
import { Search } from "lucide-react";
import { InputHTMLAttributes, forwardRef } from "react";

const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gen-muted" />
        <input
          ref={ref}
          maxLength={120}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "w-full h-10 pl-10 pr-4 rounded-xl border border-gen-border bg-gen-card text-gen-fg text-sm",
            "placeholder:text-gen-muted focus:outline-none focus:ring-2 focus:ring-gen-accent/40 focus:border-gen-accent",
            "transition-all duration-200",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
