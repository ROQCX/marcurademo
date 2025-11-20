"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { MessageList, type Message } from "./message-list"
import { ProductPills } from "./product-pills"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { chatAction, type ChatMessage } from "@/app/actions/chat"
import { MarcuraLogo } from "@/components/logo"

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { 
      id: `user-${Date.now()}`,
      role: "user", 
      content: input.trim() 
    }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    try {
      // Convert to ChatMessage format for Server Action
      const chatMessages: ChatMessage[] = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const assistantId = `assistant-${Date.now()}`
      let assistantMessage = ""
      let hasReceivedContent = false
      
      // Add empty assistant message first
      setMessages([...newMessages, { 
        id: assistantId,
        role: "assistant", 
        content: "" 
      }])

      // Get ReadableStream from Server Action (automatically secured)
      const stream = await chatAction(chatMessages)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode chunk and add to buffer (handles partial messages)
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines from buffer
        const lines = buffer.split("\n")
        // Keep incomplete line in buffer
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim() === "") continue
          
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim()
              if (jsonStr === "") continue
              
              const data = JSON.parse(jsonStr)
              
              if (data.content) {
                hasReceivedContent = true
                
                assistantMessage += data.content
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  if (updated[lastIndex] && updated[lastIndex].role === "assistant") {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      id: updated[lastIndex].id || assistantId,
                      content: assistantMessage,
                    }
                  }
                  return updated
                })
              }
              
              if (data.done) {
                setIsLoading(false)
                return
              }
              
              if (data.error) {
                throw new Error(data.error)
              }
            } catch (e) {
              // Skip invalid JSON - might be partial
              console.warn("Failed to parse SSE line:", line, e)
            }
          }
        }
      }
      
      // Process any remaining buffer
      if (buffer.trim()) {
        const line = buffer.trim()
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6).trim())
            if (data.content) {
              hasReceivedContent = true
              assistantMessage += data.content
              setMessages((prev) => {
                const updated = [...prev]
                const lastIndex = updated.length - 1
                if (updated[lastIndex] && updated[lastIndex].role === "assistant") {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    id: updated[lastIndex].id || assistantId,
                    content: assistantMessage,
                  }
                }
                return updated
              })
            }
          } catch (e) {
            console.warn("Failed to parse final buffer:", e)
          }
        }
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again.",
        },
      ])
      setIsLoading(false)
    }
  }

  const handleProductSelect = (productName: string) => {
    const question = `Tell me about ${productName}`
    setInput(question)
    // Optional: Auto-send when clicking a pill
    // handleSend()
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="relative flex h-[700px] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl border-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <MarcuraLogo className="h-8 w-auto" />
          <div>
            <h1 className="text-base font-semibold text-[#212529]">Marcura Assistant</h1>
            <p className="text-xs text-[#6C757D]">Powered by AI Ecosystem</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-[#6C757D]">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden bg-white">
        <MessageList 
          messages={messages} 
          isStreaming={isLoading}
        />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-100 bg-white p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && <ProductPills onSelect={handleProductSelect} />}

          <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 focus-within:border-[#143232] focus-within:ring-2 focus-within:ring-[#143232]/10 transition-all">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1 border-0 bg-transparent px-4 py-2 text-base shadow-none focus-visible:ring-0 text-[#495057] placeholder:text-[#6C757D]"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className={cn(
                "h-10 w-10 rounded-lg transition-all",
                input.trim()
                  ? "bg-[#143232] text-white hover:bg-[#143232]/90 shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              )}
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[#6C757D]">
              AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
