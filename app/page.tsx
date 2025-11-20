import { ChatInterface } from "@/components/chat/chat-interface";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-24 overflow-hidden">
      {/* Base background */}
      <div className="absolute inset-0 bg-[#143232]" />
      
      {/* Circular spotlight elements */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 200px at 15% 25%, rgba(20, 184, 166, 0.25) 0%, transparent 100%),
            radial-gradient(circle 180px at 85% 75%, rgba(14, 165, 233, 0.2) 0%, transparent 100%),
            radial-gradient(circle 150px at 50% 50%, rgba(20, 184, 166, 0.15) 0%, transparent 100%),
            radial-gradient(circle 160px at 5% 85%, rgba(20, 184, 166, 0.18) 0%, transparent 100%),
            radial-gradient(circle 170px at 95% 15%, rgba(14, 165, 233, 0.15) 0%, transparent 100%)
          `
        }}
      />
      
      {/* Blur overlay for depth */}
      <div className="absolute inset-0 backdrop-blur-[100px] opacity-15" />
      
      <div className="relative z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <ChatInterface />
      </div>
    </main>
  )
}
