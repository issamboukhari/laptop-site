import { Cpu, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gen-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gen-muted text-xs">
          <Cpu className="w-3.5 h-3.5" />
          <span>gen — Intelligent Computer Discovery</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gen-muted/60">
          <span>Dev by Issam Eddine</span>
          <span className="text-gen-muted/30">•</span>
          <Sparkles className="w-3 h-3 text-gen-accent/50" />
          <span>Powered by Gemini</span>
        </div>
      </div>
    </footer>
  );
}
