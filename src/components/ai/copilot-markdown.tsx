"use client";

import { memo } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-2.5">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 space-y-1 pl-4 [&>li]:list-disc [&>li]:marker:text-muted-foreground/60">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 space-y-1 pl-4 [&>li]:list-decimal [&>li]:marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  h1: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-sm font-semibold first:mt-0">{children}</h4>,
  code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="bg-muted mt-2 overflow-x-auto rounded-lg p-3 text-xs">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="text-muted-foreground mt-2 border-l-2 pl-3">{children}</blockquote>,
  hr: () => <hr className="my-3" />,
  a: ({ href, children }) => {
    if (href?.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-primary decoration-primary/30 hover:decoration-primary font-medium underline underline-offset-2 transition-colors"
        >
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="scrollbar-thin mt-2.5 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children, style }) => (
    <th style={style} className="text-muted-foreground px-2.5 py-1.5 text-left font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="tabular border-t px-2.5 py-1.5 align-top">
      {children}
    </td>
  ),
  tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
};

export const CopilotMarkdown = memo(function CopilotMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("text-sm break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
});
