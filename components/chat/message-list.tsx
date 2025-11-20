"use client"

import { useEffect, useRef } from "react"
import { MessageBubble } from "./message-bubble"
import { AnimatePresence, motion } from "framer-motion"
import { MessageSquare } from "lucide-react"

export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
}

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    if (scrollContainerRef.current && shouldAutoScroll.current) {
      const container = scrollContainerRef.current
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      
      // Always scroll to bottom when auto-scroll is enabled
      requestAnimationFrame(() => {
        if (scrollContainerRef.current && shouldAutoScroll.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
        }
      })
    }
  }, [messages, isStreaming])

  // Handle scroll events to disable auto-scroll when user scrolls up
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const scrollTop = container.scrollTop
      
      // Re-enable auto-scroll if user scrolls back to bottom
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto p-6 sm:p-8"
    >
      <div className="flex flex-col space-y-6 min-h-full">
        <AnimatePresence mode="popLayout" initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex h-full flex-col items-center justify-center text-center text-[#495057] mt-12"
            >
              <div className="mb-6 rounded-full bg-gray-100 p-6">
                <MessageSquare className="h-10 w-10 text-[#6C757D]" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-[#212529]">Welcome to Marcura Assistant</h3>
              <p className="max-w-sm text-sm text-[#495057]">
                Ask me about DA-Desk, MarTrust, ShipServ, or how they work together to optimize your workflow.
              </p>
            </motion.div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble
                key={message.id || `msg-${index}`}
                role={message.role}
                content={message.content}
                isStreaming={isStreaming && index === messages.length - 1}
              />
            ))
          )}
        </AnimatePresence>
        <div className="h-1" /> {/* Spacer to ensure scroll works */}
      </div>
    </div>
  )
}
