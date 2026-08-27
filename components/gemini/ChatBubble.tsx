"use client";

import { cn } from "@/lib/utils/cn";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gen-fg mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gen-fg mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gen-fg mt-4 mb-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gen-fg/90">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gen-fg/90">$2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  html = html.replace(/((?:<li[^>]*>.*?<\/li><br\/?>)+)/g, (match) => {
    return `<ul class="my-2">${match.replace(/<br\/?>/g, "")}</ul>`;
  });

  return html;
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          role === "user"
            ? "bg-gen-accent text-white rounded-br-md"
            : "bg-gen-card border border-gen-border text-gen-fg rounded-bl-md"
        )}
      >
        {role === "assistant" ? (
          <div
            className="prose-sm prose-invert max-w-none [&_ul]:my-2 [&_li]:my-0.5 [&_strong]:text-gen-fg [&_code]:bg-gen-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-gen-bg [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <p>{content}</p>
        )}
      </div>
    </div>
  );
}
