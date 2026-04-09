
"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2, Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { focusStrategist } from '@/ai/flows/personalized-focus-advice'
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase'
import { doc } from 'firebase/firestore'

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantPanel({ isOpen, onOpenChange }: AIAssistantPanelProps) {
  const { user } = useUser()
  const db = useFirestore()
  
  const profileRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user])
  const { data: profile } = useDoc(profileRef)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const resetChat = () => {
    setMessages([])
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const handleSend = async (customMsg?: string) => {
    const userMsg = customMsg || input.trim()
    if (!userMsg || loading) return

    if (!customMsg) setInput('')
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const result = await focusStrategist({ message: userMsg })
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: result.reply
      }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "Strategist Offline. Re-engage when ready." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 bg-background border-zinc-200 dark:border-zinc-800 flex flex-col h-full shadow-2xl pb-20 md:pb-0">
        <SheetHeader className="p-8 border-b border-zinc-100 dark:border-zinc-800 shrink-0 flex flex-row items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white">Focus Strategist</SheetTitle>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mt-1">Tactical Study Protocol</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-12 w-12 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-colors" onClick={resetChat} title="Clear Chat">
            <Trash2 className="w-6 h-6" />
          </Button>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-8 py-10">
            <div className="space-y-10 pb-10">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full opacity-30 py-20 text-center space-y-4">
                  <Brain className="w-16 h-16 text-primary" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Strategist Standby</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mt-1">Ask me anything about your studies</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="animate-in slide-in-from-bottom-3 duration-500">
                  <div className={msg.role === 'user' ? 'chatbot-message-user' : 'chatbot-message-ai'}>
                    <p className="text-[18px] leading-relaxed font-bold tracking-tight whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="chatbot-message-ai flex items-center gap-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[14px] font-black uppercase tracking-[0.3em] text-zinc-400">Strategist Thinking...</span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950/50 backdrop-blur-md pb-24 md:pb-8">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-4"
            >
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask focus hurdle..."
                className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-16 text-[16px] font-bold focus:ring-primary px-8 shadow-inner"
                disabled={loading}
              />
              <Button type="submit" size="icon" className="rounded-2xl h-16 w-16 shrink-0 bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform" disabled={loading || !input.trim()}>
                <Send className="w-6 h-6" />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
