"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"
import { useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user"
  const contentRef = useRef<HTMLDivElement>(null)
  const prevContentRef = useRef(content)

  // Smooth content updates for streaming
  useEffect(() => {
    if (contentRef.current && content !== prevContentRef.current) {
      // Only animate if content actually changed
      prevContentRef.current = content
    }
  }, [content])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex w-full items-end gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#143232]/10 text-[#143232]">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        ref={contentRef}
        className={cn(
          "relative max-w-[80%] rounded-2xl px-5 py-3 text-sm",
          isUser
            ? "bg-[#143232] text-white rounded-br-none shadow-sm"
            : "bg-white border border-gray-200 text-[#495057] rounded-bl-none shadow-sm",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
        ) : (
          <div className="prose prose-sm max-w-none leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize markdown components
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0 text-[#212529]">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0 text-[#212529]">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0 text-[#212529]">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold text-[#212529]">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children, className }) => {
                  const isInline = !className?.includes("language-");
                  return isInline ? (
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-[#495057] border border-gray-200">
                      {children}
                    </code>
                  ) : (
                    <code className="block rounded bg-gray-100 p-3 text-xs font-mono text-[#495057] overflow-x-auto border border-gray-200">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="mb-3 rounded bg-gray-100 p-3 text-xs font-mono text-[#495057] overflow-x-auto last:mb-0 border border-gray-200">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="mb-3 border-l-4 border-gray-300 pl-3 italic text-[#495057] last:mb-0 bg-gray-50 py-2">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#143232] underline hover:text-[#143232]/80 font-medium"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-4 border-gray-200" />,
                table: ({ children }) => (
                  <div className="mb-3 overflow-x-auto last:mb-0">
                    <table className="min-w-full border-collapse border border-gray-200">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
                th: ({ children }) => (
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-[#212529]">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-200 px-3 py-2 text-[#495057]">{children}</td>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <motion.span
                className="ml-1 inline-block h-4 w-1.5 bg-[#143232] align-middle rounded"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#143232] text-white">
          <User className="h-5 w-5" />
        </div>
      )}
    </motion.div>
  )
}
