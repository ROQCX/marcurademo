"use client"

import { motion } from "framer-motion"
import { Bot } from "lucide-react"

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex w-full items-end gap-2 justify-start"
    >
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-5 w-5" />
      </div>
      <div className="relative max-w-[80%] rounded-2xl rounded-bl-none bg-white border border-gray-100 px-5 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <motion.div
            className="h-2 w-2 rounded-full bg-gray-400"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="h-2 w-2 rounded-full bg-gray-400"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="h-2 w-2 rounded-full bg-gray-400"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

