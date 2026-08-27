import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gen-border bg-gen-card gen-card-shadow",
        hover &&
          "transition-all duration-200 hover:gen-glow hover:border-gen-accent/30 hover:scale-[1.01]",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4 pb-2", className)}>{children}</div>;
}

function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4 pt-0", className)}>{children}</div>;
}

function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("p-4 pt-2 border-t border-gen-border flex items-center", className)}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardContent, CardFooter };
