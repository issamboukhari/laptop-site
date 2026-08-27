export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gen-card border border-gen-border rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gen-muted/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-gen-muted/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-gen-muted/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
